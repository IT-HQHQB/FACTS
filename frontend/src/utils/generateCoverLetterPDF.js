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
    // Handle base64 data URLs
    let imageSrc = imageData;
    if (imageData.startsWith('data:image')) {
      imageSrc = imageData;
    } else if (imageData.startsWith('/') || imageData.startsWith('http')) {
      // If it's a file path, we'd need to fetch it, but for now skip
      return false;
    }
    
    doc.addImage(imageSrc, 'JPEG', x, y, width, height);
    return true;
  } catch (error) {
    console.error('Error adding image to PDF:', error);
    return false;
  }
};

/**
 * Generates a PDF for the cover letter form
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
    // Create PDF document (A4 size: 210mm x 297mm)
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 10;
    const contentWidth = pageWidth - (margin * 2);
    let yPosition = margin;

    // Helper function to convert any value to string for PDF text
    const toString = (val) => {
      if (val === null || val === undefined) return '';
      return String(val);
    };

    // Helper function to check if we need a new page
    const checkNewPage = (requiredHeight) => {
      if (yPosition + requiredHeight > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
        return true;
      }
      return false;
    };

  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Baaseteen - 1447H', pageWidth / 2, yPosition + 10, { align: 'center' });
  yPosition += 20;

  // Applicant and Counsellor Details Section (Two-column table)
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  yPosition += 5;
  
  const tableStartY = yPosition;
  const col1X = margin;
  const col2X = pageWidth / 2;
  const colWidth = (contentWidth / 2) - 5;
  const rowHeight = 8;
  
  // Table headers
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Applicant Details', col1X + 5, yPosition);
  doc.text('Counsellor Details', col2X + 5, yPosition);
  yPosition += rowHeight;

  // Draw table borders
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.1);
  
  // Applicant Details Column
  const applicantFields = [
    { label: 'Name', value: toString(formData.applicant_details?.name) },
    { label: 'Contact', value: toString(formData.applicant_details?.contact_number) },
    { label: 'Case Id', value: toString(formData.applicant_details?.case_id || caseNumber) },
    { label: 'Jamiat', value: toString(formData.applicant_details?.jamiat) },
    { label: 'Jamaat', value: toString(formData.applicant_details?.jamaat) },
    { label: 'Age', value: toString(formData.applicant_details?.age) },
  ];

  // Counsellor Details Column
  const counsellorFields = [
    { label: 'Name', value: toString(formData.counsellor_details?.name) },
    { label: 'Contact', value: toString(formData.counsellor_details?.contact_number) },
    { label: 'Jamiat', value: toString(formData.counsellor_details?.jamiat) },
    { label: 'Jamaat', value: toString(formData.counsellor_details?.jamaat) },
    { label: 'Age', value: toString(formData.counsellor_details?.age) },
    { label: 'ITS', value: toString(formData.counsellor_details?.its) },
  ];

  const maxRows = Math.max(applicantFields.length, counsellorFields.length);
  let currentY = yPosition;

  for (let i = 0; i < maxRows; i++) {
    // Draw horizontal line
    doc.line(col1X, currentY, pageWidth - margin, currentY);
    
    // Applicant column
    if (i < applicantFields.length) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`${applicantFields[i].label}:`, col1X + 2, currentY + 5);
      doc.text(toString(applicantFields[i].value), col1X + 25, currentY + 5);
    }
    
    // Counsellor column
    if (i < counsellorFields.length) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`${counsellorFields[i].label}:`, col2X + 2, currentY + 5);
      doc.text(toString(counsellorFields[i].value), col2X + 25, currentY + 5);
    }
    
    currentY += rowHeight;
  }

  // Draw vertical line between columns
  doc.line(col2X, tableStartY - 5, col2X, currentY);
  // Draw outer borders
  doc.rect(col1X, tableStartY - 5, contentWidth, currentY - tableStartY + 5);

  // Add photos (if available)
  const photoSize = 20;
  const photoY = tableStartY + 5;
  
  // Applicant photo
  if (formData.applicant_details?.photo) {
    const photoAdded = await addImageToPDF(
      doc,
      formData.applicant_details.photo,
      col1X + contentWidth / 4 - photoSize / 2,
      photoY,
      photoSize,
      photoSize
    );
    if (!photoAdded) {
      doc.setFontSize(8);
      doc.text('ITS Photo', col1X + contentWidth / 4 - 10, photoY + photoSize / 2);
    }
  } else {
    doc.setFontSize(8);
    doc.text('ITS Photo', col1X + contentWidth / 4 - 10, photoY + photoSize / 2);
  }

  // Counsellor photo
  if (formData.counsellor_details?.photo) {
    const photoAdded = await addImageToPDF(
      doc,
      formData.counsellor_details.photo,
      col2X + contentWidth / 4 - photoSize / 2,
      photoY,
      photoSize,
      photoSize
    );
    if (!photoAdded) {
      doc.setFontSize(8);
      doc.text('ITS Photo', col2X + contentWidth / 4 - 10, photoY + photoSize / 2);
    }
  } else {
    doc.setFontSize(8);
    doc.text('ITS Photo', col2X + contentWidth / 4 - 10, photoY + photoSize / 2);
  }

  yPosition = currentY + 10;

  // Financial and Business Information Section
  checkNewPage(60);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Financial and Business Information', margin, yPosition);
  yPosition += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const financialFields = [
    { label: 'Current Personal Income', value: formatCurrency(formData.current_personal_income) },
    { label: 'Current Family Income', value: formatCurrency(formData.current_family_income) },
    { label: 'Earning family members', value: formatNumber(formData.earning_family_members) },
    { label: 'Dependents', value: formatNumber(formData.dependents) },
    { label: 'Assets (Shop / House / Gold / Machinery / Stock)', 
      value: `${formatCurrency(formData.asset_shop)} / ${formatCurrency(formData.asset_house)} / ${formatCurrency(formData.asset_gold)} / ${formatCurrency(formData.asset_machinery)} / ${formatCurrency(formData.asset_stock)}` },
    { label: 'Liabilities (Qardan / Den / Others)', 
      value: `${formatCurrency(formData.liability_qardan)} / ${formatCurrency(formData.liability_den)} / ${formatCurrency(formData.liability_others)}` },
    { label: 'Business Name & Year of starting', value: toString(formData.business_name) },
    { label: 'Industry / Segment', value: toString(formData.industry_segment) },
    { label: 'Present occupation / business (Products / Services, revenue, etc.)', value: toString(formData.present_occupation) },
  ];

  financialFields.forEach(field => {
    if (yPosition > pageHeight - margin - 10) {
      doc.addPage();
      yPosition = margin;
    }
    doc.text(`${field.label}: ${toString(field.value)}`, margin + 5, yPosition);
    yPosition += 6;
  });

  yPosition += 5;

  // Financial Assistance Table
  checkNewPage(30);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Financial Assistance', margin, yPosition);
  yPosition += 8;

  const tableY = yPosition;
  const tableColWidth = contentWidth / 3;
  const tableRowHeight = 8;

  // Table headers
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Enayat Amount', margin + 5, yPosition);
  doc.text('Qardan Amount', margin + tableColWidth + 5, yPosition);
  doc.text('Total Amount', margin + (tableColWidth * 2) + 5, yPosition);
  yPosition += tableRowHeight;

  // Draw table borders
  doc.line(margin, tableY - 5, pageWidth - margin, tableY - 5);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  doc.line(margin + tableColWidth, tableY - 5, margin + tableColWidth, yPosition + tableRowHeight);
  doc.line(margin + (tableColWidth * 2), tableY - 5, margin + (tableColWidth * 2), yPosition + tableRowHeight);

  // Requested row
  doc.setFont('helvetica', 'normal');
  doc.text('Requested', margin + 2, yPosition);
  doc.text(formatCurrency(formData.requested_enayat) || '', margin + tableColWidth + 5, yPosition);
  doc.text(formatCurrency(formData.requested_qardan) || '', margin + (tableColWidth * 2) + 5, yPosition);
  doc.text(formatCurrency(formData.requested_total) || '', margin + (tableColWidth * 2) + 5, yPosition);
  yPosition += tableRowHeight;

  // Recommended row
  doc.text('Recommended', margin + 2, yPosition);
  doc.text(formatCurrency(formData.recommended_enayat) || '', margin + tableColWidth + 5, yPosition);
  doc.text(formatCurrency(formData.recommended_qardan) || '', margin + (tableColWidth * 2) + 5, yPosition);
  doc.text(formatCurrency(formData.recommended_total) || '', margin + (tableColWidth * 2) + 5, yPosition);
  yPosition += tableRowHeight + 5;

  // Draw closing border
  doc.line(margin, yPosition, pageWidth - margin, yPosition);

  // Non-financial Assistance
  checkNewPage(15);
  yPosition += 5;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Non-financial Assistance: ${formData.non_financial_assistance || ''}`, margin, yPosition);
  yPosition += 10;

  // Projected Income Table
  checkNewPage(30);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Projected Income', margin, yPosition);
  yPosition += 8;

  const projectedTableY = yPosition;
  const projectedColWidth = contentWidth / 6; // 6 columns: label + 5 years
  const projectedRowHeight = 8;

  // Table headers
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('After 1 year', margin + projectedColWidth + 5, yPosition);
  doc.text('After 2 years', margin + (projectedColWidth * 2) + 5, yPosition);
  doc.text('After 3 years', margin + (projectedColWidth * 3) + 5, yPosition);
  doc.text('After 4 years', margin + (projectedColWidth * 4) + 5, yPosition);
  doc.text('After 5 years', margin + (projectedColWidth * 5) + 5, yPosition);
  yPosition += projectedRowHeight;

  // Draw table borders
  doc.line(margin, projectedTableY - 5, pageWidth - margin, projectedTableY - 5);
  for (let i = 0; i <= 6; i++) {
    doc.line(margin + (projectedColWidth * i), projectedTableY - 5, margin + (projectedColWidth * i), yPosition + (projectedRowHeight * 2));
  }

  // Applicant row
  doc.setFont('helvetica', 'normal');
  doc.text('Applicant', margin + 2, yPosition);
  doc.text(formatCurrency(formData.applicant_projected_income_after_1_year) || '', margin + projectedColWidth + 5, yPosition);
  doc.text(formatCurrency(formData.applicant_projected_income_after_2_years) || '', margin + (projectedColWidth * 2) + 5, yPosition);
  doc.text(formatCurrency(formData.applicant_projected_income_after_3_years) || '', margin + (projectedColWidth * 3) + 5, yPosition);
  doc.text(formatCurrency(formData.applicant_projected_income_after_4_years) || '', margin + (projectedColWidth * 4) + 5, yPosition);
  doc.text(formatCurrency(formData.applicant_projected_income_after_5_years) || '', margin + (projectedColWidth * 5) + 5, yPosition);
  yPosition += projectedRowHeight;

  // Family row
  doc.text('Family', margin + 2, yPosition);
  doc.text(formatCurrency(formData.family_projected_income_after_1_year) || '', margin + projectedColWidth + 5, yPosition);
  doc.text(formatCurrency(formData.family_projected_income_after_2_years) || '', margin + (projectedColWidth * 2) + 5, yPosition);
  doc.text(formatCurrency(formData.family_projected_income_after_3_years) || '', margin + (projectedColWidth * 3) + 5, yPosition);
  doc.text(formatCurrency(formData.family_projected_income_after_4_years) || '', margin + (projectedColWidth * 4) + 5, yPosition);
  doc.text(formatCurrency(formData.family_projected_income_after_5_years) || '', margin + (projectedColWidth * 5) + 5, yPosition);
  yPosition += projectedRowHeight + 5;

  // Draw closing border
  doc.line(margin, yPosition, pageWidth - margin, yPosition);

  // Summary of Proposed Upliftment Plan
  checkNewPage(30);
  yPosition += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Summary of Proposed Upliftment Plan: ${formData.proposed_upliftment_plan || ''}`, margin, yPosition);
  yPosition += 15;

  // Welfare Dept Comments
  checkNewPage(30);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const comments = formData.welfare_department_comments || '';
  const splitComments = doc.splitTextToSize(`Welfare Dept Comments: ${comments}`, contentWidth);
  doc.text(splitComments, margin, yPosition);
  yPosition += splitComments.length * 5 + 10;

  // Executive Approval Section (with green background)
  checkNewPage(40);
  const execStartY = yPosition;
  doc.setFillColor(200, 255, 200); // Light green
  doc.rect(margin, yPosition, contentWidth, 30, 'F');
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 0, 0); // Red text
  doc.text('Executive Approval:', margin + 5, yPosition + 8);
  
  doc.setTextColor(0, 0, 0); // Black text
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  yPosition += 15;
  doc.text(`Enayat: ${formatCurrency(formData.approved_enayat)}`, margin + 5, yPosition);
  doc.text(`Qardan: ${formatCurrency(formData.approved_qardan)}`, margin + 5, yPosition + 8);
  doc.text(`QH Months: ${formData.approved_qh_months || ''}`, margin + 5, yPosition + 16);
  
  yPosition = execStartY + 35;

  // Signature and Date Section (Three columns)
  checkNewPage(50);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Executive Management Name, Signature and Date', margin, yPosition);
  yPosition += 10;

  const sigTableY = yPosition;
  const sigColWidth = contentWidth / 3;
  const sigRowHeight = 10;

  // Draw table borders
  doc.rect(margin, sigTableY, contentWidth, sigRowHeight * 4);

  // Column headers
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Welfare Dept', margin + 5, sigTableY + 7);
  doc.text('Zonal In-charge', margin + sigColWidth + 5, sigTableY + 7);
  doc.text('Operations Head', margin + (sigColWidth * 2) + 5, sigTableY + 7);

  // Draw vertical lines
  doc.line(margin + sigColWidth, sigTableY, margin + sigColWidth, sigTableY + (sigRowHeight * 4));
  doc.line(margin + (sigColWidth * 2), sigTableY, margin + (sigColWidth * 2), sigTableY + (sigRowHeight * 4));

  // Draw horizontal lines
  doc.line(margin, sigTableY + sigRowHeight, pageWidth - margin, sigTableY + sigRowHeight);
  doc.line(margin, sigTableY + (sigRowHeight * 2), pageWidth - margin, sigTableY + (sigRowHeight * 2));
  doc.line(margin, sigTableY + (sigRowHeight * 3), pageWidth - margin, sigTableY + (sigRowHeight * 3));

  // Welfare Department
  let sigY = sigTableY + sigRowHeight + 5;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Name:', margin + 5, sigY);
  doc.text(formData.welfare_department_name || '', margin + 20, sigY);
  sigY += sigRowHeight;
  doc.text('Signature:', margin + 5, sigY);
  
  // Add signature image if available
  const welfareSig = formData.welfare_department_signature_drawing_data || formData.welfare_department_signature_file_path;
  if (welfareSig) {
    const sigAdded = await addImageToPDF(doc, welfareSig, margin + 20, sigY - 5, 30, 10);
    if (!sigAdded) {
      doc.text('________________', margin + 20, sigY);
    }
  } else {
    doc.text('________________', margin + 20, sigY);
  }
  sigY += sigRowHeight;
  doc.text('Date:', margin + 5, sigY);
  doc.text(formatDate(formData.welfare_department_date) || '', margin + 20, sigY);

  // Zonal In-charge
  sigY = sigTableY + sigRowHeight + 5;
  doc.text('Name:', margin + sigColWidth + 5, sigY);
  doc.text(formData.zonal_incharge_name || '', margin + sigColWidth + 20, sigY);
  sigY += sigRowHeight;
  doc.text('Signature:', margin + sigColWidth + 5, sigY);
  
  const zonalSig = formData.zonal_incharge_signature_drawing_data || formData.zonal_incharge_signature_file_path;
  if (zonalSig) {
    const sigAdded = await addImageToPDF(doc, zonalSig, margin + sigColWidth + 20, sigY - 5, 30, 10);
    if (!sigAdded) {
      doc.text('________________', margin + sigColWidth + 20, sigY);
    }
  } else {
    doc.text('________________', margin + sigColWidth + 20, sigY);
  }
  sigY += sigRowHeight;
  doc.text('Date:', margin + sigColWidth + 5, sigY);
  doc.text(formatDate(formData.zonal_incharge_date) || '', margin + sigColWidth + 20, sigY);

  // Operations Head
  sigY = sigTableY + sigRowHeight + 5;
  doc.text('Name:', margin + (sigColWidth * 2) + 5, sigY);
  doc.text(formData.operations_head_name || '', margin + (sigColWidth * 2) + 20, sigY);
  sigY += sigRowHeight;
  doc.text('Signature:', margin + (sigColWidth * 2) + 5, sigY);
  
  const opsSig = formData.operations_head_signature_drawing_data || formData.operations_head_signature_file_path;
  if (opsSig) {
    const sigAdded = await addImageToPDF(doc, opsSig, margin + (sigColWidth * 2) + 20, sigY - 5, 30, 10);
    if (!sigAdded) {
      doc.text('________________', margin + (sigColWidth * 2) + 20, sigY);
    }
  } else {
    doc.text('________________', margin + (sigColWidth * 2) + 20, sigY);
  }
  sigY += sigRowHeight;
  doc.text('Date:', margin + (sigColWidth * 2) + 5, sigY);
  doc.text(formatDate(formData.operations_head_date) || '', margin + (sigColWidth * 2) + 20, sigY);

  yPosition = sigTableY + (sigRowHeight * 4) + 10;

    // Footer
    checkNewPage(15);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text(`Cover page prepared by ${userName || 'System'}`, pageWidth / 2, yPosition, { align: 'center' });

    return doc;
  } catch (error) {
    console.error('Error in generateCoverLetterPDF:', error);
    throw error;
  }
};
