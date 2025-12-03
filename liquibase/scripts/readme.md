# Manual Rollback Scripts

These scripts allow you to manually rollback database changes in case of emergencies.

## Usage

### Windows
```batch
cd liquibase\scripts
rollback.bat [dev|qa|prod] [count]
```

**Examples:**
```batch
# Rollback last changeset in DEV
rollback.bat dev 1

# Rollback last 2 changesets in QA
rollback.bat qa 2

# Rollback last changeset in PROD (requires double confirmation)
rollback.bat prod 1
```

### Linux/Mac
```bash
cd liquibase/scripts
./rollback.sh [dev|qa|prod] [count]
```

**Examples:**
```bash
# Rollback last changeset in DEV
./rollback.sh dev 1

# Rollback last 2 changesets in QA
./rollback.sh qa 2

# Rollback last changeset in PROD (requires double confirmation)
./rollback.sh prod 1
```

## Safety Features

- ✅ **Environment validation**: Prevents typos
- ✅ **Properties file check**: Ensures configuration exists
- ✅ **Current status display**: Shows what will be rolled back
- ✅ **Confirmation prompts**: Requires user confirmation
- ✅ **Extra PROD protection**: Double confirmation for production
- ✅ **Post-rollback status**: Shows result after rollback
- ✅ **Error handling**: Clear error messages

## When to Use

Use these scripts when:

1. **Automated rollback fails** in CI/CD pipeline
2. **Emergency hotfix** needed immediately
3. **Testing rollback** functionality locally
4. **Manual intervention** required outside CI/CD

## Important Notes

⚠️ **Always backup before rollback!**

⚠️ **Production rollbacks** require typing 'ROLLBACK' exactly

⚠️ **Run from scripts folder** for proper path resolution

## Rollback Process

1. Script validates environment
2. Shows current database status
3. Asks for confirmation
4. Executes rollback
5. Shows new database status
6. Reports success/failure

## Troubleshooting

**Script not found:**
- Ensure you're in the `liquibase/scripts` folder

**Properties file not found:**
- Check that properties files exist in `liquibase/` folder

**Permission denied (Linux/Mac):**
```bash
chmod +x rollback.sh
```

**Rollback fails:**
- Check that changesets have rollback tags defined
- Verify database connection in properties file