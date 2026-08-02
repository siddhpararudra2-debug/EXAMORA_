import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, degrees, rgb } from 'pdf-lib';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';

export interface QuestionResultData {
  id: string;
  orderIndex: number;
  questionText: string;
  type: string;
  marks: number;
  negativeMarks: number;
  marksAwarded: number | null;
  isCorrect: boolean | null;
  answerText: string;
}

export interface SessionData {
  sessionId: string;
  sessionToken: string;
  studentName: string;
  enrollmentNumber: string | null;
  studentEmail: string | null;
  status: string;
  submittedAt: Date | null;
  totalScore: number | null;
  totalMarks: number;
  percentage: number | null;
  questionResults: QuestionResultData[];
}

export interface ExamData {
  id: string;
  title: string;
  subject: string | null;
  collegeName: string | null;
  teacherName: string | null;
}

export interface ClassAnalytics {
  max: number | null;
  min: number | null;
  average: number | null;
  totalStudents: number;
  /** Raw percentage scores of every graded student — feeds the histogram. */
  scores: number[];
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_TOP = 175;

// ── Score distribution histogram (chartjs-node-canvas) ─────────────────────────
// A single reusable renderer; node-canvas instances are cheap enough to build
// per call, and the Chart.js config stays inline so no global state leaks.
const HISTOGRAM_WIDTH = 500;
const HISTOGRAM_HEIGHT = 200;
const HISTOGRAM_BUCKETS = 10;

const chartRenderer = new ChartJSNodeCanvas({
  width: HISTOGRAM_WIDTH,
  height: HISTOGRAM_HEIGHT,
  backgroundColour: 'rgba(0, 0, 0, 0)',
});

/**
 * Buckets percentage scores into 10-point bins ("0-10" ... "90-100") and
 * renders a bar chart of the distribution to a PNG buffer.
 */
export async function renderScoreDistributionChart(
  scores: number[],
): Promise<Buffer> {
  const labels: string[] = [];
  const counts: number[] = [];

  for (let i = 0; i < HISTOGRAM_BUCKETS; i += 1) {
    labels.push(`${i * 10}-${i * 10 + 10}`);
    counts.push(0);
  }

  for (const score of scores) {
    const value = Number.isFinite(score) ? score : 0;
    const bucket = Math.min(HISTOGRAM_BUCKETS - 1, Math.max(0, Math.floor(value / 10)));
    counts[bucket] += 1;
  }

  return chartRenderer.renderToBuffer({
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Students',
          data: counts,
          backgroundColor: 'rgba(79, 70, 229, 0.75)',
          borderColor: 'rgba(67, 56, 202, 1)',
          borderWidth: 1,
          borderRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: 'Score Distribution',
          color: '#312e81',
          font: { family: 'sans-serif', size: 14, weight: 'bold' },
        },
        tooltip: { enabled: false },
      },
      scales: {
        x: {
          title: { display: true, text: 'Percentage (%)', color: '#64748b' },
          ticks: { color: '#64748b', maxRotation: 0, autoSkip: false, font: { size: 9 } },
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Students', color: '#64748b' },
          ticks: { color: '#64748b', precision: 0, font: { size: 9 } },
          grid: { color: 'rgba(148, 163, 184, 0.25)' },
        },
      },
    },
  });
}

const COLOR_BRAND = rgb(0.31, 0.27, 0.9);
const COLOR_BRAND_DARK = rgb(0.21, 0.17, 0.6);
const COLOR_TEXT = rgb(0.16, 0.17, 0.19);
const COLOR_MUTED = rgb(0.45, 0.48, 0.52);
const COLOR_BORDER = rgb(0.82, 0.84, 0.88);
const COLOR_ROW_ALT = rgb(0.96, 0.97, 0.98);
const COLOR_GREEN = rgb(0.12, 0.55, 0.28);
const COLOR_RED = rgb(0.8, 0.22, 0.22);
const COLOR_AMBER = rgb(0.8, 0.55, 0.1);

const TYPE_LABELS: Record<string, string> = {
  mcq_single: 'MCQ Single',
  mcq_multi: 'MCQ Multi',
  true_false: 'True/False',
  short_answer: 'Short Answer',
  long_answer: 'Long Answer',
  fill_blank: 'Fill Blank',
  dropdown: 'Dropdown',
  linear_scale: 'Linear Scale',
  checkbox_grid: 'Checkbox Grid',
  radio_grid: 'Radio Grid',
  date: 'Date',
  file_upload: 'File Upload',
};

const QUESTION_TEXT_MAX_CHARS = 220;
const QUESTION_TEXT_MAX_LINES = 4;

const formatNumber = (value: number | null | undefined, digits = 2): string =>
  value === null || value === undefined || Number.isNaN(value) ? '—' : value.toFixed(digits);

const sanitizeForFilename = (value: string): string =>
  value.replace(/[^a-z0-9-_ ]/gi, '').trim().replace(/\s+/g, '_') || 'marksheet';

const typeLabel = (type: string): string => TYPE_LABELS[type] ?? type ?? '—';

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && current) lines.push(current);
  return lines.slice(0, maxLines).map((line) => (line.length > 90 ? `${line.slice(0, 90)}…` : line));
}

interface DrawContext {
  doc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  y: number;
}

function addPage(ctx: DrawContext): void {
  const page = ctx.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawWatermark(page, ctx.bold);
  ctx.page = page;
  ctx.y = PAGE_HEIGHT - 40;
}

function drawBrandHeader(ctx: DrawContext, examData: ExamData): void {
  const { page, bold, font } = ctx;
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 78,
    width: PAGE_WIDTH,
    height: 78,
    color: COLOR_BRAND,
  });
  page.drawText('EXAMORA', { x: MARGIN, y: PAGE_HEIGHT - 52, size: 26, font: bold, color: rgb(1, 1, 1) });
  page.drawText('Verified Online Exam Platform', { x: MARGIN, y: PAGE_HEIGHT - 26, size: 9, font, color: rgb(0.85, 0.83, 1) });
  page.drawText('Verified Result', { x: PAGE_WIDTH - MARGIN - 100, y: PAGE_HEIGHT - 52, size: 13, font: bold, color: rgb(1, 1, 1) });

  ctx.y = PAGE_HEIGHT - 78 - 30;
  const college = examData.collegeName || 'Not specified';
  page.drawText(college, { x: MARGIN, y: ctx.y, size: 14, font: bold, color: COLOR_BRAND_DARK });
  page.drawText(`Teacher: ${examData.teacherName || '—'}`, { x: PAGE_WIDTH - MARGIN - 220, y: ctx.y, size: 10, font, color: COLOR_TEXT });
  ctx.y -= 24;
  const subject = examData.subject ? ` • ${examData.subject}` : '';
  page.drawText(`${examData.title}${subject}`, { x: MARGIN, y: ctx.y, size: 13, font: bold, color: COLOR_TEXT });
  ctx.y -= 8;
  page.drawLine({ start: { x: MARGIN, y: ctx.y }, end: { x: PAGE_WIDTH - MARGIN, y: ctx.y }, thickness: 1.2, color: COLOR_BRAND });
  ctx.y -= 14;
}

function drawStudentBlock(ctx: DrawContext, sessionData: SessionData): void {
  const { page, bold, font } = ctx;
  page.drawText('STUDENT DETAILS', { x: MARGIN, y: ctx.y, size: 10, font: bold, color: COLOR_BRAND_DARK });
  ctx.y -= 12;

  const boxTop = ctx.y;
  const rowHeight = 22;
  const colMid = MARGIN + CONTENT_WIDTH / 2;
  const labelX = MARGIN + 10;
  const valueX = MARGIN + 92;
  const rows: Array<[string, string]> = [
    ['Name', sessionData.studentName || '—'],
    ['Enrollment', sessionData.enrollmentNumber || '—'],
    ['Email', sessionData.studentEmail || '—'],
    ['Status', sessionData.status.replace(/_/g, ' ').toLowerCase()],
    ['Submitted At', sessionData.submittedAt ? sessionData.submittedAt.toLocaleString() : '—'],
    ['Score', `${formatNumber(sessionData.totalScore)} / ${sessionData.totalMarks}`],
    ['Percentage', `${formatNumber(sessionData.percentage)}%`],
  ];

  const secondCol: Array<[string, string]> = [];
  const firstCol = rows.filter((_, i) => i % 2 === 0);
  rows.filter((_, i) => i % 2 === 1).forEach((row) => secondCol.push(row));

  page.drawRectangle({
    x: MARGIN,
    y: boxTop - 2 * rowHeight - 12,
    width: CONTENT_WIDTH,
    height: 2 * rowHeight + 12,
    borderColor: COLOR_BORDER,
    borderWidth: 1,
  });

  for (let r = 0; r < 2; r += 1) {
    const y = boxTop - r * rowHeight - 6;
    const left = r === 0 ? firstCol : secondCol;
    for (let c = 0; c < 3; c += 1) {
      const row = left[c];
      if (!row) continue;
      const x = c % 2 === 0 ? MARGIN : colMid;
      page.drawText(row[0], { x: x + 10, y, size: 8.5, font: bold, color: COLOR_MUTED });
      page.drawText(row[1].length > 44 ? `${row[1].slice(0, 44)}…` : row[1], { x: x + 92, y, size: 10, font, color: COLOR_TEXT });
    }
  }

  ctx.y = boxTop - 2 * rowHeight - 12 - 22;
}

interface TableColumn {
  key: 'orderIndex' | 'questionText' | 'type' | 'marks' | 'negativeMarks' | 'marksAwarded' | 'result';
  label: string;
  width: number;
  align: 'left' | 'right' | 'center';
}

const TABLE_COLUMNS: TableColumn[] = [
  { key: 'orderIndex', label: '#', width: 26, align: 'center' },
  { key: 'questionText', label: 'Question', width: 252, align: 'left' },
  { key: 'type', label: 'Type', width: 88, align: 'left' },
  { key: 'marks', label: 'Marks', width: 40, align: 'right' },
  { key: 'negativeMarks', label: 'Neg.', width: 40, align: 'right' },
  { key: 'marksAwarded', label: 'Awarded', width: 52, align: 'right' },
  { key: 'result', label: 'Result', width: 58, align: 'center' },
];

const drawTableRow = (ctx: DrawContext, row: Record<string, string>, height: number, fill: ReturnType<typeof rgb> | undefined): void => {
  const { page, bold, font } = ctx;
  const yTop = ctx.y;
  if (fill) {
    page.drawRectangle({ x: MARGIN, y: yTop - height, width: CONTENT_WIDTH, height, color: fill });
  }
  let x = MARGIN;
  for (const col of TABLE_COLUMNS) {
    const text = row[col.key] ?? '';
    const maxWidth = col.width - 8;
    if (col.key === 'questionText') {
      const lines = wrapText(text, font, 8.5, maxWidth, QUESTION_TEXT_MAX_LINES).slice(0, 2);
      const lineHeight = 11;
      const startY = yTop - height / 2 + (lines.length - 1) * (lineHeight / 2);
      lines.forEach((line, i) => {
        page.drawText(line, { x: x + 4, y: startY - i * lineHeight, size: 8.5, font, color: COLOR_TEXT });
      });
    } else {
      const size = col.key === 'orderIndex' ? 9 : 8.5;
      const f = col.key === 'result' ? bold : font;
      let textColor = COLOR_TEXT;
      if (col.key === 'result') {
        textColor = text === 'Correct' ? COLOR_GREEN : text === 'Incorrect' ? COLOR_RED : COLOR_AMBER;
      }
      const textWidth = f.widthOfTextAtSize(text, size);
      const drawX =
        col.align === 'right' ? x + col.width - 6 - textWidth : col.align === 'center' ? x + (col.width - textWidth) / 2 : x + 4;
      page.drawText(text, { x: drawX, y: yTop - height / 2 - size / 3, size, font: f, color: textColor });
    }
    x += col.width;
  }
  page.drawLine({ start: { x: MARGIN, y: yTop - height }, end: { x: PAGE_WIDTH - MARGIN, y: yTop - height }, thickness: 0.5, color: COLOR_BORDER });
};

function drawQuestionTable(ctx: DrawContext, questionResults: QuestionResultData[]): void {
  const { page, bold, font } = ctx;
  const headerHeight = 20;
  page.drawRectangle({ x: MARGIN, y: ctx.y - headerHeight, width: CONTENT_WIDTH, height: headerHeight, color: COLOR_BRAND });
  let x = MARGIN;
  for (const col of TABLE_COLUMNS) {
    const size = 8.5;
    const textWidth = bold.widthOfTextAtSize(col.label, size);
    const drawX = col.align === 'right' ? x + col.width - 6 - textWidth : col.align === 'center' ? x + (col.width - textWidth) / 2 : x + 4;
    page.drawText(col.label, { x: drawX, y: ctx.y - headerHeight / 2 - size / 3, size, font: bold, color: rgb(1, 1, 1) });
    x += col.width;
  }
  page.drawLine({ start: { x: MARGIN, y: ctx.y - headerHeight }, end: { x: PAGE_WIDTH - MARGIN, y: ctx.y - headerHeight }, thickness: 0.5, color: COLOR_BORDER });
  ctx.y -= headerHeight;

  if (questionResults.length === 0) {
    page.drawText('No question results available.', { x: MARGIN + 6, y: ctx.y - 14, size: 9.5, font, color: COLOR_MUTED });
    ctx.y -= 34;
    return;
  }

  questionResults.forEach((q, index) => {
    const questionText = q.questionText.length > QUESTION_TEXT_MAX_CHARS ? `${q.questionText.slice(0, QUESTION_TEXT_MAX_CHARS)}…` : q.questionText;
    const questionCol = TABLE_COLUMNS.find((c) => c.key === 'questionText')!;
    const lines = wrapText(questionText, font, 8.5, questionCol.width - 8, QUESTION_TEXT_MAX_LINES).slice(0, 2);
    const height = Math.max(20, lines.length * 11 + 6);

    if (ctx.y - height < FOOTER_TOP + 10) {
      addPage(ctx);
    }

    const isCorrect = q.isCorrect === true;
    const isAnswered = q.marksAwarded !== null && q.marksAwarded !== undefined;
    const resultText = isCorrect ? 'Correct' : isAnswered ? 'Incorrect' : 'Skipped';

    drawTableRow(
      ctx,
      {
        orderIndex: String(q.orderIndex + 1),
        questionText,
        type: typeLabel(q.type),
        marks: String(q.marks),
        negativeMarks: formatNumber(q.negativeMarks, 0),
        marksAwarded: formatNumber(q.marksAwarded),
        result: resultText,
      },
      height,
      index % 2 === 1 ? COLOR_ROW_ALT : undefined,
    );
    ctx.y -= height;
  });
  ctx.y -= 12;
}

function drawFooter(
  ctx: DrawContext,
  classAnalytics: ClassAnalytics,
  histogram: PDFImage | null,
): void {
  const { page, bold, font } = ctx;

  page.drawRectangle({
    x: MARGIN,
    y: ctx.y - FOOTER_TOP + 24,
    width: CONTENT_WIDTH,
    height: FOOTER_TOP - 24,
    color: rgb(0.96, 0.96, 0.99),
    borderColor: COLOR_BORDER,
    borderWidth: 1,
  });

  page.drawText('CLASS ANALYTICS — SCORE DISTRIBUTION', { x: MARGIN + 10, y: ctx.y - 14, size: 8.5, font: bold, color: COLOR_BRAND_DARK });

  const statsLine =
    `Class Max: ${formatNumber(classAnalytics.max)}%   Min: ${formatNumber(classAnalytics.min)}%   Avg: ${formatNumber(classAnalytics.average)}%`;

  if (histogram) {
    const imageWidth = 290;
    const imageHeight = (histogram.height / histogram.width) * imageWidth;
    page.drawImage(histogram, {
      x: MARGIN + 10,
      y: ctx.y - FOOTER_TOP + 30,
      width: imageWidth,
      height: imageHeight,
    });

    const statsX = MARGIN + 10 + imageWidth + 12;
    page.drawText(statsLine, { x: statsX, y: ctx.y - FOOTER_TOP + 96, size: 11, font: bold, color: COLOR_TEXT });
    page.drawText(`Students: ${classAnalytics.totalStudents}`, { x: statsX, y: ctx.y - FOOTER_TOP + 78, size: 10, font, color: COLOR_MUTED });
  } else {
    page.drawText('No class data available for this exam.', { x: MARGIN + 12, y: ctx.y - 44, size: 10, font, color: COLOR_MUTED });
    page.drawText(statsLine, { x: MARGIN + 12, y: ctx.y - 62, size: 11, font: bold, color: COLOR_TEXT });
  }

  page.drawText('EXAMORA - Verified Result', { x: PAGE_WIDTH - MARGIN - 110, y: 30, size: 8, font: bold, color: COLOR_MUTED });
  page.drawText(`Generated ${new Date().toLocaleString()} • ${ctx.page.getWidth().toFixed(0)}x${ctx.page.getHeight().toFixed(0)}`, { x: MARGIN, y: 30, size: 8, font, color: COLOR_MUTED });
}

function drawWatermark(page: PDFPage, font: PDFFont): void {
  const text = 'EXAMORA - Verified Result';
  const size = 34;
  const textWidth = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: PAGE_WIDTH / 2 - textWidth / 2,
    y: PAGE_HEIGHT / 2,
    size,
    font,
    color: rgb(0.35, 0.3, 0.8),
    opacity: 0.1,
    rotate: degrees(-35),
  });
}

export async function generateMarksheet(
  sessionData: SessionData,
  examData: ExamData,
  classAnalytics: ClassAnalytics,
): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const ctx: DrawContext = {
    doc,
    page: doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    font,
    bold,
    y: PAGE_HEIGHT - 40,
  };

  drawWatermark(ctx.page, bold);
  drawBrandHeader(ctx, examData);
  drawStudentBlock(ctx, sessionData);
  drawQuestionTable(ctx, sessionData.questionResults);

  let histogram: PDFImage | null = null;
  try {
    const histogramPng = await renderScoreDistributionChart(classAnalytics.scores);
    histogram = await doc.embedPng(histogramPng);
  } catch (err) {
    // The marksheet must not fail because the chart renderer is unavailable
    // (missing canvas font, etc.) — degrade to the text-only footer.
    console.error('[Marksheet] Failed to render score distribution chart:', err);
  }

  drawFooter(ctx, classAnalytics, histogram);

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

export { sanitizeForFilename };
