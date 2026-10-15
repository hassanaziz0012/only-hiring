#!/usr/bin/env bash
# Force the site to drop its cached job list and reload it from the database.
#
#   ./refresh.sh                          # production
#   ./refresh.sh http://localhost:3000    # any other deployment
#
# Reads REVALIDATE_SECRET from the environment, or from .env.local next to this script.
set -euo pipefail

base_url="${1:-https://onlyhiring.hassandev.me}"

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

curl --fail-with-body --silent --show-error -X POST \
  -H "Authorization: Bearer ${REVALIDATE_SECRET}" \
  "${base_url%/}/api/revalidate"
echo
