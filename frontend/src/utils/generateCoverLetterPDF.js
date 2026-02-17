import jsPDF from 'jspdf';

/**
 * Formats a date from YYYY-MM-DD to DD-MM-YYYY
 */
const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  } catch (e) {
    return dateString;
  }
};

/**
 * Formats a number with currency symbol
 */
const formatCurrency = (value) => {
  if (!value || value === '' || value === null || value === undefined) return '';
  const num = parseFloat(value);
  if (isNaN(num)) return '';
  return `Rs ${num.toLocaleString('en-IN')}`;
};

/**
 * Formats a number or returns empty string
 */
const formatNumber = (value) => {
  if (!value || value === '' || value === null || value === undefined) return '';
  const num = parseFloat(value);
  if (isNaN(num)) return '';
  return num.toLocaleString('en-IN');
};

/**
 * Adds an image to the PDF from base64 data
 */
const addImageToPDF = async (doc, imageData, x, y, width, height) => {
  if (!imageData) return false;
  try {
    let imageSrc = imageData;
    if (imageData.startsWith('data:image')) {
      imageSrc = imageData;
    } else if (imageData.startsWith('/') || imageData.startsWith('http')) {
      return false;
    }
    const format = imageSrc.indexOf('image/png') !== -1 ? 'PNG' : 'JPEG';
    doc.addImage(imageSrc, format, x, y, width, height);
    return true;
  } catch (error) {
    console.error('Error adding image to PDF:', error);
    return false;
  }
};

/** Draw a section box with title bar (form-like card). Use greenHeader for Applicant/Counsellor style (Image 1). */
const drawSectionBox = (doc, x, y, width, titleBarHeight, title, fillHeader = true, greenHeader = false) => {
  doc.setLineWidth(0.2);
  if (fillHeader) {
    if (greenHeader) {
      doc.setFillColor(200, 228, 218); // light green/teal like reference
      doc.setDrawColor(160, 200, 190);
    } else {
      doc.setFillColor(245, 245, 245);
      doc.setDrawColor(180, 180, 180);
    }
    doc.rect(x, y, width, titleBarHeight, 'FD');
    doc.rect(x, y, width, titleBarHeight, 'S');
  }
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(title, x + 4, y + titleBarHeight / 2 + 1.5);
  doc.setDrawColor(200, 200, 200);
  doc.line(x, y + titleBarHeight, x + width, y + titleBarHeight);
  return y + titleBarHeight;
};

/** Normalize form data so PDF works with both nested (form state) and flat (API) shapes */
const normalizeFormData = (formData, caseNumber) => {
  const get = (obj, key) => (obj && obj[key] !== undefined && obj[key] !== null ? obj[key] : undefined);
  const applicant = {
    name: get(formData.applicant_details, 'name') ?? formData.applicant_name,
    contact_number: get(formData.applicant_details, 'contact_number') ?? formData.applicant_contact_number,
    case_id: get(formData.applicant_details, 'case_id') ?? formData.applicant_case_id ?? caseNumber,
    jamiat: get(formData.applicant_details, 'jamiat') ?? formData.applicant_jamiat,
    jamaat: get(formData.applicant_details, 'jamaat') ?? formData.applicant_jamaat,
    age: get(formData.applicant_details, 'age') ?? formData.applicant_age,
    its: get(formData.applicant_details, 'its') ?? formData.applicant_its,
    photo: get(formData.applicant_details, 'photo') ?? formData.applicant_photo,
  };
  const counsellor = {
    name: get(formData.counsellor_details, 'name') ?? formData.counsellor_name,
    contact_number: get(formData.counsellor_details, 'contact_number') ?? formData.counsellor_contact_number,
    jamiat: get(formData.counsellor_details, 'jamiat') ?? formData.counsellor_jamiat,
    jamaat: get(formData.counsellor_details, 'jamaat') ?? formData.counsellor_jamaat,
    age: get(formData.counsellor_details, 'age') ?? formData.counsellor_age,
    its: get(formData.counsellor_details, 'its') ?? formData.counsellor_its,
    certified: get(formData.counsellor_details, 'certified') ?? formData.counsellor_certified ?? false,
    photo: get(formData.counsellor_details, 'photo') ?? formData.counsellor_photo,
  };
  return { applicant, counsellor };
};

/**
 * Generates a PDF for the cover letter form — formatted like the form for executive sign-off.
 * @param {Object} formData - The form data object
 * @param {Object} options - Options including caseNumber, userName, etc.
 * @returns {jsPDF} The generated PDF document
 */
export const generateCoverLetterPDF = async (formData, options = {}) => {
  const {
    caseNumber = '',
    userName = '',
    caseId = ''
  } = options;

  try {
    const { applicant, counsellor } = normalizeFormData(formData, caseNumber);

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 12;
    const contentWidth = pageWidth - margin * 2;
    const sectionTitleHeight = 8;
    const padding = 5;
    let yPosition = margin;

    const toString = (val) => {
      if (val === null || val === undefined) return '';
      return String(val);
    };

    const checkNewPage = (requiredHeight) => {
      if (yPosition + requiredHeight > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
        return true;
      }
      return false;
    };

    // ----- Document header (professional, form-like) -----
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('COVER LETTER', pageWidth / 2, yPosition + 6, { align: 'center' });
    yPosition += 10;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Baaseteen — 1447H', pageWidth / 2, yPosition + 4, { align: 'center' });
    yPosition += 8;

    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    const caseLabel = `Case No.: ${toString(applicant.case_id)}`;
    const dateLabel = `Date: ${formatDate(new Date().toISOString().slice(0, 10))}`;
    doc.text(caseLabel, margin, yPosition + 4);
    doc.text(dateLabel, pageWidth - margin - doc.getTextWidth(dateLabel), yPosition + 4);
    doc.setTextColor(0, 0, 0);
    yPosition += 12;

    // ----- Applicant Details (full width), then Counsellor Details below (full width) -----
    const photoSize = 26; // fits reduced box height
    const photoPad = 4;
    const detailsXOffset = photoSize + photoPad;
    const labelW = 24;
    const lineH = 4.5;
    const nameMaxChars = 50; // single row, truncate if longer
    const boxHeight = 50; // reduced height for applicant/counsellor boxes
    checkNewPage(boxHeight * 2 + 15);

    // Applicant Details — full width, photo LEFT, ITS below photo, Name (one compact row) then rest on RIGHT
    let sectionY = drawSectionBox(doc, margin, yPosition, contentWidth, sectionTitleHeight, 'Applicant Details', true, true);
    let innerY = sectionY + padding;
    const applicantPhotoX = margin + 4;
    if (applicant.photo) {
      const added = await addImageToPDF(doc, applicant.photo, applicantPhotoX, innerY, photoSize, photoSize);
      if (!added) {
        doc.setDrawColor(200, 200, 200);
        doc.rect(applicantPhotoX, innerY, photoSize, photoSize, 'S');
        doc.setFontSize(7);
        doc.setTextColor(140, 140, 140);
        doc.text('Applicant', applicantPhotoX + 3, innerY + photoSize / 2 - 2);
        doc.text('Photo', applicantPhotoX + 5, innerY + photoSize / 2 + 2);
        doc.setTextColor(0, 0, 0);
      }
    } else {
      doc.setDrawColor(200, 200, 200);
      doc.rect(applicantPhotoX, innerY, photoSize, photoSize, 'S');
      doc.setFontSize(7);
      doc.setTextColor(140, 140, 140);
      doc.text('Applicant', applicantPhotoX + 3, innerY + photoSize / 2 - 2);
      doc.text('Photo', applicantPhotoX + 5, innerY + photoSize / 2 + 2);
      doc.setTextColor(0, 0, 0);
    }
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(`ITS: ${toString(applicant.its) || '—'}`, applicantPhotoX + photoSize / 2, innerY + photoSize + 4, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    const applicantDetailsX = margin + detailsXOffset + 2;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Name:', applicantDetailsX, innerY + 4);
    doc.setFont('helvetica', 'normal');
    const applicantNameStr = toString(applicant.name) || '—';
    const applicantNameDisplay = applicantNameStr.length > nameMaxChars ? applicantNameStr.substring(0, nameMaxChars - 1) + '…' : applicantNameStr;
    doc.text(applicantNameDisplay, applicantDetailsX + labelW, innerY + 4);
    const applicantRestFields = [
      { label: 'Contact', value: applicant.contact_number },
      { label: 'Case Id', value: applicant.case_id },
      { label: 'Jamiat', value: applicant.jamiat },
      { label: 'Jamaat', value: applicant.jamaat },
      { label: 'Age', value: applicant.age },
    ];
    doc.setFontSize(9);
    applicantRestFields.forEach((f, i) => {
      const yOff = innerY + 4 + lineH + i * lineH;
      doc.setFont('helvetica', 'bold');
      doc.text(`${f.label}:`, applicantDetailsX, yOff);
      doc.setFont('helvetica', 'normal');
      const val = toString(f.value);
      const displayVal = val.length > 24 ? val.substring(0, 23) + '…' : val || '—';
      doc.text(displayVal, applicantDetailsX + labelW, yOff);
    });
    doc.setDrawColor(180, 200, 190);
    doc.rect(margin, yPosition, contentWidth, boxHeight, 'S');
    doc.setDrawColor(200, 200, 200);
    yPosition += boxHeight + 8;

    // Counsellor Details — full width section below Applicant, same layout
    checkNewPage(boxHeight + 5);
    sectionY = drawSectionBox(doc, margin, yPosition, contentWidth, sectionTitleHeight, 'Counsellor Details', true, true);
    innerY = sectionY + padding;
    const counsellorPhotoX = margin + 4;
    if (counsellor.photo) {
      const added = await addImageToPDF(doc, counsellor.photo, counsellorPhotoX, innerY, photoSize, photoSize);
      if (!added) {
        doc.setDrawColor(200, 200, 200);
        doc.rect(counsellorPhotoX, innerY, photoSize, photoSize, 'S');
        doc.setFontSize(7);
        doc.setTextColor(140, 140, 140);
        doc.text('Counsellor', counsellorPhotoX + 2, innerY + photoSize / 2 - 2);
        doc.text('Photo', counsellorPhotoX + 5, innerY + photoSize / 2 + 2);
        doc.setTextColor(0, 0, 0);
      }
    } else {
      doc.setDrawColor(200, 200, 200);
      doc.rect(counsellorPhotoX, innerY, photoSize, photoSize, 'S');
      doc.setFontSize(7);
      doc.setTextColor(140, 140, 140);
      doc.text('Counsellor', counsellorPhotoX + 2, innerY + photoSize / 2 - 2);
      doc.text('Photo', counsellorPhotoX + 5, innerY + photoSize / 2 + 2);
      doc.setTextColor(0, 0, 0);
    }
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(`ITS: ${toString(counsellor.its) || '—'}`, counsellorPhotoX + photoSize / 2, innerY + photoSize + 4, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    const counsellorDetailsX = margin + detailsXOffset + 2;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Name:', counsellorDetailsX, innerY + 4);
    doc.setFont('helvetica', 'normal');
    const counsellorNameStr = toString(counsellor.name) || '—';
    const counsellorNameDisplay = counsellorNameStr.length > nameMaxChars ? counsellorNameStr.substring(0, nameMaxChars - 1) + '…' : counsellorNameStr;
    doc.text(counsellorNameDisplay, counsellorDetailsX + labelW, innerY + 4);
    const counsellorRestFields = [
      { label: 'Contact', value: counsellor.contact_number },
      { label: 'Jamiat', value: counsellor.jamiat },
      { label: 'Jamaat', value: counsellor.jamaat },
      { label: 'Age', value: counsellor.age },
      { label: 'Certified', value: counsellor.certified ? 'Yes' : 'No' },
    ];
    doc.setFontSize(9);
    counsellorRestFields.forEach((f, i) => {
      const yOff = innerY + 4 + lineH + i * lineH;
      doc.setFont('helvetica', 'bold');
      doc.text(`${f.label}:`, counsellorDetailsX, yOff);
      doc.setFont('helvetica', 'normal');
      const val = toString(f.value);
      const displayVal = val.length > 24 ? val.substring(0, 23) + '…' : val || '—';
      doc.text(displayVal, counsellorDetailsX + labelW, yOff);
    });
    doc.setDrawColor(180, 200, 190);
    doc.rect(margin, yPosition, contentWidth, boxHeight, 'S');
    yPosition += boxHeight + 10;

    // ----- Financial and Business Overview (single section like form) -----
    checkNewPage(75);
    const finStartY = yPosition;
    sectionY = drawSectionBox(doc, margin, yPosition, contentWidth, sectionTitleHeight, 'Financial and Business Overview');
    yPosition = sectionY + padding;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    const incomeRows = [
      { label: 'Current Personal Income', value: formatCurrency(formData.current_personal_income) },
      { label: 'Current Family Income', value: formatCurrency(formData.current_family_income) },
      { label: 'Earning Family Members', value: formatNumber(formData.earning_family_members) },
      { label: 'Dependents', value: formatNumber(formData.dependents) },
    ];
    incomeRows.forEach((r, i) => {
      doc.setFont('helvetica', 'bold');
      doc.text(`${r.label}:`, margin + 4, yPosition + 4 + i * 5);
      doc.setFont('helvetica', 'normal');
      doc.text(toString(r.value), margin + 55, yPosition + 4 + i * 5);
    });
    yPosition += incomeRows.length * 5 + 4;

    doc.setFont('helvetica', 'bold');
    doc.text('Assets (House / Shop / Gold / Machinery / Stock):', margin + 4, yPosition + 4);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `${formatCurrency(formData.asset_house)} / ${formatCurrency(formData.asset_shop)} / ${formatCurrency(formData.asset_gold)} / ${formatCurrency(formData.asset_machinery)} / ${formatCurrency(formData.asset_stock)}`,
      margin + 4,
      yPosition + 9
    );
    yPosition += 16;

    doc.setFont('helvetica', 'bold');
    doc.text('Liabilities (Qardan / Den / Others):', margin + 4, yPosition + 4);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `${formatCurrency(formData.liability_qardan)} / ${formatCurrency(formData.liability_den)} / ${formatCurrency(formData.liability_others)}`,
      margin + 4,
      yPosition + 9
    );
    yPosition += 16;

    doc.setFont('helvetica', 'bold');
    doc.text('Business Name & Year:', margin + 4, yPosition + 4);
    doc.setFont('helvetica', 'normal');
    doc.text(toString(formData.business_name), margin + 45, yPosition + 4);
    yPosition += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Industry / Segment:', margin + 4, yPosition + 4);
    doc.setFont('helvetica', 'normal');
    doc.text(toString(formData.industry_segment), margin + 45, yPosition + 4);
    yPosition += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Present Occupation / Business:', margin + 4, yPosition + 4);
    doc.setFont('helvetica', 'normal');
    const occupation = toString(formData.present_occupation);
    const occLines = doc.splitTextToSize(occupation || '—', contentWidth - 12);
    doc.text(occLines, margin + 4, yPosition + 8);
    yPosition += Math.max(8, occLines.length * 5) + 6;

    doc.rect(margin, finStartY, contentWidth, yPosition - finStartY, 'S');
    yPosition += 8;

    // ----- Summary of Proposed Upliftment Plan -----
    checkNewPage(35);
    const upliftStartY = yPosition;
    sectionY = drawSectionBox(doc, margin, yPosition, contentWidth, sectionTitleHeight, 'Summary of Proposed Upliftment Plan');
    yPosition = sectionY + padding;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const upliftText = toString(formData.proposed_upliftment_plan) || '—';
    const upliftLines = doc.splitTextToSize(upliftText, contentWidth - 8);
    doc.text(upliftLines, margin + 4, yPosition + 4);
    yPosition += Math.max(12, upliftLines.length * 5) + 6;
    doc.rect(margin, upliftStartY, contentWidth, yPosition - upliftStartY, 'S');
    yPosition += 8;

    // ----- Financial Assistance (4 columns: Label, Enayat, Qardan, Total) -----
    checkNewPage(35);
    const faStartY = yPosition;
    sectionY = drawSectionBox(doc, margin, yPosition, contentWidth, sectionTitleHeight, 'Financial Assistance');
    yPosition = sectionY + padding;

    const faLabelW = 28;
    const faColW = (contentWidth - faLabelW) / 3;
    const faX1 = margin + faLabelW;
    const faX2 = margin + faLabelW + faColW;
    const faX3 = margin + faLabelW + faColW * 2;
    const rowH = 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('', margin + 2, yPosition);
    doc.text('Enayat Amount', faX1 + 3, yPosition);
    doc.text('Qardan Amount', faX2 + 3, yPosition);
    doc.text('Total Amount', faX3 + 3, yPosition);
    yPosition += rowH;
    doc.line(margin, yPosition, pageWidth - margin, yPosition);

    doc.setFont('helvetica', 'normal');
    doc.setFont('helvetica', 'bold');
    doc.text('Requested', margin + 2, yPosition + 5);
    doc.setFont('helvetica', 'normal');
    doc.text(formatCurrency(formData.requested_enayat) || '—', faX1 + 3, yPosition + 5);
    doc.text(formatCurrency(formData.requested_qardan) || '—', faX2 + 3, yPosition + 5);
    doc.text(formatCurrency(formData.requested_total) || '—', faX3 + 3, yPosition + 5);
    yPosition += rowH;

    doc.setFont('helvetica', 'bold');
    doc.text('Recommended', margin + 2, yPosition + 5);
    doc.setFont('helvetica', 'normal');
    doc.text(formatCurrency(formData.recommended_enayat) || '—', faX1 + 3, yPosition + 5);
    doc.text(formatCurrency(formData.recommended_qardan) || '—', faX2 + 3, yPosition + 5);
    doc.text(formatCurrency(formData.recommended_total) || '—', faX3 + 3, yPosition + 5);
    yPosition += rowH + 4;

    doc.setFont('helvetica', 'bold');
    doc.text('Non-financial Assistance:', margin + 2, yPosition + 4);
    doc.setFont('helvetica', 'normal');
    doc.text(toString(formData.non_financial_assistance) || '—', margin + 50, yPosition + 4);
    yPosition += 10;

    doc.rect(margin, faStartY, contentWidth, yPosition - faStartY, 'S');
    yPosition += 8;

    // ----- Projected Income -----
    checkNewPage(40);
    const projStartY = yPosition;
    sectionY = drawSectionBox(doc, margin, yPosition, contentWidth, sectionTitleHeight, 'Projected Income');
    yPosition = sectionY + padding;

    const projColW = (contentWidth - 22) / 5;
    const projRowH = 7;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('', margin + 2, yPosition);
    for (let i = 1; i <= 5; i++) doc.text(`Year ${i}`, margin + 22 + (i - 1) * projColW + 3, yPosition);
    yPosition += projRowH;
    doc.line(margin, yPosition, pageWidth - margin, yPosition);

    doc.setFont('helvetica', 'normal');
    doc.setFont('helvetica', 'bold');
    doc.text('Applicant', margin + 2, yPosition + 4);
    doc.setFont('helvetica', 'normal');
    doc.text(formatCurrency(formData.applicant_projected_income_after_1_year) || '—', margin + 22 + 3, yPosition + 4);
    doc.text(formatCurrency(formData.applicant_projected_income_after_2_years) || '—', margin + 22 + projColW + 3, yPosition + 4);
    doc.text(formatCurrency(formData.applicant_projected_income_after_3_years) || '—', margin + 22 + projColW * 2 + 3, yPosition + 4);
    doc.text(formatCurrency(formData.applicant_projected_income_after_4_years) || '—', margin + 22 + projColW * 3 + 3, yPosition + 4);
    doc.text(formatCurrency(formData.applicant_projected_income_after_5_years) || '—', margin + 22 + projColW * 4 + 3, yPosition + 4);
    yPosition += projRowH;
    doc.setFont('helvetica', 'bold');
    doc.text('Family', margin + 2, yPosition + 4);
    doc.setFont('helvetica', 'normal');
    doc.text(formatCurrency(formData.family_projected_income_after_1_year) || '—', margin + 22 + 3, yPosition + 4);
    doc.text(formatCurrency(formData.family_projected_income_after_2_years) || '—', margin + 22 + projColW + 3, yPosition + 4);
    doc.text(formatCurrency(formData.family_projected_income_after_3_years) || '—', margin + 22 + projColW * 2 + 3, yPosition + 4);
    doc.text(formatCurrency(formData.family_projected_income_after_4_years) || '—', margin + 22 + projColW * 3 + 3, yPosition + 4);
    doc.text(formatCurrency(formData.family_projected_income_after_5_years) || '—', margin + 22 + projColW * 4 + 3, yPosition + 4);
    yPosition += projRowH + 4;

    doc.rect(margin, projStartY, contentWidth, yPosition - projStartY, 'S');
    yPosition += 8;

    // ----- Welfare Dept Comments -----
    checkNewPage(30);
    const commentsStartY = yPosition;
    sectionY = drawSectionBox(doc, margin, yPosition, contentWidth, sectionTitleHeight, 'Welfare Department Comments');
    yPosition = sectionY + padding;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const comments = toString(formData.welfare_department_comments) || '—';
    const commentLines = doc.splitTextToSize(comments, contentWidth - 8);
    doc.text(commentLines, margin + 4, yPosition + 4);
    yPosition += Math.max(10, commentLines.length * 5) + 6;
    doc.rect(margin, commentsStartY, contentWidth, yPosition - commentsStartY, 'S');
    yPosition += 8;

    // ----- Executive Approval (for executive table sign-off) -----
    checkNewPage(45);
    const execBoxH = 38;
    const execStartY = yPosition;
    doc.setFillColor(232, 245, 233); // light green
    doc.rect(margin, yPosition, contentWidth, execBoxH, 'F');
    doc.setDrawColor(160, 180, 160);
    doc.rect(margin, yPosition, contentWidth, execBoxH, 'S');

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 100, 0);
    doc.text('Executive Approval (For Sign-off)', margin + 6, yPosition + 10);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Approved Enayat: ${formatCurrency(formData.approved_enayat)}`, margin + 6, yPosition + 20);
    doc.text(`Approved Qardan: ${formatCurrency(formData.approved_qardan)}`, margin + 6, yPosition + 28);
    doc.text(`QH Months: ${toString(formData.approved_qh_months) || '—'}`, margin + 6, yPosition + 36);
    yPosition = execStartY + execBoxH + 10;

    // ----- Signatures (Welfare Dept | Zonal In-charge | Operations Head) -----
    checkNewPage(55);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Executive Management — Name, Signature and Date', margin, yPosition);
    yPosition += 8;

    const sigColW = contentWidth / 3;
    const sigBoxH = 42;
    const sigTableY = yPosition;

    doc.setDrawColor(180, 180, 180);
    doc.rect(margin, sigTableY, contentWidth, sigBoxH, 'S');
    doc.line(margin + sigColW, sigTableY, margin + sigColW, sigTableY + sigBoxH);
    doc.line(margin + sigColW * 2, sigTableY, margin + sigColW * 2, sigTableY + sigBoxH);
    doc.line(margin, sigTableY + 10, pageWidth - margin, sigTableY + 10);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Welfare Department', margin + 5, sigTableY + 7);
    doc.text('Zonal In-charge', margin + sigColW + 5, sigTableY + 7);
    doc.text('Operations Head', margin + sigColW * 2 + 5, sigTableY + 7);

    const drawSignatureBlock = async (startX, rolePrefix) => {
      let sy = sigTableY + 14;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('Name:', startX + 5, sy);
      doc.text(toString(formData[`${rolePrefix}_name`]) || '—', startX + 18, sy);
      sy += 8;
      doc.text('Signature:', startX + 5, sy);
      const sigData = formData[`${rolePrefix}_signature_drawing_data`] || formData[`${rolePrefix}_signature_file_path`];
      if (sigData) {
        const added = await addImageToPDF(doc, sigData, startX + 18, sy - 4, 28, 10);
        if (!added) doc.text('________________', startX + 18, sy);
      } else doc.text('________________', startX + 18, sy);
      sy += 10;
      doc.text('Date:', startX + 5, sy);
      doc.text(formatDate(formData[`${rolePrefix}_date`]) || '—', startX + 18, sy);
    };

    await drawSignatureBlock(margin, 'welfare_department');
    await drawSignatureBlock(margin + sigColW, 'zonal_incharge');
    await drawSignatureBlock(margin + sigColW * 2, 'operations_head');

    yPosition = sigTableY + sigBoxH + 10;

    // ----- Footer -----
    checkNewPage(12);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 100, 100);
    doc.text(`Cover letter prepared by ${userName || 'System'}`, pageWidth / 2, yPosition, { align: 'center' });
    doc.setTextColor(0, 0, 0);

    return doc;
  } catch (error) {
    console.error('Error in generateCoverLetterPDF:', error);
    throw error;
  }
};
