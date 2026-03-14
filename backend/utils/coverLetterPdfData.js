/**
 * Build flat data object for the Cover Letter PDF template from database rows.
 *
 * Usage:
 *   const buildCoverLetterPdfData = require('../utils/coverLetterPdfData');
 *   const data = await buildCoverLetterPdfData(pool, caseId, { userName: 'John Doe' });
 *   const html = renderCoverLetterTemplate(data);
 *
 * The returned object has the EXACT property names expected by
 * backend/templates/coverLetterPdfTemplate.js (see its header comment).
 */

const path = require('path');
const fs = require('fs');

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Parse a value as float; return null on failure. */
function toFloat(v) {
  if (v == null || v === '') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

/** Parse a value as int; return null on failure. */
function toInt(v) {
  if (v == null || v === '') return null;
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}

/** Return a trimmed string or null. */
function toStr(v) {
  if (v == null || v === '') return null;
  return String(v).trim() || null;
}

/** Format a date column value to YYYY-MM-DD string; handles Date objects and ISO strings. */
function toDateStr(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    return v.toISOString().split('T')[0];
  }
  const s = String(v);
  if (s.includes('T')) return s.split('T')[0];
  return s;
}

/**
 * Ensure a photo value is a valid base64 data URL.
 * Photos in the DB are stored as base64 LONGTEXT (data:image/... or raw base64).
 * If the value is a file path, attempt to read and convert to base64 data URL.
 */
function ensurePhotoDataUrl(photoValue, uploadsBase) {
  if (!photoValue || typeof photoValue !== 'string') return null;

  // Already a data URL
  if (photoValue.startsWith('data:image/')) return photoValue;

  // Raw base64 string (no data: prefix) -- add the prefix
  if (/^[A-Za-z0-9+/=]{20,}$/.test(photoValue.substring(0, 100))) {
    return `data:image/jpeg;base64,${photoValue}`;
  }

  // Could be a file path -- try reading from disk
  if (uploadsBase) {
    const fullPath = photoValue.startsWith('/')
      ? path.join(uploadsBase, photoValue)
      : path.join(uploadsBase, photoValue);

    if (fs.existsSync(fullPath)) {
      try {
        const buf = fs.readFileSync(fullPath);
        const ext = path.extname(fullPath).toLowerCase();
        const mime = ext === '.png' ? 'image/png'
          : ext === '.gif' ? 'image/gif'
          : ext === '.webp' ? 'image/webp'
          : 'image/jpeg';
        return `data:${mime};base64,${buf.toString('base64')}`;
      } catch (e) {
        // Unable to read file -- fall through
      }
    }
  }

  return null;
}

/**
 * Ensure a signature value is a valid base64 data URL.
 * Signatures may be stored as drawing data (base64 data URL) or file paths.
 */
function ensureSignatureDataUrl(sigValue, uploadsBase) {
  // Reuse the same logic as photos
  return ensurePhotoDataUrl(sigValue, uploadsBase);
}

/* ------------------------------------------------------------------ */
/*  Data-fetching helpers (mirror coverLetterForms.js helper pattern)  */
/* ------------------------------------------------------------------ */

/** Fetch applicant details for a case. */
async function fetchApplicantData(pool, caseId) {
  try {
    const [rows] = await pool.execute(`
      SELECT
        a.full_name,
        a.age,
        a.phone,
        a.its_number,
        a.photo,
        a.jamiat_name,
        a.jamaat_name,
        c.case_number
      FROM cases c
      JOIN applicants a ON c.applicant_id = a.id
      WHERE c.id = ?
    `, [caseId]);

    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      name: r.full_name || '',
      age: r.age || null,
      contact_number: r.phone || '',
      its: r.its_number || '',
      case_id: r.case_number || '',
      photo: r.photo || null,
      jamiat: r.jamiat_name || '',
      jamaat: r.jamaat_name || ''
    };
  } catch (e) {
    console.error('coverLetterPdfData: Error fetching applicant data:', e);
    return null;
  }
}

/** Fetch counsellor/counselor details for a case. */
async function fetchCounsellorData(pool, caseId) {
  try {
    const [rows] = await pool.execute(`
      SELECT
        u.full_name,
        u.phone,
        u.email,
        u.photo,
        u.its_number,
        u.jamiat_ids,
        u.jamaat_ids
      FROM cases c
      LEFT JOIN users u ON c.assigned_counselor_id = u.id
      WHERE c.id = ?
    `, [caseId]);

    if (rows.length === 0 || !rows[0].full_name) return null;
    const r = rows[0];

    let jamiatName = '';
    let jamaatName = '';

    // Resolve first jamiat name
    if (r.jamiat_ids) {
      const ids = r.jamiat_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (ids.length > 0) {
        try {
          const [jRows] = await pool.execute(
            'SELECT name FROM jamiat WHERE id = ? AND is_active = 1 LIMIT 1',
            [ids[0]]
          );
          if (jRows.length > 0) jamiatName = jRows[0].name || '';
        } catch (_) { /* ignore */ }
      }
    }

    // Resolve first jamaat name
    if (r.jamaat_ids) {
      const ids = r.jamaat_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (ids.length > 0) {
        try {
          const [jRows] = await pool.execute(
            'SELECT name FROM jamaat WHERE id = ? AND is_active = 1 LIMIT 1',
            [ids[0]]
          );
          if (jRows.length > 0) jamaatName = jRows[0].name || '';
        } catch (_) { /* ignore */ }
      }
    }

    return {
      name: r.full_name || '',
      contact_number: r.phone || r.email || '',
      its: r.its_number || '',
      photo: r.photo || null,
      jamiat: jamiatName,
      jamaat: jamaatName
    };
  } catch (e) {
    console.error('coverLetterPdfData: Error fetching counsellor data:', e);
    return null;
  }
}

/** Fetch family financial data (personal/family income, earning members, dependents). */
async function fetchFamilyFinancialData(pool, caseId) {
  const defaults = {
    current_personal_income: null,
    current_family_income: null,
    earning_family_members: null,
    dependents: null
  };
  try {
    const [cf] = await pool.execute(
      'SELECT family_details_id FROM counseling_forms WHERE case_id = ?',
      [caseId]
    );
    if (cf.length === 0 || !cf[0].family_details_id) return defaults;
    const fdId = cf[0].family_details_id;

    const [rows] = await pool.execute(`
      SELECT
        (SELECT annual_income FROM family_members fm
         JOIN relations r ON fm.relation_id = r.id
         WHERE fm.family_details_id = ? AND LOWER(r.name) = 'self'
         LIMIT 1) as personal_income,
        COALESCE(SUM(CASE WHEN annual_income > 0 THEN annual_income ELSE 0 END), 0) as family_income,
        COUNT(CASE WHEN annual_income > 0 AND annual_income IS NOT NULL THEN 1 END) as earning_members,
        COUNT(CASE WHEN (annual_income = 0 OR annual_income IS NULL) THEN 1 END) as dependents
      FROM family_members WHERE family_details_id = ?
    `, [fdId, fdId]);

    if (rows.length === 0) return defaults;
    const d = rows[0];
    return {
      current_personal_income: d.personal_income ? parseFloat(d.personal_income) : null,
      current_family_income: d.family_income ? parseFloat(d.family_income) : null,
      earning_family_members: d.earning_members ? parseInt(d.earning_members) : null,
      dependents: d.dependents ? parseInt(d.dependents) : null
    };
  } catch (e) {
    console.error('coverLetterPdfData: Error fetching family financial data:', e);
    return defaults;
  }
}

/** Fetch assets and liabilities from family_details. */
async function fetchFamilyAssetsAndLiabilities(pool, caseId) {
  const defaults = {
    asset_house: null, asset_shop: null, asset_gold: null,
    asset_machinery: null, asset_stock: null,
    liability_qardan: null, liability_den: null, liability_others: null
  };
  try {
    const [cf] = await pool.execute(
      'SELECT family_details_id FROM counseling_forms WHERE case_id = ?',
      [caseId]
    );
    if (cf.length === 0 || !cf[0].family_details_id) return defaults;

    const [rows] = await pool.execute(`
      SELECT
        assets_residential, assets_shop_godown_land,
        assets_machinery_vehicle, assets_stock_raw_material, assets_others,
        liabilities_borrowing_qardan, liabilities_goods_credit, liabilities_others
      FROM family_details WHERE id = ?
    `, [cf[0].family_details_id]);

    if (rows.length === 0) return defaults;
    const d = rows[0];

    const parseDecimal = (v) => {
      if (v == null || v === '' || v === 0 || v === '0') return null;
      const p = parseFloat(v);
      return isNaN(p) ? null : p;
    };
    const getText = (v) => (v == null || v === '') ? null : String(v).trim() || null;

    return {
      asset_house: getText(d.assets_residential),
      asset_shop: getText(d.assets_shop_godown_land),
      asset_gold: getText(d.assets_others),
      asset_machinery: getText(d.assets_machinery_vehicle),
      asset_stock: getText(d.assets_stock_raw_material),
      liability_qardan: parseDecimal(d.liabilities_borrowing_qardan),
      liability_den: parseDecimal(d.liabilities_goods_credit),
      liability_others: parseDecimal(d.liabilities_others)
    };
  } catch (e) {
    console.error('coverLetterPdfData: Error fetching assets/liabilities:', e);
    return defaults;
  }
}

/** Fetch projected profit from economic_growth table. */
async function fetchEconomicGrowthProfit(pool, caseId) {
  const defaults = {
    profit_year1: null, profit_year2: null, profit_year3: null,
    profit_year4: null, profit_year5: null
  };
  try {
    const [cf] = await pool.execute(
      'SELECT economic_growth_id FROM counseling_forms WHERE case_id = ?',
      [caseId]
    );
    if (cf.length === 0 || !cf[0].economic_growth_id) return defaults;

    const [rows] = await pool.execute(`
      SELECT profit_year1, profit_year2, profit_year3, profit_year4, profit_year5
      FROM economic_growth WHERE id = ?
    `, [cf[0].economic_growth_id]);

    if (rows.length === 0) return defaults;
    const d = rows[0];
    return {
      profit_year1: d.profit_year1 ? parseFloat(d.profit_year1) : null,
      profit_year2: d.profit_year2 ? parseFloat(d.profit_year2) : null,
      profit_year3: d.profit_year3 ? parseFloat(d.profit_year3) : null,
      profit_year4: d.profit_year4 ? parseFloat(d.profit_year4) : null,
      profit_year5: d.profit_year5 ? parseFloat(d.profit_year5) : null
    };
  } catch (e) {
    console.error('coverLetterPdfData: Error fetching economic growth profit:', e);
    return defaults;
  }
}

/** Fetch financial assistance totals (requested enayat/qardan). */
async function fetchFinancialAssistanceTotals(pool, caseId) {
  const defaults = { total_enayat: null, total_qardan: null };
  try {
    const [cf] = await pool.execute(
      'SELECT financial_assistance_id FROM counseling_forms WHERE case_id = ?',
      [caseId]
    );
    if (cf.length === 0 || !cf[0].financial_assistance_id) return defaults;

    const [rows] = await pool.execute(`
      SELECT
        COALESCE(SUM(enayat), 0) as total_enayat,
        COALESCE(SUM(qardan), 0) as total_qardan
      FROM financial_assistance_timeline_assistance
      WHERE financial_assistance_id = ?
        AND (enayat IS NOT NULL OR qardan IS NOT NULL)
    `, [cf[0].financial_assistance_id]);

    if (rows.length === 0) return defaults;
    const d = rows[0];
    return {
      total_enayat: d.total_enayat ? parseFloat(d.total_enayat) : null,
      total_qardan: d.total_qardan ? parseFloat(d.total_qardan) : null
    };
  } catch (e) {
    console.error('coverLetterPdfData: Error fetching financial assistance totals:', e);
    return defaults;
  }
}

/** Fetch present occupation from personal_details. */
async function fetchPersonalOccupation(pool, caseId) {
  try {
    const [cf] = await pool.execute(
      'SELECT personal_details_id FROM counseling_forms WHERE case_id = ?',
      [caseId]
    );
    if (cf.length === 0 || !cf[0].personal_details_id) return null;

    const [rows] = await pool.execute(
      'SELECT present_occupation FROM personal_details WHERE id = ?',
      [cf[0].personal_details_id]
    );
    if (rows.length === 0 || !rows[0].present_occupation) return null;
    return rows[0].present_occupation.trim() || null;
  } catch (e) {
    console.error('coverLetterPdfData: Error fetching personal occupation:', e);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Main builder                                                       */
/* ------------------------------------------------------------------ */

/**
 * Build the flat data object for the Cover Letter PDF template.
 *
 * @param {Object} pool      - MySQL2 connection pool (promise-based)
 * @param {number|string} caseId - The case ID
 * @param {Object} [options] - Optional overrides
 * @param {string} [options.userName] - Name of the user generating the PDF
 * @returns {Promise<Object>} Flat data object matching template property names
 */
async function buildCoverLetterPdfData(pool, caseId, options = {}) {
  const uploadsBase = path.join(__dirname, '../uploads');

  // ---- 1. Fetch the cover_letter_forms row (primary source) ----
  let form = null;
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM cover_letter_forms WHERE case_id = ?',
      [caseId]
    );
    if (rows.length > 0) form = rows[0];
  } catch (e) {
    console.error('coverLetterPdfData: Error fetching cover_letter_forms:', e);
  }

  // ---- 2. Fetch case details (case_number, date) ----
  let caseRow = null;
  try {
    const [rows] = await pool.execute(
      'SELECT id, case_number, status, created_at FROM cases WHERE id = ?',
      [caseId]
    );
    if (rows.length > 0) caseRow = rows[0];
  } catch (e) {
    console.error('coverLetterPdfData: Error fetching case:', e);
  }

  // ---- 3. Fetch fallback sources in parallel ----
  const [
    applicantData,
    counsellorData,
    familyFinancial,
    assetsLiabilities,
    economicGrowth,
    financialTotals,
    personalOccupation
  ] = await Promise.all([
    fetchApplicantData(pool, caseId),
    fetchCounsellorData(pool, caseId),
    fetchFamilyFinancialData(pool, caseId),
    fetchFamilyAssetsAndLiabilities(pool, caseId),
    fetchEconomicGrowthProfit(pool, caseId),
    fetchFinancialAssistanceTotals(pool, caseId),
    fetchPersonalOccupation(pool, caseId)
  ]);

  // ---- 4. Build the flat data object ----
  // Strategy: prefer form column value, fall back to fetched data, then null.
  const f = form || {}; // safe accessor

  // -- Header --
  const caseNumber = toStr(caseRow?.case_number) || '';
  const date = toDateStr(f.submitted_at || f.updated_at) || new Date().toISOString().slice(0, 10);

  // -- Applicant Details --
  const applicant_name = toStr(f.applicant_name) || applicantData?.name || null;
  const applicant_its = toStr(f.applicant_its) || applicantData?.its || null;
  const applicant_contact_number = toStr(f.applicant_contact_number) || applicantData?.contact_number || null;
  const applicant_case_id = toStr(f.applicant_case_id) || applicantData?.case_id || caseNumber || null;
  const applicant_jamiat = toStr(f.applicant_jamiat) || applicantData?.jamiat || null;
  const applicant_jamaat = toStr(f.applicant_jamaat) || applicantData?.jamaat || null;
  const applicant_age = f.applicant_age != null ? f.applicant_age : (applicantData?.age || null);
  const applicant_photo = ensurePhotoDataUrl(
    f.applicant_photo || applicantData?.photo || null,
    uploadsBase
  );

  // -- Counsellor Details --
  const counsellor_name = toStr(f.counsellor_name) || counsellorData?.name || null;
  const counsellor_its = toStr(f.counsellor_its) || counsellorData?.its || null;
  const counsellor_contact_number = toStr(f.counsellor_contact_number) || counsellorData?.contact_number || null;
  const counsellor_jamiat = toStr(f.counsellor_jamiat) || counsellorData?.jamiat || null;
  const counsellor_jamaat = toStr(f.counsellor_jamaat) || counsellorData?.jamaat || null;
  const counsellor_age = f.counsellor_age != null ? f.counsellor_age : null;
  const counsellor_certified = f.counsellor_certified != null ? !!f.counsellor_certified : false;
  const counsellor_photo = ensurePhotoDataUrl(
    f.counsellor_photo || counsellorData?.photo || null,
    uploadsBase
  );

  // -- Financial and Business Overview --
  const current_personal_income = toFloat(f.current_personal_income) ?? familyFinancial.current_personal_income;
  const current_family_income = toFloat(f.current_family_income) ?? familyFinancial.current_family_income;
  const earning_family_members = toInt(f.earning_family_members) ?? familyFinancial.earning_family_members;
  const dependents = toInt(f.dependents) ?? familyFinancial.dependents;

  const asset_house = toStr(f.asset_house) ?? assetsLiabilities.asset_house;
  const asset_shop = toStr(f.asset_shop) ?? assetsLiabilities.asset_shop;
  const asset_gold = toStr(f.asset_gold) ?? assetsLiabilities.asset_gold;
  const asset_machinery = toStr(f.asset_machinery) ?? assetsLiabilities.asset_machinery;
  const asset_stock = toStr(f.asset_stock) ?? assetsLiabilities.asset_stock;

  const liability_qardan = toFloat(f.liability_qardan) ?? assetsLiabilities.liability_qardan;
  const liability_den = toFloat(f.liability_den) ?? assetsLiabilities.liability_den;
  const liability_others = toFloat(f.liability_others) ?? assetsLiabilities.liability_others;

  const business_name = toStr(f.business_name) || null;
  const industry_segment = toStr(f.industry_segment) || null;
  const present_occupation = toStr(f.present_occupation) || personalOccupation || null;

  // -- Summary of Proposed Upliftment Plan --
  const proposed_upliftment_plan = toStr(f.proposed_upliftment_plan) || null;

  // -- Financial Assistance --
  // NOTE: enayat_breakup_items and qardan_breakup_items are not stored in the database.
  // The cover_letter_forms table and related tables have no breakup/line-item fields.
  // These are provided as empty arrays so the template conditional blocks are skipped
  // gracefully. When breakup storage is added to the DB, populate these from that source.
  const enayat_breakup_items = [];
  const qardan_breakup_items = [];

  const requested_enayat = toFloat(f.requested_enayat) ?? financialTotals.total_enayat;
  const requested_qardan = toFloat(f.requested_qardan) ?? financialTotals.total_qardan;
  const requested_total = toFloat(f.requested_total) ??
    ((requested_enayat != null || requested_qardan != null)
      ? (requested_enayat || 0) + (requested_qardan || 0)
      : null);
  const recommended_enayat = toFloat(f.recommended_enayat) || null;
  const recommended_qardan = toFloat(f.recommended_qardan) || null;
  const recommended_total = toFloat(f.recommended_total) ??
    ((recommended_enayat != null || recommended_qardan != null)
      ? (recommended_enayat || 0) + (recommended_qardan || 0)
      : null);
  const non_financial_assistance = toStr(f.non_financial_assistance) || null;

  // -- Projected Income (5-year) --
  const applicant_projected_income_after_1_year = toFloat(f.applicant_projected_income_after_1_year) ?? economicGrowth.profit_year1;
  const applicant_projected_income_after_2_years = toFloat(f.applicant_projected_income_after_2_years) ?? economicGrowth.profit_year2;
  const applicant_projected_income_after_3_years = toFloat(f.applicant_projected_income_after_3_years) ?? economicGrowth.profit_year3;
  const applicant_projected_income_after_4_years = toFloat(f.applicant_projected_income_after_4_years) ?? economicGrowth.profit_year4;
  const applicant_projected_income_after_5_years = toFloat(f.applicant_projected_income_after_5_years) ?? economicGrowth.profit_year5;

  // Family projected income -- user-entered only, no fallback
  const family_projected_income_after_1_year = toFloat(f.family_projected_income_after_1_year);
  const family_projected_income_after_2_years = toFloat(f.family_projected_income_after_2_years);
  const family_projected_income_after_3_years = toFloat(f.family_projected_income_after_3_years);
  const family_projected_income_after_4_years = toFloat(f.family_projected_income_after_4_years);
  const family_projected_income_after_5_years = toFloat(f.family_projected_income_after_5_years);

  // -- Welfare Department Comments --
  const welfare_department_comments = toStr(f.welfare_department_comments) || null;

  // -- Executive Approval --
  const approved_enayat = toFloat(f.approved_enayat);
  const approved_qardan = toFloat(f.approved_qardan);
  const approved_qh_months = toInt(f.approved_qh_months);

  // -- Executive Management Signatures --
  // Welfare Department
  const welfare_department_name = toStr(f.welfare_department_name) || null;
  const welfare_department_signature_drawing_data = ensureSignatureDataUrl(
    f.welfare_department_signature_drawing_data, uploadsBase
  );
  const welfare_department_signature_file_path = ensureSignatureDataUrl(
    f.welfare_department_signature_file_path, uploadsBase
  );
  const welfare_department_date = toDateStr(f.welfare_department_date);

  // Zonal In-charge
  const zonal_incharge_name = toStr(f.zonal_incharge_name) || null;
  const zonal_incharge_signature_drawing_data = ensureSignatureDataUrl(
    f.zonal_incharge_signature_drawing_data, uploadsBase
  );
  const zonal_incharge_signature_file_path = ensureSignatureDataUrl(
    f.zonal_incharge_signature_file_path, uploadsBase
  );
  const zonal_incharge_date = toDateStr(f.zonal_incharge_date);

  // Operations Head
  const operations_head_name = toStr(f.operations_head_name) || null;
  const operations_head_signature_drawing_data = ensureSignatureDataUrl(
    f.operations_head_signature_drawing_data, uploadsBase
  );
  const operations_head_signature_file_path = ensureSignatureDataUrl(
    f.operations_head_signature_file_path, uploadsBase
  );
  const operations_head_date = toDateStr(f.operations_head_date);

  // -- Footer --
  const userName = options.userName || null;

  // ---- 5. Return the flat data object ----
  return {
    // Header
    caseNumber,
    date,

    // Applicant Details
    applicant_photo,
    applicant_its,
    applicant_name,
    applicant_contact_number,
    applicant_case_id,
    applicant_jamiat,
    applicant_jamaat,
    applicant_age,

    // Counsellor Details
    counsellor_photo,
    counsellor_its,
    counsellor_name,
    counsellor_contact_number,
    counsellor_jamiat,
    counsellor_jamaat,
    counsellor_age,
    counsellor_certified,

    // Financial and Business Overview
    current_personal_income,
    current_family_income,
    earning_family_members,
    dependents,
    asset_house,
    asset_shop,
    asset_gold,
    asset_machinery,
    asset_stock,
    liability_qardan,
    liability_den,
    liability_others,
    business_name,
    industry_segment,
    present_occupation,

    // Summary of Proposed Upliftment Plan
    proposed_upliftment_plan,

    // Financial Assistance
    enayat_breakup_items,
    qardan_breakup_items,
    requested_enayat,
    requested_qardan,
    requested_total,
    recommended_enayat,
    recommended_qardan,
    recommended_total,
    non_financial_assistance,

    // Projected Income (5-year)
    applicant_projected_income_after_1_year,
    applicant_projected_income_after_2_years,
    applicant_projected_income_after_3_years,
    applicant_projected_income_after_4_years,
    applicant_projected_income_after_5_years,
    family_projected_income_after_1_year,
    family_projected_income_after_2_years,
    family_projected_income_after_3_years,
    family_projected_income_after_4_years,
    family_projected_income_after_5_years,

    // Welfare Department Comments
    welfare_department_comments,

    // Executive Approval
    approved_enayat,
    approved_qardan,
    approved_qh_months,

    // Executive Management Signatures
    welfare_department_name,
    welfare_department_signature_drawing_data,
    welfare_department_signature_file_path,
    welfare_department_date,
    zonal_incharge_name,
    zonal_incharge_signature_drawing_data,
    zonal_incharge_signature_file_path,
    zonal_incharge_date,
    operations_head_name,
    operations_head_signature_drawing_data,
    operations_head_signature_file_path,
    operations_head_date,

    // Footer
    userName
  };
}

module.exports = buildCoverLetterPdfData;
