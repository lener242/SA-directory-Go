let secretClickCount = 0;
let secretClickTimer = null;
const _AP = 'FA100';

document.addEventListener('DOMContentLoaded', () => {
    const trigger = document.getElementById('secretTrigger');
    if (trigger) {
        trigger.addEventListener('click', () => {
            secretClickCount++;
            clearTimeout(secretClickTimer);
            secretClickTimer = setTimeout(() => { secretClickCount = 0; }, 3000);
            if (secretClickCount >= 5) {
                secretClickCount = 0;
                openAdminPasswordModal();
            }
        });
    }
    document.getElementById('adminPwSubmit')?.addEventListener('click', checkAdminPw);
    document.getElementById('adminPwInput')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') checkAdminPw();
    });
});

function openAdminPasswordModal() {
    const m = document.getElementById('adminPwModal');
    m.style.display = 'flex';
    document.getElementById('adminPwInput').value = '';
    document.getElementById('adminPwError').textContent = '';
    setTimeout(() => document.getElementById('adminPwInput')?.focus(), 100);
}

function checkAdminPw() {
    const val = document.getElementById('adminPwInput').value;
    if (val === _AP) {
        document.getElementById('adminPwModal').style.display = 'none';
        openAdminPanel();
    } else {
        document.getElementById('adminPwError').textContent = 'Неверный пароль';
        document.getElementById('adminPwInput').value = '';
    }
}

function openAdminPanel() {
    document.getElementById('adminPanel').style.display = 'flex';
    showAdminTab('content');
}
window.closeAdmin = function() {
    document.getElementById('adminPanel').style.display = 'none';
};

window.showAdminTab = function(tab) {
    ['content','users','log'].forEach(t => {
        const el = document.getElementById('adminTab' + t.charAt(0).toUpperCase() + t.slice(1));
        if (el) el.style.display = t === tab ? 'block' : 'none';
    });
    document.querySelectorAll('.admin-tab').forEach((btn, i) => {
        btn.classList.toggle('active', ['content','users','log'][i] === tab);
    });
    if (tab === 'users') renderUsersSearch();
    if (tab === 'log')   loadAdminLog();
};


function adminHeaders() {
    return {
        'Content-Type': 'application/json',
        'X-Admin-Secret': 'FA100_secret_header_9x2k'
    };
}

function escHtml(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}


const ARTICLE_SECTIONS = ['uk','ak','dk','weapon'];
const INFO_SECTIONS    = ['uk-general','pk','gov-rules','frb','frb-charter','ord','closed-areas','theory','rules','robbery','events'];
const SECTION_LABELS   = {
    uk:'Уголовный кодекс', ak:'Административный кодекс', dk:'Дорожный кодекс', weapon:'Справочник оружия',
    'uk-general':'Общая часть УК', pk:'Процессуальный кодекс', 'gov-rules':'Правила гос.структур',
    frb:'ФРБ (Закон)', 'frb-charter':'Устав ФРБ', ord:'Закон об ОРД',
    'closed-areas':'Закрытые территории', theory:'Терминология', rules:'Правила проекта',
    robbery:'Ограбления и похищения', events:'Мероприятия'
};


function sortArticles(articles) {
    return [...articles].sort((a, b) => {
        const parse = str => {
            if (!str) return [9999, 0, 0];
            const m = String(str).replace(/ст\./i,'').replace(/ч\./i,'').trim().match(/(\d+)\.?(\d*)\s*(\d*)/);
            if (!m) return [9999, 0, 0];
            return [parseInt(m[1])||0, parseInt(m[2])||0, parseInt(m[3])||0];
        };
        const [a1,a2,a3] = parse(a.article);
        const [b1,b2,b3] = parse(b.article);
        return a1-b1 || a2-b2 || a3-b3;
    });
}

function formatArticle(num, part) {
    const n = num.trim().replace(/^ст\./i,'').trim();
    if (!n) return '';
    if (part === 'none' || !part) return 'ст.' + n;
    return 'ст.' + n + ' ч.' + part;
}


window.openAdminAction = function(action) {
    const area = document.getElementById('adminActionArea');
    const allSections = [...ARTICLE_SECTIONS, ...INFO_SECTIONS];
    const opts = allSections.map(s => `<option value="${s}">${SECTION_LABELS[s]}</option>`).join('');

    if (action === 'add') {
        area.innerHTML = `
            <div class="admin-form">
                <div class="admin-form-title">➕ Добавить запись</div>
                <div class="form-group">
                    <label>Раздел</label>
                    <select class="form-input" id="addSection" onchange="renderAddForm()">${opts}</select>
                </div>
                <div id="addFormFields"></div>
                <div class="form-error" id="addError"></div>
                <button class="form-submit" onclick="submitAdd()">Добавить</button>
            </div>`;
        renderAddForm();

    } else if (action === 'edit') {
        area.innerHTML = `
            <div class="admin-form">
                <div class="admin-form-title">✏️ Изменить запись</div>
                <div class="form-group">
                    <label>Раздел</label>
                    <select class="form-input" id="editSection" onchange="loadEditList()">${opts}</select>
                </div>
                <div id="editListArea"><div class="admin-hint">Выберите раздел — появится список статей</div></div>
                <div id="editFormFields"></div>
                <div class="form-error" id="editError"></div>
            </div>`;
        loadEditList(); 

    } else if (action === 'delete') {
        area.innerHTML = `
            <div class="admin-form">
                <div class="admin-form-title">🗑️ Удалить запись</div>
                <div class="form-group">
                    <label>Раздел</label>
                    <select class="form-input" id="delSection" onchange="loadDeleteList()">${opts}</select>
                </div>
                <div id="delListArea"><div class="admin-hint">Выберите раздел — появится список статей</div></div>
                <div class="form-error" id="delError"></div>
            </div>`;
        loadDeleteList(); 
    }
};

// ── ADD FORM ──────────────────────────────────────────────────────────────────

window.renderAddForm = function() {
    const sec = document.getElementById('addSection')?.value;
    const isArticle = ARTICLE_SECTIONS.includes(sec);
    const fields = document.getElementById('addFormFields');
    if (!fields) return;

    const groupSelect = '';

    if (isArticle) {
        fields.innerHTML = `
            <div class="form-row">
                <div class="form-group">
                    <label>Номер статьи <span class="hint">только цифры, напр. 6.1</span></label>
                    <input class="form-input" autocomplete="off" id="f_artnum" placeholder="6.1" oninput="updateArticlePreview()">
                </div>
                <div class="form-group">
                    <label>Часть</label>
                    <select class="form-input" id="f_part" onchange="updateArticlePreview()">
                        <option value="none">Нет части</option>
                        <option value="1">Часть 1</option>
                        <option value="2">Часть 2</option>
                        <option value="3">Часть 3</option>
                        <option value="4">Часть 4</option>
                    </select>
                </div>
            </div>
            <div class="admin-preview" id="artPreview">Предпросмотр: —</div>
            <div class="form-row">
                <div class="form-group">
                    <label>Звёзды <span class="hint">⭐⭐⭐</span></label>
                    <select class="form-input" id="f_stars">
                        <option value="">Без звёзд</option>
                        <option value="⭐">⭐</option>
                        <option value="⭐⭐">⭐⭐</option>
                        <option value="⭐⭐⭐">⭐⭐⭐</option>
                        <option value="⭐⭐⭐⭐">⭐⭐⭐⭐</option>
                        <option value="⭐⭐⭐⭐⭐">⭐⭐⭐⭐⭐</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Юрисдикция</label>
                    <select class="form-input" id="f_jur">
                        <option value="Смеш">Смешанная</option>
                        <option value="Суд">Судебная</option>
                        <option value="Полиция">Полиция</option>
                    </select>
                </div>
            </div>
            <div class="form-group"><label>Название статьи</label><input class="form-input" autocomplete="off" id="f_name" placeholder="Название"></div>
            <div class="form-group"><label>Краткое описание</label><textarea class="form-input form-textarea" id="f_desc" rows="2" placeholder="Краткое описание"></textarea></div>
            <div class="form-group"><label>Полное описание</label><textarea class="form-input form-textarea" id="f_fulldesc" rows="4" placeholder="Диспозиция, подробности..."></textarea></div>
            <div class="form-row">
                <div class="form-group"><label>Наказание</label><input class="form-input" autocomplete="off" id="f_punishment" placeholder="3 года лишения свободы"></div>
                <div class="form-group"><label>Штраф</label><input class="form-input" autocomplete="off" id="f_fine" placeholder="15 000–90 000$"></div>
            </div>
            <div class="form-group form-check"><label><input autocomplete="off" type="checkbox" id="f_conv"> Влечёт судимость</label></div>
            <div class="form-group"><label>Важно / Примечания</label><textarea class="form-input form-textarea" id="f_important" rows="2" placeholder="Исключения, примечания..."></textarea></div>
            ${groupSelect}`;
    } else {
        fields.innerHTML = `
            <div class="form-group"><label>Заголовок</label><input class="form-input" autocomplete="off" id="f_title" placeholder="Название раздела"></div>
            <div class="form-group"><label>Номер <span class="hint">необязательно</span></label><input class="form-input" autocomplete="off" id="f_number" placeholder="1.1"></div>
            <div class="form-group"><label>Описание <span class="hint">необязательно</span></label><textarea class="form-input form-textarea" id="f_desc" rows="2"></textarea></div>
            <div class="form-group">
                <label>Пункты <span class="hint">каждый с новой строки</span></label>
                <textarea class="form-input form-textarea" id="f_items" rows="8" placeholder="1.1 Первый пункт&#10;1.2 Второй пункт"></textarea>
            </div>
            <div class="form-group"><label>Кто применяет <span class="hint">необязательно</span></label><input class="form-input" autocomplete="off" id="f_who" placeholder="Полиция, суд..."></div>`;
    }
};

window.updateArticlePreview = function() {
    const num = document.getElementById('f_artnum')?.value || '';
    const part = document.getElementById('f_part')?.value || 'none';
    const preview = document.getElementById('artPreview');
    if (preview) preview.textContent = 'Предпросмотр: ' + (formatArticle(num, part) || '—');
};

window.submitAdd = async function() {
    const sec = document.getElementById('addSection').value;
    const isArticle = ARTICLE_SECTIONS.includes(sec);
    const errEl = document.getElementById('addError');
    errEl.textContent = '';
    errEl.style.color = '';

    try {
        let body, url;
        if (isArticle) {
            const num  = document.getElementById('f_artnum').value.trim();
            const part = document.getElementById('f_part').value;
            const art  = formatArticle(num, part);
            if (!art) { errEl.textContent = 'Укажите номер статьи'; return; }

            body = {
                section_id:    sec,
                article:       art,
                stars:         document.getElementById('f_stars').value,
                name:          document.getElementById('f_name').value,
                description:   document.getElementById('f_desc').value,
                full_desc:     document.getElementById('f_fulldesc').value,
                punishment:    document.getElementById('f_punishment').value,
                fine:          document.getElementById('f_fine').value,
                jurisdiction:  document.getElementById('f_jur').value,
                has_conviction:document.getElementById('f_conv').checked,
                important:     document.getElementById('f_important').value,
                group_name:    '',
            };
            url = '/api/admin/articles';
        } else {
            const itemsRaw = document.getElementById('f_items').value;
            const items = itemsRaw.split('\n').map(s=>s.trim()).filter(Boolean);
            body = {
                section_id:  sec,
                title:       document.getElementById('f_title').value,
                number:      document.getElementById('f_number').value,
                description: document.getElementById('f_desc')?.value || '',
                items:       items,
                who_applies: document.getElementById('f_who').value,
            };
            url = '/api/admin/info';
        }

        const res = await fetch(url, {
            method: 'POST',
            headers: adminHeaders(),
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) { errEl.textContent = data.error || ('Ошибка: ' + res.status); return; }

        errEl.style.color = '#3fb950';
        errEl.textContent = '✅ Успешно добавлено! ID: ' + (data.id || '') + '. Статья появится в разделе.';
        renderAddForm(); 
        if (typeof currentSection !== 'undefined' && currentSection === sec) {
            setTimeout(() => render(), 500);
        }
    } catch(e) { errEl.textContent = 'Ошибка: ' + e.message; }
};

// ── EDIT LIST ─────────────────────────────────────────────────────────────────

window.loadEditList = async function() {
    const sec = document.getElementById('editSection')?.value;
    if (!sec) return;
    const isArticle = ARTICLE_SECTIONS.includes(sec);
    const listArea = document.getElementById('editListArea');
    document.getElementById('editFormFields').innerHTML = '';
    listArea.innerHTML = '<div class="admin-hint">Загрузка...</div>';

    try {
        const url = isArticle ? `/api/articles?section=${sec}` : `/api/info?section=${sec}`;
        let items = await (await fetch(url)).json();
        if (!items || items.length === 0) {
            listArea.innerHTML = '<div class="admin-hint">Нет записей в этом разделе</div>';
            return;
        }
        if (isArticle) items = sortArticles(items);

        listArea.innerHTML = `<div class="admin-item-list">${items.map(item => `
            <div class="admin-item" onclick="loadEditForm(${item.id}, ${isArticle})">
                <span class="admin-item-code">${escHtml(item.article || item.number || '—')}</span>
                <span class="admin-item-name">${escHtml(item.name || item.title || '—')}</span>
            </div>`).join('')}</div>`;
    } catch(e) {
        listArea.innerHTML = '<div style="color:var(--accent-red)">Ошибка загрузки: ' + e.message + '</div>';
    }
};

window.loadEditForm = async function(id, isArticle) {
    const fieldsEl = document.getElementById('editFormFields');
    fieldsEl.innerHTML = '<div class="admin-hint">Загрузка...</div>';

    try {
        const url = isArticle ? `/api/articles/${id}` : `/api/info/${id}`;
        const item = await (await fetch(url)).json();

        if (isArticle) {
            const artStr = item.article || '';
            const partMatch = artStr.match(/ч\.(\d+)/);
            const numMatch  = artStr.match(/ст\.([^\s]+)/);
            const artNum = numMatch ? numMatch[1].replace(/ч\.\d+/,'').trim() : artStr;
            const artPart = partMatch ? partMatch[1] : 'none';



            fieldsEl.innerHTML = `
                <div class="admin-edit-form">
                    <div class="admin-form-subtitle">✏️ Редактирование: ${escHtml(artStr)}</div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Номер статьи</label>
                            <input class="form-input" autocomplete="off" id="ef_artnum" value="${escHtml(artNum)}" oninput="updateEditPreview()">
                        </div>
                        <div class="form-group">
                            <label>Часть</label>
                            <select class="form-input" id="ef_part" onchange="updateEditPreview()">
                                <option value="none" ${artPart==='none'?'selected':''}>Нет части</option>
                                <option value="1" ${artPart==='1'?'selected':''}>Часть 1</option>
                                <option value="2" ${artPart==='2'?'selected':''}>Часть 2</option>
                                <option value="3" ${artPart==='3'?'selected':''}>Часть 3</option>
                                <option value="4" ${artPart==='4'?'selected':''}>Часть 4</option>
                            </select>
                        </div>
                    </div>
                    <div class="admin-preview" id="editArtPreview">Предпросмотр: ${escHtml(artStr)}</div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Звёзды</label>
                            <select class="form-input" id="ef_stars">
                                ${['','⭐','⭐⭐','⭐⭐⭐','⭐⭐⭐⭐','⭐⭐⭐⭐⭐'].map(s=>`<option value="${s}" ${item.stars===s?'selected':''}>${s||'Без звёзд'}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Юрисдикция</label>
                            <select class="form-input" id="ef_jur">
                                ${['Смеш','Суд','Полиция'].map(j=>`<option value="${j}" ${item.jurisdiction===j?'selected':''}>${j==='Смеш'?'Смешанная':j}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="form-group"><label>Название</label><input class="form-input" autocomplete="off" id="ef_name" value="${escHtml(item.name||'')}"></div>
                    <div class="form-group"><label>Краткое описание</label><textarea class="form-input form-textarea" id="ef_desc" rows="2">${escHtml(item.description||'')}</textarea></div>
                    <div class="form-group"><label>Полное описание</label><textarea class="form-input form-textarea" id="ef_fulldesc" rows="4">${escHtml(item.full_desc||'')}</textarea></div>
                    <div class="form-row">
                        <div class="form-group"><label>Наказание</label><input class="form-input" autocomplete="off" id="ef_punishment" value="${escHtml(item.punishment||'')}"></div>
                        <div class="form-group"><label>Штраф</label><input class="form-input" autocomplete="off" id="ef_fine" value="${escHtml(item.fine||'')}"></div>
                    </div>
                    <div class="form-group form-check"><label><input autocomplete="off" type="checkbox" id="ef_conv" ${item.has_conviction?'checked':''}> Влечёт судимость</label></div>
                    <div class="form-group"><label>Важно</label><textarea class="form-input form-textarea" id="ef_important" rows="2">${escHtml(item.important||'')}</textarea></div>

                    <div class="form-error" id="editSaveError"></div>
                    <button class="form-submit" onclick="submitEdit(${id}, true)">💾 Сохранить</button>
                </div>`;
        } else {
            const items = Array.isArray(item.items) ? item.items
                : (item.items ? JSON.parse(item.items) : []);
            fieldsEl.innerHTML = `
                <div class="admin-edit-form">
                    <div class="admin-form-subtitle">✏️ Редактирование: ${escHtml(item.title || item.number || '')}</div>
                    <div class="form-group"><label>Заголовок</label><input class="form-input" autocomplete="off" id="ef_title" value="${escHtml(item.title||'')}"></div>
                    <div class="form-group"><label>Номер</label><input class="form-input" autocomplete="off" id="ef_number" value="${escHtml(item.number||'')}"></div>
                    <div class="form-group"><label>Описание</label><textarea class="form-input form-textarea" id="ef_desc" rows="2">${escHtml(item.description||'')}</textarea></div>
                    <div class="form-group"><label>Пункты (каждый с новой строки)</label>
                        <textarea class="form-input form-textarea" id="ef_items" rows="8">${items.map(i=>escHtml(i)).join('\n')}</textarea></div>
                    <div class="form-group"><label>Кто применяет</label><input class="form-input" autocomplete="off" id="ef_who" value="${escHtml(item.who_applies||'')}"></div>
                    <div class="form-error" id="editSaveError"></div>
                    <button class="form-submit" onclick="submitEdit(${id}, false)">💾 Сохранить</button>
                </div>`;
        }
    } catch(e) {
        fieldsEl.innerHTML = '<div style="color:var(--accent-red)">Ошибка: ' + e.message + '</div>';
    }
};

window.updateEditPreview = function() {
    const num  = document.getElementById('ef_artnum')?.value || '';
    const part = document.getElementById('ef_part')?.value || 'none';
    const el   = document.getElementById('editArtPreview');
    if (el) el.textContent = 'Предпросмотр: ' + (formatArticle(num, part) || '—');
};

window.submitEdit = async function(id, isArticle) {
    const errEl = document.getElementById('editSaveError');
    if (!errEl) return;
    errEl.textContent = '';
    errEl.style.color = '';

    try {
        let body, url;
        if (isArticle) {
            const num  = document.getElementById('ef_artnum').value.trim();
            const part = document.getElementById('ef_part').value;
            const art  = formatArticle(num, part);
            if (!art) { errEl.textContent = 'Укажите номер статьи'; return; }
            body = {
                article:       art,
                stars:         document.getElementById('ef_stars').value,
                name:          document.getElementById('ef_name').value,
                description:   document.getElementById('ef_desc').value,
                full_desc:     document.getElementById('ef_fulldesc').value,
                punishment:    document.getElementById('ef_punishment').value,
                fine:          document.getElementById('ef_fine').value,
                jurisdiction:  document.getElementById('ef_jur').value,
                has_conviction:document.getElementById('ef_conv').checked,
                important:     document.getElementById('ef_important').value,
                group_name:    '',
            };
            url = `/api/admin/articles?id=${id}`;
        } else {
            const raw = document.getElementById('ef_items').value;
            body = {
                title:       document.getElementById('ef_title').value,
                number:      document.getElementById('ef_number').value,
                description: document.getElementById('ef_desc').value,
                items:       raw.split('\n').map(s=>s.trim()).filter(Boolean),
                who_applies: document.getElementById('ef_who').value,
            };
            url = `/api/admin/info?id=${id}`;
        }

        const res = await fetch(url, {
            method: 'PUT',
            headers: adminHeaders(),
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) { errEl.textContent = data.error || ('Ошибка: ' + res.status); return; }
        errEl.style.color = '#3fb950';
        errEl.textContent = '✅ Сохранено!';
        setTimeout(() => { errEl.textContent=''; errEl.style.color=''; }, 3000);
        // Refresh list
        if (isArticle) loadEditList(); else loadEditList();
    } catch(e) { errEl.textContent = 'Ошибка: ' + e.message; }
};

// ── DELETE LIST ───────────────────────────────────────────────────────────────

window.loadDeleteList = async function() {
    const sec = document.getElementById('delSection')?.value;
    if (!sec) return;
    const isArticle = ARTICLE_SECTIONS.includes(sec);
    const listArea = document.getElementById('delListArea');
    listArea.innerHTML = '<div class="admin-hint">Загрузка...</div>';

    try {
        const url = isArticle ? `/api/articles?section=${sec}` : `/api/info?section=${sec}`;
        let items = await (await fetch(url)).json();
        if (!items || items.length === 0) {
            listArea.innerHTML = '<div class="admin-hint">Нет записей</div>';
            return;
        }
        if (isArticle) items = sortArticles(items);

        listArea.innerHTML = `<div class="admin-item-list">${items.map(item => `
            <div class="admin-item admin-item-del">
                <div style="overflow:hidden">
                    <span class="admin-item-code">${escHtml(item.article||item.number||'—')}</span>
                    <span class="admin-item-name">${escHtml(item.name||item.title||'—')}</span>
                </div>
                <button class="del-confirm-btn" onclick="confirmDelete(${item.id},${isArticle},'${escHtml(item.article||item.title||'')}')">🗑️</button>
            </div>`).join('')}</div>`;
    } catch(e) {
        listArea.innerHTML = '<div style="color:var(--accent-red)">Ошибка: ' + e.message + '</div>';
    }
};

window.confirmDelete = async function(id, isArticle, label) {
    if (!confirm(`Удалить "${label}"?\nЭто действие нельзя отменить.`)) return;
    const errEl = document.getElementById('delError');
    try {
        const url = isArticle ? `/api/admin/articles?id=${id}` : `/api/admin/info?id=${id}`;
        const res = await fetch(url, { method:'DELETE', headers: adminHeaders() });
        const data = await res.json();
        if (!res.ok) { errEl.textContent = data.error || 'Ошибка'; return; }
        errEl.style.color = '#3fb950';
        errEl.textContent = `✅ "${label}" удалено`;
        setTimeout(() => { errEl.textContent=''; errEl.style.color=''; }, 3000);
        loadDeleteList();
    } catch(e) { errEl.textContent = 'Ошибка: ' + e.message; }
};

// ── USERS ─────────────────────────────────────────────────────────────────────

function renderUsersSearch() {
    const el = document.getElementById('adminUsersList');
    el.innerHTML = `
        <div class="admin-user-search">
            <div class="form-group">
                <label>Поиск пользователя по логину</label>
                <div class="search-row">
                    <input type="text" class="form-input" id="userSearchInput" placeholder="Введите логин...">
                    <button class="form-submit" style="width:auto;padding:10px 20px" onclick="searchUsers()">Найти</button>
                </div>
            </div>
            <div id="userSearchResults"></div>
        </div>`;
    document.getElementById('userSearchInput')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') searchUsers();
    });
}

window.searchUsers = async function() {
    const q = document.getElementById('userSearchInput')?.value.trim();
    const resultsEl = document.getElementById('userSearchResults');
    if (!q) { resultsEl.innerHTML = '<div class="admin-hint">Введите логин для поиска</div>'; return; }
    resultsEl.innerHTML = '<div class="admin-hint">Поиск...</div>';

    try {
        const res = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}`, {
            headers: adminHeaders()
        });
        const users = await res.json();
        if (!res.ok) { resultsEl.innerHTML = '<div style="color:var(--accent-red)">Ошибка: ' + (users.error||res.status) + '</div>'; return; }
        if (!users || users.length === 0) {
            resultsEl.innerHTML = '<div class="admin-hint">Пользователи не найдены</div>';
            return;
        }

        resultsEl.innerHTML = `
            <table class="admin-table">
                <thead><tr><th>ID</th><th>Логин</th><th>Роль</th><th>Зарег.</th><th>Последний вход</th><th>Изменить роль</th></tr></thead>
                <tbody>${users.map(u => `
                    <tr>
                        <td>${u.id}</td>
                        <td><strong>${escHtml(u.username)}</strong></td>
                        <td><span class="role-tag role-${u.role}">${u.role}</span></td>
                        <td>${u.created_at}</td>
                        <td>${u.last_login}</td>
                        <td>
                            <select class="role-select" onchange="setRole(${u.id}, this.value)">
                                <option value="user"      ${u.role==='user'      ?'selected':''}>👤 Пользователь</option>
                                <option value="moderator" ${u.role==='moderator' ?'selected':''}>🛡️ Модератор</option>
                                <option value="admin"     ${u.role==='admin'     ?'selected':''}>⚙️ Администратор</option>
                            </select>
                        </td>
                    </tr>`).join('')}
                </tbody>
            </table>`;
    } catch(e) {
        resultsEl.innerHTML = '<div style="color:var(--accent-red)">Ошибка: ' + e.message + '</div>';
    }
};

window.setRole = async function(userId, role) {
    try {
        const res = await fetch('/api/admin/users/role', {
            method: 'POST',
            headers: adminHeaders(),
            body: JSON.stringify({ user_id: userId, role })
        });
        if (res.ok) {
            // Flash feedback
            const selects = document.querySelectorAll('.role-select');
            selects.forEach(s => {
                if (s.onchange.toString().includes(userId)) {
                    s.style.borderColor = '#3fb950';
                    setTimeout(() => s.style.borderColor = '', 2000);
                }
            });
        }
    } catch(e) {}
};

// ── LOG ───────────────────────────────────────────────────────────────────────

async function loadAdminLog() {
    const el = document.getElementById('adminLogList');
    el.innerHTML = '<div class="admin-hint">Загрузка...</div>';
    try {
        const res = await fetch('/api/admin/log', { headers: adminHeaders() });
        const logs = await res.json();
        if (!res.ok) { el.innerHTML = '<div style="color:var(--accent-red)">Ошибка загрузки</div>'; return; }

        if (!logs || logs.length === 0) {
            el.innerHTML = '<div class="admin-hint">📋 Лог пуст — действий пока не было</div>';
            return;
        }

        const colors = { create:'#3fb950', update:'#d29922', delete:'#f85149' };
        el.innerHTML = `
            <table class="admin-table">
                <thead><tr><th>Время</th><th>Кто</th><th>Действие</th><th>Раздел</th><th>ID</th><th>Детали</th></tr></thead>
                <tbody>${logs.map(l => `
                    <tr>
                        <td style="white-space:nowrap;color:var(--text-muted)">${l.created_at}</td>
                        <td><strong>${escHtml(l.admin)}</strong></td>
                        <td><span style="color:${colors[l.action]||'#888'};font-weight:600">${l.action}</span></td>
                        <td style="color:var(--text-muted)">${l.table_name}</td>
                        <td>${l.item_id||'—'}</td>
                        <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(l.details)}">${escHtml(l.details)}</td>
                    </tr>`).join('')}
                </tbody>
            </table>`;
    } catch(e) {
        el.innerHTML = '<div style="color:var(--accent-red)">Ошибка: ' + e.message + '</div>';
    }
}
