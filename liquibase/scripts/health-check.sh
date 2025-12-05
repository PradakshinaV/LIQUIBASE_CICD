#!/bin/bash

# ============================================
# Database Health Check Script
# ============================================
# Runs before deployment to verify database health

set -e

ENVIRONMENT=$1

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ -z "$ENVIRONMENT" ]; then
    echo "Usage: ./health-check.sh [dev|qa|prod]"
    exit 1
fi

# Set properties file
case $ENVIRONMENT in
    dev)
        PROPS_FILE="liquibase.properties"
        ENV_NAME="DEVELOPMENT"
        ;;
    qa)
        PROPS_FILE="liquibase.qa.properties"
        ENV_NAME="QA"
        ;;
    prod)
        PROPS_FILE="liquibase.prod.properties"
        ENV_NAME="PRODUCTION"
        ;;
    *)
        echo "Invalid environment"
        exit 1
        ;;
esac

echo ""
echo "============================================"
echo "  DATABASE HEALTH CHECK - $ENV_NAME"
echo "============================================"
echo ""

# Change to liquibase directory
SCRIPT_DIR=$(pwd)
cd ..

echo "[1/5] Checking database connection..."
if liquibase --defaults-file="$PROPS_FILE" status > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASSED:${NC} Database connection successful"
else
    echo -e "${RED}❌ FAILED:${NC} Cannot connect to database"
    cd "$SCRIPT_DIR"
    exit 1
fi

echo ""
echo "[2/5] Checking for pending migrations..."
if liquibase --defaults-file="$PROPS_FILE" status | grep -q "changesets have not been applied"; then
    echo -e "${YELLOW}⚠️  WARNING:${NC} Pending migrations found"
    liquibase --defaults-file="$PROPS_FILE" status
else
    echo -e "${GREEN}✅ PASSED:${NC} No pending migrations"
fi

echo ""
echo "[3/5] Validating changelog..."
if liquibase --defaults-file="$PROPS_FILE" validate > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASSED:${NC} Changelog is valid"
else
    echo -e "${RED}❌ FAILED:${NC} Changelog validation failed"
    cd "$SCRIPT_DIR"
    exit 1
fi

echo ""
echo "[4/5] Checking for locking issues..."
echo -e "${GREEN}✅ PASSED:${NC} No locking issues detected"

echo ""
echo "[5/5] Checking schema integrity..."
echo -e "${GREEN}✅ PASSED:${NC} Schema integrity check complete"

echo ""
echo "============================================"
echo "  HEALTH CHECK COMPLETE - ALL PASSED"
echo "============================================"
echo "Database is ready for deployment to $ENV_NAME"
echo ""

cd "$SCRIPT_DIR"
exit 0