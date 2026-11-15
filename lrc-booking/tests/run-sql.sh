#!/usr/bin/env bash
# Apply the schema to a throwaway database and run the acceptance script.
set -euo pipefail
cd "$(dirname "$0")/.."
DB=manhal_acceptance
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "drop database if exists ${DB};" >/dev/null
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "create database ${DB};" >/dev/null
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/bootstrap.sql >/dev/null
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" -f supabase/schema.sql >/dev/null
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" -f supabase/rls.sql >/dev/null
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" -f supabase/seed.sql >/dev/null
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/acceptance.sql
