// ===== API CLIENT =====
const API_BASE = '/api';

const Api = {
    async getSections() { return (await fetch(`${API_BASE}/sections`)).json(); },
    async getArticles({ section, filter, q } = {}) {
        const p = new URLSearchParams();
        if (section) p.set('section', section);
        if (filter && filter !== 'all') p.set('filter', filter);
        if (q) p.set('q', q);
        return (await fetch(`${API_BASE}/articles?${p}`)).json();
    },
    async getInfoItems({ section, q } = {}) {
        const p = new URLSearchParams();
        if (section) p.set('section', section);
        if (q) p.set('q', q);
        return (await fetch(`${API_BASE}/info?${p}`)).json();
    },
    async globalSearch(q) {
        if (!q) return [];
        return (await fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}`)).json();
    },
    async getFavourites(userId) {
        return (await fetch(`${API_BASE}/favourites?user_id=${userId}`)).json();
    },
    async addFavourite(userId, itemType, itemId) {
        return (await fetch(`${API_BASE}/favourites`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ user_id: userId, item_type: itemType, item_id: itemId })
        })).json();
    },
    async removeFavourite(userId, itemType, itemId) {
        const p = new URLSearchParams({ user_id: userId, item_type: itemType, item_id: itemId });
        return (await fetch(`${API_BASE}/favourites?${p}`, { method: 'DELETE' })).json();
    },
    async reorderFavourites(items) {
        return (await fetch(`${API_BASE}/favourites/reorder`, {
            method: 'PUT', headers: {'Content-Type':'application/json'},
            body: JSON.stringify(items)
        })).json();
    },
    isArticleSection(s) { return ['uk','ak','dk','weapon'].includes(s); }
};

// ===== USER ID =====
function getUserId() {
    // If logged in, use account ID; else localStorage
    if (typeof currentUser !== 'undefined' && currentUser) {
        return 'account_' + currentUser.id;
    }
    let id = localStorage.getItem('sa_user_id');
    if (!id) {
        id = 'u_' + Math.random().toString(36).substr(2,9) + Date.now().toString(36);
        localStorage.setItem('sa_user_id', id);
    }
    return id;
}
