# Public rooms deployment

This release adds public Socket.IO channels, user-created rooms, favourites, auto-join, room history, 48-hour cleanup and admin room controls.

No GitHub Actions or workflow files are used.

## 1. Check out the branch

```bash
cd /var/www/chat
git fetch origin
git checkout agent/public-rooms-runtime
git pull origin agent/public-rooms-runtime
```

## 2. Environment

The existing database schema already contains the channel tables, so this release does not require a new Prisma migration.

Add or review these optional values in `backend/.env`:

```env
CHANNEL_INACTIVE_HOURS=48
CHANNEL_CLEANUP_INTERVAL_MS=3600000
CHANNEL_HISTORY_LIMIT=100
CHANNEL_MAX_AUTO_JOIN=5
CHANNEL_MAX_JOINED=8
```

`CHANNEL_INACTIVE_HOURS=48` means a non-official, non-protected community room is permanently deleted once it has no messages for 48 hours and nobody is currently connected to it.

## 3. Backend checks

```bash
cd /var/www/chat/backend
yarn install
yarn prisma generate
yarn prisma migrate deploy
yarn typecheck
yarn build
```

`prisma migrate deploy` should report no pending migration for this feature. The startup process creates or repairs the official rooms:

- `#general`
- `#polska`
- `#uk`
- `#relacje`
- `#gaming`

## 4. Frontend checks

```bash
cd /var/www/chat/frontend
yarn install
yarn build
```

## 5. Admin frontend checks

```bash
cd /var/www/chat/admin-frontend
yarn install
yarn build
```

## 6. Deploy static builds

Use the same frontend/admin deployment paths already configured for the current Chati installation. Confirm the generated frontend contains the `/pokoje` application route and that Nginx still falls back to `index.html` for client-side routes.

## 7. Restart backend

```bash
pm2 restart <chati-backend-process-name> --update-env
pm2 logs <chati-backend-process-name> --lines 100
```

Expected startup log:

```text
Backend listening on :3066
```

## 8. Smoke test

1. Open `/pokoje` as a guest, choose a nickname and join `#general`.
2. Open a second browser and confirm live presence and messages.
3. Log in with a verified account and create a room.
4. Favourite that room and enable auto-join.
5. Re-open `/pokoje` and confirm the room opens automatically.
6. Open the admin panel and confirm the room appears under **Pokoje publiczne**.
7. Change slow mode or guest access and verify the setting applies.

## Rollback

The feature does not alter the Prisma schema. To roll back, check out the previous commit, rebuild all three applications and restart the backend. Existing channel rows can remain in PostgreSQL safely while the older application is running.
