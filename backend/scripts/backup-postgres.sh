#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

: "${DATABASE_URL:?DATABASE_URL is required}"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/chati-postgres}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
HOSTNAME_SAFE="$(hostname | tr -cd 'A-Za-z0-9._-' | cut -c1-40)"
FINAL_FILE="${BACKUP_DIR}/chati-${HOSTNAME_SAFE}-${TIMESTAMP}.dump"
TEMP_FILE="${FINAL_FILE}.partial"

for command in pg_dump pg_restore sha256sum python3; do
  command -v "$command" >/dev/null 2>&1 || { echo "Missing required command: $command" >&2; exit 1; }
done

PG_URL="$({ DATABASE_URL="$DATABASE_URL" python3 - <<'PY'
import os
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
url = urlsplit(os.environ["DATABASE_URL"])
query = [(k, v) for k, v in parse_qsl(url.query, keep_blank_values=True) if k != "schema"]
print(urlunsplit((url.scheme, url.netloc, url.path, urlencode(query), url.fragment)))
PY
} )"

mkdir -p "$BACKUP_DIR"
trap 'rm -f "$TEMP_FILE"' EXIT

pg_dump \
  --format=custom \
  --compress=6 \
  --no-owner \
  --no-acl \
  --file="$TEMP_FILE" \
  "$PG_URL"

pg_restore --list "$TEMP_FILE" >/dev/null
mv "$TEMP_FILE" "$FINAL_FILE"
sha256sum "$FINAL_FILE" > "${FINAL_FILE}.sha256"

find "$BACKUP_DIR" -type f \( -name 'chati-*.dump' -o -name 'chati-*.dump.sha256' \) -mtime "+${BACKUP_RETENTION_DAYS}" -delete

printf 'Backup created: %s\n' "$FINAL_FILE"
printf 'Checksum: %s\n' "${FINAL_FILE}.sha256"
