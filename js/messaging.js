// ============================================================
// In-app messaging — one thread per claim, real-time via Supabase
// ============================================================

const Messaging = {
  async fetch(claimId) {
    const { data, error } = await sb
      .from('messages')
      .select('*')
      .eq('claim_id', claimId)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('fetch messages error', error);
      return [];
    }
    return data || [];
  },

  async send(claimId, content) {
    const { error } = await sb.from('messages').insert({
      claim_id: claimId,
      sender_id: Auth.session.user.id,
      content
    });
    return { error };
  },

  subscribe(claimId, onInsert) {
    return sb
      .channel(`messages-${claimId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `claim_id=eq.${claimId}` }, (payload) => {
        onInsert(payload.new);
      })
      .subscribe();
  },

  unsubscribe(channel) {
    if (channel) sb.removeChannel(channel);
  }
};

let activeChatClaimId = null;
let activeChatChannel = null;

function renderChatMessage(msg) {
  const log = document.getElementById('chat-modal-log');
  if (!log) return;
  const mine = msg.sender_id === Auth.session.user.id;
  const bubble = document.createElement('div');
  bubble.className = `chat-msg ${mine ? 'user' : 'bot'}`;
  bubble.textContent = msg.content;
  log.appendChild(bubble);
  log.scrollTop = log.scrollHeight;
}

async function openChatModal(claimId, otherPartyName) {
  activeChatClaimId = claimId;
  document.getElementById('chat-modal-title').textContent = `Chat with ${otherPartyName}`;
  document.getElementById('chat-modal-log').innerHTML = '';
  document.getElementById('chat-modal-overlay').style.display = 'flex';

  const messages = await Messaging.fetch(claimId);
  messages.forEach(renderChatMessage);

  Messaging.unsubscribe(activeChatChannel);
  activeChatChannel = Messaging.subscribe(claimId, (newMsg) => {
    // Avoid double-rendering our own just-sent message (already rendered optimistically)
    if (newMsg.sender_id === Auth.session.user.id) return;
    renderChatMessage(newMsg);
  });
}

function closeChatModal() {
  document.getElementById('chat-modal-overlay').style.display = 'none';
  Messaging.unsubscribe(activeChatChannel);
  activeChatChannel = null;
  activeChatClaimId = null;
}

function initMessaging() {
  document.getElementById('chat-modal-close')?.addEventListener('click', closeChatModal);
  document.getElementById('chat-modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'chat-modal-overlay') closeChatModal();
  });

  document.getElementById('chat-modal-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('chat-modal-input');
    const content = input.value.trim();
    if (!content || !activeChatClaimId) return;
    input.value = '';

    renderChatMessage({ sender_id: Auth.session.user.id, content }); // optimistic
    const { error } = await Messaging.send(activeChatClaimId, content);
    if (error) console.error('Send message failed', error);
  });

  // Event delegation: any button anywhere with data-open-chat handles opening the modal
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-open-chat]');
    if (!btn) return;
    openChatModal(btn.dataset.claimId, btn.dataset.otherName);
  });
}

document.addEventListener('DOMContentLoaded', initMessaging);