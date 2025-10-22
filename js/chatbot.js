import Fuse from "https://cdn.jsdelivr.net/npm/fuse.js@6.6.2/dist/fuse.esm.js";

const chatBox   = document.getElementById("chat-box");
const input     = document.getElementById("user-input");
const sendBtn   = document.getElementById("send-btn");
const synToggle = document.getElementById("syn-online");
const synStatus = document.getElementById("syn-status");

let fuse;
let knowledgeBase = [];
const SYN = new Map();
const CACHE_KEY = "faqbot_syn_cache_v1";
let synCache = loadCache();

function appendMessage(html, sender="bot"){ const el=document.createElement("div"); el.className=`message ${sender}`; el.innerHTML=html; chatBox.appendChild(el); chatBox.scrollTop=chatBox.scrollHeight; }
function setSynStatus(msg){ if(synStatus) synStatus.textContent = msg || ""; }

function loadCache(){ try{const raw=localStorage.getItem(CACHE_KEY); return raw?JSON.parse(raw):{t:0,data:{}};}catch{return {t:0,data:{}};} }
function saveCache(){ try{localStorage.setItem(CACHE_KEY, JSON.stringify(synCache));}catch{} }

async function fetchDatamuse(term){ const url=`https://api.datamuse.com/words?ml=${encodeURIComponent(term)}&max=20`; const r=await fetch(url,{mode:"cors"}); if(!r.ok) throw new Error("Datamuse indisponível"); const arr=await r.json(); return (arr||[]).map(x=>(x.word||"").toLowerCase()).filter(Boolean); }

function escapeRx(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); }
function expandText(text){ let t=` ${text.toLowerCase()} `; for(const [canon,set] of SYN.entries()){ for(const s of set){ if(!s||s===canon) continue; const rx=new RegExp(`(^|\\W)${escapeRx(s)}(\\W|$)`,"g"); t=t.replace(rx, `$1${canon}$2`);} } return t.trim(); }

function buildSynFromKB(){ const words=new Set(); for(const e of knowledgeBase) (e.keywords||[]).forEach(k=>k.split(/\s+/).forEach(w=>words.add(w.toLowerCase()))); for(const w of words) if(!SYN.has(w)) SYN.set(w,new Set([w])); }

async function loadSynonymsFile(){ try{ const res=await fetch("data/synonyms.json",{cache:"no-store"}); if(!res.ok) return; const data=await res.json(); const map=data?.map||{}; for(const [canon,list] of Object.entries(map)){ if(!SYN.has(canon)) SYN.set(canon,new Set([canon])); list.forEach(s=>SYN.get(canon).add(String(s).toLowerCase())); } }catch{} }

async function enrichSynOnline(limit=30){
  const now = Date.now();
  const EXPIRE = 7*24*60*60*1000;
  const needRefresh = (now - (synCache.t||0)) > EXPIRE;
  let processed = 0;
  for (const canon of SYN.keys()){
    if (processed >= limit) break;
    if (!needRefresh && synCache.data && synCache.data[canon]){
      const arr = synCache.data[canon];
      const set = SYN.get(canon); arr.forEach(s=>set.add(s));
      continue;
    }
    try {
      const syns = await fetchDatamuse(canon);
      const set = SYN.get(canon);
      if (!synCache.data) synCache.data = {};
      synCache.data[canon] = syns;
      syns.forEach(s=>set.add(s));
      processed++;
    } catch {}
  }
  synCache.t = now; saveCache();
}

async function loadKnowledge(){
  const res = await fetch("data/knowledge.json", { cache:"no-store" });
  const data = await res.json();
  knowledgeBase = data.faq || [];
  await loadSynonymsFile();
  buildSynFromKB();
  if (synToggle?.checked){ setSynStatus("a recolher sinónimos…"); await enrichSynOnline(30); setSynStatus("sinónimos online ativos"); }
  else setSynStatus("sinónimos online desligados");
  fuse = new Fuse(knowledgeBase, { includeScore:true, shouldSort:true, threshold:0.4, keys:[{name:"keywords",weight:0.7},{name:"answer",weight:0.3}] });
}

function findAnswer(question){
  const q = expandText(question.toLowerCase());
  const results = fuse.search(q);
  if (results.length && results[0].score < 0.5) return results[0].item.answer;
  for (const e of knowledgeBase){ if ((e.keywords||[]).some(k => q.includes(k.toLowerCase()))) return e.answer; }
  return "Não encontrei uma resposta exata 🤔<br>Tenta reformular a tua pergunta ou contactar o teu e-tutor.";
}

function handleUserMessage(){ const question=input.value.trim(); if(!question) return; appendMessage(question,"user"); input.value=""; setTimeout(()=>{ appendMessage(findAnswer(question),"bot"); },300); }

sendBtn.addEventListener("click", handleUserMessage);
input.addEventListener("keypress", e=>{ if(e.key==="Enter") handleUserMessage(); });
synToggle?.addEventListener("change", async ()=>{ if(synToggle.checked){ setSynStatus("a recolher sinónimos…"); await enrichSynOnline(30); setSynStatus("sinónimos online ativos"); } else setSynStatus("sinónimos online desligados"); });
loadKnowledge();
