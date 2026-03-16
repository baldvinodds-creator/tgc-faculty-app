#!/bin/bash
# Run the CSV import script against Railway's database.
#
# Option A — If Railway CLI is linked:
#   railway run npx tsx scripts/import-csv.ts ../faculty-applications.csv
#
# Option B — With explicit DATABASE_URL:
#   DATABASE_URL="postgresql://..." npx tsx scripts/import-csv.ts ../faculty-applications.csv
#
# Option C — This script (paste your DATABASE_URL below):

if [ -z "$DATABASE_URL" ]; then
  echo ""
  echo "  Usage:"
  echo "    DATABASE_URL=\"postgresql://...\" bash scripts/run-import.sh"
  echo ""
  echo "  Or via Railway CLI:"
  echo "    railway run npx tsx scripts/import-csv.ts ../faculty-applications.csv"
  echo ""
  exit 1
fi

echo "Starting CSV import..."
npx tsx scripts/import-csv.ts ../faculty-applications.csv
