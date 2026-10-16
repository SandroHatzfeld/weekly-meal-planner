# Weekly Meal Planner

Gerichte planen, Rezepte sammeln und gemeinsam einkaufen – mit Live-Updates für alle Mitglieder eines Plans.
Rewrite von BringPlanner v2 (PHP/MySQL) mit Next.js, Prisma/PostgreSQL, Auth.js und Socket.io.

## Lokale Entwicklung

```bash
# Postgres-Dev-Instanz
docker run --name bringplanner-dev-db -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=bringplanner_dev -p 5432:5432 -d postgres:17-alpine

cp .env.example .env        # DATABASE_URL + AUTH_SECRET (npx auth secret) eintragen
npm install
npx prisma migrate deploy   # bzw. `npx prisma migrate dev` bei Schema-Änderungen
npm run dev                 # startet server.js (Next.js + Socket.io) auf :3000
```

Ohne `RESEND_API_KEY` werden E-Mails (Verifizierung, Einladungen) nur in die Konsole geloggt – der Link kann von dort kopiert werden.

## Architektur

- `server.js` – Custom Server: Next.js und Socket.io teilen sich den HTTP-Server. Die Socket.io-Instanz liegt auf `globalThis.__wmpIO` und wird über `src/lib/realtime.ts` aus Server Actions/Route Handlern angesprochen.
- **Socket-Auth:** Der Client holt sich bei jedem (Re-)Connect ein kurzlebiges, HMAC-signiertes Ticket von `/api/socket/ticket` (Membership-Check gegen die DB). `server.js` prüft nur die Signatur.
- **Rooms:** `plan:{id}` (alle Änderungs-Events), `dish:{id}` (Presence beim Bearbeiten), `user:{id}` (Force-Disconnect beim Entfernen/Verlassen).
- **Konflikt-Schutz:** Dishes per Optimistic Lock über `updatedAt`, Grocery-Toggles ohne Lock (letzter Stand gewinnt).
- **Auth:** Credentials + JWT. Der `jwt`-Callback prüft bei jedem Request die Mitgliedschaften und liest `activePlanId` (Fallback: ältester Plan).

## Externe API (Home Assistant & Co.)

API-Token unter *Einstellungen → API-Tokens* erstellen, dann mit `Authorization: Bearer <token>`:

| Methode | Pfad | Body |
|---|---|---|
| GET | `/api/external/plans` | |
| GET | `/api/external/plans/:planId/lists` | |
| GET | `/api/external/lists/:listId/grocery-items` | |
| POST | `/api/external/lists/:listId/grocery-items` | `{ "name": "Milch", "details": "2 L" }` |
| PATCH | `/api/external/lists/:listId/grocery-items/:itemId` | `{ "checked": true }` |

## Deployment

```bash
cp .env.example .env   # Werte setzen, APP_PORT auf einen freien Host-Port (sudo ss -tlnp)
docker compose run --rm app npx prisma migrate deploy
docker compose up -d --build
```

Nginx braucht die WebSocket-Upgrade-Header, sonst fällt Socket.io auf Polling zurück:

```nginx
location / {
    proxy_pass http://localhost:3010;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 10m; # Bild-Uploads (nginx-Standard ist 1 MB)
}
```

Hochgeladene und per URL übernommene Bilder liegen im Docker-Volume `uploads` (`/app/data/uploads`) und werden über `/api/images/…` nur an eingeloggte Nutzer ausgeliefert.
