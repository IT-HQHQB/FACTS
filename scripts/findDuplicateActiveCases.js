/**
 * Find ITS numbers with multiple active (non-closed) cases and flag redundant cases as duplicate.
 * Run from project root: node scripts/findDuplicateActiveCases.js
 * Or from scripts/: node findDuplicateActiveCases.js
 * Requires migration add_is_duplicate_to_cases.sql to be applied first.
 */
const path = require('path');
// Rely on backend config to load .env (avoids needing dotenv in scripts/ when run from scripts/)
const backendConfigPath = path.join(__dirname, '..', 'backend', 'config', 'database');
const { pool } = require(backendConfigPath);

async function main() {
  // Ensure is_duplicate column exists
  const [colRows] = await pool.execute(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cases' AND COLUMN_NAME = 'is_duplicate'
  `);
  if (colRows.length === 0) {
    console.error('Column cases.is_duplicate not found. Run migration: database/migrations/add_is_duplicate_to_cases.sql');
    process.exit(1);
  }

  // Find ITS numbers with more than one non-closed case
  const [duplicateItsRows] = await pool.execute(`
    SELECT a.its_number, COUNT(*) as active_count
    FROM cases c
    JOIN applicants a ON c.applicant_id = a.id
    WHERE (c.status IS NULL OR c.status <> 'closed')
    GROUP BY a.its_number
    HAVING COUNT(*) > 1
  `);

  if (duplicateItsRows.length === 0) {
    console.log('No ITS numbers with multiple active cases found.');
    process.exit(0);
  }

  console.log(`Found ${duplicateItsRows.length} ITS number(s) with multiple active cases.\n`);

  const report = [];
  for (const row of duplicateItsRows) {
    const itsNumber = row.its_number;
    const [cases] = await pool.execute(
      `SELECT c.id, c.case_number, c.status, c.created_at
       FROM cases c
       JOIN applicants a ON c.applicant_id = a.id
       WHERE a.its_number = ? AND (c.status IS NULL OR c.status <> 'closed')
       ORDER BY c.created_at DESC`,
      [itsNumber]
    );

    // Keep the most recent case as primary (do not flag); flag the rest as duplicate
    const primary = cases[0];
    const toFlag = cases.slice(1);
    const caseIdsToFlag = toFlag.map((c) => c.id);

    if (caseIdsToFlag.length > 0) {
      const placeholders = caseIdsToFlag.map(() => '?').join(',');
      await pool.execute(
        `UPDATE cases SET is_duplicate = 1 WHERE id IN (${placeholders})`,
        caseIdsToFlag
      );
    }

    report.push({
      its_number: itsNumber,
      primary_case: primary.case_number,
      primary_case_id: primary.id,
      flagged: toFlag.map((c) => ({ case_number: c.case_number, id: c.id, created_at: c.created_at }))
    });

    console.log(`ITS ${itsNumber}: primary ${primary.case_number} (id ${primary.id}); flagged as duplicate: ${toFlag.map((c) => c.case_number).join(', ')}`);
  }

  console.log('\nSummary:');
  console.log(JSON.stringify(report, null, 2));
  console.log('\nDone. Flagged cases can be reviewed in the Cases list with filter is_duplicate=1, then closed or deleted manually.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
