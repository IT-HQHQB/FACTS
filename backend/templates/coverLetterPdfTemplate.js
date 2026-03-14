/**
 * HTML template for Cover Letter PDF generation (Puppeteer-compatible).
 *
 * Expected data object properties:
 *
 *   -- Header --
 *   caseNumber          {string}  Case number displayed in header
 *   date                {string}  Date string (YYYY-MM-DD or any parseable format); defaults to today
 *
 *   -- Applicant Details --
 *   applicant_photo     {string|null}  Base64 data URL of applicant photo
 *   applicant_its       {string}       ITS number
 *   applicant_name      {string}       Full name
 *   applicant_contact_number {string}  Contact number
 *   applicant_case_id   {string}       Case ID (falls back to caseNumber)
 *   applicant_jamiat    {string}       Jamiat name
 *   applicant_jamaat    {string}       Jamaat name
 *   applicant_age       {string|number} Age
 *
 *   -- Counsellor Details --
 *   counsellor_photo    {string|null}  Base64 data URL of counsellor photo
 *   counsellor_its      {string}       ITS number
 *   counsellor_name     {string}       Full name
 *   counsellor_contact_number {string} Contact number
 *   counsellor_jamiat   {string}       Jamiat name
 *   counsellor_jamaat   {string}       Jamaat name
 *   counsellor_age      {string|number} Age
 *   counsellor_certified {boolean}     Whether counsellor is certified
 *
 *   -- Financial and Business Overview --
 *   current_personal_income  {string|number}  Current personal income
 *   current_family_income    {string|number}  Current family income
 *   earning_family_members   {string|number}  Number of earning family members
 *   dependents               {string|number}  Number of dependents
 *   asset_house              {string|number}  House asset value
 *   asset_shop               {string|number}  Shop asset value
 *   asset_gold               {string|number}  Gold asset value
 *   asset_machinery          {string|number}  Machinery asset value
 *   asset_stock              {string|number}  Stock asset value
 *   liability_qardan         {string|number}  Qardan liability
 *   liability_den            {string|number}  Den liability
 *   liability_others         {string|number}  Other liabilities
 *   business_name            {string}         Business name & year
 *   industry_segment         {string}         Industry / segment
 *   present_occupation       {string}         Present occupation / business description
 *
 *   -- Summary of Proposed Upliftment Plan --
 *   proposed_upliftment_plan {string}  Free-text plan description
 *
 *   -- Financial Assistance --
 *   requested_enayat         {string|number}  Requested Enayat amount
 *   requested_qardan         {string|number}  Requested Qardan amount
 *   requested_total          {string|number}  Requested Total amount
 *   recommended_enayat       {string|number}  Recommended Enayat amount
 *   recommended_qardan       {string|number}  Recommended Qardan amount
 *   recommended_total        {string|number}  Recommended Total amount
 *   non_financial_assistance {string}         Non-financial assistance details
 *
 *   -- Projected Income (5-year) --
 *   applicant_projected_income_after_1_year  {string|number}
 *   applicant_projected_income_after_2_years {string|number}
 *   applicant_projected_income_after_3_years {string|number}
 *   applicant_projected_income_after_4_years {string|number}
 *   applicant_projected_income_after_5_years {string|number}
 *   family_projected_income_after_1_year     {string|number}
 *   family_projected_income_after_2_years    {string|number}
 *   family_projected_income_after_3_years    {string|number}
 *   family_projected_income_after_4_years    {string|number}
 *   family_projected_income_after_5_years    {string|number}
 *
 *   -- Welfare Department Comments --
 *   welfare_department_comments {string}  Comments from welfare department
 *
 *   -- Enayat / Qardan Break-up (optional arrays) --
 *   enayat_breakup_items  {Array<{amount, description}>|null}  Line items for enayat break-up
 *   qardan_breakup_items  {Array<{amount, description}>|null}  Line items for qardan break-up
 *
 *   -- Executive Approval --
 *   approved_enayat      {string|number}  Approved Enayat amount
 *   approved_qardan      {string|number}  Approved Qardan amount
 *   approved_qh_months   {string|number}  Approved QH months
 *
 *   -- Executive Management Signatures --
 *   welfare_department_name                  {string}       Name
 *   welfare_department_signature_drawing_data {string|null} Base64 signature image
 *   welfare_department_signature_file_path    {string|null} Base64 signature image (fallback)
 *   welfare_department_date                  {string}       Date
 *   zonal_incharge_name                      {string}       Name
 *   zonal_incharge_signature_drawing_data    {string|null}  Base64 signature image
 *   zonal_incharge_signature_file_path       {string|null}  Base64 signature image (fallback)
 *   zonal_incharge_date                      {string}       Date
 *   operations_head_name                     {string}       Name
 *   operations_head_signature_drawing_data   {string|null}  Base64 signature image
 *   operations_head_signature_file_path      {string|null}  Base64 signature image (fallback)
 *   operations_head_date                     {string}       Date
 *
 *   -- Footer --
 *   userName             {string}  Name of person who generated the cover letter
 */

/* ---- Helper functions ---- */

function esc(s) {
  if (s == null || s === '') return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escOrDash(s) {
  if (s == null || s === '') return '&mdash;';
  const escaped = esc(s);
  return escaped || '&mdash;';
}

function fmtCurrency(v) {
  if (v == null || v === '' || v === undefined) return '';
  const num = parseFloat(v);
  if (isNaN(num)) return '';
  return 'Rs ' + num.toLocaleString('en-IN') + '/-';
}

function fmtCurrencyOrDash(v) {
  const result = fmtCurrency(v);
  return result || '&mdash;';
}

function fmtCurrencyRupee(v) {
  if (v == null || v === '' || v === undefined) return '';
  const num = parseFloat(v);
  if (isNaN(num)) return '';
  return '&#8377; ' + num.toLocaleString('en-IN');
}

function fmtCurrencyRupeeOrDash(v) {
  const result = fmtCurrencyRupee(v);
  return result || '&mdash;';
}

function fmtNumber(v) {
  if (v == null || v === '' || v === undefined) return '';
  const num = parseFloat(v);
  if (isNaN(num)) return '';
  return num.toLocaleString('en-IN');
}

function fmtDate(v) {
  if (v == null || v === '') return '';
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch (e) {
    return String(v);
  }
}

function fmtDateOrDash(v) {
  const result = fmtDate(v);
  return result || '&mdash;';
}

/**
 * Renders a photo cell: either an <img> tag for base64 data URLs or a placeholder box.
 */
function renderPhoto(dataUrl, altText) {
  if (dataUrl && typeof dataUrl === 'string' && dataUrl.startsWith('data:image')) {
    return `<img src="${dataUrl}" alt="${esc(altText)}" style="width:80px;height:80px;object-fit:cover;border:1px solid #999;" />`;
  }
  return `<div style="width:80px;height:80px;border:1px solid #999;display:flex;align-items:center;justify-content:center;background:#fafafa;">
    <span style="font-size:7pt;color:#999;text-align:center;line-height:1.2;">${esc(altText)}<br/>Photo</span>
  </div>`;
}

/**
 * Renders a signature: either an <img> tag for base64 data URLs or an underline placeholder.
 */
function renderSignature(drawingData, filePath) {
  const sigData = drawingData || filePath;
  if (sigData && typeof sigData === 'string' && sigData.startsWith('data:image')) {
    return `<img src="${sigData}" alt="Signature" style="max-width:100px;max-height:36px;display:block;" />`;
  }
  return '<span style="display:inline-block;width:100px;border-bottom:1px solid #999;">&nbsp;</span>';
}

/* ---- Main template function ---- */

/**
 * Renders the Cover Letter as a complete HTML string for Puppeteer PDF generation.
 * @param {Object} data - The data object (see property list at top of file)
 * @returns {string} Complete HTML document string
 */
function renderCoverLetterTemplate(data) {
  const d = data || {};

  // Safe accessors
  const sOrDash = (key) => escOrDash(d[key]);

  // Determine date to display
  const displayDate = fmtDate(d.date) || fmtDate(new Date().toISOString().slice(0, 10));
  const caseNumber = esc(d.caseNumber || d.applicant_case_id || '');

  // Build assets display string
  const assetsArr = [];
  if (d.asset_shop != null && d.asset_shop !== '') assetsArr.push('Shop: ' + fmtCurrencyOrDash(d.asset_shop));
  if (d.asset_house != null && d.asset_house !== '') assetsArr.push('House: ' + fmtCurrencyOrDash(d.asset_house));
  if (d.asset_gold != null && d.asset_gold !== '') assetsArr.push('Gold: ' + fmtCurrencyOrDash(d.asset_gold));
  if (d.asset_machinery != null && d.asset_machinery !== '') assetsArr.push('Machinery: ' + fmtCurrencyOrDash(d.asset_machinery));
  if (d.asset_stock != null && d.asset_stock !== '') assetsArr.push('Stock: ' + fmtCurrencyOrDash(d.asset_stock));
  const assetsDisplay = assetsArr.length > 0 ? assetsArr.join(', ') : '&mdash;';

  // Build liabilities display string
  const liabilitiesArr = [];
  if (d.liability_qardan != null && d.liability_qardan !== '') liabilitiesArr.push('Qardan: ' + fmtCurrencyOrDash(d.liability_qardan));
  if (d.liability_den != null && d.liability_den !== '') liabilitiesArr.push('Den: ' + fmtCurrencyOrDash(d.liability_den));
  if (d.liability_others != null && d.liability_others !== '') liabilitiesArr.push('Others: ' + fmtCurrencyOrDash(d.liability_others));
  const liabilitiesDisplay = liabilitiesArr.length > 0 ? liabilitiesArr.join(', ') : '&mdash;';

  // Build enayat break-up section
  let enayatBreakupHtml = '';
  if (d.enayat_breakup_items && Array.isArray(d.enayat_breakup_items) && d.enayat_breakup_items.length > 0) {
    const lines = d.enayat_breakup_items.map(item =>
      `&#8377;${fmtNumber(item.amount)} &ndash; ${escOrDash(item.description)}`
    ).join('<br/>');
    enayatBreakupHtml = `
    <tr>
      <td colspan="2" style="padding:0;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="border:none;border-right:1px solid #333;width:25%;padding:4px 6px;font-weight:bold;vertical-align:top;font-size:9pt;">Enayat Break-up:</td>
            <td style="border:none;padding:4px 6px;font-size:9pt;">${lines}</td>
          </tr>
        </table>
      </td>
    </tr>`;
  }

  // Build qardan break-up section
  let qardanBreakupHtml = '';
  if (d.qardan_breakup_items && Array.isArray(d.qardan_breakup_items) && d.qardan_breakup_items.length > 0) {
    const lines = d.qardan_breakup_items.map(item =>
      `&#8377;${fmtNumber(item.amount)} &ndash; ${escOrDash(item.description)}`
    ).join('<br/>');
    qardanBreakupHtml = `
    <tr>
      <td colspan="2" style="padding:0;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="border:none;border-right:1px solid #333;width:25%;padding:4px 6px;font-weight:bold;vertical-align:top;font-size:9pt;">Qardan Hasana Break-up:</td>
            <td style="border:none;padding:4px 6px;font-size:9pt;">${lines}</td>
          </tr>
        </table>
      </td>
    </tr>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Cover Letter</title>
  <style>
    @page {
      size: A4;
      margin: 10mm 12mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      font-size: 10pt;
      color: #222;
      line-height: 1.3;
      margin: 0;
      padding: 0;
      background: #fff;
    }

    /* Main outer table */
    table.main-table {
      width: 100%;
      border-collapse: collapse;
      border: 1.5px solid #333;
    }
    table.main-table > tbody > tr > td {
      border: 1px solid #333;
      padding: 0;
      vertical-align: top;
    }

    /* Inner tables */
    table.inner {
      width: 100%;
      border-collapse: collapse;
    }
    table.inner td,
    table.inner th {
      border: 1px solid #333;
      padding: 3px 6px;
      vertical-align: top;
      font-size: 10pt;
    }
    table.inner th {
      font-weight: bold;
      background: #f5f5f5;
      font-size: 10pt;
    }

    /* No-border inner table for person details */
    table.person-inner {
      width: 100%;
      border-collapse: collapse;
    }
    table.person-inner td {
      border: none;
      padding: 1px 4px;
      vertical-align: top;
      font-size: 9pt;
    }

    /* Header */
    .header-cell {
      text-align: center;
      padding: 6px 8px !important;
      font-size: 14pt;
      font-weight: bold;
    }

    /* Section headers */
    .section-header {
      font-weight: bold;
      font-size: 11pt;
      padding: 4px 6px !important;
      background: #f0f0f0;
    }

    /* Label cells */
    .lbl {
      font-weight: bold;
      font-size: 10pt;
    }

    /* Value cells */
    .val {
      font-size: 10pt;
    }

    /* Photo container */
    .photo-container {
      text-align: center;
      padding: 4px;
    }
    .its-label {
      font-size: 8pt;
      font-weight: bold;
      margin-top: 3px;
      text-align: center;
    }

    /* Multiline text */
    .multiline {
      white-space: pre-wrap;
      word-break: break-word;
    }

    /* Signature block */
    .sig-label {
      font-weight: bold;
      font-size: 8pt;
      color: #555;
    }

    /* Sub-table for financial assistance and projected income */
    table.sub-table {
      width: 100%;
      border-collapse: collapse;
    }
    table.sub-table td,
    table.sub-table th {
      border: 1px solid #333;
      padding: 3px 6px;
      text-align: center;
      font-size: 9pt;
      vertical-align: middle;
    }
    table.sub-table th {
      font-weight: bold;
      background: #f5f5f5;
    }

    /* Executive section: keep together on one page */
    .executive-section {
      page-break-inside: avoid;
      break-inside: avoid;
    }

  </style>
</head>
<body>

<table class="main-table">
  <tbody>

    <!-- ===== HEADER ROW ===== -->
    <tr>
      <td colspan="2" class="header-cell">
        Baaseteen &mdash; 1447H
      </td>
    </tr>

    <!-- ===== APPLICANT DETAILS + COUNSELLOR DETAILS (side by side) ===== -->
    <tr>
      <!-- LEFT: Applicant Details -->
      <td style="width:50%;padding:0;">
        <table class="inner" style="border:none;">
          <tr>
            <td colspan="2" class="section-header" style="border-left:none;border-right:none;border-top:none;">Applicant Details</td>
          </tr>
          <tr>
            <td style="width:95px;border-left:none;border-bottom:none;padding:4px;" rowspan="2">
              <div class="photo-container">
                ${renderPhoto(d.applicant_photo, 'Applicant')}
                <div class="its-label">ITS: ${escOrDash(d.applicant_its)}</div>
              </div>
            </td>
            <td style="border-right:none;border-bottom:none;padding:0;">
              <table class="person-inner">
                <tr><td style="width:55px;" class="lbl">Name:</td><td>${sOrDash('applicant_name')}</td></tr>
                <tr><td class="lbl">Contact:</td><td>${sOrDash('applicant_contact_number')}</td></tr>
                <tr><td class="lbl">Case Id:</td><td>${escOrDash(d.applicant_case_id || d.caseNumber)}</td></tr>
                <tr><td class="lbl">Place:</td><td>${sOrDash('applicant_jamaat')}</td></tr>
                <tr><td class="lbl">Jamiat:</td><td>${sOrDash('applicant_jamiat')}</td></tr>
                <tr><td class="lbl">Age:</td><td>${sOrDash('applicant_age')}</td></tr>
              </table>
            </td>
          </tr>
        </table>
      </td>

      <!-- RIGHT: Counsellor Details -->
      <td style="width:50%;padding:0;">
        <table class="inner" style="border:none;">
          <tr>
            <td colspan="2" class="section-header" style="border-left:none;border-right:none;border-top:none;">Counsellor Details</td>
          </tr>
          <tr>
            <td style="width:95px;border-left:none;border-bottom:none;padding:4px;" rowspan="2">
              <div class="photo-container">
                ${renderPhoto(d.counsellor_photo, 'Counsellor')}
                <div class="its-label">ITS: ${escOrDash(d.counsellor_its)}</div>
              </div>
            </td>
            <td style="border-right:none;border-bottom:none;padding:0;">
              <table class="person-inner">
                <tr><td style="width:55px;" class="lbl">Name:</td><td>${sOrDash('counsellor_name')}</td></tr>
                <tr><td class="lbl">Place:</td><td>${sOrDash('counsellor_jamaat')}</td></tr>
                <tr><td class="lbl">Jamiat:</td><td>${sOrDash('counsellor_jamiat')}</td></tr>
                <tr><td class="lbl">Contact:</td><td>${sOrDash('counsellor_contact_number')}</td></tr>
                <tr><td class="lbl">Age:</td><td>${sOrDash('counsellor_age')}</td></tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ===== FINANCIAL OVERVIEW ===== -->
    <!-- Row 1: Personal Income + Earning Members -->
    <tr>
      <td style="padding:0;" colspan="2">
        <table class="inner" style="border:none;">
          <tr>
            <td style="width:50%;border-left:none;border-bottom:none;border-top:none;"><span class="lbl">Current Personal Income:</span> ${fmtCurrencyOrDash(d.current_personal_income)}</td>
            <td style="border-right:none;border-bottom:none;border-top:none;"><span class="lbl">Earning family members:</span> ${escOrDash(fmtNumber(d.earning_family_members) || d.earning_family_members)}</td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Row 2: Family Income + Dependents -->
    <tr>
      <td style="padding:0;" colspan="2">
        <table class="inner" style="border:none;">
          <tr>
            <td style="width:50%;border-left:none;border-bottom:none;border-top:none;"><span class="lbl">Current Family Income:</span> ${fmtCurrencyOrDash(d.current_family_income)}</td>
            <td style="border-right:none;border-bottom:none;border-top:none;"><span class="lbl">Dependents:</span> ${escOrDash(fmtNumber(d.dependents) || d.dependents)}</td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Row 3: Assets -->
    <tr>
      <td colspan="2" style="padding:4px 6px;">
        <span class="lbl">Assets (Shop / House / Gold / Machinery / Stock):</span> ${assetsDisplay}
      </td>
    </tr>

    <!-- Row 4: Liabilities -->
    <tr>
      <td colspan="2" style="padding:4px 6px;">
        <span class="lbl">Liabilities (Qardan / Den / Others):</span> ${liabilitiesDisplay}
      </td>
    </tr>

    <!-- Row 5: Business Name -->
    <tr>
      <td style="padding:0;" colspan="2">
        <table class="inner" style="border:none;">
          <tr>
            <td style="width:50%;border-left:none;border-bottom:none;border-top:none;"><span class="lbl">Business Name &amp; Year of starting:</span></td>
            <td style="border-right:none;border-bottom:none;border-top:none;">${sOrDash('business_name')}</td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Row 6: Industry / Segment -->
    <tr>
      <td style="padding:0;" colspan="2">
        <table class="inner" style="border:none;">
          <tr>
            <td style="width:50%;border-left:none;border-bottom:none;border-top:none;"><span class="lbl">Industry / Segment:</span></td>
            <td style="border-right:none;border-bottom:none;border-top:none;">${sOrDash('industry_segment')}</td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Row 7: Present Occupation -->
    <tr>
      <td style="padding:0;" colspan="2">
        <table class="inner" style="border:none;">
          <tr>
            <td style="width:50%;border-left:none;border-bottom:none;border-top:none;vertical-align:top;"><span class="lbl">Present occupation / business (Products / Services, revenue, etc.):</span></td>
            <td style="border-right:none;border-bottom:none;border-top:none;" class="multiline">${sOrDash('present_occupation')}</td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ===== SUMMARY OF PROPOSED UPLIFTMENT PLAN ===== -->
    <tr>
      <td style="padding:0;" colspan="2">
        <table class="inner" style="border:none;">
          <tr>
            <td style="width:20%;border-left:none;border-bottom:none;border-top:none;vertical-align:top;" class="lbl">Summary of Proposed Upliftment Plan:</td>
            <td style="border-right:none;border-bottom:none;border-top:none;" class="multiline">${sOrDash('proposed_upliftment_plan')}</td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ===== FINANCIAL ASSISTANCE ===== -->
    <tr>
      <td style="padding:0;" colspan="2">
        <table class="inner" style="border:none;">
          <tr>
            <td style="width:20%;border-left:none;border-bottom:none;border-top:none;vertical-align:middle;" class="lbl" rowspan="3">Financial Assistance:</td>
            <td style="border-right:none;border-top:none;padding:0;">
              <table class="sub-table">
                <thead>
                  <tr>
                    <th style="width:25%;">&nbsp;</th>
                    <th>Enayat Amount</th>
                    <th>Qardan Amount</th>
                    <th>Total Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="font-weight:bold;text-align:left;">Requested</td>
                    <td>${fmtCurrencyOrDash(d.requested_enayat)}</td>
                    <td>${fmtCurrencyOrDash(d.requested_qardan)}</td>
                    <td>${fmtCurrencyOrDash(d.requested_total)}</td>
                  </tr>
                  <tr>
                    <td style="font-weight:bold;text-align:left;">Recommended</td>
                    <td>${fmtCurrencyOrDash(d.recommended_enayat)}</td>
                    <td>${fmtCurrencyOrDash(d.recommended_qardan)}</td>
                    <td>${fmtCurrencyOrDash(d.recommended_total)}</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ===== NON-FINANCIAL ASSISTANCE ===== -->
    <tr>
      <td style="padding:0;" colspan="2">
        <table class="inner" style="border:none;">
          <tr>
            <td style="width:20%;border-left:none;border-bottom:none;border-top:none;vertical-align:top;" class="lbl">Non-financial Assistance:</td>
            <td style="border-right:none;border-bottom:none;border-top:none;" class="multiline">${sOrDash('non_financial_assistance')}</td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ===== PROJECTED INCOME ===== -->
    <tr>
      <td style="padding:0;" colspan="2">
        <table class="inner" style="border:none;">
          <tr>
            <td style="width:20%;border-left:none;border-bottom:none;border-top:none;vertical-align:middle;" class="lbl" rowspan="3">Projected Income:</td>
            <td style="border-right:none;border-top:none;padding:0;">
              <table class="sub-table">
                <thead>
                  <tr>
                    <th style="width:16%;">&nbsp;</th>
                    <th>After 1 year</th>
                    <th>After 2 years</th>
                    <th>After 3 years</th>
                    <th>After 4 years</th>
                    <th>After 5 years</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="font-weight:bold;text-align:left;">Applicant</td>
                    <td>${fmtCurrencyRupeeOrDash(d.applicant_projected_income_after_1_year)}</td>
                    <td>${fmtCurrencyRupeeOrDash(d.applicant_projected_income_after_2_years)}</td>
                    <td>${fmtCurrencyRupeeOrDash(d.applicant_projected_income_after_3_years)}</td>
                    <td>${fmtCurrencyRupeeOrDash(d.applicant_projected_income_after_4_years)}</td>
                    <td>${fmtCurrencyRupeeOrDash(d.applicant_projected_income_after_5_years)}</td>
                  </tr>
                  <tr>
                    <td style="font-weight:bold;text-align:left;">Family</td>
                    <td>${fmtCurrencyRupeeOrDash(d.family_projected_income_after_1_year)}</td>
                    <td>${fmtCurrencyRupeeOrDash(d.family_projected_income_after_2_years)}</td>
                    <td>${fmtCurrencyRupeeOrDash(d.family_projected_income_after_3_years)}</td>
                    <td>${fmtCurrencyRupeeOrDash(d.family_projected_income_after_4_years)}</td>
                    <td>${fmtCurrencyRupeeOrDash(d.family_projected_income_after_5_years)}</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ===== WELFARE DEPARTMENT COMMENTS ===== -->
    <tr>
      <td style="padding:0;" colspan="2">
        <table class="inner" style="border:none;">
          <tr>
            <td style="width:20%;border-left:none;border-bottom:none;border-top:none;vertical-align:top;" class="lbl">Welfare Dept Comments:</td>
            <td style="border-right:none;border-bottom:none;border-top:none;" class="multiline">${sOrDash('welfare_department_comments')}</td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ===== ENAYAT BREAK-UP (if data available) ===== -->
    ${enayatBreakupHtml}

    <!-- ===== QARDAN HASANA BREAK-UP (if data available) ===== -->
    ${qardanBreakupHtml}

  </tbody>
</table>

<!-- ===== EXECUTIVE SECTION (kept together on one page) ===== -->
<div class="executive-section">
<table class="main-table">
  <tbody>

    <!-- ===== EXECUTIVE APPROVAL ===== -->
    <tr>
      <td colspan="2" class="section-header" style="background:#e8f5e9;text-align:center;font-size:11pt;">
        Executive Approval
      </td>
    </tr>
    <tr>
      <td style="padding:0;" colspan="2">
        <table class="inner" style="border:none;">
          <tr>
            <td style="width:20%;border-left:none;border-bottom:none;border-top:none;vertical-align:middle;" class="lbl" rowspan="2">Executive Approval:</td>
            <td style="border-right:none;border-top:none;padding:0;">
              <table class="sub-table">
                <thead>
                  <tr>
                    <th style="width:25%;">&nbsp;</th>
                    <th>Enayat</th>
                    <th>Qardan</th>
                    <th>QH Months</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="font-weight:bold;text-align:left;">Approved Amounts</td>
                    <td>${fmtCurrencyOrDash(d.approved_enayat)}</td>
                    <td>${fmtCurrencyOrDash(d.approved_qardan)}</td>
                    <td>${escOrDash(d.approved_qh_months)}</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ===== EXECUTIVE MANAGEMENT SIGNATURES ===== -->
    <tr>
      <td colspan="2" class="section-header" style="text-align:center;font-size:10pt;">
        Executive Management &mdash; Name, Signature and Date
      </td>
    </tr>
    <tr>
      <td colspan="2" style="padding:0;">
        <table class="inner" style="border:none;">
          <thead>
            <tr>
              <th style="width:33.33%;border-left:none;border-top:none;">Welfare Department</th>
              <th style="width:33.33%;border-top:none;">Zonal In-charge</th>
              <th style="width:33.33%;border-right:none;border-top:none;">Operations Head</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border-left:none;border-bottom:none;padding:6px;">
                <div style="margin-bottom:4px;"><span class="sig-label">Name:</span> ${escOrDash(d.welfare_department_name)}</div>
                <div style="margin-bottom:4px;"><span class="sig-label">Signature:</span><br/>${renderSignature(d.welfare_department_signature_drawing_data, d.welfare_department_signature_file_path)}</div>
                <div><span class="sig-label">Date:</span> ${fmtDateOrDash(d.welfare_department_date)}</div>
              </td>
              <td style="border-bottom:none;padding:6px;">
                <div style="margin-bottom:4px;"><span class="sig-label">Name:</span> ${escOrDash(d.zonal_incharge_name)}</div>
                <div style="margin-bottom:4px;"><span class="sig-label">Signature:</span><br/>${renderSignature(d.zonal_incharge_signature_drawing_data, d.zonal_incharge_signature_file_path)}</div>
                <div><span class="sig-label">Date:</span> ${fmtDateOrDash(d.zonal_incharge_date)}</div>
              </td>
              <td style="border-right:none;border-bottom:none;padding:6px;">
                <div style="margin-bottom:4px;"><span class="sig-label">Name:</span> ${escOrDash(d.operations_head_name)}</div>
                <div style="margin-bottom:4px;"><span class="sig-label">Signature:</span><br/>${renderSignature(d.operations_head_signature_drawing_data, d.operations_head_signature_file_path)}</div>
                <div><span class="sig-label">Date:</span> ${fmtDateOrDash(d.operations_head_date)}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>

  </tbody>
</table>
</div>


</body>
</html>`;
}

module.exports = renderCoverLetterTemplate;
