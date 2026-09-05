import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Types for Attendance PDF Export
export interface AttendanceClassSummary {
  classId: string;
  grade: number;
  section: string;
  stream: 'ol' | 'al';
  totalStudents: number;
  total: number;
  present: number;
  absent: number;
  late: number;
  rate: number;
  studentBreakdown: {
    id: string;
    name: string;
    admNo: string;
    total: number;
    present: number;
    absent: number;
    late: number;
    rate: number;
  }[];
}

export interface AttendancePdfOptions {
  schoolName?: string;
  schoolCensusCode?: string;
  principalName?: string;
  gradeFilter: string; // 'all' or '10', etc.
  overallRate: number;
  totalClasses: number;
  totalStudents: number;
  classes: AttendanceClassSummary[];
  detailed?: boolean; // If true, include individual student roster per class
}

// Types for Performance PDF Export
export interface PerformanceClassSummary {
  classId: string;
  grade: number;
  section: string;
  stream: 'ol' | 'al';
  totalStudents: number;
  studentsWithMarks: number;
  avgMarks: number;
  passRate: number;
  highestMark: number;
  topStudentName: string;
  subjectAvgs: { subject: string; avg: number }[];
  studentPerf: {
    id: string;
    name: string;
    admNo: string;
    subjects: number;
    avg: number;
    grade: string;
  }[];
}

export interface PerformancePdfOptions {
  schoolName?: string;
  schoolCensusCode?: string;
  principalName?: string;
  gradeFilter: string;
  selectedTerm: number;
  overallAvgMark: number;
  totalClasses: number;
  totalStudents: number;
  classes: PerformanceClassSummary[];
  detailed?: boolean; // If true, include subject averages and student rankings
}

// Helper to format current date & time
function getFormattedDateTime(): string {
  const now = new Date();
  return now.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function sanitizeFilename(str: string): string {
  return str.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Generates and downloads the Official Attendance Report PDF
 */
export function exportAttendancePdf(options: AttendancePdfOptions): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const generatedAt = getFormattedDateTime();
  const school = options.schoolName || 'Government School / National School';
  const census = options.schoolCensusCode ? `MoE Census: ${options.schoolCensusCode}` : '';
  const principal = options.principalName || 'Principal';
  const filterLabel = options.gradeFilter === 'all' ? 'All Grades' : `Grade ${options.gradeFilter}`;

  // ── Header Banner ────────────────────────────────────────────────────────
  doc.setFillColor(15, 23, 42); // Navy #0f172a
  doc.rect(0, 0, pageWidth, 24, 'F');

  // Accent line
  doc.setFillColor(2, 132, 199); // Sky Blue #0284c7
  doc.rect(0, 24, pageWidth, 2, 'F');

  // App & School Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(school.toUpperCase(), margin, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(186, 230, 253);
  doc.text(`EduNexus Academic Governance System  ${census ? `|  ${census}` : ''}`, margin, 18);

  doc.setFontSize(8.5);
  doc.setTextColor(226, 232, 240);
  doc.text(`Generated: ${generatedAt}`, pageWidth - margin, 18, { align: 'right' });

  // ── Document Subheader ───────────────────────────────────────────────────
  let curY = 33;

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('OVERALL ATTENDANCE REPORT', margin, curY);

  curY += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Scope: ${filterLabel}  |  Certified Principal: ${principal}  |  Academic Year: 2026`, margin, curY);

  curY += 7;

  // ── KPI Summary Cards ────────────────────────────────────────────────────
  const cardWidth = (contentWidth - 9) / 4;
  const cardHeight = 18;

  const kpis = [
    { label: 'Total Classes', value: `${options.totalClasses}`, color: [2, 132, 199] },
    { label: 'Total Students', value: `${options.totalStudents}`, color: [13, 148, 136] },
    {
      label: 'Overall Attendance',
      value: `${options.overallRate}%`,
      color: options.overallRate >= 90 ? [16, 185, 129] : options.overallRate >= 75 ? [245, 158, 11] : [239, 68, 68],
    },
    {
      label: 'Report Category',
      value: options.detailed ? 'Detailed Roster' : 'Executive Summary',
      color: [124, 58, 237],
    },
  ];

  kpis.forEach((kpi, idx) => {
    const cardX = margin + idx * (cardWidth + 3);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(cardX, curY, cardWidth, cardHeight, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.value, cardX + cardWidth / 2, curY + 8, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, cardX + cardWidth / 2, curY + 14, { align: 'center' });
  });

  curY += cardHeight + 8;

  // ── Class-wise Summary Table ─────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Class-wise Attendance Summary', margin, curY);
  curY += 3;

  const summaryHead = [['Class', 'Stream', 'Enrolled', 'Present (P)', 'Absent (A)', 'Late (L)', 'Rate (%)', 'Assessment']];
  const summaryBody = options.classes.map(c => {
    const rateText = c.total > 0 ? `${c.rate}%` : 'N/A';
    const assessment = c.total === 0 ? 'No Data' : c.rate >= 90 ? 'Excellent' : c.rate >= 75 ? 'Satisfactory' : 'Needs Attention';
    return [
      `Grade ${c.grade}${c.section}`,
      c.stream === 'ol' ? 'O/L' : 'A/L',
      c.totalStudents.toString(),
      c.present.toString(),
      c.absent.toString(),
      c.late.toString(),
      rateText,
      assessment,
    ];
  });

  autoTable(doc, {
    startY: curY,
    head: summaryHead,
    body: summaryBody,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center',
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    columnStyles: {
      0: { fontStyle: 'bold', halign: 'left' },
      1: { halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'center', textColor: [16, 185, 129] },
      4: { halign: 'center', textColor: [239, 68, 68] },
      5: { halign: 'center', textColor: [245, 158, 11] },
      6: { halign: 'center', fontStyle: 'bold' },
      7: { halign: 'center', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 6) {
        const raw = String(data.cell.raw);
        const val = parseInt(raw, 10);
        if (!isNaN(val)) {
          if (val >= 90) data.cell.styles.textColor = [16, 185, 129];
          else if (val >= 75) data.cell.styles.textColor = [217, 119, 6];
          else data.cell.styles.textColor = [239, 68, 68];
        }
      }
    },
    margin: { left: margin, right: margin },
  });

  // ── Detailed Student Breakdown (if requested) ────────────────────────────
  if (options.detailed) {
    for (const cls of options.classes) {
      if (cls.studentBreakdown.length === 0) continue;

      doc.addPage();
      let dY = 18;

      // Class Sub-header
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, dY - 4, contentWidth, 10, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(
        `Grade ${cls.grade}${cls.section} (${cls.stream === 'ol' ? 'O/L' : 'A/L'}) — Student Attendance Roster`,
        margin + 4,
        dY + 2
      );

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Enrolled: ${cls.totalStudents} | Class Rate: ${cls.rate}%`,
        pageWidth - margin - 4,
        dY + 2,
        { align: 'right' }
      );

      dY += 10;

      const studentHead = [['#', 'Admission No.', 'Student Name', 'Present', 'Absent', 'Late', 'Attendance Rate', 'Standing']];
      const studentBody = cls.studentBreakdown.map((s, idx) => {
        const rateText = s.total > 0 ? `${s.rate}%` : 'N/A';
        const standing = s.total === 0 ? 'No Data' : s.rate >= 90 ? 'Regular' : s.rate >= 75 ? 'Moderate' : 'Irregular';
        return [
          (idx + 1).toString(),
          s.admNo || s.id,
          s.name,
          s.present.toString(),
          s.absent.toString(),
          s.late.toString(),
          rateText,
          standing,
        ];
      });

      autoTable(doc, {
        startY: dY,
        head: studentHead,
        body: studentBody,
        theme: 'striped',
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8,
          halign: 'center',
        },
        styles: {
          fontSize: 7.5,
          cellPadding: 2,
          textColor: [30, 41, 59],
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          1: { halign: 'center', cellWidth: 28, fontStyle: 'bold' },
          2: { halign: 'left', cellWidth: 'auto' },
          3: { halign: 'center', cellWidth: 18, textColor: [16, 185, 129] },
          4: { halign: 'center', cellWidth: 18, textColor: [239, 68, 68] },
          5: { halign: 'center', cellWidth: 18, textColor: [245, 158, 11] },
          6: { halign: 'center', cellWidth: 26, fontStyle: 'bold' },
          7: { halign: 'center', cellWidth: 24, fontStyle: 'bold' },
        },
        margin: { left: margin, right: margin },
      });
    }
  }

  // ── Official Sign-off Block on Last Page ─────────────────────────────────
  const lastTableY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : curY;
  const signBlockHeight = 36;

  // Check if sign block fits on current page, else add page
  let signY = lastTableY + 12;
  if (signY + signBlockHeight > pageHeight - 16) {
    doc.addPage();
    signY = 24;
  }

  // Verification statement
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Official Verification: This document is an authorized record generated from the EduNexus Academic Governance System.',
    margin,
    signY
  );
  doc.text(
    'Any alterations or unauthorized reproductions invalidate this official school record.',
    margin,
    signY + 4
  );

  signY += 12;

  // Left Sign Block: Teacher / Section Head
  doc.setDrawColor(148, 163, 184);
  doc.line(margin, signY + 14, margin + 60, signY + 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text('Prepared / Verified By', margin, signY + 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Class Teachers / Section Head', margin, signY + 22);

  // Right Sign Block: Principal
  const pSignX = pageWidth - margin - 60;
  doc.line(pSignX, signY + 14, pSignX + 60, signY + 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text('Approved & Certified', pSignX, signY + 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`${principal} (Principal & Seal)`, pSignX, signY + 22);

  // ── Running Page Footers ─────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `EduNexus SAMS  |  ${school}  |  Overall Attendance Report`,
      margin,
      pageHeight - 6
    );
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth - margin,
      pageHeight - 6,
      { align: 'right' }
    );
  }

  // ── Trigger Download ─────────────────────────────────────────────────────
  const fileName = `${sanitizeFilename(school)}_Attendance_Report_${sanitizeFilename(filterLabel)}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}

/**
 * Generates and downloads the Official Performance Report PDF
 */
export function exportPerformancePdf(options: PerformancePdfOptions): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const generatedAt = getFormattedDateTime();
  const school = options.schoolName || 'Government School / National School';
  const census = options.schoolCensusCode ? `MoE Census: ${options.schoolCensusCode}` : '';
  const principal = options.principalName || 'Principal';
  const filterLabel = options.gradeFilter === 'all' ? 'All Grades' : `Grade ${options.gradeFilter}`;

  // ── Header Banner ────────────────────────────────────────────────────────
  doc.setFillColor(15, 23, 42); // Navy
  doc.rect(0, 0, pageWidth, 24, 'F');

  // Accent line
  doc.setFillColor(13, 148, 136); // Teal Accent #0d9488
  doc.rect(0, 24, pageWidth, 2, 'F');

  // App & School Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(school.toUpperCase(), margin, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(204, 251, 241);
  doc.text(`EduNexus Academic Governance System  ${census ? `|  ${census}` : ''}`, margin, 18);

  doc.setFontSize(8.5);
  doc.setTextColor(226, 232, 240);
  doc.text(`Generated: ${generatedAt}`, pageWidth - margin, 18, { align: 'right' });

  // ── Document Subheader ───────────────────────────────────────────────────
  let curY = 33;

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(`OVERALL ACADEMIC PERFORMANCE REPORT — TERM ${options.selectedTerm}`, margin, curY);

  curY += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Scope: ${filterLabel}  |  Certified Principal: ${principal}  |  Academic Year: 2026`, margin, curY);

  curY += 7;

  // Calculate high-level performance metrics
  const evaluatedClasses = options.classes.filter(c => c.studentsWithMarks > 0);
  const totalEvaluatedStudents = options.classes.reduce((acc, c) => acc + c.studentsWithMarks, 0);
  const overallPassRate = evaluatedClasses.length > 0
    ? Math.round(evaluatedClasses.reduce((acc, c) => acc + c.passRate, 0) / evaluatedClasses.length)
    : 0;
  const highestMarkOverall = Math.max(...options.classes.map(c => c.highestMark), 0);

  // ── KPI Summary Cards ────────────────────────────────────────────────────
  const cardWidth = (contentWidth - 9) / 4;
  const cardHeight = 18;

  const kpis = [
    { label: 'Students Assessed', value: `${totalEvaluatedStudents} / ${options.totalStudents}`, color: [2, 132, 199] },
    {
      label: `Average Score (Term ${options.selectedTerm})`,
      value: options.overallAvgMark > 0 ? `${options.overallAvgMark} / 100` : 'N/A',
      color: options.overallAvgMark >= 70 ? [16, 185, 129] : options.overallAvgMark >= 50 ? [245, 158, 11] : [239, 68, 68],
    },
    {
      label: 'Overall Pass Rate (>=35)',
      value: `${overallPassRate}%`,
      color: overallPassRate >= 75 ? [16, 185, 129] : [245, 158, 11],
    },
    {
      label: 'Highest Score in School',
      value: highestMarkOverall > 0 ? `${highestMarkOverall} / 100` : '—',
      color: [124, 58, 237],
    },
  ];

  kpis.forEach((kpi, idx) => {
    const cardX = margin + idx * (cardWidth + 3);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(cardX, curY, cardWidth, cardHeight, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.value, cardX + cardWidth / 2, curY + 8, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, cardX + cardWidth / 2, curY + 14, { align: 'center' });
  });

  curY += cardHeight + 8;

  // ── Class-wise Performance Summary Table ─────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`1. Class Performance Overview — Term ${options.selectedTerm}`, margin, curY);
  curY += 3;

  const summaryHead = [['Class', 'Stream', 'Enrolled', 'Evaluated', 'Avg. Mark', 'Pass Rate (%)', 'Highest', 'Top Performer']];
  const summaryBody = options.classes.map(c => [
    `Grade ${c.grade}${c.section}`,
    c.stream === 'ol' ? 'O/L' : 'A/L',
    c.totalStudents.toString(),
    c.studentsWithMarks.toString(),
    c.studentsWithMarks > 0 ? `${c.avgMarks}` : 'N/A',
    c.studentsWithMarks > 0 ? `${c.passRate}%` : 'N/A',
    c.highestMark > 0 ? `${c.highestMark}` : '—',
    c.topStudentName || '—',
  ]);

  autoTable(doc, {
    startY: curY,
    head: summaryHead,
    body: summaryBody,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center',
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    columnStyles: {
      0: { fontStyle: 'bold', halign: 'left' },
      1: { halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center', fontStyle: 'bold' },
      5: { halign: 'center', fontStyle: 'bold' },
      6: { halign: 'center', fontStyle: 'bold', textColor: [2, 132, 199] },
      7: { halign: 'left' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 4) {
        const val = parseInt(String(data.cell.raw), 10);
        if (!isNaN(val)) {
          if (val >= 70) data.cell.styles.textColor = [16, 185, 129];
          else if (val >= 50) data.cell.styles.textColor = [217, 119, 6];
          else data.cell.styles.textColor = [239, 68, 68];
        }
      }
    },
    margin: { left: margin, right: margin },
  });

  // ── Detailed Class Breakdowns (Subject Averages & Rankings) ──────────────
  if (options.detailed) {
    for (const cls of options.classes) {
      if (cls.studentPerf.length === 0 && cls.subjectAvgs.length === 0) continue;

      doc.addPage();
      let dY = 18;

      // Class Title Header
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, dY - 4, contentWidth, 10, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(
        `Grade ${cls.grade}${cls.section} (${cls.stream === 'ol' ? 'O/L' : 'A/L'}) — Term ${options.selectedTerm} Analysis`,
        margin + 4,
        dY + 2
      );

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Class Avg: ${cls.avgMarks} | Pass Rate: ${cls.passRate}% | Highest: ${cls.highestMark}`,
        pageWidth - margin - 4,
        dY + 2,
        { align: 'right' }
      );

      dY += 12;

      // Subject Averages Sub-table (if available)
      if (cls.subjectAvgs.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
        doc.text('Subject Performance Matrix', margin, dY);
        dY += 3;

        const subHead = [['Subject', 'Average Mark', 'Grade Standing', 'Subject', 'Average Mark', 'Grade Standing']];
        const half = Math.ceil(cls.subjectAvgs.length / 2);
        const col1 = cls.subjectAvgs.slice(0, half);
        const col2 = cls.subjectAvgs.slice(half);

        const subBody: string[][] = [];
        for (let i = 0; i < half; i++) {
          const s1 = col1[i];
          const s2 = col2[i];
          const g1 = s1 ? (s1.avg >= 75 ? 'A' : s1.avg >= 65 ? 'B' : s1.avg >= 55 ? 'C' : s1.avg >= 35 ? 'S' : 'F') : '';
          const g2 = s2 ? (s2.avg >= 75 ? 'A' : s2.avg >= 65 ? 'B' : s2.avg >= 55 ? 'C' : s2.avg >= 35 ? 'S' : 'F') : '';

          subBody.push([
            s1 ? s1.subject : '',
            s1 ? `${s1.avg} / 100` : '',
            g1,
            s2 ? s2.subject : '',
            s2 ? `${s2.avg} / 100` : '',
            g2,
          ]);
        }

        autoTable(doc, {
          startY: dY,
          head: subHead,
          body: subBody,
          theme: 'grid',
          headStyles: {
            fillColor: [51, 65, 85],
            textColor: [255, 255, 255],
            fontSize: 7.5,
            fontStyle: 'bold',
            halign: 'center',
          },
          styles: {
            fontSize: 7.5,
            cellPadding: 2,
            textColor: [30, 41, 59],
          },
          columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 40 },
            1: { halign: 'center', cellWidth: 26 },
            2: { halign: 'center', cellWidth: 24, fontStyle: 'bold' },
            3: { fontStyle: 'bold', cellWidth: 40 },
            4: { halign: 'center', cellWidth: 26 },
            5: { halign: 'center', cellWidth: 24, fontStyle: 'bold' },
          },
          margin: { left: margin, right: margin },
        });

        dY = ((doc as any).lastAutoTable?.finalY || dY) + 8;
      }

      // Student Ranking Table
      if (cls.studentPerf.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
        doc.text('Student Academic Rankings', margin, dY);
        dY += 3;

        const rankHead = [['Rank', 'Admission No.', 'Student Name', 'Subjects Assessed', 'Average Mark', 'Grade Result']];
        const rankBody = cls.studentPerf.map((stu, sIdx) => [
          stu.subjects > 0 ? `${sIdx + 1}` : '—',
          stu.admNo || stu.id,
          stu.name,
          stu.subjects.toString(),
          stu.subjects > 0 ? `${stu.avg}` : 'N/A',
          stu.grade,
        ]);

        autoTable(doc, {
          startY: dY,
          head: rankHead,
          body: rankBody,
          theme: 'striped',
          headStyles: {
            fillColor: [30, 41, 59],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 8,
            halign: 'center',
          },
          styles: {
            fontSize: 7.5,
            cellPadding: 2,
            textColor: [30, 41, 59],
          },
          columnStyles: {
            0: { halign: 'center', cellWidth: 14, fontStyle: 'bold' },
            1: { halign: 'center', cellWidth: 28, fontStyle: 'bold' },
            2: { halign: 'left', cellWidth: 'auto' },
            3: { halign: 'center', cellWidth: 32 },
            4: { halign: 'center', cellWidth: 28, fontStyle: 'bold' },
            5: { halign: 'center', cellWidth: 24, fontStyle: 'bold' },
          },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 0 && data.cell.raw === '1') {
              data.cell.styles.textColor = [217, 119, 6]; // gold for rank 1
            }
          },
          margin: { left: margin, right: margin },
        });
      }
    }
  }

  // ── Official Sign-off Block on Last Page ─────────────────────────────────
  const lastTableY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : curY;
  const signBlockHeight = 36;

  let signY = lastTableY + 12;
  if (signY + signBlockHeight > pageHeight - 16) {
    doc.addPage();
    signY = 24;
  }

  // Verification statement
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Official Verification: This document is an authorized academic report generated from the EduNexus Academic Governance System.',
    margin,
    signY
  );
  doc.text(
    'Grading Standard: Sri Lanka National Curriculum (A: 75-100, B: 65-74, C: 55-64, S: 35-54, F: 0-34).',
    margin,
    signY + 4
  );

  signY += 12;

  // Left Sign Block: Section Head
  doc.setDrawColor(148, 163, 184);
  doc.line(margin, signY + 14, margin + 60, signY + 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text('Prepared / Verified By', margin, signY + 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Section Head / Exam Coordinator', margin, signY + 22);

  // Right Sign Block: Principal
  const pSignX = pageWidth - margin - 60;
  doc.line(pSignX, signY + 14, pSignX + 60, signY + 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text('Approved & Certified', pSignX, signY + 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`${principal} (Principal & Seal)`, pSignX, signY + 22);

  // ── Running Page Footers ─────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `EduNexus SAMS  |  ${school}  |  Performance Report — Term ${options.selectedTerm}`,
      margin,
      pageHeight - 6
    );
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth - margin,
      pageHeight - 6,
      { align: 'right' }
    );
  }

  // ── Trigger Download ─────────────────────────────────────────────────────
  const fileName = `${sanitizeFilename(school)}_Performance_Report_Term${options.selectedTerm}_${sanitizeFilename(filterLabel)}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}
