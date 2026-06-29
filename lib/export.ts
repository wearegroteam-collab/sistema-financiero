import { formatDateTime } from "./format";

export type ExportRow = Record<string, string | number>;

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function exportExcel(rows: ExportRow[], filename: string, title: string) {
  const headers = rows[0] ? Object.keys(rows[0]) : ["Sin datos"];
  const body = rows.length ? rows : [{ "Sin datos": "No hay registros para el filtro seleccionado" }];
  const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body>
    <h1>${escapeHtml(title)}</h1>
    <p>Generado: ${escapeHtml(formatDateTime(new Date().toISOString()))}</p>
    <table border="1">
      <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
      <tbody>${body
        .map((row) => `<tr>${headers.map((header) => `<td>${escapeHtml(String(row[header] ?? ""))}</td>`).join("")}</tr>`)
        .join("")}</tbody>
    </table>
  </body></html>`;

  downloadBlob(new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" }), filename);
}

export function exportPdf(lines: string[], filename: string) {
  const content = buildPdf(lines);
  downloadBlob(new Blob([content], { type: "application/pdf" }), filename);
}

function buildPdf(lines: string[]) {
  const escapedLines = lines.flatMap((line) => wrapLine(line, 88)).slice(0, 58);
  const text = escapedLines
    .map((line, index) => `BT /F1 10 Tf 50 ${790 - index * 13} Td (${escapePdf(line)}) Tj ET`)
    .join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
    `5 0 obj << /Length ${text.length} >> stream\n${text}\nendstream endobj\n`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += object;
  }
  const xrefAt = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
  return pdf;
}

function wrapLine(value: string, size: number) {
  const words = value.split(" ");
  const lines: string[] = [];
  let current = "";
  words.forEach((word) => {
    if (`${current} ${word}`.trim().length > size) {
      lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  });
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function escapePdf(value: string) {
  return value.replace(/[^\x20-\x7E]/g, "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
