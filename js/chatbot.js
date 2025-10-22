const chatBox = document.getElementById("chat-box");
const input = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
let knowledgeBase = [];

async function loadKnowledge() {
  try {
    const res = await fetch("data/knowledge.json", { cache: "no-store" });
    const data = await res.json();
    knowledgeBase = data.faq || [];
  } catch (e) {
    knowledgeBase = [];
  }
}

function appendMessage(text, sender = "bot") {
  const msg = document.createElement("div");
  msg.classList.add("message", sender);
  msg.innerHTML = text;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function findAnswer(question) {
  const q = question.toLowerCase();
  // First: direct keyword inclusion
  for (const entry of knowledgeBase) {
    if ((entry.keywords || []).some(k => q.includes(k.toLowerCase()))) {
      return entry.answer;
    }
  }
  // Second: simple scoring
  let best = { score: 0, answer: null };
  for (const entry of knowledgeBase) {
    const kws = (entry.keywords || []).map(k => k.toLowerCase());
    const score = kws.reduce((acc, k) => acc + (q.includes(k) ? 1 : 0), 0);
    if (score > best.score) best = { score, answer: entry.answer };
  }
  return best.answer || "Não encontrei uma resposta exata 🤔<br>Podes tentar reformular ou contactar o teu e-tutor.";
}

function handleUserMessage() {
  const question = input.value.trim();
  if (!question) return;
  appendMessage(question, "user");
  input.value = "";
  setTimeout(() => {
    const answer = findAnswer(question);
    appendMessage(answer, "bot");
  }, 300);
}

sendBtn.addEventListener("click", handleUserMessage);
input.addEventListener("keypress", e => {
  if (e.key === "Enter") handleUserMessage();
});

loadKnowledge();
