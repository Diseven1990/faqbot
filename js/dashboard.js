import { readPDF, readDOCX, toCSV, fromCSV } from "./utils.js";

const ownerEl=document.getElementById("gh-owner"); const repoEl=document.getElementById("gh-repo"); const tokenEl=document.getElementById("gh-token");
const connectBtn=document.getElementById("connect-btn"); const authStatus=document.getElementById("auth-status");
const uploadSection=document.getElementById("upload"); const manualSection=document.getElementById("manual");
const commitSection=document.getElementById("commit"); const historySection=document.getElementById("history"); const synSection=document.getElementById("syn");
const fileInput=document.getElementById("file-input"); const uploadBtn=document.getElementById("upload-btn"); const filePreview=document.getElementById("file-preview");
const keywordsInput=document.getElementById("keywords"); const answerInput=document.getElementById("answer"); const addBtn=document.getElementById("add-btn");
const tableBody=document.querySelector("#kb-table tbody");
const importCSVBtn=document.getElementById("import-csv"); const exportCSVBtn=document.getElementById("export-csv"); const csvFile=document.getElementById("csv-file");
const saveBtn=document.getElementById("save-btn"); const saveStatus=document.getElementById("save-status"); const doBackup=document.getElementById("do-backup");
const historyList=document.getElementById("history-list");
const synTerm=document.getElementById("syn-term"); const synBtn=document.getElementById("syn-btn");
const synCanon=document.getElementById("syn-canon"); const synList=document.getElementById("syn-list"); const synAdd=document.getElementById("syn-add"); const synClear=document.getElementById("syn-clear");
const synTableBody=document.querySelector("#syn-table tbody"); const synSave=document.getElementById("syn-save"); const synStatus=document.getElementById("syn-status");

let token="", owner="", repo=""; let knowledge=[], shaKnowledge=""; let synonymsMap={}, shaSynonyms="";

function ghHeaders(){ return { "Authorization":`token ${token}`, "Accept":"application/vnd.github+json" }; }
async function ghFetch(url,opts={}){ const res=await fetch(url,{ headers:ghHeaders(), ...opts }); if(res.status===403 && res.headers.get("x-ratelimit-remaining")==="0") throw new Error("Limite de taxa atingido"); return res; }

connectBtn.addEventListener("click", async ()=>{
  token=tokenEl.value.trim(); owner=ownerEl.value.trim(); repo=repoEl.value.trim();
  if(!token||!owner||!repo) return alert("Preenche owner, repo e token.");
  const me=await ghFetch("https://api.github.com/user");
  if(me.ok){ authStatus.textContent="✅ Ligado com sucesso!"; uploadSection.classList.remove("hidden"); manualSection.classList.remove("hidden"); commitSection.classList.remove("hidden"); historySection.classList.remove("hidden"); synSection.classList.remove("hidden"); await loadKnowledge(); await loadHistory(); await loadSynonyms(); }
  else authStatus.textContent="❌ Erro na autenticação.";
});

async function loadKnowledge(){ const url=`https://api.github.com/repos/${owner}/${repo}/contents/data/knowledge.json`; const res=await ghFetch(url); if(!res.ok) throw new Error("Não foi possível carregar knowledge.json"); const data=await res.json(); shaKnowledge=data.sha; knowledge=JSON.parse(atob(data.content)).faq||[]; renderTable(); }
function renderTable(){ tableBody.innerHTML=""; knowledge.forEach((entry,idx)=>{ const tr=document.createElement("tr"); tr.innerHTML=`<td>${idx+1}</td><td contenteditable="true" data-field="keywords">${(entry.keywords||[]).join(", ")}</td><td contenteditable="true" data-field="answer">${entry.answer||""}</td><td><div class="actions"><button data-action="update" data-idx="${idx}">Atualizar</button><button data-action="delete" data-idx="${idx}">Remover</button></div></td>`; tableBody.appendChild(tr); }); }
uploadBtn.addEventListener("click", async ()=>{ const file=fileInput.files[0]; if(!file) return alert("Seleciona um ficheiro."); let text=""; const n=file.name.toLowerCase(); if(n.endswith(".pdf")) text=await readPDF(file); if(n.endswith(".doc")||n.endswith(".docx")) text=await readDOCX(file); filePreview.textContent=text.slice(0,5000)+(text.length>5000?"…":""); answerInput.value=text; });
addBtn.addEventListener("click", ()=>{ const kw=keywordsInput.value.split(",").map(s=>s.trim()).filter(Boolean); const ans=answerInput.value.trim(); if(!kw.length||!ans) return alert("Preenche palavras‑chave e resposta."); knowledge.push({keywords:kw, answer:ans}); renderTable(); keywordsInput.value=""; answerInput.value=""; });
tableBody.addEventListener("click", (e)=>{ const btn=e.target.closest("button"); if(!btn) return; const idx=+btn.dataset.idx; if(btn.dataset.action==="delete"){ if(confirm("Remover esta entrada?")){ knowledge.splice(idx,1); renderTable(); } } if(btn.dataset.action==="update"){ const tr=btn.closest("tr"); const kw=tr.querySelector('[data-field="keywords"]').innerText.split(",").map(s=>s.trim()).filter(Boolean); const ans=tr.querySelector('[data-field="answer"]').innerText.trim(); knowledge[idx]={keywords:kw, answer:ans}; } });
importCSVBtn.addEventListener("click", ()=> csvFile.click());
csvFile.addEventListener("change", async ()=>{ const file=csvFile.files[0]; if(!file) return; const text=await file.text(); const rows=fromCSV(text); knowledge=knowledge.concat(rows); renderTable(); });
exportCSVBtn.addEventListener("click", ()=>{ const csv=toCSV(knowledge); const blob=new Blob([csv],{type:"text/csv;charset=utf-8"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="knowledge.csv"; a.click(); URL.revokeObjectURL(url); });
saveBtn.addEventListener("click", async ()=>{ saveStatus.textContent="A gravar no GitHub…"; try{ if(document.getElementById("do-backup").checked) await saveBackup(); await saveKnowledge(); saveStatus.textContent="✅ knowledge.json atualizado!"; } catch(e){ saveStatus.textContent="❌ Erro: "+e.message; } });
async function saveKnowledge(){ const url=`https://api.github.com/repos/${owner}/${repo}/contents/data/knowledge.json`; const body={ message:`Atualização via dashboard (${new Date().toISOString()})`, content:btoa(JSON.stringify({faq:knowledge},null,2)), sha:shaKnowledge, branch:"main" }; const res=await ghFetch(url,{method:"PUT", headers:{...ghHeaders(),"Content-Type":"application/json"}, body:JSON.stringify(body)}); if(!res.ok) throw new Error(await res.text()); const data=await res.json(); shaKnowledge=data.content.sha; }
async function saveBackup(){ const ts=new Date(); const pad=n=>n<10?"0"+n:""+n; const name=`knowledge-${ts.getFullYear()}${pad(ts.getMonth()+1)}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}.json`; const path=`data/backups/${name}`; const url=`https://api.github.com/repos/${owner}/${repo}/contents/${path}`; const body={ message:`Backup via dashboard (${new Date().toISOString()})`, content:btoa(JSON.stringify({faq:knowledge},null,2)), branch:"main" }; const res=await ghFetch(url,{method:"PUT", headers:{...ghHeaders(),"Content-Type":"application/json"}, body:JSON.stringify(body)}); if(!res.ok) throw new Error("Backup falhou: "+await res.text()); }
async function loadHistory(){ const url=`https://api.github.com/repos/${owner}/${repo}/commits?path=data/knowledge.json`; const res=await ghFetch(url); if(!res.ok) return; const commits=await res.json(); historyList.innerHTML=""; for(const c of commits){ const div=document.createElement("div"); div.className="item"; const date=new Date(c.commit.author.date).toLocaleString(); div.innerHTML=`<div><span class="badge">${c.sha.slice(0,7)}</span> ${date} — ${c.commit.author.name}</div><div class="small">${c.commit.message}</div>`; historyList.appendChild(div); } }

// synonyms.json
async function loadSynonyms(){ const url=`https://api.github.com/repos/${owner}/${repo}/contents/data/synonyms.json`; const res=await ghFetch(url); if(res.status===404){ synonymsMap={}; shaSynonyms=""; renderSynTable(); return; } if(!res.ok) throw new Error("Não foi possível carregar synonyms.json"); const data=await res.json(); shaSynonyms=data.sha; const decoded=atob(data.content); const json=JSON.parse(decoded); synonymsMap=json.map||{}; renderSynTable(); }
function renderSynTable(){ synTableBody.innerHTML=""; const entries=Object.entries(synonymsMap).sort((a,b)=>a[0].localeCompare(b[0])); for(const [canon,list] of entries){ const tr=document.createElement("tr"); tr.innerHTML=`<td contenteditable="true" data-field="canon">${canon}</td><td contenteditable="true" data-field="list">${(list||[]).join(", ")}</td><td><div class="actions"><button data-action="apply" data-canon="${canon}">Aplicar</button><button data-action="delete" data-canon="${canon}">Remover</button></div></td>`; synTableBody.appendChild(tr); } }
synAdd.addEventListener("click", ()=>{
  const canon = (synCanon.value||"").trim().toLowerCase();
  const list  = (synList.value||"").split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);
  if (!canon) return alert("Indica o termo canónico.");
  if (!list.length) return alert("Indica pelo menos um sinónimo.");
  const uniq = Array.from(new Set(list.filter(s=>s!==canon)));
  synonymsMap[canon] = uniq; renderSynTable();
});
synClear.addEventListener("click", ()=>{ synCanon.value=""; synList.value=""; });
synTableBody.addEventListener("click", (e)=>{
  const btn = e.target.closest("button"); if(!btn) return;
  const action = btn.dataset.action; const currentCanon = btn.dataset.canon;
  if (action==="delete"){ if (confirm(`Remover "${currentCanon}"?`)) { delete synonymsMap[currentCanon]; renderSynTable(); } }
  if (action==="apply"){
    const tr = btn.closest("tr");
    const canonCell = tr.querySelector('[data-field="canon"]');
    const listCell  = tr.querySelector('[data-field="list"]');
    const canon = canonCell.innerText.trim().toLowerCase();
    const list  = listCell.innerText.split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);
    if (!canon) return alert("O canónico não pode ficar vazio.");
    const uniq = Array.from(new Set(list.filter(s=>s!==canon)));
    if (canon !== currentCanon) delete synonymsMap[currentCanon];
    synonymsMap[canon] = uniq;
  }
});
synSave.addEventListener("click", async ()=>{
  synStatus.textContent="A gravar…";
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/data/synonyms.json`;
    const body = { message:`Atualização de synonyms.json via dashboard (${new Date().toISOString()})`, content:btoa(JSON.stringify({ map: synonymsMap }, null, 2)), branch:"main" };
    if (shaSynonyms) body.sha = shaSynonyms;
    const res = await ghFetch(url, { method:"PUT", headers:{...ghHeaders(),"Content-Type":"application/json"}, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json(); shaSynonyms = data.content.sha; synStatus.textContent="✅ Gravado!";
  } catch(e){ synStatus.textContent="❌ Erro: "+e.message; }
});

async function fetchDatamuse(term){ const url=`https://api.datamuse.com/words?ml=${encodeURIComponent(term)}&max=25`; const r=await fetch(url,{mode:"cors"}); if(!r.ok) throw new Error("Datamuse indisponível"); const data=await r.json(); return (data||[]).map(x=>(x.word||"").toLowerCase()); }
function uniq(arr){ return Array.from(new Set(arr.map(s=>s.trim()).filter(Boolean))); }
async function suggestSynonymsIntoKeywords(baseTerm){ if(!baseTerm) throw new Error("Indica um termo para sinónimos."); const syns=await fetchDatamuse(baseTerm); if(!syns.length) throw new Error("Sem sugestões."); const existing=uniq((keywordsInput.value||"").split(",").map(s=>s.toLowerCase())); const merged=uniq(existing.concat([baseTerm.toLowerCase()]).concat(syns)); keywordsInput.value=merged.join(", "); return syns; }
document.getElementById("syn-btn")?.addEventListener("click", async ()=>{ const term=(document.getElementById("syn-term").value||"").trim(); if(!term) return alert("Escreve um termo (ex.: reagendar)."); const btn=document.getElementById("syn-btn"); btn.disabled=true; btn.textContent="A procurar…"; try{ const syns=await suggestSynonymsIntoKeywords(term); alert(`Sugeridos ${syns.length} sinónimos.`);}catch(e){ alert("Erro: "+e.message);} finally{ btn.disabled=false; btn.textContent="Sugerir sinónimos"; } });
