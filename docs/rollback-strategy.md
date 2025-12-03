# Database Rollback Strategy

## Overview

This document describes the rollback strategy for database migrations in the Database DevOps project.

---

## Table of Contents

1. [Automatic Rollback (CI/CD)](#automatic-rollback-cicd)
2. [Manual Rollback](#manual-rollback)
3. [Backup Strategy](#backup-strategy)
4. [Emergency Rollback Procedure](#emergency-rollback-procedure)
5. [Testing Rollback](#testing-rollback)
6. [Troubleshooting](#troubleshooting)

---

## Automatic Rollback (CI/CD)

The GitHub Actions pipeline automatically handles failed deployments:

### How It Works

1. **Pre-Deployment Backup**: Before any deployment, a full database backup is created
2. **Deployment Attempt**: Liquibase attempts to apply changesets
3. **Failure Detection**: If deployment fails, pipeline detects the error
4. **Automatic Rollback**: Pipeline executes `rollback-count 1` to undo the failed changeset
5. **Notification**: Pipeline logs show rollback success/failure

### Pipeline Behavior
```yaml
- name: Deploy to [ENV] Database
  id: deploy_[env]
  run: liquibase update
  continue-on-error: true

- name: Rollback on Failure
  if: failure() && steps.deploy_[env].outcome == 'failure'
  run: liquibase rollback-count 1
```

### What Gets Rolled Back

- **DEV**: Last 1 changeset (immediate rollback)
- **QA**: Last 1 changeset (immediate rollback)
- **PROD**: Last 1 changeset (immediate rollback with notification)

---

## Manual Rollback

### Using Rollback Scripts

#### Windows
```batch
cd liquibase\scripts
.\rollback.bat [dev|qa|prod] [count]
```

**Examples:**
```batch
# Rollback last changeset in DEV
.\rollback.bat dev 1

# Rollback last 2 changesets in QA
.\rollback.bat qa 2

# Rollback last 3 changesets in PROD (requires double confirmation)
.\rollback.bat prod 3
```

#### Linux/Mac
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

---

### Using Liquibase Commands Directly

#### Rollback by Count
```bash
cd liquibase

# Rollback last changeset
liquibase --defaults-file=liquibase.properties rollback-count 1

# Rollback last 3 changesets
liquibase --defaults-file=liquibase.properties rollback-count 3
```

#### Rollback to Specific Date
```bash
# Rollback to November 29, 2025
liquibase --defaults-file=liquibase.properties rollback-to-date 2025-11-29
```

#### Rollback to Specific Tag
```bash
# First, tag your current version
liquibase --defaults-file=liquibase.properties tag v1.0

# Later, rollback to that tag
liquibase --defaults-file=liquibase.properties rollback v1.0
```

---

## Backup Strategy

### Backup Schedule

| Environment | When | Retention | Storage Location |
|-------------|------|-----------|------------------|
| **DEV** | Before each deployment | 30 days | GitHub Actions Artifacts |
| **QA** | Before each deployment | 30 days | GitHub Actions Artifacts |
| **PROD** | Before each deployment | 90 days | GitHub Actions Artifacts |

### Backup Format

Backups are created using `mysqldump`:
```bash
mysqldump -h localhost -u username -p database_name > backup_YYYYMMDD_HHMMSS.sql
```

### Accessing Backups

1. Go to your GitHub repository
2. Click **Actions** tab
3. Click on the workflow run
4. Scroll down to **Artifacts** section
5. Download the backup file (e.g., `dev-backup`, `qa-backup`, `prod-backup`)

### Restoring from Backup
```bash
# Download backup from GitHub Actions artifacts
# Then restore:

mysql -h localhost -u username -p database_name < backup_file.sql
```

---

## Emergency Rollback Procedure

Follow this procedure for critical production issues:

### Step 1: Assess the Situation

- [ ] Identify which changeset caused the issue
- [ ] Determine impact scope (which tables/data affected)
- [ ] Check if automatic rollback already occurred

### Step 2: Stop Application Traffic (if needed)
```bash
# If using application server
systemctl stop application_service

# Or redirect traffic away from database
```

### Step 3: Execute Rollback
```bash
cd C:\database-devops-project\liquibase\scripts

# For PRODUCTION (requires typing 'ROLLBACK')
.\rollback.bat prod 1
```

### Step 4: Verify Database State
```sql
USE testdb_prod;

-- Check current applied changesets
SELECT * FROM DATABASECHANGELOG 
ORDER BY DATEEXECUTED DESC 
LIMIT 10;

-- Verify table structures
SHOW TABLES;
DESCRIBE [affected_table];
```

### Step 5: Test Database Connectivity
```bash
cd C:\database-devops-project\liquibase

# Test connection
liquibase --defaults-file=liquibase.prod.properties status
```

### Step 6: Restore Application Traffic
```bash
# Restart application
systemctl start application_service
```

### Step 7: Document the Incident

Create an incident report including:
- Date and time of incident
- Changeset that failed
- Rollback actions taken
- Root cause analysis
- Prevention measures

---

## Testing Rollback

### Test Automatic Rollback in Pipeline

To test that automatic rollback works:

1. **Edit** `liquibase/changelogs/v1.1/005-test-failure.xml`
2. **Uncomment** the intentional failure changeset:
```xml
<changeSet id="005-intentional-failure" author="admin">
    <addColumn tableName="non_existent_table">
        <column name="test_column" type="VARCHAR(50)"/>
    </addColumn>
</changeSet>
```

3. **Commit and push** to GitHub:
```bash
git add liquibase/changelogs/v1.1/005-test-failure.xml
git commit -m "Test: Add intentional failure to test rollback"
git push origin main
```

4. **Watch the pipeline**:
   - Go to GitHub → Actions
   - Watch deployment fail
   - Watch automatic rollback execute
   - Verify database returns to previous state

5. **Clean up** - Comment out the failure changeset:
```bash
git add liquibase/changelogs/v1.1/005-test-failure.xml
git commit -m "Revert test failure changeset"
git push origin main
```

---

### Test Manual Rollback Locally
```bash
cd C:\database-devops-project\liquibase

# Apply a changeset
liquibase --defaults-file=liquibase.properties update

# Check status
liquibase --defaults-file=liquibase.properties status

# Rollback last changeset
liquibase --defaults-file=liquibase.properties rollback-count 1

# Verify rollback
liquibase --defaults-file=liquibase.properties status

# Re-apply changeset
liquibase --defaults-file=liquibase.properties update
```

---

## Troubleshooting

### Issue: Rollback Fails

**Error:** `No inverse of X could be found`

**Solution:** Ensure all changesets have `<rollback>` tags defined:
```xml
<changeSet id="example" author="admin">
    <createTable tableName="example">
        <!-- columns -->
    </createTable>
    <rollback>
        <dropTable tableName="example"/>
    </rollback>
</changeSet>
```

---

### Issue: Cannot Connect to Database

**Error:** `Connection refused` or `Access denied`

**Solution:**

1. Verify database is running:
```bash
mysql -u cicd_user -p testdb_dev
```

2. Check credentials in properties file:
```bash
type liquibase\liquibase.properties
```

3. Test connection:
```bash
liquibase --defaults-file=liquibase.properties status
```

---

### Issue: Backup Not Found in GitHub Artifacts

**Problem:** Need to restore but backup not available

**Solution:**

1. Check retention period (artifacts expire after 30-90 days)
2. If expired, use local database backups
3. If no backup available, use Liquibase to regenerate schema from changesets:
```bash
# Create fresh database
mysql -u root -p -e "CREATE DATABASE testdb_restored;"

# Apply all changesets from beginning
liquibase --url=jdbc:mysql://localhost:3306/testdb_restored --username=cicd_user --password=SecurePass123! --changeLogFile=liquibase/changelogs/db.changelog-master.xml update
```

---

### Issue: Rollback Script Permission Denied (Linux/Mac)

**Error:** `Permission denied: ./rollback.sh`

**Solution:**
```bash
chmod +x liquibase/scripts/rollback.sh
```

---

### Issue: Wrong Number of Changesets Rolled Back

**Problem:** Rolled back too many or too few changesets

**Solution:**

1. Check current state:
```bash
liquibase --defaults-file=liquibase.properties status
```

2. If too many rolled back, re-apply:
```bash
liquibase --defaults-file=liquibase.properties update
```

3. If too few rolled back, rollback more:
```bash
liquibase --defaults-file=liquibase.properties rollback-count [additional_count]
```

---

## Rollback Best Practices

### ✅ DO

- ✅ Always test rollback locally before deploying
- ✅ Write `<rollback>` tags for every changeset
- ✅ Create backups before production deployments
- ✅ Document all manual rollback actions
- ✅ Test rollback procedures regularly
- ✅ Keep rollback scripts version-controlled

### ❌ DON'T

- ❌ Skip writing rollback tags
- ❌ Rollback production without backup
- ❌ Rollback without understanding impact
- ❌ Edit DATABASECHANGELOG table manually
- ❌ Assume automatic rollback always works
- ❌ Delete backup files prematurely

---

## Rollback Checklist

Before executing a rollback:

- [ ] Identify the changeset to rollback
- [ ] Verify backup exists
- [ ] Check current database state
- [ ] Notify team members
- [ ] Stop application traffic (if critical)
- [ ] Execute rollback
- [ ] Verify database state
- [ ] Test database connectivity
- [ ] Restore application traffic
- [ ] Document the action

---

## Contact & Support

For issues with rollback procedures:

1. Check this documentation
2. Review GitHub Actions logs
3. Check Liquibase documentation: https://docs.liquibase.com/commands/rollback/home.html
4. Contact database team

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-03 | Initial rollback strategy documentation |
---
**Last Updated:** December 3, 2025  
**Maintained By:** DevOps Team