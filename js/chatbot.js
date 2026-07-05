// ============================================================
// Simple keyword-matching FAQ chatbot — no API, fully client-side
// ============================================================

const CHAT_KB = [
  {
    keywords: ['what is tamufeeds', 'what is this', 'about'],
    answer: "TamuFeeds connects restaurants with surplus, still-good food to children's homes and NGOs nearby, so it gets eaten instead of thrown away."
  },
  {
    keywords: ['cost', 'free', 'price', 'pay'],
    answer: "TamuFeeds is completely free for both restaurants and NGOs."
  },
  {
    keywords: ['sign up', 'signup', 'register', 'create account', 'join'],
    answer: "Click \"Sign Up\" in the top navbar, choose Restaurant or Organization, and fill in your details. It takes under a minute."
  },
  {
    keywords: ['donate', 'post a listing', 'post food', 'give food', 'list food'],
    answer: "Once logged in as a restaurant, click \"Donate Food\" in the navbar to post what you have, how much, and your pickup window."
  },
  {
    keywords: ['claim', 'reserve', 'get food', 'collect food'],
    answer: "NGOs can browse the live board and click \"Claim this\" on any available listing. You'll then have a set window to pick it up."
  },
  {
    keywords: ['pickup window', 'how long', 'deadline', 'expire', 'time limit'],
    answer: "Once claimed, you have 3 hours to pick up the food. If it's not marked picked up in time, it automatically becomes available again for others."
  },
  {
    keywords: ['forgot password', 'reset password', 'cant log in', "can't log in"],
    answer: "On the Log In page, click \"Forgot password?\" and enter your email — we'll send you a reset link."
  },
  {
    keywords: ['map', 'location', 'where'],
    answer: "The Map page shows all active listings plotted by location, color-coded by status — green for available, amber for claimed."
  },
  {
    keywords: ['badge', 'impact', 'dashboard', 'points'],
    answer: "Your Impact dashboard tracks your completed handoffs and unlocks badges at 1, 5, 20, and 50 completions."
  },
  {
    keywords: ['privacy', 'data', 'safe', 'secure'],
    answer: "Your data is stored securely and your contact details are only shared with the other party once a claim is made. See our Privacy Policy in the footer for full details."
  },
  {
    keywords: ['contact', 'support', 'help', 'human', 'email'],
    answer: "You can reach us anytime at hello@tamufeeds.com."
  },
  {
    keywords: ['photo', 'picture', 'image'],
    answer: "Yes — restaurants can attach a photo when posting a listing, so NGOs can see exactly what's available."
  }
];

const CHAT_FALLBACK = "I don't have an answer for that yet — try rephrasing, check our FAQ page, or email hello@tamufeeds.com and we'll help directly.";

const CHAT_SUGGESTIONS = ['How do I donate food?', 'How do I claim food?', 'Is it free?', 'How does pickup work?'];

function findChatAnswer(text) {
  const q = text.toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const entry of CHAT_KB) {
    const score = entry.keywords.reduce((acc, kw) => acc + (q.includes(kw) ? kw.length : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  return best ? best.answer : CHAT_FALLBACK;
}

function chatAppendMessage(text, from) {
  const log = document.getElementById('chat-log');
  if (!log) return;
  const msg = document.createElement('div');
  msg.className = `chat-msg ${from}`;
  msg.textContent = text;
  log.appendChild(msg);
  log.scrollTop = log.scrollHeight;
}

function chatSend(text) {
  if (!text.trim()) return;
  chatAppendMessage(text, 'user');
  setTimeout(() => {
    chatAppendMessage(findChatAnswer(text), 'bot');
  }, 350);
}

function initChatbot() {
  const toggleBtn = document.getElementById('chat-toggle-btn');
  const panel = document.getElementById('chat-panel');
  const closeBtn = document.getElementById('chat-close-btn');
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');
  const suggestionsEl = document.getElementById('chat-suggestions');

  if (!toggleBtn || !panel) return;

  suggestionsEl.innerHTML = CHAT_SUGGESTIONS
    .map(s => `<button type="button" class="chat-suggestion">${s}</button>`)
    .join('');

  suggestionsEl.querySelectorAll('.chat-suggestion').forEach(btn => {
    btn.addEventListener('click', () => chatSend(btn.textContent));
  });

  toggleBtn.addEventListener('click', () => {
    panel.classList.toggle('open');
    if (panel.classList.contains('open') && !panel.dataset.greeted) {
      panel.dataset.greeted = 'true';
      chatAppendMessage("Hi! I'm the TamuFeeds helper bot. Ask me anything about donating, claiming, or how the platform works.", 'bot');
    }
  });

  closeBtn.addEventListener('click', () => panel.classList.remove('open'));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value;
    input.value = '';
    chatSend(text);
  });
}

document.addEventListener('DOMContentLoaded', initChatbot);