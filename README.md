# NextStep Cargo

NextStep Cargo is a hackathon MVP for coordinating regional cargo transport in Kazakhstan’s Mangystau Region. Its core objective is to reduce empty truck returns by connecting a completed delivery with a compatible available cargo for the return direction.

## Problem

Regional freight is fragmented: shippers and carriers struggle to find each other, routes are planned independently, and trucks frequently return empty. This increases fuel use, transport costs, and unnecessary road kilometers while providing little visibility into regional cargo flows.

## Solution

The application provides three Russian-language product views:

- **Отправитель:** creates cargo transportation requests.
- **Перевозчик:** sees available cargo, accepts an order, and updates its delivery lifecycle.
- **Диспетчер:** sees aggregated order activity, corridors, and the planning impact of accepted return-cargo matches.

The interface is mobile-first for shippers and carriers, with a desktop-oriented dispatcher dashboard. Authentication is intentionally omitted from this hackathon MVP.

For the hackathon MVP, carrier identity is represented by a persistent browser-local profile. The accepted order stores a snapshot of that carrier’s name, phone, vehicle type, and plate. This is not authentication, and phone numbers are not verified. Production deployment should replace this mechanism with Firebase Authentication and verified user ownership.

## Core MVP workflow

1. A shipper creates an order.
2. The order is stored in Firestore and appears in real time for carriers.
3. A carrier accepts it through a Firestore transaction.
4. The carrier moves the order from `accepted` to `in_transit` and then `delivered`.
5. After delivery, the carrier requests return-cargo recommendations.
6. The system ranks useful available orders and explains their estimated impact.
7. Accepting a recommendation atomically accepts the return order and persists a `routeMatches` record.
8. The dispatcher dashboard aggregates persisted match savings.

When Firebase is missing or temporarily unavailable, the UI remains usable with an intentional in-memory synthetic-data fallback. Fallback changes are not persisted.

## Return-cargo matching

For a delivered route `A → B`, the truck is assumed to be at `B` and otherwise return toward `A` empty. For an available candidate `C → D`:

```text
emptyKmBefore = distance(B, A)
repositionKm = distance(B, C)
emptyKmAfter = repositionKm + distance(D, A)
savedKm = max(0, emptyKmBefore - emptyKmAfter)
```

Candidates that save less than 10 km or less than 10% of the baseline are rejected. Direct `B → A` returns rank highest; nearby and partial returns are scored by saved distance, repositioning distance, and how close their destination moves the truck toward `A`. This is a transparent deterministic optimization heuristic, not AI or machine learning.

Current route distances come from a fixed, symmetric reference matrix for MVP planning. They are **reference/demo planning distances, not live GPS measurements or routing results**.

## Economic impact calculation

Planning assumptions are centralized in `lib/matching.ts`:

```text
Truck consumption: 28 liters / 100 km
Fuel price: 300 ₸ / liter
fuelSavedLiters = savedKm × 28 / 100
estimatedSavingsKzt = fuelSavedLiters × 300
```

Fuel and monetary savings are **estimates**, not measured telemetry or guaranteed real-world savings. Dispatcher impact totals include only return matches actually accepted and persisted in Firestore.

## AI Analyst

The deterministic optimization engine remains responsible for route matching, reference-distance comparisons, compatibility scores, and all savings calculations. The optional AI Analyst does not replace or recalculate that engine.

The browser builds a minimal structured snapshot containing route results or aggregated corridor counts and sends it to a Next.js server Route Handler. The server calls Gemini with a server-only key and asks it to explain the supplied facts in a bounded Russian response. Carrier names, phone numbers, Firestore IDs, credentials, and full documents are excluded.

- **Carrier analysis:** explains why the best calculated return route is preferable to the supplied alternatives.
- **Dispatcher analysis:** interprets aggregated directional imbalance, order counts, and persisted savings totals.
- AI output is advisory and read-only. It never writes orders, route matches, lifecycle status, profiles, or calculated savings.
- If Gemini is unavailable or not configured, every core logistics workflow continues normally.

AI analysis requires the server-side `GEMINI_API_KEY`. Never expose it through a `NEXT_PUBLIC_*` variable.

## Technology stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4 and project CSS
- Firebase Web SDK
- Cloud Firestore real-time listeners and transactions

No map provider, GPS service, paid routing API, authentication provider, payment system, or AI API is currently integrated.

## Firestore collections

### `orders`

Stores origin and destination references, cargo type, weight, price, planning distance, shipper information, comments, status, a carrier-profile snapshot (`carrierId`, name, phone, vehicle type, and plate), and lifecycle timestamps. Older demo records without the full snapshot remain supported.

Supported lifecycle:

```text
available → accepted → in_transit → delivered
```

### `routeMatches`

Stores accepted original/return order pairs, route endpoints, empty kilometers before and after, repositioning distance, saved kilometers, estimated fuel and monetary savings, match score, match type, reason, and creation timestamp.

The current client-side filtering strategy requires no custom Firestore composite indexes.

## Run locally

Requirements: a current Node.js release and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Quality checks:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Environment variables

Add the Firebase Web App configuration to `.env.local`:

```text
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
GEMINI_API_KEY=
```

`.env.local` is gitignored. Do not commit environment-specific credentials. Firebase Web configuration identifies the Firebase project but does not replace Firestore security rules.

## Demo scenario for judges

1. Open **Диспетчер** and select **Заполнить демо-данными**. Seeding uses stable IDs, creates only missing synthetic records, and never resets modified orders.
2. Open **Перевозчик** and create the lightweight local carrier profile when prompted.
3. Accept `Актау → Жанаозен` and verify that it appears in **Мои рейсы** for that profile.
4. Select **Начать рейс**, then **Завершить доставку**.
5. Select **Найти обратный груз**.
6. Review the direct `Жанаозен → Актау` recommendation and its before/after empty-distance explanation.
7. Select **Взять обратный груз**.
8. Return to **Диспетчер** and verify that the assigned carrier and saved kilometers, estimated fuel, and estimated KZT savings are visible.

Orders can also be created manually in the **Отправитель** view and appear for the carrier without a page refresh.

## Current limitations

- No Firebase Authentication or verified role ownership.
- The included/demo public Firestore access is **hackathon-only** and must be replaced with authenticated, role-based security before production.
- Distances use a small static reference matrix rather than live routing.
- Matching does not yet consider vehicle dimensions, load compatibility, pickup windows, road restrictions, or weather.
- Fuel and cost savings are planning estimates based on fixed assumptions.
- No GPS tracking, real map, notifications, chat, payments, or carrier verification.
- AI explanations depend on an external provider, are advisory, and are limited to supplied structured application data.
- Client-side aggregation is appropriate for the MVP dataset, not high-volume regional analytics.

## Future roadmap

- Firebase Authentication and role-based Firestore rules.
- Vehicle and cargo-constraint compatibility.
- Real routing and map visualization.
- Pickup-window and multi-stop optimization.
- GPS-assisted delivery status with explicit driver consent.
- Server-side aggregation, audit history, and operational monitoring.
- Kazakh localization alongside Russian.

Before public deployment, replace demo Firestore rules, introduce authenticated authorization, validate writes on a trusted backend, and complete a privacy/security review.
