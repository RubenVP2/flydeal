# FlyDeal

Analyse quotidienne des prix de vols : deal score, vérifications aux moments stratégiques, tactiques de contournement du yield management. Next.js + SQLite, Docker/Dokploy ready.

## Provider de prix

Deux sources de prix, sélectionnées automatiquement au démarrage :

| Provider | Activation | Description |
|---|---|---|
| **flights-service** (fast-flights) | `FAST_FLIGHTS_URL` définie | Prix réels via le microservice Python auto-hébergé (scraping Google Flights). |
| **Simulation** | (défaut) | Prix déterministes réalistes — aucun service requis, idéal pour le dev. |

### Migration FlightAPI.io → flights-service

FlyDeal n'utilise plus FlightAPI.io : la variable `FLY_API_KEY` est supprimée et remplacée par l'URL du microservice auto-hébergé :

```bash
FAST_FLIGHTS_URL=http://localhost:8000
```

### API utilisée

```
GET {FAST_FLIGHTS_URL}/api/v1/search?from_airport=CDG&to_airport=JFK&depart_date=2026-09-10
    &return_date=2026-09-24&trip=round-trip&adults=2&children=1&infants=0
    &seat=economy&currency=EUR&language=fr
```

Réponse : `{ "price": 412.5, "currency": "EUR", "provider": "fast-flights", ... }` — `price` est le **prix total le plus bas** (€ TTC) pour tout le groupe et le trajet.
`return_date` est omis pour un aller simple, requis pour un aller-retour.
Codes d'erreur gérés : `404` (aucune offre), autres 4xx (paramètres invalides), `502` (échec du scraper).

## Options de recherche

Chaque surveillance peut préciser :

- **Type de trajet** : aller simple ou aller-retour (date de retour obligatoire, ≥ date de départ) ;
- **Passagers** : adultes (1-9), enfants (0-8), bébés (0-8, ≤ nombre d'adultes) ;
- **Cabine** : Économie, Premium Éco, Affaires, Première.

Ces options sont propagées au provider à chaque vérification (scheduler et « vérifier maintenant »), et la flexibilité ±N jours s'applique conjointement à l'aller et au retour. En mode simulation, elles modulent le prix de base : aller-retour ×1.85, cabine ×1 à ×3.2, enfants ×0.75, bébés ×0.1.

## Tests

```bash
npm install
npm test              # tests unitaires (Vitest)
npm run test:coverage # avec couverture (seuils : 85 % lignes/fonctions/branches/instructions)
npm run test:e2e      # tests fonctionnels de bout en bout
```

La suite unitaire couvre le moteur de prix (simulation déterministe, multiplicateurs d'options, provider fast-flights avec fetch mocké), la couche SQLite (CRUD + migration de schéma), le scheduler (fenêtres J-60/J-21/J-14/J-7, propagation des options) et les routes API.

Les tests e2e (`tests/e2e/run-e2e.mjs`, Node pur) démarrent un stub flights-service et un `next dev` sur ports éphémères, puis vérifient tout le cycle : création de surveillances (aller simple / aller-retour), validation 400, vérification immédiate avec propagation des options au stub, modification, suppression et page d'accueil.

## Déploiement (Dokploy)

```bash
docker compose up -d --build
```

Variables d'environnement : voir `.env.example`. Le port 3000 est exposé en interne (routage via le proxy Dokploy/Traefik).
