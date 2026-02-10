const { pool } = require('../backend/config/database');

async function main() {
  const conn = await pool.getConnection();
  try {
    await conn.query('START TRANSACTION');

    const [cases] = await conn.query('SELECT id, status FROM cases ORDER BY id ASC LIMIT 1');
    if (!cases.length) {
      console.log('No cases found; nothing to test.');
      await conn.query('ROLLBACK');
      return;
    }

    const { id, status } = cases[0];
    console.log('Using case:', { id, status_before: status });

    // This value previously caused ENUM truncation if not present in the enum list.
    const testStatus = 'submitted_to_executive';
    await conn.query('UPDATE cases SET status = ? WHERE id = ?', [testStatus, id]);

    const [after] = await conn.query('SELECT status FROM cases WHERE id = ?', [id]);
    console.log('Status updated inside transaction:', after[0]);

    await conn.query('ROLLBACK');
    console.log('Rolled back transaction (no data changes persisted).');
  } finally {
    conn.release();
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

