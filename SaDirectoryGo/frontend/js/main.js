let currentSection = 'uk';
let currentFilter = 'all';
let searchQuery = '';
let isGlobalSearch = false;
let searchDebounce = null;
let sectionsData = [];

function showLoading(show) {
    document.getElementById('loadingSpinner').style.display = show ? 'block' : 'none';
}

function toggleDetails(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = el.style.display === 'block' ? 'none' : 'block';
}
window.toggleDetails = toggleDetails;

function renderArticleCard(item, idx) {
    const cardId = `card_${item.id || idx}`;
    const stars = item.stars ? `<div class="card-stars">${item.stars}</div>` : '';
    const penalty = item.punishment ? `<span class="badge badge-penalty">⏱ ${item.punishment}</span>` : '';
    const fine = item.fine ? `<span class="badge badge-fine">💰 ${item.fine}</span>` : '';
    const conv = item.has_conviction ? `<span class="badge badge-conv">⚠️ Судимость</span>` : '';

    let detailsHtml = '';
    if (item.full_desc) detailsHtml += `<div class="detail-section"><div class="detail-label">📖 Полное описание</div><div class="detail-content">${item.full_desc}</div></div>`;
    if (item.important) detailsHtml += `<div class="detail-section"><div class="detail-label">⚠️ Важно</div><div class="detail-content">${item.important}</div></div>`;
    if (!detailsHtml && item.description) detailsHtml = `<div class="detail-section"><div class="detail-label">📖 Описание</div><div class="detail-content">${item.description}</div></div>`;
    if (!detailsHtml) detailsHtml = `<div class="detail-section"><div class="detail-content">Нет дополнительной информации</div></div>`;

    const sectionType = currentSection === 'uk' ? 'criminal' : currentSection === 'ak' ? 'admin' : currentSection === 'dk' ? 'traffic' : 'info';

    return `
        <div class="article-card ${sectionType}">
            <div class="card-header" onclick="toggleDetails('${cardId}')">
                <div class="card-info">
                    <div class="card-code">${item.article || 'Информация'}</div>
                    <div class="card-title">${item.name || ''}</div>
                    <div class="card-desc">${item.description || ''}</div>
                    <div class="card-footer">${penalty}${fine}${conv}</div>
                </div>
                ${stars}
            </div>
            <div class="card-details" id="${cardId}" style="display:none;">
                ${detailsHtml}
            </div>
        </div>`;
}

function renderInfoCard(item, idx) {
    const cardId = `info_${item.id || idx}`;
    const items = Array.isArray(item.items) ? item.items : (item.items ? JSON.parse(item.items) : []);
    let detailsHtml = '';
    if (items.length > 0) {
        detailsHtml += `<div class="detail-section"><div class="detail-label">📋 Содержание</div><div class="detail-content">${items.map(i => `<p>• ${i}</p>`).join('')}</div></div>`;
    }
    if (item.description) detailsHtml += `<div class="detail-section"><div class="detail-label">📖 Описание</div><div class="detail-content">${item.description}</div></div>`;
    if (item.who_applies) detailsHtml += `<div class="detail-section"><div class="detail-label">👮 Кто применяет</div><div class="detail-content">${item.who_applies}</div></div>`;
    if (!detailsHtml) detailsHtml = `<div class="detail-section"><div class="detail-content">Нет дополнительной информации</div></div>`;

    const firstItem = items.length > 0 ? items[0].substring(0, 100) + (items[0].length > 100 ? '...' : '') : '';

    return `
        <div class="article-card info">
            <div class="card-header" onclick="toggleDetails('${cardId}')">
                <div class="card-info">
                    <div class="card-code">${item.number || 'Раздел'}</div>
                    <div class="card-title">${item.title || ''}</div>
                    <div class="card-desc">${firstItem}</div>
                </div>
            </div>
            <div class="card-details" id="${cardId}" style="display:none;">
                ${detailsHtml}
            </div>
        </div>`;
}

function renderSearchResult(item, idx) {
    const cardId = `sr_${item.id}_${idx}`;
    const sectionBadge = `<span class="badge badge-section">📂 ${item.section_title}</span>`;
    const penalty = item.punishment ? `<span class="badge badge-penalty">⏱ ${item.punishment}</span>` : '';
    const fine = item.fine ? `<span class="badge badge-fine">💰 ${item.fine}</span>` : '';

    let detailsHtml = `<div class="detail-section"><div class="detail-content">${item.description || 'Нет описания'}</div></div>`;
    if (item.items) {
        const arr = typeof item.items === 'string' ? JSON.parse(item.items) : item.items;
        if (arr && arr.length > 0) {
            detailsHtml += `<div class="detail-section"><div class="detail-label">📋 Содержание</div><div class="detail-content">${arr.map(i => `<p>• ${i}</p>`).join('')}</div></div>`;
        }
    }

    return `
        <div class="article-card info">
            <div class="card-header" onclick="toggleDetails('${cardId}')">
                <div class="card-info">
                    <div class="card-code">${item.code || ''}</div>
                    <div class="card-title">${item.title || ''}</div>
                    <div class="card-desc">${item.description ? item.description.substring(0, 120) : ''}</div>
                    <div class="card-footer">${sectionBadge}${penalty}${fine}</div>
                </div>
            </div>
            <div class="card-details" id="${cardId}" style="display:none;">
                ${detailsHtml}
            </div>
        </div>`;
}

async function render() {
    showLoading(true);
    const container = document.getElementById('articlesList');
    container.innerHTML = '';

    try {
        let items = [];
        const section = sectionsData.find(s => s.id === currentSection);

        if (Api.isArticleSection(currentSection)) {
            items = await Api.getArticles({ section: currentSection, filter: currentFilter });
            container.innerHTML = (items || []).map((item, i) => renderArticleCard(item, i)).join('');
        } else {
            items = await Api.getInfoItems({ section: currentSection });
            container.innerHTML = (items || []).map((item, i) => renderInfoCard(item, i)).join('');
        }

        const statsEl = document.getElementById('stats');
        if (statsEl) {
            let html = `<div class="stat-badge">📄 ${(items || []).length} записей</div>`;
            if (section && section.has_filters && items) {
                const sudCount = items.filter(i => i.has_conviction).length;
                const fineCount = items.filter(i => i.fine).length;
                if (sudCount > 0) html += `<div class="stat-badge">⚠️ ${sudCount}</div>`;
                if (fineCount > 0) html += `<div class="stat-badge">💰 ${fineCount}</div>`;
            }
            statsEl.innerHTML = html;
        }
    } catch (e) {
        container.innerHTML = `<div style="padding:20px;color:#f44">Ошибка загрузки: ${e.message}</div>`;
    }

    showLoading(false);
}

function renderFilters(section) {
    const container = document.getElementById('filtersBar');
    if (!section || !section.has_filters) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = `
        <button class="filter-btn ${currentFilter === 'all' ? 'active' : ''}" onclick="setFilter('all')">📌 Все</button>
        <button class="filter-btn ${currentFilter === 'sud' ? 'active' : ''}" onclick="setFilter('sud')">⚠️ Влечёт судимость</button>
        <button class="filter-btn ${currentFilter === 'sh' ? 'active' : ''}" onclick="setFilter('sh')">💰 Со штрафом</button>
        <button class="filter-btn ${currentFilter === '5star' ? 'active' : ''}" onclick="setFilter('5star')">⭐ 5 звёзд</button>
    `;
}

window.setFilter = function(filter) {
    currentFilter = filter;
    const section = sectionsData.find(s => s.id === currentSection);
    renderFilters(section);
    render();
};

window.changeSection = function(sectionId) {
    currentSection = sectionId;
    currentFilter = 'all';
    isGlobalSearch = false;
    searchQuery = '';
    const searchInput = document.getElementById('globalSearch');
    if (searchInput) searchInput.value = '';

    document.getElementById('globalSearchResults').style.display = 'none';
    document.getElementById('articlesList').style.display = 'block';
    document.getElementById('filtersBar').style.display = 'flex';

    const section = sectionsData.find(s => s.id === sectionId);
    if (section) {
        document.getElementById('sectionTitle').textContent = `${section.icon} ${section.title}`;
        renderFilters(section);
    }

    render();

    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.section === sectionId);
    });
};

async function performGlobalSearch(q) {
    if (!q.trim()) { clearGlobalSearch(); return; }
    showLoading(true);
    try {
        const results = await Api.globalSearch(q);
        document.getElementById('globalSearchResults').style.display = 'block';
        document.getElementById('articlesList').style.display = 'none';
        document.getElementById('filtersBar').style.display = 'none';
        document.getElementById('sectionTitle').textContent = '🔍 Результаты поиска';
        document.getElementById('stats').innerHTML = `<div class="stat-badge">🎯 Найдено: ${(results || []).length}</div>`;
        document.getElementById('globalSearchList').innerHTML = (results || []).length > 0
            ? results.map((item, i) => renderSearchResult(item, i)).join('')
            : '<div style="padding:20px;color:#888">Ничего не найдено</div>';
    } catch (e) {
        console.error(e);
    }
    showLoading(false);
}

function clearGlobalSearch() {
    isGlobalSearch = false;
    document.getElementById('globalSearchResults').style.display = 'none';
    document.getElementById('articlesList').style.display = 'block';
    document.getElementById('filtersBar').style.display = 'flex';
    const section = sectionsData.find(s => s.id === currentSection);
    if (section) document.getElementById('sectionTitle').textContent = `${section.icon} ${section.title}`;
    render();
}
window.clearGlobalSearch = clearGlobalSearch;

function buildSidebars(sections) {
    const groups = {};
    for (const s of sections) {
        if (!groups[s.group_name]) groups[s.group_name] = [];
        groups[s.group_name].push(s);
    }

    let html = '';
    for (const [groupName, items] of Object.entries(groups)) {
        html += `<div class="nav-group"><div class="nav-group-title">${groupName}</div>`;
        for (const item of items) {
            html += `<button class="nav-item" data-section="${item.id}"><span class="nav-icon">${item.icon}</span><span>${item.title}</span></button>`;
        }
        html += `</div>`;
    }

    const desktopNav = document.getElementById('desktopSidebarNav');
    const mobileNav = document.getElementById('mobileSidebarNav');
    if (desktopNav) desktopNav.innerHTML = html;
    if (mobileNav) mobileNav.innerHTML = html;

    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            changeSection(btn.dataset.section);
            closeMobileMenu();
        });
    });
}

function openMobileMenu() {
    document.getElementById('mobileSidebar').classList.add('open');
    document.getElementById('mobileMenuOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
}
function closeMobileMenu() {
    document.getElementById('mobileSidebar').classList.remove('open');
    document.getElementById('mobileMenuOverlay').classList.remove('open');
    document.body.style.overflow = '';
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        sectionsData = await Api.getSections();
        buildSidebars(sectionsData);
    } catch (e) {
        console.error('Failed to load sections:', e);
    }

    document.getElementById('menuToggleBtn')?.addEventListener('click', openMobileMenu);
    document.getElementById('closeSidebarBtn')?.addEventListener('click', closeMobileMenu);
    document.getElementById('mobileMenuOverlay')?.addEventListener('click', closeMobileMenu);
    document.getElementById('clearSearchBtn')?.addEventListener('click', clearGlobalSearch);

    const searchInput = document.getElementById('globalSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchDebounce);
            searchQuery = e.target.value;
            searchDebounce = setTimeout(() => performGlobalSearch(searchQuery), 300);
        });
    }

    document.querySelector(`.nav-item[data-section="${currentSection}"]`)?.classList.add('active');
    const firstSection = sectionsData.find(s => s.id === currentSection);
    if (firstSection) renderFilters(firstSection);
    render();
});
