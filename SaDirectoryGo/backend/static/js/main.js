
let currentSection = 'uk';
let currentFilter = 'all';
let searchQuery = '';
let searchDebounce = null;
let sectionsData = [];
let favouriteSet = new Set(); 
let favouritesList = [];      
const USER_ID = getUserId();

function showLoading(show) {
    document.getElementById('loadingSpinner').style.display = show ? 'block' : 'none';
}
function favKey(type, id) { return `${type}_${id}`; }

function toggleDetails(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const isOpen = el.style.display === 'block';
    el.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) el.classList.add('open'); else el.classList.remove('open');
}
window.toggleDetails = toggleDetails;

async function loadFavouritesState() {
    try {
        favouritesList = await Api.getFavourites(USER_ID) || [];
        favouriteSet = new Set(favouritesList.map(f => favKey(f.item_type, f.item_id)));
    } catch(e) { console.error(e); }
}

async function toggleFavourite(itemType, itemId, btn) {
    const key = favKey(itemType, itemId);
    if (favouriteSet.has(key)) {
        await Api.removeFavourite(USER_ID, itemType, itemId);
        favouriteSet.delete(key);
        favouritesList = favouritesList.filter(f => !(f.item_type === itemType && f.item_id === itemId));
        btn.classList.remove('fav-active');
        btn.title = 'Добавить в избранное';
    } else {
        await Api.addFavourite(USER_ID, itemType, itemId);
        favouriteSet.add(key);
        favouritesList = await Api.getFavourites(USER_ID) || [];
        btn.classList.add('fav-active');
        btn.title = 'Убрать из избранного';
    }
    updateFavBadge();
}
window.toggleFavourite = toggleFavourite;

function updateFavBadge() {
    const badge = document.getElementById('favBadge');
    if (badge) {
        badge.textContent = favouritesList.length;
        badge.style.display = favouritesList.length > 0 ? 'inline-flex' : 'none';
    }
}

function starBtn(itemType, itemId) {
    const active = favouriteSet.has(favKey(itemType, itemId));
    return `<button class="fav-btn${active ? ' fav-active' : ''}" 
        title="${active ? 'Убрать из избранного' : 'Добавить в избранное'}"
        onclick="event.stopPropagation(); toggleFavourite('${itemType}', ${itemId}, this)">
        ★
    </button>`;
}

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

    const typeMap = { uk: 'criminal', ak: 'admin', dk: 'traffic', weapon: 'info' };
    const sectionType = typeMap[item.section_id || currentSection] || 'info';

    return `
        <div class="article-card ${sectionType}">
            <div class="card-header" onclick="toggleDetails('${cardId}')">
                <div class="card-info">
                    <div class="card-code">${item.article || 'Информация'}</div>
                    <div class="card-title">${item.name || ''}</div>
                    <div class="card-desc">${item.description || ''}</div>
                    <div class="card-footer">${penalty}${fine}${conv}</div>
                </div>
                <div class="card-right">
                    ${stars}
                    ${starBtn('article', item.id)}
                </div>
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
    if (items.length > 0) detailsHtml += `<div class="detail-section"><div class="detail-label">📋 Содержание</div><div class="detail-content">${items.map(i => `<p>• ${i}</p>`).join('')}</div></div>`;
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
                <div class="card-right">
                    ${starBtn('info', item.id)}
                </div>
            </div>
            <div class="card-details" id="${cardId}" style="display:none;">
                ${detailsHtml}
            </div>
        </div>`;
}

function renderFavourites() {
    document.getElementById('globalSearchResults').style.display = 'none';
    document.getElementById('filtersBar').innerHTML = '';
    document.getElementById('sectionTitle').textContent = '⭐ Избранное';
    document.getElementById('stats').innerHTML = `<div class="stat-badge">⭐ ${favouritesList.length} статей</div>`;

    const container = document.getElementById('articlesList');
    if (favouritesList.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⭐</div>
                <div class="empty-title">Избранное пусто</div>
                <div style="color:var(--text-muted);font-size:13px;margin-top:8px">Нажмите ★ на любой статье чтобы добавить</div>
            </div>`;
        return;
    }

    const warning = !currentUser ? `<div class="fav-warning">⚠️ Если вы не зарегистрированы, ваше избранное может очиститься! <a onclick="document.getElementById('authOpenBtn').click()">Зарегистрируйтесь</a> чтобы сохранить навсегда.</div>` : '';
    container.innerHTML = warning + `<div id="favList" class="fav-list">${favouritesList.map(renderFavCard).join('')}</div>`;
    initDragDrop();
}

function renderFavCard(item) {
    const cardId = `fav_${item.fav_id}`;
    const typeLabel = { uk:'УК', ak:'АК', dk:'ДК', weapon:'Оружие', 'uk-general':'УК Общая',
        pk:'ПК', 'gov-rules':'Гос.структуры', frb:'ФРБ', 'frb-charter':'Устав ФРБ',
        ord:'ОРД', 'closed-areas':'Закрытые', theory:'Терминология',
        rules:'Правила', robbery:'Ограбления', events:'Мероприятия' };
    const sectionBadge = `<span class="badge badge-section">📂 ${typeLabel[item.section_id] || item.section_id}</span>`;
    const penalty = item.punishment ? `<span class="badge badge-penalty">⏱ ${item.punishment}</span>` : '';
    const fine = item.fine ? `<span class="badge badge-fine">💰 ${item.fine}</span>` : '';

    let detailsHtml = '';
    if (item.description) detailsHtml += `<div class="detail-section"><div class="detail-label">📖 Описание</div><div class="detail-content">${item.description}</div></div>`;
    if (item.important) detailsHtml += `<div class="detail-section"><div class="detail-label">⚠️ Важно</div><div class="detail-content">${item.important}</div></div>`;
    if (item.items && item.items !== '[]') {
        try {
            const arr = JSON.parse(item.items);
            if (arr.length > 0) detailsHtml += `<div class="detail-section"><div class="detail-label">📋 Содержание</div><div class="detail-content">${arr.map(i=>`<p>• ${i}</p>`).join('')}</div></div>`;
        } catch(e){}
    }
    if (!detailsHtml) detailsHtml = `<div class="detail-section"><div class="detail-content">Нет дополнительной информации</div></div>`;

    return `
        <div class="article-card fav-card" draggable="true" data-fav-id="${item.fav_id}" data-item-type="${item.item_type}" data-item-id="${item.item_id}">
            <div class="fav-drag-handle" title="Перетащить">⠿</div>
            <div class="card-header" onclick="toggleDetails('${cardId}')">
                <div class="card-info">
                    <div class="card-code">${item.article || item.name}</div>
                    <div class="card-title">${item.article ? item.name : ''}</div>
                    <div class="card-desc">${(item.description||'').substring(0,120)}</div>
                    <div class="card-footer">${sectionBadge}${penalty}${fine}</div>
                </div>
                <div class="card-right">
                    <button class="fav-btn fav-active" title="Убрать из избранного"
                        onclick="event.stopPropagation(); removeFavAndRefresh('${item.item_type}', ${item.item_id})">★</button>
                </div>
            </div>
            <div class="card-details" id="${cardId}" style="display:none;">
                ${detailsHtml}
            </div>
        </div>`;
}

window.removeFavAndRefresh = async function(itemType, itemId) {
    await Api.removeFavourite(USER_ID, itemType, itemId);
    favouriteSet.delete(favKey(itemType, itemId));
    favouritesList = favouritesList.filter(f => !(f.item_type === itemType && f.item_id === itemId));
    updateFavBadge();
    renderFavourites();
};

function initDragDrop() {
    const list = document.getElementById('favList');
    if (!list) return;
    let dragEl = null;

    list.addEventListener('dragstart', e => {
        dragEl = e.target.closest('.fav-card');
        if (dragEl) { setTimeout(() => dragEl.classList.add('dragging'), 0); }
    });
    list.addEventListener('dragend', e => {
        if (dragEl) dragEl.classList.remove('dragging');
        dragEl = null;
        saveFavOrder();
    });
    list.addEventListener('dragover', e => {
        e.preventDefault();
        const target = e.target.closest('.fav-card');
        if (!target || target === dragEl) return;
        const rect = target.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        if (e.clientY < mid) list.insertBefore(dragEl, target);
        else list.insertBefore(dragEl, target.nextSibling);
    });
}

async function saveFavOrder() {
    const cards = document.querySelectorAll('#favList .fav-card');
    const order = Array.from(cards).map((c, i) => ({
        fav_id: parseInt(c.dataset.favId),
        sort_order: i
    }));
    await Api.reorderFavourites(order);
    const map = {};
    favouritesList.forEach(f => map[f.fav_id] = f);
    favouritesList = order.map(o => map[o.fav_id]).filter(Boolean);
}

function renderPamyatkaFA() {
    document.getElementById('globalSearchResults').style.display = 'none';
    document.getElementById('filtersBar').innerHTML = '';
    document.getElementById('sectionTitle').textContent = '🕵️ Памятка Free Agent';
    document.getElementById('stats').innerHTML = `<div class="stat-badge">📋 FIB FA</div>`;
    document.getElementById('articlesList').innerHTML = `
<div class="fa-pamyatka">

  <div class="fa-hero">
    <div class="fa-hero-badge">FIB · FREE AGENT</div>
    <h2 class="fa-hero-title">Памятка отдела Free Agent</h2>
    <p class="fa-hero-sub">Free Agent (FA) — специальные агенты Федерального Бюро Расследований, которые организовывают и координируют рабочие процессы, чётко понимают цели и задачи текущих операций, готовятся к переговорам и поддерживают конструктивный тон дискуссии.</p>
  </div>

  <div class="fa-section">
    <div class="fa-section-title">🎯 Основные задачи Free Agent</div>
    <div class="fa-tasks">
      <div class="fa-task"><span class="fa-task-icon">🤝</span><span>Осуществлять поддержку в работе других отделов</span></div>
      <div class="fa-task"><span class="fa-task-icon">🎙️</span><span>Руководить операциями, выступать в качестве переговорщика</span></div>
      <div class="fa-task"><span class="fa-task-icon">📋</span><span>Выполнять поручения директора Бюро, его заместителей и прямого начальства (Curator FA, Head FA, Dep.Head FA)</span></div>
      <div class="fa-task"><span class="fa-task-icon">🔒</span><span>Соблюдать конфиденциальность и корпоративную этику</span></div>
      <div class="fa-task"><span class="fa-task-icon">🏆</span><span>Ориентироваться на результат, не забывая о качестве</span></div>
    </div>
  </div>

  <div class="fa-grid">
    <div class="fa-block fa-block-red">
      <div class="fa-block-header">🚨 Как отрабатывать похищения</div>
      <div class="fa-steps">
        <div class="fa-step"><span class="fa-step-num">1</span><span>Оповещаем в рацию на волне <strong>300.300</strong>: «Начинаю отрабатывать»</span></div>
        <div class="fa-step"><span class="fa-step-num">2</span><span>Отписываем в рацию департамента:<br><code>/dep to All: Агент FIB работает по похищению.</code></span></div>
        <div class="fa-step"><span class="fa-step-num">3</span><span>Поднимаем руки и подходим к крайм переговорщику</span></div>
        <div class="fa-step"><span class="fa-step-num">4</span><span>Предоставляем своё удостоверение</span></div>
        <div class="fa-step"><span class="fa-step-num">5</span><span>Подходим к заложникам: <em>«Как дела? Жалобы есть?»</em></span></div>
        <div class="fa-step"><span class="fa-step-num">6</span><span>Отходим и слушаем требования</span></div>
      </div>
    </div>

    <div class="fa-block fa-block-yellow">
      <div class="fa-block-header">🏦 Как отрабатывать банки/бизнесы</div>
      <div class="fa-steps">
        <div class="fa-step"><span class="fa-step-num">1</span><span>Отписываем в рацию департамента:<br><code>/dep to All: Агент FIB работает по банку/бизнесу.</code></span></div>
        <div class="fa-step"><span class="fa-step-num">2</span><span>Поднимаем руки и подходим к крайм переговорщику</span></div>
        <div class="fa-step"><span class="fa-step-num">3</span><span>Предоставляем своё удостоверение</span></div>
        <div class="fa-step"><span class="fa-step-num">4</span><span>Убеждаемся что заложник в порядке: <em>«Как дела? Жалобы есть?»</em></span></div>
        <div class="fa-step"><span class="fa-step-num">5</span><span>Отходим и слушаем требования</span></div>
      </div>
    </div>
  </div>

  <div class="fa-section">
    <div class="fa-section-title">💬 Требования — Адекватные</div>
    <div class="fa-grid">
      <div class="fa-sub-block">
        <div class="fa-sub-title">🚗 Похищение</div>
        <div class="fa-steps">
          <div class="fa-step"><span class="fa-step-num">1</span><span>Сообщаем:<br><code>/dep to All: Похитители на [цвет] машинах запросили [сумма]$ за [кол-во] заложников и [зк] зеленого коридора.</code></span></div>
          <div class="fa-step"><span class="fa-step-num">2</span><span>Снимаем деньги с фракции с причиной: <strong>Похищение</strong></span></div>
          <div class="fa-step"><span class="fa-step-num">3</span><span>Возвращаемся и передаём сумку с деньгами</span></div>
          <div class="fa-step"><span class="fa-step-num">4</span><span>Подходим к заложникам, снимаем стяжки и мешок с головы</span></div>
          <div class="fa-step"><span class="fa-step-num">5</span><span><code>/dep to All: Заложники спасены, похитители уехали на [цвет] машинах, у них есть [зк] зеленого коридора.</code></span></div>
          <div class="fa-step"><span class="fa-step-num">6</span><span>Отписываем в 🔫┃похищения</span></div>
        </div>
      </div>
      <div class="fa-sub-block">
        <div class="fa-sub-title">🏦 Банк</div>
        <div class="fa-steps">
          <div class="fa-step"><span class="fa-step-num">1</span><span><code>/dep to All: Похитители на [цвет] машинах запросили [зк] зеленого коридора.</code></span></div>
          <div class="fa-step"><span class="fa-step-num">2</span><span>Подходим к заложникам, снимаем стяжки и мешок с головы</span></div>
          <div class="fa-step"><span class="fa-step-num">3</span><span><code>/dep to All: Заложник спасен, похитители уехали на [цвет] машинах, у них есть [зк] зеленого коридора.</code></span></div>
        </div>
      </div>
    </div>
  </div>

  <div class="fa-section">
    <div class="fa-section-title">⚠️ Требования — Неадекватные</div>
    <div class="fa-grid">
      <div class="fa-sub-block fa-sub-danger">
        <div class="fa-sub-title">🚗 Похищение — Пуш</div>
        <div class="fa-steps">
          <div class="fa-step"><span class="fa-step-num">1</span><span><code>/dep to All: Похитители выдвинули неадекватные требования, требуется поддержка всех силовых структур.</code></span></div>
          <div class="fa-step"><span class="fa-step-num">2</span><span>Откидываем марк: <code>/mark2 10-20 Пуш похитка.</code></span></div>
          <div class="fa-step"><span class="fa-step-num">3</span><span>Ждём силовую структуру и начинаем пуш</span></div>
          <div class="fa-step"><span class="fa-step-num">4</span><span>Отписываем в 🔫┃пуш-похищения</span></div>
        </div>
      </div>
      <div class="fa-sub-block fa-sub-danger">
        <div class="fa-sub-title">🏦 Банк — Пуш</div>
        <div class="fa-steps">
          <div class="fa-step"><span class="fa-step-num">1</span><span><code>/dep to All: Похитители выдвинули неадекватные требования, требуется поддержка всех силовых структур.</code></span></div>
          <div class="fa-step"><span class="fa-step-num">2</span><span>Откидываем марк: <code>/mark2 10-20 Пуш банк.</code></span></div>
          <div class="fa-step"><span class="fa-step-num">3</span><span>Ждём силовую структуру и начинаем пуш</span></div>
        </div>
      </div>
    </div>
  </div>

  <div class="fa-section">
    <div class="fa-section-title">👑 Выкуп за Лидеров / Заместителей</div>
    <div class="fa-ransom-grid">
      <div class="fa-ransom-item"><span class="fa-ransom-org">LSPD / LSCSD</span><span class="fa-ransom-val">3 MarksmanRifle Mk2 или 75/50 тяж. бронежилетов</span></div>
      <div class="fa-ransom-item"><span class="fa-ransom-org">SANG</span><span class="fa-ransom-val">5 CombatMG Mk2 / 3 CombatMG Mk2 или 8000/4000 материалов</span></div>
      <div class="fa-ransom-item"><span class="fa-ransom-org">City Hall</span><span class="fa-ransom-val">1 000 000$ / 500 000$ / 250 000$ или 50/30/20 тяж. бронежилетов</span></div>
      <div class="fa-ransom-item"><span class="fa-ransom-org">FIB</span><span class="fa-ransom-val">1 HeavySniper Mk2 / 2 HeavySniper или 75/45 тяж. бронежилетов</span></div>
      <div class="fa-ransom-item"><span class="fa-ransom-org">EMS</span><span class="fa-ransom-val">350/250 эпинефрина или 8/6 дефибриллятора</span></div>
      <div class="fa-ransom-item"><span class="fa-ransom-org">Weazel News</span><span class="fa-ransom-val">Новостная волна/SMS + тех. материалы 7500/4000</span></div>
    </div>
    <div class="fa-note">💰 Максимальный выкуп за лидера/заместителя — <strong>150 000$</strong></div>
  </div>

  <div class="fa-section">
    <div class="fa-section-title">📝 Важные примечания</div>
    <div class="fa-notes-grid">
      <div class="fa-note-card">📹 Обязательно откатываем всю работу по похитке или банку. Откаты храним <strong>72 часа</strong> в качестве <strong>720p</strong>.</div>
      <div class="fa-note-card">🤝 Ведём адекватное общение на переговорах, без оскорблений и провокаций.</div>
      <div class="fa-note-card">💸 Снимая с фракции деньги — отписываем и указываем причину: <strong>Похищение</strong>.</div>
      <div class="fa-note-card">📊 Все работы похитки и банка откидывает в таски начальство.</div>
      <div class="fa-note-card">📅 Не забываем про недельные отчёты в 💸┃отчет-на-премию.</div>
      <div class="fa-note-card">❓ Вопросы — по иерархии: <strong>Dep.Head FA → Head FA → Cur FA</strong>.</div>
    </div>
  </div>

</div>`;
}

async function render() {
    if (currentSection === '__favourites__') { renderFavourites(); return; }
    if (currentSection === '__chat__') { if (typeof renderChatSection === 'function') renderChatSection(); return; }
    if (currentSection === '__fa_pamyatka__') { renderPamyatkaFA(); return; }

    showLoading(true);
    document.getElementById('globalSearchResults').style.display = 'none';
    document.getElementById('articlesList').style.display = 'block';
    const container = document.getElementById('articlesList');
    container.innerHTML = '';

    try {
        let items = [];
        const section = sectionsData.find(s => s.id === currentSection);

        if (Api.isArticleSection(currentSection)) {
            items = await Api.getArticles({ section: currentSection, filter: currentFilter });
            if (items && items.length > 0) {
                const parseArt = str => {
                    const s = String(str||'').replace(/ст\./i,'').trim();
                    const m = s.match(/^(\d+)\.?(\d*)(?:\s*ч\.(\d+))?/);
                    return m ? [+m[1]||0, +m[2]||0, +m[3]||0] : [9999,0,0];
                };
                items.sort((a, b) => {
                    const [a1,a2,a3] = parseArt(a.article);
                    const [b1,b2,b3] = parseArt(b.article);
                    return a1-b1 || a2-b2 || a3-b3;
                });
            }
            container.innerHTML = (items || []).map((item, i) => renderArticleCard(item, i)).join('');
        } else {
            items = await Api.getInfoItems({ section: currentSection });
            container.innerHTML = (items || []).map((item, i) => renderInfoCard(item, i)).join('');
        }

        const statsEl = document.getElementById('stats');
        if (statsEl && section) {
            let html = `<div class="stat-badge">📄 ${(items || []).length} записей</div>`;
            if (section.has_filters && items) {
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
    if (!section || !section.has_filters) { container.innerHTML = ''; return; }
    container.innerHTML = `
        <button class="filter-btn ${currentFilter==='all'?'active':''}" onclick="setFilter('all')">📌 Все</button>
        <button class="filter-btn ${currentFilter==='sud'?'active':''}" onclick="setFilter('sud')">⚠️ Влечёт судимость</button>
        <button class="filter-btn ${currentFilter==='sh'?'active':''}" onclick="setFilter('sh')">💰 Со штрафом</button>
        <button class="filter-btn ${currentFilter==='5star'?'active':''}" onclick="setFilter('5star')">⭐ 5 звёзд</button>`;
}

window.setFilter = function(filter) {
    currentFilter = filter;
    renderFilters(sectionsData.find(s => s.id === currentSection));
    render();
};

window.changeSection = function(sectionId) {
    currentSection = sectionId;
    currentFilter = 'all';
    const searchInput = document.getElementById('globalSearch');
    if (searchInput) searchInput.value = '';
    document.getElementById('globalSearchResults').style.display = 'none';
    document.getElementById('articlesList').style.display = 'block';

    if (sectionId === '__favourites__') {
        document.getElementById('sectionTitle').textContent = '⭐ Избранное';
        document.getElementById('filtersBar').innerHTML = '';
    } else if (sectionId === '__chat__') {
        document.getElementById('sectionTitle').textContent = '💬 Чат предложений';
        document.getElementById('filtersBar').innerHTML = '';
        render();
        return;
    } else if (sectionId === '__fa_pamyatka__') {
        document.getElementById('sectionTitle').textContent = '🕵️ Памятка FA';
        document.getElementById('filtersBar').innerHTML = '';
    } else {
        const section = sectionsData.find(s => s.id === sectionId);
        if (section) {
            document.getElementById('sectionTitle').textContent = `${section.icon} ${section.title}`;
            renderFilters(section);
        }
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
        const resArr = Array.isArray(results) ? results : [];
        document.getElementById('stats').innerHTML = `<div class="stat-badge">🎯 Найдено: ${resArr.length}</div>`;
        document.getElementById('globalSearchList').innerHTML = resArr.length > 0
            ? resArr.map((item, i) => {
                const sectionBadge = `<span class="badge badge-section">📂 ${item.section_title}</span>`;
                const penalty = item.punishment ? `<span class="badge badge-penalty">⏱ ${item.punishment}</span>` : '';
                const fine = item.fine ? `<span class="badge badge-fine">💰 ${item.fine}</span>` : '';
                const cardId = `sr_${item.id}_${i}`;
                const favType = item.item_type || 'article';
                return `<div class="article-card info">
                    <div class="card-header" onclick="toggleDetails('${cardId}')">
                        <div class="card-info">
                            <div class="card-code">${item.code||''}</div>
                            <div class="card-title">${item.title||''}</div>
                            <div class="card-desc">${(item.description||'').substring(0,120)}</div>
                            <div class="card-footer">${sectionBadge}${penalty}${fine}</div>
                        </div>
                        <div class="card-right">${starBtn(favType, item.id)}</div>
                    </div>
                    <div class="card-details" id="${cardId}" style="display:none;">
                        <div class="detail-section"><div class="detail-content">${item.description||''}</div></div>
                    </div>
                </div>`;
            }).join('')
            : '<div style="padding:20px;color:var(--text-muted)">Ничего не найдено</div>';
    } catch(e) { console.error(e); }
    showLoading(false);
}

function clearGlobalSearch() {
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

    let html = `
        <div class="nav-group">
            <div class="nav-group-title">🕵️ ФБР — FIB</div>
            <button class="nav-item" data-section="__fa_pamyatka__">
                <span class="nav-icon">📋</span><span>Порядок действий FA</span>
            </button>
        </div>`;

    for (const [groupName, items] of Object.entries(groups)) {
        html += `<div class="nav-group"><div class="nav-group-title">${groupName}</div>`;
        for (const item of items) {
            html += `<button class="nav-item" data-section="${item.id}"><span class="nav-icon">${item.icon}</span><span>${item.title}</span></button>`;
        }
        html += `</div>`;
    }

    html += `
        <div class="nav-group">
            <div class="nav-group-title">💬 Общение</div>
            <button class="nav-item" data-section="__chat__">
                <span class="nav-icon">💬</span><span>Чат предложений</span>
            </button>
        </div>`;

    ['desktopSidebarNav','mobileSidebarNav'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = html;
    });

    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => { changeSection(btn.dataset.section); closeMobileMenu(); });
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
    } catch(e) { console.error('Failed to load sections:', e); }

    await loadFavouritesState();
    updateFavBadge();

    document.getElementById('menuToggleBtn')?.addEventListener('click', openMobileMenu);
    document.getElementById('closeSidebarBtn')?.addEventListener('click', closeMobileMenu);
    document.getElementById('mobileMenuOverlay')?.addEventListener('click', closeMobileMenu);
    document.getElementById('clearSearchBtn')?.addEventListener('click', clearGlobalSearch);

    document.getElementById('favTabBtn')?.addEventListener('click', () => changeSection('__favourites__'));

    const searchInput = document.getElementById('globalSearch');
    if (searchInput) {
        searchInput.addEventListener('input', e => {
            clearTimeout(searchDebounce);
            searchQuery = e.target.value;
            searchDebounce = setTimeout(() => performGlobalSearch(searchQuery), 300);
        });
    }

    document.querySelector(`.nav-item[data-section="${currentSection}"]`)?.classList.add('active');
    renderFilters(sectionsData.find(s => s.id === currentSection));
    render();
});
