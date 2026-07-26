# flights-service

FastAPI microservice wrapping the open-source [`fast-flights`](https://github.com/AWeirdDev/flights)
Google Flights scraper, exposing a small HTTP API for the flydeal Next.js app.

## Endpoints

### `GET /health`

Liveness probe — never touches the scraper.

```json
{"status": "ok"}
```

### `GET /api/v1/search`

Query params:

| Param          | Required | Default    | Notes                                                        |
| -------------- | -------- | ---------- | ------------------------------------------------------------ |
| `from_airport` | yes      | —          | 3-letter IATA, case-insensitive                              |
| `to_airport`   | yes      | —          | 3-letter IATA, case-insensitive                              |
| `depart_date`  | yes      | —          | `YYYY-MM-DD`                                                 |
| `return_date`  | no       | —          | `YYYY-MM-DD`; **required** when `trip=round-trip`            |
| `trip`         | no       | `one-way`  | `one-way` \| `round-trip`                                    |
| `adults`       | no       | `1`        | int 1–9                                                      |
| `children`     | no       | `0`        | int 0–8                                                      |
| `infants`      | no       | `0`        | int 0–8, must be `<= adults`; mapped to infants **on lap**   |
| `seat`         | no       | `economy`  | `economy` \| `premium-economy` \| `business` \| `first`      |
| `currency`     | no       | `EUR`      | 3-letter code, forwarded to Google Flights                   |
| `language`     | no       | `fr`       | forwarded to Google Flights                                  |

Success `200`:

```json
{
  "price": 120.0,
  "currency": "EUR",
  "provider": "fast-flights",
  "trip": "one-way",
  "flights_count": 3,
  "details": {
    "airlines": ["Air France"],
    "type": "best",
    "stops": 0,
    "total_duration_min": 105,
    "legs": [
      {
        "from_code": "CDG",
        "from_name": "Paris Charles de Gaulle",
        "to_code": "BCN",
        "to_name": "Barcelona-El Prat",
        "departure": "2026-03-01T10:35",
        "arrival": "2026-03-01T12:20",
        "duration_min": 105,
        "plane_type": "Airbus A320"
      }
    ],
    "carbon": { "emission_g": 92500, "typical_g": 110000 }
  }
}
```

`price` is the cheapest returned fare for the whole requested party/trip.
`details` describes that same cheapest offer — everything Google Flights
exposes via fast-flights v3: airlines, per-leg airports (codes + full names),
local departure/arrival times, per-leg duration and aircraft type, stops
count (`legs - 1`), total flight time, and carbon emissions vs the route
average. Leg times are **local to each airport** (`YYYY-MM-DDTHH:MM`, no
timezone). Note: fast-flights v3 does not extract flight numbers.

Errors:

- `400` / `422` — invalid params (bad IATA, bad date, round-trip without
  `return_date`, `return_date < depart_date`, `infants > adults`,
  more than 9 total passengers, …)
- `404 {"detail": "..."}` — scraper returned no flights
- `502 {"detail": "..."}` — scraper call failed or timed out (30 s)

Example:

```sh
curl "http://localhost:8000/api/v1/search?from_airport=CDG&to_airport=JFK&depart_date=2026-03-01&trip=round-trip&return_date=2026-03-10&adults=2"
```

## Run locally

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Tests

The scraper (`fast_flights.get_flights`) is mocked — no network calls.

```sh
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m pytest tests/ -v
```

## Docker

```sh
docker build -t flights-service .
docker run --rm -p 8000:8000 flights-service
```

## Notes

- `infants` is mapped to `Passengers(infants_on_lap=...)` (the common case:
  infant on an adult's lap), which is why `infants <= adults` is enforced.
- Round-trips are sent to `fast-flights` as two `FlightQuery` legs
  (outbound + return) with `trip="round-trip"`.
- From Europe, Google redirects to `consent.google.com` unless consent cookies
  are sent. The service injects `CONSENT`/`SOCS` cookies through a custom
  `FetchIntegration` (`app/main.py`). Override them if Google changes its
  consent flow via the `FLIGHTS_CONSENT_COOKIE` / `FLIGHTS_SOCS_COOKIE`
  environment variables.
