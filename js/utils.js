// Lê ficheiro PDF
export async function readPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(i => i.str).join(" ") + "\n";
  }
  return text.trim();
}

// Lê ficheiro DOC/DOCX
export async function readDOCX(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await window.mammoth.extractRawText({ arrayBuffer });
  return (result.value || "").trim();
}

// CSV helpers
export function toCSV(rows) {
  const esc = (s) => '"' + String(s).replace(/"/g, '""') + '"';
  const header = ['keywords','answer'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([esc((r.keywords || []).join('|')), esc(r.answer || '')].join(','));
  }
  return lines.join('\n');
}

export function fromCSV(text) {
  // Very simple CSV parser (expects "keywords,answer"; keywords separated by | or , inside)
  const lines = text.split(/\r?\n/).filter(Boolean);
  const out = [];
  let start = 0;
  if (lines[0].toLowerCase().includes('keywords')) start = 1;
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    const parts = splitCSV(line);
    const kwRaw = (parts[0] || '');
    const ans = parts[1] || '';
    const keywords = kwRaw.split('|').map(s => s.trim()).filter(Boolean);
    out.push({ keywords, answer: ans });
  }
  return out;
}

function splitCSV(line) {
  const res = [];
  let cur = '';
  let inQ = false;
  for (let i=0;i<line.length;i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i+1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      res.push(cur); cur='';
    } else {
      cur += ch;
    }
  }
  res.push(cur);
  return res;
}
