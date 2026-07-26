# FlyDeal

Analyse quotidienne des prix de vols : deal score, vérifications aux moments stratégiques, tactiques de contournement du yield management. Next.js + SQLite, Docker/Dokploy ready.

## Provider de prix

Deux sources de prix, sélectionnées automatiquement au démarrage :

| Provider | Activation | Description |
|---|---|---|
| **FlightAPI.io** | `FLY_API_KEY` définie | Prix réels multi-vendeurs (700+ compagnies/OTA) via l'API Oneway Trip. |
| **Simulation** | (défaut) | Prix déterministes réalistes — aucune clé requise, idéal pour le dev. |

### Migration Amadeus → FlightAPI.io

L'API Amadeus for Developers ayant été décommissionnée, FlyDeal utilise désormais **[FlightAPI.io](https://www.flightapi.io/)**. Les anciennes variables `AMADEUS_CLIENT_ID` / `AMADEUS_CLIENT_SECRET` sont supprimées et remplacées par une seule clé :

```bash
FLY_API_KEY=votre_cle_flightapi
```

Sur Dokploy, la variable est déjà configurée dans les env vars du service — aucune autre action n'est requise, un redéploiement suffit.

### API utilisée

```
GET https://api.flightapi.io/onewaytrip/{FLY_API_KEY}/{origine}/{destination}/{YYYY-MM-DD}/1/0/0/Economy/EUR
```

Réponse : `itineraries[].pricing_options[].price.amount` — FlyDeal retient le **prix le plus bas** (€ TTC aller simple, 1 adulte, Economy).
Codes d'erreur gérés : `404`/`410` (aucune offre), `429` (quota dépassé — ralentir la cadence ou upgrader le plan).
Doc officielle : https://docs.flightapi.io/flight-price-api/oneway-trip-api

## Tests

```bash
npm install
npm test
```

La suite (`lib/price-engine.test.ts`, Vitest lancé via npx — aucune dépendance ajoutée au lockfile) couvre : déterminisme et rampe yield du simulateur, construction d'URL FlightAPI.io, extraction du prix minimal depuis une réponse réelle, et gestion des erreurs (clé absente, 404/410/429, réponse vide). Les appels HTTP sont mockés — aucune clé ni quota nécessaire.

## Déploiement (Dokploy)

```bash
docker compose up -d --build
```

Variables d'environnement : voir `.env.example`. Le port 3000 est exposé en interne (routage via le proxy Dokploy/Traefik).
