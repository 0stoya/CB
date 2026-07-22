# Chati production operations runbook

This runbook covers health monitoring, database backups, restore drills, retention jobs, SMTP visibility and common incident checks. It does not require GitHub Actions.

## Health endpoints

The backend exposes:

```text
GET /healthz
GET /readyz
```

- `/healthz` confirms that the Node process is alive. It does not query PostgreSQL.
- `/readyz` performs a bounded PostgreSQL readiness query and returns HTTP `503` when the database is not ready.

Suggested external checks:

```bash
curl --fail --silent --show-error https://chati.online/healthz
curl --fail --silent --show-error https://chati.online/readyz
```

Monitor `/readyz` every 1–5 minutes. Alert after at least two consecutive failures to avoid noise during a controlled restart.

## Request IDs and API headers

Every HTTP response includes `X-Request-ID`. Unexpected backend errors log the same ID, HTTP method and path. Ask a user reporting an error to copy the request ID when it is visible in the API response.

The backend also applies:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- strict referrer and permissions policies
- API `Cache-Control: no-store`
- HSTS in production
- a restrictive API content-security policy

Nginx may keep its existing security headers. Duplicate identical headers should be avoided where possible.

## Admin operations screen

The admin panel displays:

- PostgreSQL readiness and latency
- application version, build SHA, Node version and uptime
- process memory
- active/suspended/deleted account totals
- open reports and active sessions
- SMTP configuration and transport verification state
- the latest retention-job result
- 30 days of content-free daily aggregates
- lifetime and recent HTTP error/latency counters when available

The SMTP check uses Nodemailer's transport verification and does not send a message.

## Automated maintenance

The backend runs maintenance on startup and then at `MAINTENANCE_INTERVAL_MS`.

It removes only:

- expired or old revoked session records
- expired or old used verification/reset tokens
- old **read** notifications
- old email delivery outcome logs
- daily metric rows beyond their retention window

It does not remove unread notifications, chat messages, reports or moderation history.

Default retention values are documented in `.env.example`. The job can also be run manually from the admin operations panel.

## Daily analytics

`DailyMetric` contains counts only. It stores no message text, URL history, raw IP, e-mail address, browser identity or user-level event trail.

The rollup includes:

- registrations and verifications
- distinct users with session activity
- public/private message counts
- rooms and reports created
- notifications created
- successful and failed account e-mails

The admin can rebuild up to 90 days from existing database timestamps.

## Database backups

The backup command uses PostgreSQL custom format, verifies the archive with `pg_restore --list`, writes atomically and creates a SHA-256 checksum.

```bash
cd /var/www/chat/backend
set -a
source .env
set +a
BACKUP_DIR=/var/backups/chati-postgres yarn db:backup
```

The script removes the Prisma-only `schema=public` query parameter while preserving valid PostgreSQL connection options.

### Install the systemd timer

Create the service account and backup directory according to the server's existing ownership model. The example assumes the application runs as `chati`:

```bash
sudo install -d -o chati -g chati -m 0700 /var/backups/chati-postgres
sudo cp ops/chati-backup.service.example /etc/systemd/system/chati-backup.service
sudo cp ops/chati-backup.timer.example /etc/systemd/system/chati-backup.timer
sudo systemctl daemon-reload
sudo systemctl enable --now chati-backup.timer
sudo systemctl list-timers chati-backup.timer
```

Run and inspect the first backup:

```bash
sudo systemctl start chati-backup.service
sudo systemctl status chati-backup.service
sudo journalctl -u chati-backup.service -n 100 --no-pager
sudo ls -lah /var/backups/chati-postgres
```

Store at least one encrypted off-server copy. A backup located only on the application server is not sufficient disaster recovery.

## Restore drill

Perform restore drills against a disposable PostgreSQL database, never production.

1. Create an empty test database and a temporary `DATABASE_URL` targeting it.
2. Stop any application process connected to that test database.
3. Run:

```bash
cd /var/www/chat/backend
DATABASE_URL='postgresql://.../chati_restore_test?schema=public' \
CONFIRM_RESTORE=YES \
yarn db:restore /var/backups/chati-postgres/chati-example.dump
```

4. Verify:

```bash
yarn prisma migrate status
psql 'postgresql://.../chati_restore_test' -c 'SELECT COUNT(*) FROM "User";'
```

5. Start a temporary backend against the restored database and run account, room, friend and admin smoke tests.
6. Record the date, backup filename, restore duration and result.

For a real production restore:

- place the site in maintenance mode
- stop backend processes
- take a final backup where possible
- verify the selected archive and checksum
- restore with explicit `CONFIRM_RESTORE=YES`
- run `prisma migrate status`
- start the backend and verify `/readyz`
- complete smoke tests before reopening traffic

## SMTP incident checks

1. Open the admin operations panel and run **Sprawdź SMTP**.
2. Confirm host, port, TLS mode and credentials in `.env`.
3. Review recent backend logs for `Verification email failed` or delivery errors.
4. Check provider dashboards for authentication, quota, suppression and domain verification issues.
5. Do not paste full recipient addresses or credentials into incident tickets.

Delivery logs store only an HMAC hash of the recipient address, outcome, provider message ID and a shortened error message.

## Common incident commands

```bash
pm2 status
pm2 logs <chati-backend-process> --lines 200
curl -i https://chati.online/healthz
curl -i https://chati.online/readyz
cd /var/www/chat/backend
yarn prisma migrate status
sudo systemctl status postgresql
sudo journalctl -u postgresql -n 100 --no-pager
```

## Release metadata

Set these values during deployment:

```env
APP_VERSION=1.0.0
BUILD_SHA=<deployed-git-commit>
```

They appear in `/healthz`, logs and the admin operations panel.
