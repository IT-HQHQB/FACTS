/**
 * Run a SQL migration file using the backend's database config.
 * Usage (from backend folder): node scripts/run-migration.js <migration-name>
 * Example: node scripts/run-migration.js allow_null_email_on_users
 * Migration file is read from: database/migrations/<migration-name>.sql
 */
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

const migrationName = process.argv[2];
if (!migrationName) {
  console.error('Usage: node scripts/run-migration.js <migration-name>');
  console.error('Example: node scripts/run-migration.js allow_null_email_on_users');
  process.exit(1);
}

const migrationFile = migrationName.endsWith('.sql') ? migrationName : `${migrationName}.sql`;
const migrationPath = path.join(__dirname, '..', '..', 'database', 'migrations', migrationFile);

if (!fs.existsSync(migrationPath)) {
  console.error('Migration file not found:', migrationPath);
  process.exit(1);
}

const sql = fs.readFileSync(migrationPath, 'utf8');

const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

async function run() {
  const connection = await pool.getConnection();
  try {
    console.log('Running migration:', migrationFile);
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      console.log('Executing statement', i + 1, '...');
      await connection.execute(statement);
      console.log('OK');
    }
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    connection.release();
  }
}

run();
