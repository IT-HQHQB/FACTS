const { pool } = require('../backend/config/database');

async function main() {
  const [rows] = await pool.query("SHOW COLUMNS FROM cases LIKE 'status'");
  console.log(rows);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

