import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ColumnDef {
  key: string;
  header: string;
  width?: number;
}

/**
 * Export data to Excel (.xlsx) format
 */
export function exportToExcel<T extends Record<string, unknown>>(
  data: T[],
  columns: ColumnDef[],
  filename: string
): void {
  // Transform data to match column headers
  const worksheetData = data.map((row) =>
    columns.reduce((acc, col) => {
      acc[col.header] = row[col.key] ?? '';
      return acc;
    }, {} as Record<string, unknown>)
  );

  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(worksheetData);

  // Set column widths
  const colWidths = columns.map((col) => ({
    wch: col.width || Math.max(col.header.length, 15),
  }));
  worksheet['!cols'] = colWidths;

  // Create workbook and append worksheet
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');

  // Generate file and trigger download
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export interface ReportFilters {
  wing?: string;
  statuses?: string[];
  isolation?: string;
  diagnoses?: string[];
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Export data to PDF format with a table
 */
export function exportToPDF<T extends Record<string, unknown>>(
  data: T[],
  columns: ColumnDef[],
  title: string,
  filename: string,
  filters?: ReportFilters
): void {
  // Create PDF document in landscape for wider tables
  const doc = new jsPDF({
    orientation: columns.length > 5 ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Add title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 20);

  // Add date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

  let startY = 35;

  // Add filter details if provided
  if (filters) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Applied Filters:', 14, startY);
    startY += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    const filterLines: string[] = [];

    if (filters.wing) {
      filterLines.push(`Wing: ${filters.wing}`);
    }

    if (filters.statuses && filters.statuses.length > 0) {
      filterLines.push(`Status: ${filters.statuses.join(', ')}`);
    }

    if (filters.isolation && filters.isolation !== 'All Residents') {
      filterLines.push(`Isolation: ${filters.isolation}`);
    }

    if (filters.diagnoses && filters.diagnoses.length > 0) {
      filterLines.push(`Diagnosis: ${filters.diagnoses.join(', ')}`);
    }

    if (filters.dateFrom || filters.dateTo) {
      if (filters.dateFrom && filters.dateTo) {
        filterLines.push(`Date Range: ${filters.dateFrom} to ${filters.dateTo}`);
      } else if (filters.dateFrom) {
        filterLines.push(`Date Range: From ${filters.dateFrom}`);
      } else if (filters.dateTo) {
        filterLines.push(`Date Range: To ${filters.dateTo}`);
      }
    }

    if (filterLines.length === 0) {
      filterLines.push('No filters applied (showing all data)');
    }

    filterLines.forEach((line) => {
      doc.text(`  - ${line}`, 14, startY);
      startY += 5;
    });

    startY += 5;
  }

  // Add record count
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.text(`Total Records: ${data.length}`, 14, startY);
  startY += 8;

  // Prepare table data
  const headers = columns.map((col) => col.header);
  const rows = data.map((row) =>
    columns.map((col) => {
      const value = row[col.key];
      return value !== null && value !== undefined ? String(value) : '';
    })
  );

  // Generate table
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: startY,
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [59, 130, 246], // Primary blue
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    margin: { left: 14, right: 14 },
  });

  // Save the PDF
  doc.save(`${filename}.pdf`);
}

/**
 * Export Daily Census summary to PDF
 */
export function exportCensusToPDF(
  summary: {
    totalBeds: number;
    occupiedBeds: number;
    vacantBeds: number;
    outOfService: number;
    occupancyRate: number;
    maleOccupied: number;
    femaleOccupied: number;
  },
  wingData: Array<{
    wing: string;
    total: number;
    occupied: number;
    vacant: number;
    outOfService: number;
    occupancyRate: number;
  }>,
  filename: string
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Daily Census Report', 14, 20);

  // Date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

  // Summary section
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Facility Summary', 14, 42);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  let yPos = 52;
  const lineHeight = 7;

  doc.text(`Total Beds: ${summary.totalBeds}`, 20, yPos);
  yPos += lineHeight;
  doc.text(`Occupied Beds: ${summary.occupiedBeds} (${summary.occupancyRate}%)`, 20, yPos);
  yPos += lineHeight;
  doc.text(`Vacant Beds: ${summary.vacantBeds}`, 20, yPos);
  yPos += lineHeight;
  doc.text(`Out of Service: ${summary.outOfService}`, 20, yPos);
  yPos += lineHeight * 1.5;

  // Gender distribution
  doc.setFont('helvetica', 'bold');
  doc.text('Gender Distribution:', 20, yPos);
  yPos += lineHeight;
  doc.setFont('helvetica', 'normal');
  doc.text(`Male Residents: ${summary.maleOccupied}`, 25, yPos);
  yPos += lineHeight;
  doc.text(`Female Residents: ${summary.femaleOccupied}`, 25, yPos);
  yPos += lineHeight * 2;

  // Wing breakdown table
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Wing Breakdown', 14, yPos);

  autoTable(doc, {
    head: [['Wing', 'Total', 'Occupied', 'Vacant', 'Out of Service', 'Occupancy %']],
    body: wingData.map((w) => [
      w.wing,
      w.total.toString(),
      w.occupied.toString(),
      w.vacant.toString(),
      w.outOfService.toString(),
      `${w.occupancyRate}%`,
    ]),
    startY: yPos + 5,
    styles: {
      fontSize: 10,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 25, halign: 'center' },
      4: { cellWidth: 35, halign: 'center' },
      5: { cellWidth: 30, halign: 'center' },
    },
    margin: { left: 14, right: 14 },
  });

  doc.save(`${filename}.pdf`);
}

/**
 * Export Daily Census summary to Excel
 */
export function exportCensusToExcel(
  summary: {
    totalBeds: number;
    occupiedBeds: number;
    vacantBeds: number;
    outOfService: number;
    occupancyRate: number;
    maleOccupied: number;
    femaleOccupied: number;
  },
  wingData: Array<{
    wing: string;
    total: number;
    occupied: number;
    vacant: number;
    outOfService: number;
    occupancyRate: number;
  }>,
  filename: string
): void {
  const workbook = XLSX.utils.book_new();

  // Summary sheet
  const summaryData = [
    ['Daily Census Report'],
    [`Generated: ${new Date().toLocaleString()}`],
    [],
    ['Facility Summary'],
    ['Total Beds', summary.totalBeds],
    ['Occupied Beds', summary.occupiedBeds],
    ['Occupancy Rate', `${summary.occupancyRate}%`],
    ['Vacant Beds', summary.vacantBeds],
    ['Out of Service', summary.outOfService],
    [],
    ['Gender Distribution'],
    ['Male Residents', summary.maleOccupied],
    ['Female Residents', summary.femaleOccupied],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet['!cols'] = [{ wch: 20 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // Wing breakdown sheet
  const wingHeaders = ['Wing', 'Total', 'Occupied', 'Vacant', 'Out of Service', 'Occupancy %'];
  const wingRows = wingData.map((w) => [
    w.wing,
    w.total,
    w.occupied,
    w.vacant,
    w.outOfService,
    `${w.occupancyRate}%`,
  ]);

  const wingSheet = XLSX.utils.aoa_to_sheet([wingHeaders, ...wingRows]);
  wingSheet['!cols'] = [
    { wch: 25 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 15 },
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(workbook, wingSheet, 'Wing Breakdown');

  XLSX.writeFile(workbook, `${filename}.xlsx`);
}
