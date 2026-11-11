// ===== CHAT MODULE =====
let chatPollInterval = null;

function renderChatSection() {
    document.getElementById('globalSearchResults').style.display = 'none';
    document.getElementById('filtersBar').innerHTML = '';
    document.getElementById('sectionTitle').textContent = '💬 Чат предложений';
    document.getElementById('stats').innerHTML = '';

    document.getElementById('articlesList').innerHTML = `
        <div class="chat-container">
            <div class="chat-messages" id="chatMessages"><div class="chat-loading">Загрузка...</div></div>
            <div class="chat-input-area" id="chatInputArea">
                <div class="chat-auth-note" id="chatAuthNote" style="display:none;">
                    🔒 Для отправки сообщений необходимо <a href="#" onclick="document.getElementById('authOpenBtn').click();return false;">войти в аккаунт</a>
                </div>
                <div class="chat-input-row" id="chatInputRow" style="display:none;">
                    <input type="text" id="chatInput" class="chat-input" placeholder="Написать предложение..." maxlength="500">
                    <button class="chat-send-btn" id="chatSendBtn">➤</button>
                </div>
            </div>
        </div>`;

    updateChatInputVisibility();
    loadChat();
    if (chatPollInterval) clearInterval(chatPollInterval);
    chatPollInterval = setInterval(loadChat, 10000);
}

function updateChatInputVisibility() {
    const authNote = document.getElementById('chatAuthNote');
    const inputRow = document.getElementById('chatInputRow');
    if (!authNote || !inputRow) return;

    if (currentUser) {
        authNote.style.display = 'none';
        inputRow.style.display = 'flex';
        document.getElementById('chatSendBtn')?.addEventListener('click', sendChat);
        document.getElementById('chatInput')?.addEventListener('keydown', e => {
            if (e.key === 'Enter') sendChat();
        });
    } else {
        authNote.style.display = 'block';
        inputRow.style.display = 'none';
    }
}

async function loadChat() {
    try {
        const res = await fetch('/api/chat');
        const msgs = await res.json();
        const container = document.getElementById('chatMessages');
        if (!container) return;

        if (!msgs || msgs.length === 0) {
            container.innerHTML = '<div class="chat-empty">Сообщений пока нет. Будьте первым!</div>';
            return;
        }

        const sorted = [...msgs].reverse();
        const canMod = currentUser && (currentUser.role === 'moderator' || currentUser.role === 'admin');
    const canModAdmin = canMod; 

        container.innerHTML = sorted.map(m => {
            const isAdmin = m.role === 'admin';
            const isMod = m.role === 'moderator';
            const roleLabel = isAdmin ? '<span class="chat-prefix admin-prefix">Admin</span>'
                            : isMod   ? '<span class="chat-prefix mod-prefix">Moder</span>'
                                      : '<span class="chat-prefix user-prefix">Участник</span>';
            const nameClass = isAdmin ? 'chat-name admin-name' : isMod ? 'chat-name mod-name' : 'chat-name';
            const delBtn = canMod ? `<button class="chat-del-btn" onclick="deleteMsg(${m.id})" title="Удалить">✕</button>` : '';
            return `
                <div class="chat-msg" data-id="${m.id}">
                    <div class="chat-msg-header">
                        <span class="${nameClass}">${m.username}</span>
                        ${roleLabel}
                        <span class="chat-time">${m.created_at}</span>
                        ${delBtn}
                    </div>
                    <div class="chat-msg-text">${escapeHtml(m.message)}</div>
                </div>`;
        }).join('');

        container.scrollTop = container.scrollHeight;
    } catch(e) { console.error('Chat load error:', e); }
}

function showChatError(msg) {
    const area = document.getElementById('chatInputArea');
    if (!area) return;
    let err = document.getElementById('chatSpamError');
    if (!err) {
        err = document.createElement('div');
        err.id = 'chatSpamError';
        err.style.cssText = 'color:var(--accent-red);font-size:12px;padding:6px 0;text-align:center;';
        area.insertBefore(err, area.firstChild);
    }
    err.textContent = '🚫 ' + msg;
    setTimeout(() => { if (err) err.textContent = ''; }, 5000);
}

async function sendChat() {
    const input = document.getElementById('chatInput');
    if (!input) return;
    const msg = input.value.trim();
    if (!msg) return;

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + getToken()
            },
            body: JSON.stringify({ message: msg })
        });
        if (res.ok) {
            input.value = '';
            await loadChat();
        } else if (res.status === 429) {
            const data = await res.json();
            showChatError(data.error || 'Слишком много сообщений, подождите.');
        }
    } catch(e) {}
}

window.deleteMsg = async function(id) {
    if (!confirm('Удалить сообщение?')) return;
    try {
        const headers = { 'Content-Type': 'application/json' };
        const token = getToken();
        if (token) headers['Authorization'] = 'Bearer ' + token;
        await fetch(`/api/chat/message?id=${id}`, { method: 'DELETE', headers });
        await loadChat();
    } catch(e) {}
};

function escapeHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

window.addEventListener('beforeunload', () => {
    if (chatPollInterval) clearInterval(chatPollInterval);
});
