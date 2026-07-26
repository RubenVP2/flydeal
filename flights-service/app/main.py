"""FastAPI microservice wrapping the fast-flights Google Flights scraper.

Contract (consumed by the flydeal Next.js app):
  GET /health         -> {"status": "ok"}
  GET /api/v1/search  -> {"price", "currency", "provider", "trip", "flights_count"}

Error semantics:
  400/422  invalid params (bad IATA, bad date, round-trip without return_date,
           return_date < depart_date, infants > adults, > 9 passengers)
  404      the scraper returned no flights
  502      the scraper call itself failed (exception, timeout)
"""

import asyncio
import logging
import os
from datetime import date
from typing import Literal, Optional

import fast_flights
from fast_flights.integrations.base import FetchIntegration
from fast_flights.querying import Query
from fastapi import FastAPI, HTTPException, Query as QueryParam
from primp import Client

logger = logging.getLogger("flights-service")

app = FastAPI(title="flights-service", version="1.0.0")

PROVIDER = "fast-flights"
# Seconds to wait for the Google Flights scrape before giving up (502).
SCRAPE_TIMEOUT = 30.0

# Depuis l'Europe, Google redirige vers consent.google.com sans cookie de
# consentement (la page ne contient alors aucune donnée de vol). On injecte
# ces cookies via une FetchIntegration ; surcharge possible par variable
# d'environnement si Google fait évoluer son mécanisme.
CONSENT_COOKIES = {
    "CONSENT": os.environ.get("FLIGHTS_CONSENT_COOKIE", "PENDING+987"),
    "SOCS": os.environ.get(
        "FLIGHTS_SOCS_COOKIE",
        "CAESEwgDEgk0ODE3Nzk3MjQaAmZyIAEaBgiA_LyaBg",
    ),
}


class ConsentFetch(FetchIntegration):
    """Fetch Google Flights en contournant le mur de consentement UE."""

    def fetch_html(self, q: Query | str, /) -> str:
        client = Client(
            impersonate="chrome_145",
            impersonate_os="macos",
            referer=True,
            cookie_store=True,
        )
        params = q.params() if isinstance(q, Query) else {"q": q}
        res = client.get(
            "https://www.google.com/travel/flights",
            params=params,
            cookies=CONSENT_COOKIES,
        )
        return res.text


FETCH_INTEGRATION = ConsentFetch()

Trip = Literal["one-way", "round-trip"]
Seat = Literal["economy", "premium-economy", "business", "first"]

IATA_PATTERN = "^[A-Za-z]{3}$"


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/v1/search")
async def search(
    from_airport: str = QueryParam(..., pattern=IATA_PATTERN),
    to_airport: str = QueryParam(..., pattern=IATA_PATTERN),
    depart_date: date = QueryParam(...),
    return_date: Optional[date] = QueryParam(None),
    trip: Trip = QueryParam("one-way"),
    adults: int = QueryParam(1, ge=1, le=9),
    children: int = QueryParam(0, ge=0, le=8),
    infants: int = QueryParam(0, ge=0, le=8),
    seat: Seat = QueryParam("economy"),
    currency: str = QueryParam("EUR", min_length=3, max_length=3),
    language: str = QueryParam("fr", min_length=2, max_length=5),
) -> dict:
    if trip == "round-trip":
        if return_date is None:
            raise HTTPException(
                status_code=400,
                detail="return_date is required when trip=round-trip",
            )
        if return_date < depart_date:
            raise HTTPException(
                status_code=400,
                detail="return_date must not be before depart_date",
            )
    if infants > adults:
        raise HTTPException(
            status_code=422,
            detail="infants must be <= adults (one infant on lap per adult)",
        )
    if adults + children + infants > 9:
        raise HTTPException(
            status_code=422,
            detail="total passengers (adults + children + infants) must be <= 9",
        )

    origin = from_airport.upper()
    destination = to_airport.upper()

    flights = [
        fast_flights.FlightQuery(
            date=depart_date.isoformat(),
            from_airport=origin,
            to_airport=destination,
        )
    ]
    if trip == "round-trip":
        # Round-trip queries are two FlightQuery legs (outbound + return),
        # per the fast-flights v3 docs/README.
        flights.append(
            fast_flights.FlightQuery(
                date=return_date.isoformat(),
                from_airport=destination,
                to_airport=origin,
            )
        )

    # Map the single `infants` param to infants_on_lap: it is the common case
    # (infant travels on an adult's lap) and matches our infants <= adults
    # validation, which the library also enforces for infants_on_lap.
    passengers = fast_flights.Passengers(
        adults=adults,
        children=children,
        infants_in_seat=0,
        infants_on_lap=infants,
    )

    query = fast_flights.create_query(
        flights=flights,
        trip=trip,
        seat=seat,
        passengers=passengers,
        language=language,
        currency=currency.upper(),
    )

    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(
                fast_flights.get_flights, query, integration=FETCH_INTEGRATION
            ),
            timeout=SCRAPE_TIMEOUT,
        )
    except fast_flights.FlightsNotFound:
        raise HTTPException(status_code=404, detail="no flights found") from None
    except (asyncio.TimeoutError, TimeoutError):
        raise HTTPException(
            status_code=502, detail="flight search timed out"
        ) from None
    except HTTPException:
        raise
    except Exception:
        logger.exception("fast-flights scraper call failed")
        raise HTTPException(
            status_code=502, detail="flight search upstream failed"
        ) from None

    if not result:
        raise HTTPException(status_code=404, detail="no flights found")

    # price = cheapest option for the whole requested party/trip.
    price = float(min(f.price for f in result))

    return {
        "price": price,
        "currency": currency.upper(),
        "provider": PROVIDER,
        "trip": trip,
        "flights_count": len(result),
    }
