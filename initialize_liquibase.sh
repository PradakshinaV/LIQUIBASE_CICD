#!/bin/bash
# Initialize Liquibase for QA and PROD databases
# This script creates the DATABASECHANGELOG table by running Liquibase update

LIQUIBASE_PATH="${LIQUIBASE_PATH:-liquibase}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIQUIBASE_DIR="$SCRIPT_DIR/liquibase"

if ! command -v "$LIQUIBASE_PATH" &> /dev/null; then
    echo "Error: Liquibase not found. Please install Liquibase or set LIQUIBASE_PATH."
    exit 1
fi

echo ""
echo "=== Initializing Liquibase for QA and PROD databases ==="
echo ""

# Initialize QA database
echo "Initializing QA database..."
cd "$LIQUIBASE_DIR" || exit 1
if "$LIQUIBASE_PATH" --defaults-file=liquibase.qa.properties update; then
    echo "✓ QA database initialized successfully"
else
    echo "✗ Failed to initialize QA database"
fi

echo ""

# Initialize PROD database
echo "Initializing PROD database..."
if "$LIQUIBASE_PATH" --defaults-file=liquibase.prod.properties update; then
    echo "✓ PROD database initialized successfully"
else
    echo "✗ Failed to initialize PROD database"
fi

echo ""
echo "=== Initialization Complete ==="
echo "The DATABASECHANGELOG table should now exist in both QA and PROD databases."


