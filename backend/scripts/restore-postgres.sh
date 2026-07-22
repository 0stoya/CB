#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${1:?Usage: CONFIRM_RESTORE=YES $0 /path/to/backup.dump}"

BACKUP_FILE="$1"
CONFIRM_RESTORE="${CONFIRM_RESTORE:-NO}"
RESTORE_NO_CLEAN="${RESTORE_NO_CLEAN:-0}"

if [[ "$CONFIRM_RESTORE" != "YES" ]]; then
  echo "Restore refused. Set CONFIRM_RESTORE=YES after confirming the target database and maintenance window." >&2
  exit 2
fi

[[ -f "$BACKUP_FILE" ]] || { echo "Backup file not found: $BACKUP_FILE" >&2; exit 1; }

for command in pg_restore sha256sum python3; do
  command -v "$command" >/dev/null 2>&1 || { echo "Missing required command: $command" >&2; exit 1; }
done

if [[ -f "${BACKUP_FILE}.sha256" ]]; then
  (cd "$(dirname "$BACKUP_FILE")" && sha256sum --check "$(basename "${BACKUP_FILE}.sha256")")
else
  echo "Warning: checksum file is missing; continuing because CONFIRM_RESTORE=YES was supplied." >&2
fi

pg_restore --list "$BACKUP_FILE" >/dev/null

PG_URL="$({ DATABASE_URL="$DATABASE_URL" python3 - <<'PY'
import os
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
url = urlsplit(os.environ["DATABASE_URL"])
query = [(k, v) for k, v in parse_qsl(url.query, keep_blank_values=True) if k != "schema"]
print(urlunsplit((url.scheme, url.netloc, url.path, urlencode(query), url.fragment)))
PY
} )"

restore_args=(--exit-on-error --no-owner --no-acl --dbname="$PG_URL")
if [[ "$RESTORE_NO_CLEAN" != "1" ]]; then
  restore_args+=(--clean --if-exists)
fi

echo "Restoring $BACKUP_FILE into the configured DATABASE_URL target."
echo "The application should be stopped before this command is run."
pg_restore "${restore_args[@]}" "$BACKUP_FILE"
echo "Restore completed successfully. Run Prisma migration status and application smoke tests before reopening traffic."
