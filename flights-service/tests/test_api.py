"""Tests for the flights-service API.

fast_flights.get_flights is always monkeypatched — no real network calls.
"""

import fast_flights
import pytest
from fastapi.testclient import TestClient
from fast_flights.model import CarbonEmission, Flights
from fast_flights.parser import ResultList
from fast_flights.pb.flights_pb2 import Passenger

from app.main import app

client = TestClient(app)


def make_result(*prices: int) -> ResultList:
    """Build a fast_flights ResultList with one Flights entry per price."""
    result = ResultList()
    for p in prices:
        result.append(
            Flights(
                type="one-way",
                price=p,
                airlines=["AF"],
                flights=[],
                carbon=CarbonEmission(typical_on_route=0, emission=0),
            )
        )
    return result


@pytest.fixture
def mock_get_flights(monkeypatch):
    """Patch fast_flights.get_flights; returns a recorder for the received query."""
    calls = []

    def fake(query, /, **kwargs):
        calls.append({"query": query, "kwargs": kwargs})
        return make_result(250, 120, 380)

    monkeypatch.setattr(fast_flights, "get_flights", fake)
    return calls


# ---------- health ----------


def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


# ---------- happy paths ----------


def test_one_way_happy_path_min_price(mock_get_flights):
    resp = client.get(
        "/api/v1/search",
        params={
            "from_airport": "cdg",  # case-insensitive
            "to_airport": "JFK",
            "depart_date": "2026-03-01",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body == {
        "price": 120.0,  # min of 250, 120, 380
        "currency": "EUR",
        "provider": "fast-flights",
        "trip": "one-way",
        "flights_count": 3,
    }
    assert isinstance(body["price"], float)


def test_round_trip_builds_two_legs(mock_get_flights):
    resp = client.get(
        "/api/v1/search",
        params={
            "from_airport": "CDG",
            "to_airport": "JFK",
            "depart_date": "2026-03-01",
            "return_date": "2026-03-10",
            "trip": "round-trip",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["trip"] == "round-trip"

    query = mock_get_flights[0]["query"]
    assert query.get_trip_type() == "round-trip"
    assert len(query.flight_data) == 2
    outbound, inbound = query.flight_data
    assert outbound.date == "2026-03-01"
    assert outbound.from_airport.airport == "CDG"
    assert outbound.to_airport.airport == "JFK"
    assert inbound.date == "2026-03-10"
    assert inbound.from_airport.airport == "JFK"
    assert inbound.to_airport.airport == "CDG"


def test_params_forwarded_to_library(mock_get_flights):
    resp = client.get(
        "/api/v1/search",
        params={
            "from_airport": "ory",
            "to_airport": "nrt",
            "depart_date": "2026-04-05",
            "adults": 2,
            "children": 1,
            "infants": 1,
            "seat": "business",
            "currency": "usd",
            "language": "en",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["currency"] == "USD"

    query = mock_get_flights[0]["query"]
    assert query.get_trip_type() == "one-way"
    assert query.get_seat_type() == "business"
    assert query.language == "en"
    assert query.currency == "USD"
    assert query.flight_data[0].from_airport.airport == "ORY"
    assert query.flight_data[0].to_airport.airport == "NRT"
    # 2 adults + 1 child + 1 infant-on-lap = 4 Passenger enum entries
    assert list(query.passengers) == [
        Passenger.ADULT,
        Passenger.ADULT,
        Passenger.CHILD,
        Passenger.INFANT_ON_LAP,
    ]


def test_consent_integration_is_passed(mock_get_flights):
    """Le scraper doit recevoir la FetchIntegration (contournement du mur de
    consentement Google UE) — régression critique si ce kwarg disparaît."""
    from app.main import FETCH_INTEGRATION

    resp = client.get(
        "/api/v1/search",
        params={
            "from_airport": "LYS",
            "to_airport": "NCE",
            "depart_date": "2026-09-10",
        },
    )
    assert resp.status_code == 200
    assert mock_get_flights[0]["kwargs"].get("integration") is FETCH_INTEGRATION


# ---------- validation errors (400/422) ----------


@pytest.mark.parametrize(
    "params",
    [
        # IATA codes: wrong length / non-alpha
        {"from_airport": "CD", "to_airport": "JFK", "depart_date": "2026-03-01"},
        {"from_airport": "CDGX", "to_airport": "JFK", "depart_date": "2026-03-01"},
        {"from_airport": "C1G", "to_airport": "JFK", "depart_date": "2026-03-01"},
        {"from_airport": "CDG", "to_airport": "JF", "depart_date": "2026-03-01"},
        # bad date format
        {"from_airport": "CDG", "to_airport": "JFK", "depart_date": "01-03-2026"},
        {"from_airport": "CDG", "to_airport": "JFK", "depart_date": "2026-13-01"},
        # adults / children / infants out of range
        {
            "from_airport": "CDG",
            "to_airport": "JFK",
            "depart_date": "2026-03-01",
            "adults": 0,
        },
        {
            "from_airport": "CDG",
            "to_airport": "JFK",
            "depart_date": "2026-03-01",
            "adults": 10,
        },
        {
            "from_airport": "CDG",
            "to_airport": "JFK",
            "depart_date": "2026-03-01",
            "children": 9,
        },
        # bad enum values
        {
            "from_airport": "CDG",
            "to_airport": "JFK",
            "depart_date": "2026-03-01",
            "trip": "multi-city",
        },
        {
            "from_airport": "CDG",
            "to_airport": "JFK",
            "depart_date": "2026-03-01",
            "seat": "cargo",
        },
    ],
)
def test_invalid_params_422(params, mock_get_flights):
    resp = client.get("/api/v1/search", params=params)
    assert resp.status_code == 422
    assert mock_get_flights == []  # scraper never called


def test_missing_required_params_422():
    resp = client.get("/api/v1/search", params={"from_airport": "CDG"})
    assert resp.status_code == 422


def test_round_trip_without_return_date_400():
    resp = client.get(
        "/api/v1/search",
        params={
            "from_airport": "CDG",
            "to_airport": "JFK",
            "depart_date": "2026-03-01",
            "trip": "round-trip",
        },
    )
    assert resp.status_code == 400
    assert "return_date" in resp.json()["detail"]


def test_return_before_depart_400():
    resp = client.get(
        "/api/v1/search",
        params={
            "from_airport": "CDG",
            "to_airport": "JFK",
            "depart_date": "2026-03-10",
            "return_date": "2026-03-01",
            "trip": "round-trip",
        },
    )
    assert resp.status_code == 400


def test_infants_greater_than_adults_422():
    resp = client.get(
        "/api/v1/search",
        params={
            "from_airport": "CDG",
            "to_airport": "JFK",
            "depart_date": "2026-03-01",
            "adults": 1,
            "infants": 2,
        },
    )
    assert resp.status_code == 422
    assert "infants" in resp.json()["detail"]


def test_more_than_nine_passengers_422():
    resp = client.get(
        "/api/v1/search",
        params={
            "from_airport": "CDG",
            "to_airport": "JFK",
            "depart_date": "2026-03-01",
            "adults": 5,
            "children": 5,
        },
    )
    assert resp.status_code == 422


# ---------- scraper outcomes ----------


def test_no_flights_returns_404(monkeypatch):
    monkeypatch.setattr(fast_flights, "get_flights", lambda q, /, **kw: ResultList())
    resp = client.get(
        "/api/v1/search",
        params={"from_airport": "CDG", "to_airport": "JFK", "depart_date": "2026-03-01"},
    )
    assert resp.status_code == 404
    assert "detail" in resp.json()


def test_flights_not_found_exception_returns_404(monkeypatch):
    def raise_not_found(q, /, **kw):
        raise fast_flights.FlightsNotFound("no flights found; received error")

    monkeypatch.setattr(fast_flights, "get_flights", raise_not_found)
    resp = client.get(
        "/api/v1/search",
        params={"from_airport": "CDG", "to_airport": "JFK", "depart_date": "2026-03-01"},
    )
    assert resp.status_code == 404
    assert "detail" in resp.json()


def test_scraper_exception_returns_502(monkeypatch):
    def boom(q, /, **kw):
        raise RuntimeError("connection reset by peer")

    monkeypatch.setattr(fast_flights, "get_flights", boom)
    resp = client.get(
        "/api/v1/search",
        params={"from_airport": "CDG", "to_airport": "JFK", "depart_date": "2026-03-01"},
    )
    assert resp.status_code == 502
    body = resp.json()
    assert "detail" in body
    # no stack trace / internals leaked
    assert "connection reset by peer" not in body["detail"]
