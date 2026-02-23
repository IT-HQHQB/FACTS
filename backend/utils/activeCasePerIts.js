const { pool } = require('../config/database');

/**
 * Get all active (non-closed) cases for a given ITS number across the system.
 * Used to enforce: at most one active case per ITS (Baaseteen + SHND).
 *
 * @param {string} itsNumber - Applicant ITS number
 * @param {object} [connection] - Optional DB connection for use inside a transaction (e.g. connection.execute). If not provided, uses pool.
 * @returns {Promise<Array<{ id: number, case_number: string, status: string }>>} List of active cases, or empty array
 */
async function getActiveCasesForIts(itsNumber, connection = null) {
  if (!itsNumber || String(itsNumber).trim() === '') {
    return [];
  }
  const executor = connection ? connection.execute.bind(connection) : pool.execute.bind(pool);
  const [rows] = await executor(
    `SELECT c.id, c.case_number, c.status
     FROM cases c
     JOIN applicants a ON c.applicant_id = a.id
     WHERE a.its_number = ? AND (c.status IS NULL OR c.status <> 'closed')`,
    [String(itsNumber).trim()]
  );
  return Array.isArray(rows) ? rows : [];
}

/**
 * Check if there is at least one active case for the given ITS number.
 *
 * @param {string} itsNumber - Applicant ITS number
 * @param {object} [connection] - Optional DB connection for transactions
 * @returns {Promise<boolean>}
 */
async function hasActiveCaseForIts(itsNumber, connection = null) {
  const cases = await getActiveCasesForIts(itsNumber, connection);
  return cases.length > 0;
}

module.exports = {
  getActiveCasesForIts,
  hasActiveCaseForIts
};
