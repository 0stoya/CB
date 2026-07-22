# Launch hardening and operations deployment

Branch:

```text
agent/launch-hardening-operations
```

Migration:

```text
20260722063000_launch_hardening_operations
```

The migration adds e-mail delivery outcomes, content-free daily metrics and audit action values for account reactivation/session revocation. Deploy it before restarting the backend.

## 1. Check out the branch

```bash
cd /var/www/chat
git fetch origin
git checkout agent/launch-hardening-operations
git pull origin agent/launch-hardening-operations
```

## 2. Update deployment metadata

Add or update these values in `backend/.env`:

```env
APP_VERSION=1.0.0
BUILD_SHA=<current-branch-commit-sha>
```

Review the retention defaults added to `.env.example`. The defaults are suitable for initial launch unless a documented retention decision requires different values.

## 3. Backend migration and checks

```bash
cd /var/www/chat/backend
yarn install
yarn prisma generate
yarn prisma migrate deploy
yarn prisma migrate status
yarn typecheck
yarn build
```

Do not restart the old backend binary before `prisma migrate deploy` completes.

## 4. Admin frontend checks

```bash
cd /var/www/chat/admin-frontend
yarn install
yarn build
```

The public frontend is unchanged in this phase.

## 5. Restart

```bash
pm2 restart <chati-backend-process> --update-env
pm2 logs <chati-backend-process> --lines 200
```

Confirm there are no Prisma, migration, SMTP initialisation, Socket.IO or maintenance-job errors.

## 6. Health and header checks

```bash
curl -i https://chati.online/healthz
curl -i https://chati.online/readyz
curl -I https://chati.online/api/auth/me
```

Expected:

- `/healthz` returns HTTP 200 and includes version/build metadata.
- `/readyz` returns HTTP 200 with a database latency value.
- API responses include `X-Request-ID`, `X-Content-Type-Options`, `X-Frame-Options` and `Cache-Control: no-store`.
- Production responses include HSTS.

## 7. Admin user management smoke test

1. Open the admin panel from an allowed IP.
2. Search for a verified test account by nickname and e-mail.
3. Open account details and confirm sessions, activity counts and created rooms are shown.
4. Revoke all sessions and confirm the account's active browser is disconnected.
5. Suspend the account and confirm login is refused.
6. Confirm the action appears in moderation history.
7. Reactivate the account and confirm login works again.
8. Confirm a deleted account cannot be reactivated.

## 8. Operations panel smoke test

1. Confirm PostgreSQL reports `Działa` and has a reasonable latency.
2. Confirm version, build SHA, uptime, Node version and memory are populated.
3. Make several successful and invalid API requests; confirm aggregate HTTP totals update without exposing URLs or user data.
4. Run **Sprawdź SMTP** and confirm the result matches the configured provider.
5. Run **Uruchom czyszczenie** and inspect the deleted-record counts.
6. Run **Przelicz 30 dni** and confirm daily metrics appear.
7. Confirm analytics contain counts only—no message text, e-mail address, IP or browsing trail.

## 9. Account e-mail smoke test

Use disposable test accounts:

1. Request a verification e-mail.
2. Request a password-reset e-mail.
3. Confirm delivery succeeds and the admin operations screen records recent success.
4. Temporarily test invalid SMTP credentials only in a controlled environment; confirm the account endpoint reports failure and the operations screen records a failed delivery.
5. Restore valid credentials immediately.

## 10. Backup smoke test

```bash
cd /var/www/chat/backend
sudo install -d -o "$(id -un)" -g "$(id -gn)" -m 0700 /var/backups/chati-postgres
BACKUP_DIR=/var/backups/chati-postgres yarn db:backup
ls -lah /var/backups/chati-postgres
latest="$(ls -1t /var/backups/chati-postgres/*.dump | head -n 1)"
pg_restore --list "$latest" >/dev/null
sha256sum --check "${latest}.sha256"
```

Install and enable the systemd service/timer only after the manual backup passes. Templates are in `backend/ops/`.

## 11. Restore drill

Do not restore over production during deployment validation. Use a disposable database and follow `OPERATIONS_RUNBOOK.md`.

A release is not complete until at least one backup has been restored successfully into a disposable database.

## 12. Regression checks

Confirm existing flows still work:

- anonymous random chat
- account registration, verification and password reset
- public rooms, favourites, mentions and moderation
- friends and offline private messages
- notification centre and account dashboard
- admin bans, rooms, contact messages and reports

Use the full `RELEASE_QA_CHECKLIST.md` before marking the PR ready.

No GitHub Actions are added or required by this deployment.
