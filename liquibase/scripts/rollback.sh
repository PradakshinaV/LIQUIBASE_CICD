#!/bin/bash

# ============================================
# Manual Rollback Script for Linux/Mac
# ============================================
# Usage: ./rollback.sh [dev|qa|prod] [count]
# Example: ./rollback.sh dev 1
# ============================================

set -e  # Exit on error

ENVIRONMENT=$1
ROLLBACK_COUNT=${2:-1}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if environment is provided
if [ -z "$ENVIRONMENT" ]; then
    echo ""
    echo -e "${RED}ERROR: Environment not specified!${NC}"
    echo ""
    echo "Usage: ./rollback.sh [dev|qa|prod] [count]"
    echo ""
    echo "Examples:"
    echo "  ./rollback.sh dev 1        - Rollback last changeset in DEV"
    echo "  ./rollback.sh qa 2         - Rollback last 2 changesets in QA"
    echo "  ./rollback.sh prod 1       - Rollback last changeset in PROD"
    echo ""
    exit 1
fi

# Set properties file based on environment
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
        echo ""
        echo -e "${RED}ERROR: Invalid environment '$ENVIRONMENT'${NC}"
        echo "Valid options: dev, qa, prod"
        echo ""
        exit 1
        ;;
esac

# Save current directory
SCRIPT_DIR=$(pwd)

# Change to liquibase directory (parent of scripts)
cd ..

# Check if properties file exists
if [ ! -f "$PROPS_FILE" ]; then
    echo ""
    echo -e "${RED}ERROR: Properties file not found: $PROPS_FILE${NC}"
    echo "Please ensure you're running this script from the scripts folder."
    echo ""
    cd "$SCRIPT_DIR"
    exit 1
fi

echo ""
echo "============================================"
echo "     DATABASE ROLLBACK WARNING"
echo "============================================"
echo "Environment: $ENV_NAME"
echo "Changesets to rollback: $ROLLBACK_COUNT"
echo "Properties file: $PROPS_FILE"
echo ""
echo "This will UNDO the last $ROLLBACK_COUNT database change(s)."
echo ""

# Extra confirmation for PRODUCTION
if [ "$ENVIRONMENT" = "prod" ]; then
    echo -e "${RED}*** PRODUCTION ENVIRONMENT ***${NC}"
    echo ""
    read -p "Type 'ROLLBACK' to confirm (case-sensitive): " CONFIRM1
    if [ "$CONFIRM1" != "ROLLBACK" ]; then
        echo ""
        echo "Rollback cancelled."
        cd "$SCRIPT_DIR"
        exit 0
    fi
fi

read -p "Are you sure you want to continue? (Y/N): " CONFIRM
if [[ ! $CONFIRM =~ ^[Yy]$ ]]; then
    echo ""
    echo "Rollback cancelled."
    cd "$SCRIPT_DIR"
    exit 0
fi

echo ""
echo "============================================"
echo "Starting rollback..."
echo "============================================"
echo ""

# Show current status before rollback
echo "Current database status:"
liquibase --defaults-file="$PROPS_FILE" status
echo ""

# Perform rollback
echo "Rolling back $ROLLBACK_COUNT changeset(s)..."
if liquibase --defaults-file="$PROPS_FILE" rollback-count "$ROLLBACK_COUNT"; then
    echo ""
    echo -e "${GREEN}============================================${NC}"
    echo -e "${GREEN}SUCCESS: Rollback completed successfully!${NC}"
    echo -e "${GREEN}============================================${NC}"
    echo ""
    echo "New database status:"
    liquibase --defaults-file="$PROPS_FILE" status
    echo ""
else
    echo ""
    echo -e "${RED}============================================${NC}"
    echo -e "${RED}ERROR: Rollback failed!${NC}"
    echo -e "${RED}============================================${NC}"
    echo "Check the error messages above."
    echo ""
    cd "$SCRIPT_DIR"
    exit 1
fi

# Return to script directory
cd "$SCRIPT_DIR"

exit 0