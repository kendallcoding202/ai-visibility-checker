// Agency PDF drawn from the report already stored for this purchase.
// Standard fonts only. No images, no network, no URLs fetched.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { buildPaidReport } from './paidReportDocument.js';

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 54;
const ink = rgb(0.11, 0.098, 0.082);
const muted = rgb(0.353, 0.325, 0.282);
const accent = rgb(0.051, 0.361, 0.282);

export function pdfSafe(font, value, max = 12000) {
  const raw = String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, max);
  const encode = (text) => {
    try {
      font.encodeText(text);
      return text;
    } catch {
      let out = '';
      for (const ch of text) {
        try {
          font.encodeText(ch);
          out += ch;
        } catch {
          out += '?';
        }
      }
      return out;
    }
  };
  return raw.split('\n').map((line) => encode(line)).join('\n');
}

function wrap(text, font, size, maxWidth) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let line = '';
  const pushWord = (word) => {
    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      line = word;
      return;
    }
    let chunk = '';
    for (const ch of word) {
      const trial = chunk + ch;
      if (font.widthOfTextAtSize(trial, size) <= maxWidth) chunk = trial;
      else {
        if (chunk) lines.push(chunk);
        chunk = ch;
      }
    }
    line = chunk;
  };
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) line = next;
    else {
      if (line) lines.push(line);
      pushWord(word);
    }
  }
  if (line) lines.push(line);
  return lines;
}

function newPage(doc) {
  return doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
}

export async function buildPaidReportPdf({ result, answers, agency } = {}) {
  const model = buildPaidReport({ result, answers, agency });
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const maxWidth = PAGE_WIDTH - MARGIN * 2;
  const state = { doc, page: newPage(doc), y: PAGE_HEIGHT - MARGIN, font, bold, maxWidth };

  const ensure = (needed) => {
    if (state.y - needed >= MARGIN + 36) return;
    state.page = newPage(doc);
    state.y = PAGE_HEIGHT - MARGIN;
  };
  const draw = (text, { face = font, size = 11, color = ink, gap = 4, indent = 0 } = {}) => {
    const paragraphs = pdfSafe(face, text).split('\n');
    for (const paragraph of paragraphs) {
      const lines = wrap(paragraph, face, size, maxWidth - indent);
      if (!lines.length) continue;
      for (const line of lines) {
        ensure(size + gap);
        state.page.drawText(line, { x: MARGIN + indent, y: state.y, size, font: face, color });
        state.y -= size + gap;
      }
    }
  };
  const heading = (text, size = 15) => {
    ensure(size + 18);
    state.y -= 10;
    draw(text, { face: bold, size, color: accent, gap: 6 });
  };

  draw('AI VISIBILITY REPORT', { face: bold, size: 11, color: accent, gap: 8 });
  draw(model.brand, { face: bold, size: 26, gap: 8 });
  if (model.domain) draw(`Domain: ${model.domain}`, { size: 12, color: muted });
  if (model.category) draw(`Market: ${model.category}`, { size: 12, color: muted });
  if (model.date) draw(model.date, { size: 12, color: muted });
  draw(model.preparedBy, { face: bold, size: 12, gap: 10 });
  ensure(8);
  state.page.drawLine({
    start: { x: MARGIN, y: state.y },
    end: { x: PAGE_WIDTH - MARGIN, y: state.y },
    thickness: 1,
    color: accent,
  });
  state.y -= 16;
  draw(`${model.brand} was mentioned in ${model.mentionedIn} of ${model.total} answers. Score: ${model.score}/100.`, { face: bold, size: 12 });
  if (model.avgRank) draw(`Average position when mentioned: ${model.avgRank}`);
  draw(model.runsLine, { size: 10, color: muted, gap: 8 });

  heading('Buying stages', 16);
  for (const stage of model.stages) draw(stage.line);

  for (const section of model.sections) {
    heading(section.label, 16);
    if (!section.rows.length) {
      draw('No prompts in this stage.', { color: muted });
      continue;
    }
    section.rows.forEach((row, index) => {
      draw(`${index + 1}. ${row.prompt}`, { face: bold, size: 12, gap: 3 });
      draw(row.mention, { size: 11 });
      if (row.mentioned && row.sentiment && row.sentiment !== 'not_mentioned') {
        draw(`Sentiment: ${row.sentiment}`, { size: 11, color: muted });
      }
      draw(`Top picks: ${row.picks}`, { size: 11 });
      draw(row.answer ? row.answer : 'Raw answer was not stored with this report.', {
        size: 10,
        color: row.answer ? ink : muted,
        gap: 8,
      });
    });
  }

  heading('Cited sources', 16);
  if (model.topSources.length) {
    for (const source of model.topSources) draw(`${source.domain} (${source.n})`);
  } else {
    draw('No sources cited.', { color: muted });
  }
  heading('What to fix', 16);
  draw(model.whatToFix);
  ensure(28);
  state.y -= 8;
  draw('One snapshot of ChatGPT. Answers vary by run, wording, and location.', { size: 9, color: muted });

  const pages = doc.getPages();
  pages.forEach((page, index) => {
    const label = pdfSafe(font, `${model.footer}    ${index + 1} / ${pages.length}`, 160);
    page.drawText(label, { x: MARGIN, y: 28, size: 9, font, color: muted });
  });

  doc.setTitle(pdfSafe(font, `AI visibility report for ${model.brand}`, 140) || 'AI visibility report');
  doc.setAuthor(pdfSafe(font, model.preparedBy, 120));
  doc.setSubject(pdfSafe(font, model.stages.map((stage) => stage.line).join(' | '), 700));
  doc.setCreator('AI Visibility Checker');
  doc.setProducer('AI Visibility Checker');

  return doc.save();
}
