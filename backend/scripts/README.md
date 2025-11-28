# Database Migration Scripts

This directory contains scripts for running database migrations.

## Welfare Checklist Migration

To create the `welfare_checklist_case_summary` table for storing overall remarks:

```bash
npm run migrate:welfare-checklist
```

Or directly:

```bash
node backend/scripts/runWelfareChecklistMigration.js
```

## Generic Migration Script

To run any SQL migration file:

```bash
npm run migrate <path-to-sql-file>
```

Or directly:

```bash
node backend/scripts/runMigration.js <path-to-sql-file>
```

### Example

```bash
node backend/scripts/runMigration.js database/migrations/add_overall_remarks_to_welfare_checklist.sql
```

## Notes

- All migrations run within a transaction, so they will be rolled back if any error occurs
- The scripts use the database connection from `backend/config/database.js`
- Make sure your `.env` file has the correct database credentials


















