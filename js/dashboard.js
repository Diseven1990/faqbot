import { readPDF, readDOCX, toCSV, fromCSV } from "./utils.js";

const ownerEl = document.getElementById("gh-owner");
const repoEl = document.getElementById("gh-repo");
const tokenEl = document.getElementById("gh-token");
const connectBtn = document.getElementById("connect-btn");
const authStatus = document.getElementById("auth-status");

const uploadSection = document.getElementById("upload");
const manualSection = document.getElementById("manual");
const commitSection = document.getElementById("commit");
const historySection = document.getElementById("history");

const fileInput = document.getElementById("file-input");
const uploadBtn = document.getElementById("upload-btn");
const filePreview = document.getElementById("file-preview");

const keywordsInput = document.getElementById("keywords");
const answerInput = document.getElementById("answer");
const addBtn = document.getElementById("add-btn");

const tableBody = document.querySelector("#kb-table tbody");

const importCSVBtn = document.getElementById("import-csv");
const exportCSVBtn = document.getElementById("export-csv");
const csvFile = document.getElementById("csv-file");

const saveBtn = document.getElementById("save-btn");
const saveStatus = document.getElementById("save-status");
const doBackup = document.getElementById("do-backup");

const historyList = document.getElementById("history-list");

let token = "";
let owner = "";
let repo = "";
let knowledge = [];
let shaKnowledge = "";
let pendingChanges = [];

function ghHeaders() {
  return {
    "Authorization": `token ${token}`,
    "Accept": "application/vnd.github+json"
  };
}

async function ghFetch(url, options={}) {
  const res = await fetch(url, { headers: ghHeaders(), ...options });
  if (res.status === 403) {
    const rl = res.headers.get("x-ratelimit-remaining");
    if (rl === "0") throw new Error("Limite de taxa da GitHub API atingido. Tenta mais tarde.");
  }
  return res;
}

// AUTENTICAR
connectBtn.addEventListener("click", async () => {
  token = tokenEl.value.trim();
  owner = ownerEl.value.trim();
  repo = repoEl.value.trim();
  if (!token || !owner || !repo) return alert("Preenche owner, repo e token.");
  const me = await ghFetch("https://api.github.com/user");
  if (me.ok) {
    authStatus.textContent = "✅ Ligado com sucesso!";
    uploadSection.classList.remove("hidden");
    manualSection.classList.remove("hidden");
    commitSection.classList.remove("hidden");
    historySection.classList.remove("hidden");
    await loadKnowledge();
    await loadHistory();
  } else {
    const t = await me.text();
    authStatus.textContent = "❌ Erro na autenticação: " + t;
  }
});

// Carregar knowledge.json
async function loadKnowledge() {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/data/knowledge.json`;
  const res = await ghFetch(url);
  if (!res.ok) throw new Error("Não foi possível carregar knowledge.json");
  const data = await res.json();
  shaKnowledge = data.sha;
  const decoded = atob(data.content);
  const json = JSON.parse(decoded);
  knowledge = json.faq || [];
  renderTable();
}

// Render tabela
function renderTable() {
  tableBody.innerHTML = "";
  knowledge.forEach((entry, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${idx+1}</td>
      <td contenteditable="true" data-field="keywords">${(entry.keywords||[]).join(", ")}</td>
      <td contenteditable="true" data-field="answer">${entry.answer||""}</td>
      <td>
        <div class="actions">
          <button data-action="update" data-idx="${idx}">Atualizar</button>
          <button data-action="delete" data-idx="${idx}">Remover</button>
        </div>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

// Extrair texto do ficheiro
uploadBtn.addEventListener("click", async () => {
  const file = fileInput.files[0];
  if (!file) return alert("Seleciona um ficheiro.");
  let text = "";
  if (file.name.toLowerCase().endsWith(".pdf")) text = await readPDF(file);
  if (file.name.toLowerCase().endsWith(".doc") || file.name.toLowerCase().endsWith(".docx")) text = await readDOCX(file);
  filePreview.textContent = text.slice(0, 5000) + (text.length > 5000 ? "..." : "");
  answerInput.value = text;
});

// Adicionar nova entrada
addBtn.addEventListener("click", () => {
  const kw = keywordsInput.value.split(",").map(k => k.trim()).filter(Boolean);
  const ans = answerInput.value.trim();
  if (!kw.length || !ans) return alert("Preenche palavras‑chave e resposta.");
  knowledge.push({ keywords: kw, answer: ans });
  renderTable();
  keywordsInput.value = "";
  answerInput.value = "";
});

// Atualizar/Remover linha
tableBody.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const idx = parseInt(btn.dataset.idx, 10);
  if (btn.dataset.action === "delete") {
    if (confirm("Remover esta entrada?")) {
      knowledge.splice(idx, 1);
      renderTable();
    }
  }
  if (btn.dataset.action === "update") {
    const tr = btn.closest("tr");
    const kwCell = tr.querySelector('[data-field="keywords"]');
    const ansCell = tr.querySelector('[data-field="answer"]');
    const kw = kwCell.innerText.split(",").map(s => s.trim()).filter(Boolean);
    const ans = ansCell.innerText.trim();
    knowledge[idx] = { keywords: kw, answer: ans };
    kwCell.classList.add("updated");
    ansCell.classList.add("updated");
    setTimeout(() => { kwCell.classList.remove("updated"); ansCell.classList.remove("updated"); }, 800);
  }
});

// Import/Export CSV
importCSVBtn.addEventListener("click", () => csvFile.click());
csvFile.addEventListener("change", async () => {
  const file = csvFile.files[0];
  if (!file) return;
  const text = await file.text();
  const rows = fromCSV(text);
  knowledge = knowledge.concat(rows);
  renderTable();
});
exportCSVBtn.addEventListener("click", () => {
  const csv = toCSV(knowledge);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "knowledge.csv";
  a.click();
  URL.revokeObjectURL(url);
});

// Guardar no GitHub (+ backup opcional)
saveBtn.addEventListener("click", async () => {
  saveStatus.textContent = "A gravar no GitHub...";
  try {
    if (doBackup.checked) {
      await saveBackup();
    }
    await saveKnowledge();
    saveStatus.textContent = "✅ knowledge.json atualizado com sucesso!";
  } catch (e) {
    saveStatus.textContent = "❌ Erro ao gravar: " + e.message;
  }
});

async function saveKnowledge() {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/data/knowledge.json`;
  const content = btoa(JSON.stringify({ faq: knowledge }, null, 2));
  const body = {
    message: `Atualização via dashboard (${new Date().toISOString()})`,
    content,
    sha: shaKnowledge,
    branch: "main"
  };
  const res = await ghFetch(url, {
    method: "PUT",
    headers: { ...ghHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t);
  }
  const data = await res.json();
  shaKnowledge = data.content.sha; // atualizar sha para próxima gravação
}

// Backup em data/backups/knowledge-YYYYMMDD-HHMMSS.json
async function saveBackup() {
  const ts = new Date();
  const pad = (n)=> String(n).zfill?.(2) || (n<10? "0"+n : ""+n);
  const name = `knowledge-${ts.getFullYear()}${pad(ts.getMonth()+1)}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}.json`;
  const path = `data/backups/${name}`;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const content = btoa(JSON.stringify({ faq: knowledge }, null, 2));
  const body = {
    message: `Backup via dashboard (${new Date().toISOString()})`,
    content,
    branch: "main"
  };
  const res = await ghFetch(url, {
    method: "PUT",
    headers: { ...ghHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error("Backup falhou: " + t);
  }
}

// Histórico de commits do knowledge.json
async function loadHistory() {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits?path=data/knowledge.json`;
  const res = await ghFetch(url);
  if (!res.ok) return;
  const commits = await res.json();
  historyList.innerHTML = "";
  for (const c of commits) {
    const div = document.createElement("div");
    div.className = "item";
    const date = new Date(c.commit.author.date).toLocaleString();
    div.innerHTML = `<div><span class="badge">${c.sha.slice(0,7)}</span> ${date} — ${c.commit.author.name}</div>
    <div class="small">${c.commit.message}</div>
    <div class="small"><a href="#" data-sha="${c.sha}">Ver versão</a></div>`;
    historyList.appendChild(div);
  }
  historyList.addEventListener("click", async (e) => {
    const a = e.target.closest("a[data-sha]");
    if (!a) return;
    e.preventDefault();
    const sha = a.dataset.sha;
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/data/knowledge.json?ref=${sha}`;
    const res = await ghFetch(url);
    if (!res.ok) return alert("Não foi possível obter essa versão.");
    const data = await res.json();
    const decoded = atob(data.content);
    const json = JSON.parse(decoded);
    const lines = JSON.stringify(json, null, 2);
    const blob = new Blob([lines], { type: "application/json" });
    const obj = URL.createObjectURL(blob);
    const win = window.open();
    win.document.write("<pre>"+lines.replace(/</g,"&lt;")+"</pre>");
    URL.revokeObjectURL(obj);
  });
}
