#!/usr/bin/env bash
# Tell the site a sync happened: it drops its cached job lists, and the cached pages of the jobs the sync
# added, changed or removed, and reloads them from the database.
#
#   ./refresh.sh                          # production
#   ./refresh.sh http://localhost:3000    # any other deployment
#   ./refresh.sh --all [url]              # also drop every job page (after editing jobs outside the pipeline)
#
# The jobs come from the pipeline's last_sync.json, written by sync_to_db.py (set LAST_SYNC_FILE to read
# another file). Once production has it, it's renamed to last_sync.sent.json, so the next sync knows these
# were sent; a sync that finds it unsent adds its jobs to the next one. Without the file, only the lists
# and the jobs the latest sync added are dropped.
#
# Reads REVALIDATE_SECRET from the environment, or from .env.local next to this script.
set -euo pipefail

all=false
if [[ "${1:-}" == "--all" ]]; then
  all=true
  shift
fi
production_url="https://onlyhiring.hassandev.me"
base_url="${1:-$production_url}"
last_sync_file="${LAST_SYNC_FILE:-$HOME/Desktop/programming/only-hiring-pipeline/last_sync.json}"

if [[ -z "${REVALIDATE_SECRET:-}" ]]; then
  env_file="$(dirname "$0")/.env.local"
  if [[ -f "$env_file" ]]; then
    REVALIDATE_SECRET="$(grep -E '^REVALIDATE_SECRET=' "$env_file" | tail -n 1 | cut -d= -f2- | tr -d '"'"'")"
  fi
fi

if [[ -z "${REVALIDATE_SECRET:-}" ]]; then
  echo "REVALIDATE_SECRET is not set and was not found in .env.local" >&2
  exit 1
fi

if [[ "$all" == true ]]; then
  body='{"all":true}'
  sending_file=false
elif [[ -f "$last_sync_file" ]]; then
  body="@$last_sync_file"
  sending_file=true
else
  echo "No $last_sync_file, so only the lists and the newest jobs will be refreshed" >&2
  body='{}'
  sending_file=false
fi

curl --fail-with-body --silent --show-error -X POST \
  -H "Authorization: Bearer ${REVALIDATE_SECRET}" \
  -H "Content-Type: application/json" \
  --data-binary "$body" \
  "${base_url%/}/api/revalidate"
echo

if [[ "$sending_file" == true && "${base_url%/}" == "$production_url" ]]; then
  mv "$last_sync_file" "${last_sync_file%.json}.sent.json"
fi
