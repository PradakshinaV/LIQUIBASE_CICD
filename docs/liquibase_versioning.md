# Liquibase Versioning Guide

## Overview

This guide explains how to version your database changes using Liquibase in this project.

---

## Changeset ID Naming Convention

All changesets follow this pattern:
```
[version]-[sequence]-[description]
```

**Examples:**
- `v1-1-create-users-roles`
- `002-create-department`
- `005-add-created-date`

---

## Version Structure
```
liquibase/
└── changelogs/
    ├── db.changelog-master.xml       ← Main changelog (includes all versions)
    ├── v1.0/
    │   └── db.changelog-v1.0.xml     ← Version 1.0 changesets
    └── v1.1/
        ├── 002-create-department.xml
        ├── 003-create-project.xml
        ├── 004-add-status-column.xml
        └── 005-test-failure.xml
```

---

## Creating New Changesets

### Step 1: Determine Version Number

- **Major version change** (v2.0): Breaking changes, schema redesign
- **Minor version change** (v1.2): New tables, significant features
- **Patch version** (v1.1.1): Small changes, bug fixes

### Step 2: Create Changeset File
```xml
<?xml version="1.0" encoding="UTF-8"?>
<databaseChangeLog
    xmlns="http://www.liquibase.org/xml/ns/dbchangelog"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="
       http://www.liquibase.org/xml/ns/dbchangelog
       http://www.liquibase.org/xml/ns/dbchangelog/dbchangelog-4.23.xsd">

    <changeSet id="006-add-user-preferences" author="your-name">
        <!-- Your changes here -->
        <rollback>
            <!-- Rollback logic here -->
        </rollback>
    </changeSet>

</databaseChangeLog>
```

### Step 3: Include in Master Changelog

Edit `db.changelog-master.xml`:
```xml
<include file="v1.1/006-add-user-preferences.xml" relativeToChangelogFile="true"/>
```

---

## Tagging Versions

Tag your database versions for easy rollback:
```bash
# After successful deployment to PROD
liquibase --defaults-file=liquibase.prod.properties tag v1.1.0
```

**Rollback to a tag:**
```bash
liquibase --defaults-file=liquibase.prod.properties rollback v1.1.0
```

---

## Version History

Track your versions in this table:

| Version | Date | Description | Changesets |
|---------|------|-------------|------------|
| v1.0 | 2025-11-27 | Initial schema | 6 changesets (users, roles, indexes) |
| v1.1 | 2025-11-29 | Department & project tables | 5 changesets (department, project, status, timestamps) |

---

**Maintained By:** Database DevOps Team