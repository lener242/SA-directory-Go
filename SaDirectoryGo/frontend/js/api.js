const API_BASE = '/api';

const Api = {
    async getSections() {
        const res = await fetch(`${API_BASE}/sections`);
        return res.json();
    },

    async getArticles({ section, filter, q } = {}) {
        const params = new URLSearchParams();
        if (section) params.set('section', section);
        if (filter && filter !== 'all') params.set('filter', filter);
        if (q) params.set('q', q);
        const res = await fetch(`${API_BASE}/articles?${params}`);
        return res.json();
    },

    async getInfoItems({ section, q } = {}) {
        const params = new URLSearchParams();
        if (section) params.set('section', section);
        if (q) params.set('q', q);
        const res = await fetch(`${API_BASE}/info?${params}`);
        return res.json();
    },

    async globalSearch(q) {
        if (!q) return [];
        const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}`);
        return res.json();
    },

    // Sections that use articles table (have structured fields like article, punishment)
    isArticleSection(sectionId) {
        return ['uk', 'ak', 'dk', 'weapon'].includes(sectionId);
    }
};
