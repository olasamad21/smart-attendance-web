import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PDFReportOptions {
  title: string;
  subtitle?: string;
  courseCode: string;
  courseTitle: string;
  lecturerName?: string;
  date?: string;
  headers: string[];
  rows: (string | number)[][];
  filename: string;
}

export function downloadPDF(options: PDFReportOptions): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // --- Header Section ---
  // Green accent bar at top
  doc.setFillColor(45, 106, 79); // Primary green
  doc.rect(0, 0, pageWidth, 3, 'F');

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(30, 30, 30);
  doc.text(options.title, 14, 16);

  // Course info line
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  doc.text(`${options.courseCode} — ${options.courseTitle}`, 14, 24);

  // Metadata line
  let metaY = 30;
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  const metaParts: string[] = [];
  if (options.lecturerName) metaParts.push(`Lecturer: ${options.lecturerName}`);
  if (options.date) metaParts.push(`Date: ${options.date}`);
  metaParts.push(`Generated: ${new Date().toLocaleString()}`);
  doc.text(metaParts.join('   •   '), 14, metaY);

  // Thin separator line
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(14, metaY + 3, pageWidth - 14, metaY + 3);

  // --- Table ---
  autoTable(doc, {
    startY: metaY + 7,
    head: [options.headers],
    body: options.rows.map(row => row.map(cell => String(cell))),
    theme: 'grid',
    headStyles: {
      fillColor: [45, 106, 79],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 3,
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [40, 40, 40],
    },
    alternateRowStyles: {
      fillColor: [245, 248, 245],
    },
    styles: {
      lineColor: [220, 220, 220],
      lineWidth: 0.2,
      overflow: 'linebreak',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 }, // S/N column
    },
    margin: { left: 14, right: 14 },
    didParseCell: (data: any) => {
      // Color the Status column
      const lastColIndex = options.headers.length - 1;
      if (data.section === 'body' && data.column.index === lastColIndex) {
        const val = String(data.cell.raw).toLowerCase();
        if (val === 'present') {
          data.cell.styles.textColor = [45, 106, 79];
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'absent') {
          data.cell.styles.textColor = [200, 60, 60];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  // --- Footer ---
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.text(
      `EduVerify Smart Attendance System   •   Page ${i} of ${pageCount}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }

  doc.save(options.filename.endsWith('.pdf') ? options.filename : `${options.filename}.pdf`);
}
