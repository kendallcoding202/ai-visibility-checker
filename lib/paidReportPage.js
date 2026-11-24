// Data for the paid report page. The page itself turns a null model into a 404.
import { parseAgencyName } from './buyingStage.js';
import { loadPaidReport } from './paidReportAccess.js';
import { buildPaidReport } from './paidReportDocument.js';

function one(value) {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : '';
  return typeof value === 'string' ? value : '';
}

export async function paidReportPageModel(params) {
  const token = one(params?.token);
  const report = await loadPaidReport(token);
  if (!report) return null;
  const parsed = parseAgencyName(one(params?.agency));
  return {
    token,
    doc: buildPaidReport({
      result: report.result,
      answers: report.answers,
      agency: parsed.ok ? parsed.name : '',
    }),
    showError: !parsed.ok || one(params?.error) === 'agency',
  };
}
