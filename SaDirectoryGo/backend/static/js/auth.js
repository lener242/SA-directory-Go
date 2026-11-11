// ===== AUTH MODULE =====
let currentUser = null;

function getToken() { return localStorage.getItem('sa_token'); }
function setToken(t) { localStorage.setItem('sa_token', t); }
function clearToken() { localStorage.removeItem('sa_token'); }

async function initAuth() {
    const token = getToken();
    if (!token) { updateAuthUI(null); return; }
    try {
        const res = await fetch('/api/me', { headers: { 'Authorization': 'Bearer ' + token } });
        if (res.ok) {
            currentUser = await res.json();
            updateAuthUI(currentUser);
            await loadFavouritesState();
            updateFavBadge();
        } else {
            clearToken();
            updateAuthUI(null);
        }
    } catch(e) { updateAuthUI(null); }
}

function updateAuthUI(user) {
    const authBlock = document.getElementById('authBlock');
    const userBlock = document.getElementById('userBlock');
    if (!authBlock || !userBlock) return;

    if (user) {
        authBlock.style.display = 'none';
        userBlock.style.display = 'flex';
        document.getElementById('userNameDisplay').textContent = user.username;
        document.getElementById('userAvatar').textContent = user.username[0].toUpperCase();
        const badge = document.getElementById('userRoleBadge');
        badge.textContent = user.role === 'admin' ? 'Admin' : user.role === 'moderator' ? 'Moder' : '';
        badge.className = 'user-role-badge role-' + user.role;
    } else {
        authBlock.style.display = 'flex';
        userBlock.style.display = 'none';
    }
}

function switchAuthTab(tab) {
    document.getElementById('loginForm').style.display = tab === 'login' ? 'block' : 'none';
    document.getElementById('regForm').style.display   = tab === 'reg'   ? 'block' : 'none';
    document.getElementById('tabLogin').classList.toggle('active', tab === 'login');
    document.getElementById('tabReg').classList.toggle('active', tab === 'reg');
}
window.switchAuthTab = switchAuthTab;

async function doLogin() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errEl = document.getElementById('loginError');
    errEl.textContent = '';
    if (!username || !password) { errEl.textContent = 'Заполните все поля'; return; }

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) { errEl.textContent = data.error || 'Ошибка'; return; }
        setToken(data.token);
        currentUser = data.user;
        updateAuthUI(currentUser);
        document.getElementById('authModal').style.display = 'none';
        await loadFavouritesState();
        updateFavBadge();
        if (currentSection === '__favourites__') renderFavourites();
    } catch(e) { errEl.textContent = 'Ошибка подключения'; }
}

async function doRegister() {
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value;
    const errEl = document.getElementById('regError');
    errEl.textContent = '';
    if (!username || !password) { errEl.textContent = 'Заполните все поля'; return; }

    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) { errEl.textContent = data.error || 'Ошибка'; return; }
        setToken(data.token);
        currentUser = data.user;
        updateAuthUI(currentUser);
        document.getElementById('authModal').style.display = 'none';
        await loadFavouritesState();
        updateFavBadge();
    } catch(e) { errEl.textContent = 'Ошибка подключения'; }
}

function doLogout() {
    clearToken();
    currentUser = null;
    updateAuthUI(null);
    favouritesList = [];
    favouriteSet = new Set();
    updateFavBadge();
    if (currentSection === '__favourites__') renderFavourites();
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('authOpenBtn')?.addEventListener('click', () => {
        document.getElementById('authModal').style.display = 'flex';
        switchAuthTab('login');
    });
    document.getElementById('authModalClose')?.addEventListener('click', () => {
        document.getElementById('authModal').style.display = 'none';
    });
    document.getElementById('authModal')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('authModal'))
            document.getElementById('authModal').style.display = 'none';
    });
    document.getElementById('logoutBtn')?.addEventListener('click', doLogout);
    document.getElementById('loginSubmit')?.addEventListener('click', doLogin);
    document.getElementById('regSubmit')?.addEventListener('click', doRegister);
    document.getElementById('loginPassword')?.addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });
    document.getElementById('regPassword')?.addEventListener('keydown', e => { if(e.key==='Enter') doRegister(); });
    initAuth();
});
