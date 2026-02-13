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

/** Draw a section box with title bar (form-like card) */
const drawSectionBox = (doc, x, y, width, titleBarHeight, title, fillHeader = true) => {
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  if (fillHeader) {
    doc.setFillColor(245, 245, 245);
    doc.rect(x, y, width, titleBarHeight, 'FD');
    doc.rect(x, y, width, titleBarHeight, 'S');
  }
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 50);
  doc.text(title, x + 4, y + titleBarHeight / 2 + 1.5);
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(200, 200, 200);
  doc.line(x, y + titleBarHeight, x + width, y + titleBarHeight);
  return y + titleBarHeight;
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
    const caseLabel = `Case No.: ${toString(formData.applicant_details?.case_id || caseNumber)}`;
    const dateLabel = `Date: ${formatDate(new Date().toISOString().slice(0, 10))}`;
    doc.text(caseLabel, margin, yPosition + 4);
    doc.text(dateLabel, pageWidth - margin - doc.getTextWidth(dateLabel), yPosition + 4);
    doc.setTextColor(0, 0, 0);
    yPosition += 12;

    // ----- Applicant & Counsellor (two side-by-side sections like the form) -----
    checkNewPage(55);
    const colWidth = (contentWidth - 6) / 2;
    const boxHeight = 52;

    // Applicant Details box
    let sectionY = drawSectionBox(doc, margin, yPosition, colWidth, sectionTitleHeight, 'Applicant Details');
    let innerY = sectionY + padding;
    const applicantFields = [
      { label: 'Name', value: toString(formData.applicant_details?.name) },
      { label: 'Contact', value: toString(formData.applicant_details?.contact_number) },
      { label: 'Case Id', value: toString(formData.applicant_details?.case_id || caseNumber) },
      { label: 'Jamiat', value: toString(formData.applicant_details?.jamiat) },
      { label: 'Jamaat', value: toString(formData.applicant_details?.jamaat) },
      { label: 'Age', value: toString(formData.applicant_details?.age) },
      { label: 'ITS', value: toString(formData.applicant_details?.its) },
    ];
    const photoSize = 18;
    const hasApplicantPhoto = !!formData.applicant_details?.photo;
    if (hasApplicantPhoto) {
      const added = await addImageToPDF(doc, formData.applicant_details.photo, margin + colWidth - photoSize - 4, innerY, photoSize, photoSize);
      if (!added) doc.setFontSize(7).text('Photo', margin + colWidth - photoSize - 2, innerY + photoSize / 2);
    }
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const labelW = 22;
    applicantFields.forEach((f, i) => {
      doc.setFont('helvetica', 'bold');
      doc.text(`${f.label}:`, margin + 4, innerY + 4 + i * 5);
      doc.setFont('helvetica', 'normal');
      const val = toString(f.value);
      doc.text(val.length > 28 ? val.substring(0, 27) + '…' : val, margin + 4 + labelW, innerY + 4 + i * 5);
    });
    doc.rect(margin, yPosition, colWidth, boxHeight, 'S');
    doc.setDrawColor(200, 200, 200);

    // Counsellor Details box
    sectionY = drawSectionBox(doc, margin + colWidth + 6, yPosition, colWidth, sectionTitleHeight, 'Counsellor Details');
    innerY = sectionY + padding;
    const counsellorFields = [
      { label: 'Name', value: toString(formData.counsellor_details?.name) },
      { label: 'Contact', value: toString(formData.counsellor_details?.contact_number) },
      { label: 'Jamiat', value: toString(formData.counsellor_details?.jamiat) },
      { label: 'Jamaat', value: toString(formData.counsellor_details?.jamaat) },
      { label: 'Age', value: toString(formData.counsellor_details?.age) },
      { label: 'ITS', value: toString(formData.counsellor_details?.its) },
      { label: 'Certified', value: formData.counsellor_details?.certified ? 'Yes' : 'No' },
    ];
    if (formData.counsellor_details?.photo) {
      const added = await addImageToPDF(doc, formData.counsellor_details.photo, margin + colWidth + 6 + colWidth - photoSize - 4, innerY, photoSize, photoSize);
      if (!added) doc.setFontSize(7).text('Photo', margin + colWidth + 6 + colWidth - photoSize - 2, innerY + photoSize / 2);
    }
    doc.setFontSize(9);
    counsellorFields.forEach((f, i) => {
      doc.setFont('helvetica', 'bold');
      doc.text(`${f.label}:`, margin + colWidth + 10, innerY + 4 + i * 5);
      doc.setFont('helvetica', 'normal');
      const val = toString(f.value);
      doc.text(val.length > 28 ? val.substring(0, 27) + '…' : val, margin + colWidth + 10 + labelW, innerY + 4 + i * 5);
    });
    doc.rect(margin + colWidth + 6, yPosition, colWidth, boxHeight, 'S');
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
