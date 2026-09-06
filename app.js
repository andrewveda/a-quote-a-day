/* ═══════════════════════════════════════════
   A QUOTE A DAY — app.js
   - Scroll-to-top fix on tab switch
   - Contributor Hall of Fame + profile cards
   - Compact mobile masthead
   - Download all quotes for a date (HTML & PDF)
═══════════════════════════════════════════ */

const CONFIG = {
    REPO: "AndrewVeda/a-quote-a-day",
    DIR:  "quotes",
};

let DB          = [];
let currentView = [];
let deckIdx     = 0;
let currentTab  = 'all';

/* ─── MASTHEAD SCROLL ─── */
const mastheadEl = document.getElementById('masthead');
const COMPACT_THRESHOLD = 80;

window.addEventListener('scroll', () => {
    const y = window.scrollY;
    mastheadEl.classList.toggle('scrolled', y > 20);
    if (window.innerWidth < 768) {
        mastheadEl.classList.toggle('masthead--compact', y > COMPACT_THRESHOLD);
    } else {
        mastheadEl.classList.remove('masthead--compact');
    }
}, { passive: true });

window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) mastheadEl.classList.remove('masthead--compact');
}, { passive: true });

/* ─── DATELINE ─── */
document.getElementById('mastDateline').innerText =
    new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }).toUpperCase();

/* ─── KEYBOARD ENGINE ─── */
document.addEventListener('keydown', e => {
    const overlay = document.getElementById('deckOverlay');
    if (!overlay.classList.contains('open')) return;
    if (e.key === 'Escape')     closeDeck();
    if (e.key === 'ArrowRight') moveDeck(1);
    if (e.key === 'ArrowLeft')  moveDeck(-1);
});

function moveDeck(dir) {
    const next = deckIdx + dir;
    if (next < 0 || next >= currentView.length) return;
    deckIdx = next;
    updateDeckPosition();
}

/* ─── CLOSE DECK ─── */
function closeDeck() {
    document.getElementById('deckOverlay').classList.remove('open');
    document.body.style.overflow = '';
    window.history.replaceState(null, null, window.location.pathname);
}

/* ─── SCROLL TO TOP (instant, no jank) ─── */
function resetScroll() {
    window.scrollTo({ top: 0, behavior: 'instant' });
    // Also force-remove compact state so masthead re-appears immediately
    mastheadEl.classList.remove('masthead--compact');
}

/* ─── INIT ─── */
document.addEventListener('DOMContentLoaded', async () => {
    await fetchArchive();
    setupNavigation();
    setupCompactMasthead();
    setupSwipeEngine();
    setupSearch();

    const urlParams = new URLSearchParams(window.location.search);
    const quoteId   = urlParams.get('id');
    if (quoteId) jumpToQuote(quoteId);
});

/* ─── FETCH & PARSE ─── */
async function fetchArchive() {
    try {
        const response = await fetch(
            `https://api.github.com/repos/${CONFIG.REPO}/contents/${CONFIG.DIR}`
        );
        if (!response.ok) throw new Error('Network error');

        const files   = await response.json();
        const mdFiles = files.filter(f => f.name.endsWith('.md'));

        const promises = mdFiles.map(async (file, i) => {
            try {
                const raw = await fetch(file.download_url).then(r => r.text());
                return parseEntry(raw, file.name, i + 1);
            } catch { return null; }
        });

        DB = (await Promise.all(promises)).filter(Boolean);
        DB.sort((a, b) => b.date - a.date);

        if (DB.length === 0) throw new Error('Empty archive');

        document.getElementById('mastCount').innerText = `${DB.length} Quotes`;
        renderGrid(DB);

    } catch (err) {
        console.error('Archive fetch error:', err);
        document.getElementById('mainContent').innerHTML = `
            <div class="empty-state">
                <p>⚠️ Could not load archive.</p>
                <button onclick="location.reload()" style="margin-top:20px;padding:10px 24px;border:1px solid var(--gold-border);border-radius:30px;cursor:pointer;font-family:var(--sans);background:var(--gold);color:white;">
                    Retry
                </button>
            </div>`;
    } finally {
        const loader = document.getElementById('loader');
        if (loader) loader.style.display = 'none';
    }
}

function parseEntry(md, filename, fallbackId) {
    const match = md.match(/---([\s\S]*?)---/);
    if (!match) return null;

    const data = {};
    match[1].split('\n').forEach(line => {
        const i = line.indexOf(':');
        if (i !== -1) {
            data[line.substring(0,i).trim()] = line.substring(i+1).trim();
        }
    });

    const dateMatch = filename.match(/^(\d{4}-\d{2}-\d{2})/);
    return {
        id:          data.id || fallbackId,
        quote:       data.quote       || 'Text missing.',
        author:      data.author      || 'Unknown',
        contributor: data.contributor || 'Anonymous',
        department:  data.department  || 'English',
        about:       data.what_it_means_to_me || data.about || '',
        date:        new Date(dateMatch ? dateMatch[1] : 0),
        dateStr:     dateMatch ? dateMatch[1] : 'Unknown',
    };
}

/* ─── RENDER GRID ─── */
function renderGrid(quotes) {
    currentView = quotes;
    const container = document.getElementById('mainContent');

    if (quotes.length === 0) {
        container.innerHTML = '<p class="no-results">No quotes found.</p>';
        return;
    }

    container.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'results-header';
    header.textContent = `${quotes.length} ${quotes.length === 1 ? 'Quote' : 'Quotes'}`;
    container.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'col-grid';

    quotes.forEach((q, i) => {
        const card = document.createElement('div');
        card.className = 'q-card';
        card.style.animationDelay = `${Math.min(i * 40, 400)}ms`;
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `Quote by ${q.author}`);
        const snippet = q.about && q.about.trim()
            ? `<div class="q-card-reflection">"${q.about.length > 120 ? q.about.slice(0, 117) + '…' : q.about}"<span class="q-card-reflection-by"> — ${q.contributor}</span></div>`
            : '';
        card.innerHTML = `
            <div class="q-card-num">No. ${q.id} · ${q.dateStr}</div>
            <div class="q-card-text">"${q.quote}"</div>
            ${snippet}
            <div class="q-card-footer">
                <div>
                    <div class="q-card-author">${q.author} <span class="q-card-contrib">via ${q.contributor}</span></div>
                    <div class="q-card-dept">${q.department}</div>
                </div>
                <div class="q-card-arrow">→</div>
            </div>
        `;
        card.addEventListener('click', () => openDeck(quotes, i));
        card.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') openDeck(quotes, i);
        });
        grid.appendChild(card);
    });

    container.appendChild(grid);
}

/* ─── SEARCH ─── */
function setupSearch() {
    const input = document.getElementById('searchInput');
    let debounceTimer;

    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const q = input.value.trim().toLowerCase();
            if (!q) {
                if (currentTab === 'all') renderGrid(DB);
                return;
            }
            const filtered = DB.filter(item =>
                item.quote.toLowerCase().includes(q) ||
                item.author.toLowerCase().includes(q) ||
                item.contributor.toLowerCase().includes(q) ||
                item.department.toLowerCase().includes(q) ||
                item.about.toLowerCase().includes(q)
            );
            renderGrid(filtered);
        }, 220);
    });
}

/* ─── NAVIGATION ─── */
function setupNavigation() {
    document.querySelectorAll('.quick-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            currentTab = tab;

            // ── SCROLL FIX: reset to top before rebuilding DOM ──
            resetScroll();

            document.getElementById('searchInput').value = '';
            document.querySelectorAll('.quick-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            if (tab === 'all') {
                renderGrid(DB);
            } else if (tab === 'departments') {
                renderGroupedGrid('department');
            } else if (tab === 'contributors') {
                renderContributors();
            } else {
                openDirectory(tab);
            }
        });
    });

    document.getElementById('deckClose').addEventListener('click', closeDeck);
    document.getElementById('arrowPrev').addEventListener('click', () => moveDeck(-1));
    document.getElementById('arrowNext').addEventListener('click', () => moveDeck(1));
    document.getElementById('dirClose').addEventListener('click', closeDirectory);
    document.getElementById('dirBackdrop').addEventListener('click', closeDirectory);
    document.getElementById('deckOverlay').addEventListener('click', e => {
        if (e.target === e.currentTarget) closeDeck();
    });
}

/* ─── CONTRIBUTOR INITIALS AVATAR ─── */
function getInitials(name) {
    return name.trim().split(/\s+/).map(w => w[0].toUpperCase()).slice(0, 2).join('');
}

// Stable warm accent per contributor
const CONTRIB_ACCENTS = [
    { bg: '#b8913a', fg: '#fff' },
    { bg: '#6b0f1a', fg: '#fff' },
    { bg: '#2d5a3d', fg: '#fff' },
    { bg: '#1a3a5c', fg: '#fff' },
    { bg: '#5c3d1a', fg: '#fff' },
    { bg: '#4a2060', fg: '#fff' },
    { bg: '#1c4a4a', fg: '#fff' },
];

function accentForName(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return CONTRIB_ACCENTS[hash % CONTRIB_ACCENTS.length];
}

/* ─── RENDER CONTRIBUTORS ─── */
function renderContributors() {
    const container = document.getElementById('mainContent');
    container.innerHTML = '';

    const index = {};
    DB.forEach(item => {
        if (!index[item.contributor]) {
            index[item.contributor] = {
                name:       item.contributor,
                department: item.department,
                quotes:     [],
                latest:     item.date,
            };
        }
        index[item.contributor].quotes.push(item);
        if (item.date > index[item.contributor].latest) {
            index[item.contributor].latest = item.date;
        }
    });

    const contributors = Object.values(index)
        .sort((a, b) => b.quotes.length - a.quotes.length);

    // ── HALL OF FAME (top 3) ──
    const podium = document.createElement('div');
    podium.className = 'hof-section';
    podium.innerHTML = `
        <div class="hof-masthead">
            <div class="hof-rule"></div>
            <div class="hof-title-wrap">
                <div class="hof-eyebrow">English Department</div>
                <div class="hof-title">Hall of Fame</div>
                <div class="hof-sub">Our most prolific voices</div>
            </div>
            <div class="hof-rule"></div>
        </div>
    `;

    const medals  = ['🥇', '🥈', '🥉'];
    const podiumRow = document.createElement('div');
    podiumRow.className = 'hof-podium';

    const podiumOrder = [1, 0, 2];
    podiumOrder.forEach((rank, pos) => {
        const c = contributors[rank];
        if (!c) return;
        const accent  = accentForName(c.name);
        const initials = getInitials(c.name);
        const latestQuote = c.quotes[0];
        const card = document.createElement('div');
        card.className = `hof-card hof-rank-${rank + 1}`;
        card.style.animationDelay = `${pos * 100}ms`;
        card.innerHTML = `
            <div class="hof-medal">${medals[rank]}</div>
            <div class="hof-avatar" style="background:${accent.bg};color:${accent.fg}">${initials}</div>
            <div class="hof-name">${c.name}</div>
            <div class="hof-dept">${c.department}</div>
            <div class="hof-count">
                <span class="hof-count-num">${c.quotes.length}</span>
                <span class="hof-count-label">${c.quotes.length === 1 ? 'quote' : 'quotes'}</span>
            </div>
            <div class="hof-preview">"${latestQuote.quote.length > 80 ? latestQuote.quote.slice(0, 77) + '…' : latestQuote.quote}"</div>
            <button class="hof-view-btn" aria-label="View ${c.name}'s quotes">View all →</button>
        `;
        card.querySelector('.hof-view-btn').addEventListener('click', () => {
            renderGrid(c.quotes);
            resetScroll();
        });
        card.addEventListener('click', e => {
            if (e.target.classList.contains('hof-view-btn')) return;
            renderGrid(c.quotes);
            resetScroll();
        });
        podiumRow.appendChild(card);
    });

    podium.appendChild(podiumRow);
    container.appendChild(podium);

    // ── ALL CONTRIBUTORS GRID ──
    if (contributors.length > 3) {
        const restHeader = document.createElement('div');
        restHeader.className = 'results-header';
        restHeader.style.marginTop = '48px';
        restHeader.textContent = `All ${contributors.length} Contributors`;
        container.appendChild(restHeader);

        const grid = document.createElement('div');
        grid.className = 'contrib-grid';

        contributors.forEach((c, i) => {
            if (i < 3) return; // Skip top 3
            const accent   = accentForName(c.name);
            const initials = getInitials(c.name);
            const latest   = c.quotes[0];
            const card = document.createElement('div');
            card.className = 'contrib-card';
            card.style.animationDelay = `${Math.min(i * 30, 400)}ms`;
            card.setAttribute('tabindex', '0');
            card.setAttribute('role', 'button');
            card.setAttribute('aria-label', `${c.name} — ${c.quotes.length} quotes`);

            card.innerHTML = `
                <div class="contrib-card-top">
                    <div class="contrib-avatar" style="background:${accent.bg};color:${accent.fg}">${initials}</div>
                    <div class="contrib-info">
                        <div class="contrib-name">${c.name}</div>
                        <div class="contrib-dept">${c.department}</div>
                    </div>
                    <div class="contrib-badge">${c.quotes.length}</div>
                </div>
                <div class="contrib-preview">"${latest.quote.length > 100 ? latest.quote.slice(0, 97) + '…' : latest.quote}"</div>
                <div class="contrib-footer">
                    <span class="contrib-author-tag">— ${latest.author}</span>
                    <span class="contrib-arrow">→</span>
                </div>
            `;
            card.addEventListener('click', () => {
                renderGrid(c.quotes);
                resetScroll();
            });
            card.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') { renderGrid(c.quotes); resetScroll(); }
            });
            grid.appendChild(card);
        });

        container.appendChild(grid);
    }
}

/* ─── RENDER GROUPED GRID (Departments) ─── */
function renderGroupedGrid(groupBy) {
    const container = document.getElementById('mainContent');
    container.innerHTML = '';

    const index = {};
    DB.forEach(item => {
        const key = item[groupBy] || 'Other';
        if (!index[key]) index[key] = [];
        index[key].push(item);
    });

    const sorted = Object.keys(index).sort((a, b) => index[b].length - index[a].length);

    sorted.forEach(groupName => {
        const groupQuotes = index[groupName];
        const section = document.createElement('div');
        section.className = 'dept-section';

        const heading = document.createElement('div');
        heading.className = 'dept-heading';
        heading.innerHTML = `
            <span class="dept-heading-name">${groupName}</span>
            <span class="dept-heading-count">${groupQuotes.length} ${groupQuotes.length === 1 ? 'quote' : 'quotes'}</span>
        `;
        section.appendChild(heading);

        const grid = document.createElement('div');
        grid.className = 'col-grid';

        groupQuotes.forEach((q, i) => {
            const card = document.createElement('div');
            card.className = 'q-card';
            card.style.animationDelay = `${Math.min(i * 30, 300)}ms`;
            card.setAttribute('tabindex', '0');
            card.setAttribute('role', 'button');
            card.setAttribute('aria-label', `Quote by ${q.author}`);

            const snippet = q.about && q.about.trim()
                ? `<div class="q-card-reflection">"${q.about.length > 120 ? q.about.slice(0, 117) + '…' : q.about}"<span class="q-card-reflection-by"> — ${q.contributor}</span></div>`
                : '';

            card.innerHTML = `
                <div class="q-card-num">No. ${q.id} · ${q.dateStr}</div>
                <div class="q-card-text">"${q.quote}"</div>
                ${snippet}
                <div class="q-card-footer">
                    <div>
                        <div class="q-card-author">${q.author} <span class="q-card-contrib">via ${q.contributor}</span></div>
                        <div class="q-card-dept">${q.department}</div>
                    </div>
                    <div class="q-card-arrow">→</div>
                </div>
            `;
            card.addEventListener('click', () => openDeck(groupQuotes, i));
            card.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') openDeck(groupQuotes, i);
            });
            grid.appendChild(card);
        });

        section.appendChild(grid);
        container.appendChild(section);
    });
}

/* ─── DIRECTORY ─── */
function openDirectory(category) {
    const list = document.getElementById('dirList');
    list.innerHTML = '';

    const titleMap = { authors: 'Authors', contributors: 'Contributors', departments: 'Departments' };
    document.getElementById('dirTitle').innerText = titleMap[category] || 'Directory';

    const index = {};
    DB.forEach(item => {
        const key = category === 'authors'
            ? item.author
            : category === 'contributors'
                ? item.contributor
                : item.department;
        if (!index[key]) index[key] = [];
        index[key].push(item);
    });

    Object.keys(index)
        .sort((a, b) => index[b].length - index[a].length)
        .forEach(name => {
            const row = document.createElement('div');
            row.className = 'dir-row';
            row.innerHTML = `
                <span class="dir-row-name">${name}</span>
                <span class="dir-badge">${index[name].length}</span>
            `;
            row.addEventListener('click', () => {
                renderGrid(index[name]);
                closeDirectory();
                resetScroll();
            });
            list.appendChild(row);
        });

    document.getElementById('dirPanel').classList.add('open');
    document.getElementById('dirBackdrop').classList.add('open');
}

function closeDirectory() {
    document.getElementById('dirPanel').classList.remove('open');
    document.getElementById('dirBackdrop').classList.remove('open');
}

/* ─── OPEN DECK ─── */
function openDeck(quotes, startIdx) {
    currentView = quotes;
    deckIdx     = startIdx;

    const track = document.getElementById('deckTrack');
    track.innerHTML = '';

    quotes.forEach((q, i) => {
        const slide = document.createElement('div');
        slide.className = 'deck-slide';
        const hasReflection = q.about && q.about.trim().length > 0;

        slide.innerHTML = `
            <div class="deck-layout">
                <div class="deck-left">
                    <div class="deck-card" id="export-target-${i}">
                        <div class="dc-body">
                            <div class="dc-kicker">Quote #${q.id} · ${q.dateStr}</div>
                            <div class="dc-quote">"${q.quote}"</div>
                            <div class="dc-byline">
                                <div class="dc-author">${q.author}</div>
                                <div class="dc-role">Quoted Author</div>
                            </div>
                            <div class="dc-envelope">
                                <div class="dc-env-label">Contributed by</div>
                                <div class="dc-contrib-name">${q.contributor}</div>
                                <div class="dc-contrib-dept">${q.department}</div>
                                ${hasReflection ? `
                                    <div class="dc-divider"></div>
                                    <div class="dc-reflection-label">What this means to me</div>
                                    <div class="dc-reflection">"${q.about}"</div>
                                ` : ''}
                            </div>
                        </div>
                        <div class="deck-action-row no-export">
                            <button class="btn-premium-action btn-whatsapp" onclick="shareToWhatsApp(${i})">
                                📲 Share
                            </button>
                            <a href="https://andrewveda.github.io/a-quote-a-day/submissions"
                               target="_blank" rel="noopener"
                               class="btn-premium-action btn-submit">
                                ✏️ Add a Quote
                            </a>
                        </div>
                    </div>
                </div>
                <div class="deck-right">
                    <div class="deck-comments-label">Discussion</div>
                    <div class="giscus-mount" id="giscus-slot-${i}"></div>
                </div>
            </div>
        `;
        track.appendChild(slide);
    });

    document.getElementById('deckOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
    updateDeckPosition(false);
}

/* ─── UPDATE DECK POSITION ─── */
function updateDeckPosition(animate = true) {
    const track = document.getElementById('deckTrack');
    if (!track) return;

    track.style.transition = animate
        ? 'transform 0.42s cubic-bezier(0.23, 1, 0.32, 1)'
        : 'none';
    track.style.transform = `translateX(${-deckIdx * 100}vw)`;

    const counter = document.getElementById('deckCounter');
    if (counter) counter.innerText = `${deckIdx + 1} / ${currentView.length}`;

    const prev = document.getElementById('arrowPrev');
    const next = document.getElementById('arrowNext');
    if (prev) prev.disabled = deckIdx === 0;
    if (next) next.disabled = deckIdx === currentView.length - 1;

    const wrap = document.getElementById('deckProgressWrap');
    if (wrap) {
        const total   = currentView.length;
        const maxDots = Math.min(total, 7);
        wrap.innerHTML = '';
        for (let i = 0; i < maxDots; i++) {
            const dot = document.createElement('div');
            dot.className = 'progress-dot' + (i === Math.min(deckIdx, maxDots - 1) ? ' active' : '');
            wrap.appendChild(dot);
        }
    }

    const q = currentView[deckIdx];
    if (q) window.history.replaceState(null, null, `?id=${q.id}`);

    loadGiscus(deckIdx);
}

/* ─── GISCUS ─── */
function loadGiscus(idx) {
    const slot = document.getElementById(`giscus-slot-${idx}`);
    if (!slot || slot.innerHTML !== '') return;

    const q = currentView[idx];
    const script = document.createElement('script');
    script.src = 'https://giscus.app/client.js';
    script.setAttribute('data-repo',        CONFIG.REPO);
    script.setAttribute('data-repo-id',     'R_kgDORI8-yw');
    script.setAttribute('data-category',    'General');
    script.setAttribute('data-category-id', 'DIC_kwDORI8-y84C1-Jq');
    script.setAttribute('data-mapping',     'specific');
    script.setAttribute('data-term',        `${q.author} — ${q.contributor}`);
    script.setAttribute('data-theme',       'preferred_color_scheme');
    script.crossOrigin = 'anonymous';
    script.async = true;
    slot.appendChild(script);
}

/* ─── SWIPE ENGINE ─── */
function setupSwipeEngine() {
    let startX = 0, dist = 0, dragging = false;
    const area = document.getElementById('deckOverlay');

    area.addEventListener('touchstart', e => {
        startX   = e.touches[0].clientX;
        dragging = true;
    }, { passive: true });

    area.addEventListener('touchmove', e => {
        if (!dragging) return;
        dist = e.touches[0].clientX - startX;
    }, { passive: true });

    area.addEventListener('touchend', () => {
        if (!dragging) return;
        dragging = false;
        if (Math.abs(dist) > 70) moveDeck(dist < 0 ? 1 : -1);
        dist = 0;
    });
}

/* ─── JUMP TO QUOTE ─── */
function jumpToQuote(id) {
    const found = DB.find(q => String(q.id) === String(id));
    if (found) openDeck(DB, DB.indexOf(found));
}

/* ─── COMPACT MASTHEAD ─── */
function setupCompactMasthead() {
    const compactSearchBtn   = document.getElementById('compactSearchBtn');
    const compactSearchBar   = document.getElementById('compactSearchBar');
    const compactSearchInput = document.getElementById('compactSearchInput');
    const mainSearchInput    = document.getElementById('searchInput');
    const filterBtn          = document.getElementById('compactFilterBtn');
    const sheetBackdrop      = document.getElementById('filterSheetBackdrop');
    const sheetTabs          = document.getElementById('filterSheetTabs');

    compactSearchBtn.addEventListener('click', () => {
        const isOpen = compactSearchBar.classList.toggle('open');
        if (isOpen) {
            compactSearchInput.focus();
        } else {
            compactSearchInput.value = '';
            mainSearchInput.value = '';
            mainSearchInput.dispatchEvent(new Event('input'));
        }
    });

    compactSearchInput.addEventListener('input', () => {
        mainSearchInput.value = compactSearchInput.value;
        mainSearchInput.dispatchEvent(new Event('input'));
    });

    filterBtn.addEventListener('click', () => {
        sheetBackdrop.classList.add('open');
        document.body.style.overflow = 'hidden';
    });

    sheetBackdrop.addEventListener('click', e => {
        if (e.target === sheetBackdrop) closeFilterSheet();
    });

    function closeFilterSheet() {
        sheetBackdrop.classList.remove('open');
        document.body.style.overflow = '';
    }

    sheetTabs.addEventListener('click', e => {
        const btn = e.target.closest('.filter-sheet-tab');
        if (!btn) return;
        const tab = btn.dataset.tab;
        sheetTabs.querySelectorAll('.filter-sheet-tab').forEach(b =>
            b.classList.toggle('active', b === btn)
        );
        const mainTab = document.querySelector(`.quick-tab[data-tab="${tab}"]`);
        if (mainTab) mainTab.click();
        closeFilterSheet();
    });

    document.querySelectorAll('.quick-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            if (sheetTabs) {
                sheetTabs.querySelectorAll('.filter-sheet-tab').forEach(b =>
                    b.classList.toggle('active', b.dataset.tab === tab)
                );
            }
        });
    });
}

/* ─── SHARE / EXPORT ─── */
async function shareToWhatsApp(idx) {
    const q   = currentView[idx];
    const btn = event.currentTarget;
    const orig = btn.innerHTML;
    btn.innerHTML = 'Processing…';
    btn.disabled  = true;

    try {
        const stage = document.getElementById('share-canvas-container');

        const qLen = q.quote.length;
        const quoteFontSize   = qLen < 50  ? 72 : qLen < 80  ? 60 : qLen < 120 ? 48 : qLen < 180 ? 38 : 30;
        const authorFontSize  = q.author.length < 15 ? 52 : q.author.length < 25 ? 42 : 34;
        const contribFontSize = q.contributor.length < 12 ? 48 : q.contributor.length < 20 ? 38 : 30;
        const reflFontSize    = q.about && q.about.length < 100 ? 24 : 19;

        const reflectionBlock = q.about ? `
            <div style="background:#1c1a16;padding:28px 40px;flex-shrink:0;">
                <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:4px;text-transform:uppercase;color:#b8913a;margin-bottom:12px;">What this means to me</div>
                <div style="font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:${reflFontSize}px;line-height:1.45;color:#f5f0e8;">"${q.about}"</div>
            </div>` : '';

        stage.innerHTML = `
            <div id="poster-export" style="width:540px;height:960px;background:#f5f0e8;display:flex;flex-direction:column;overflow:hidden;position:relative;font-family:'Cormorant Garamond',Georgia,serif;">
                <div style="position:absolute;top:-30px;left:-10px;font-size:500px;line-height:1;color:rgba(184,145,58,0.07);font-style:italic;pointer-events:none;z-index:0;">"</div>
                <div style="background:#1c1a16;padding:16px 32px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;z-index:1;">
                    <div style="font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:22px;color:#b8913a;">A Quote A Day</div>
                    <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:rgba(184,145,58,0.5);">SRM VEC · No.${q.id}</div>
                </div>
                <div style="height:5px;background:linear-gradient(to right,#6b3f10,#b8913a,#e8c97a,#b8913a,#6b3f10);flex-shrink:0;z-index:1;"></div>
                <div style="flex:1;padding:32px 36px 24px;display:flex;flex-direction:column;justify-content:center;z-index:1;overflow:hidden;">
                    <div style="font-size:${quoteFontSize}px;font-style:italic;font-weight:600;line-height:1.2;color:#1c1a16;letter-spacing:-0.5px;margin-bottom:28px;">"${q.quote}"</div>
                    <div style="border-top:2px solid #b8913a;padding-top:20px;display:flex;flex-direction:column;gap:4px;">
                        <div style="font-size:${authorFontSize}px;font-weight:700;line-height:1.05;color:#1c1a16;letter-spacing:-0.5px;">${q.author}</div>
                        <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#b8913a;margin-top:4px;">Quoted Author</div>
                    </div>
                </div>
                <div style="background:#b8913a;padding:20px 36px;flex-shrink:0;z-index:1;">
                    <div style="font-family:'DM Mono',monospace;font-size:8px;letter-spacing:4px;text-transform:uppercase;color:rgba(28,26,22,0.6);margin-bottom:6px;">Shared by</div>
                    <div style="font-size:${contribFontSize}px;font-weight:700;font-style:italic;line-height:1.05;color:#1c1a16;letter-spacing:-0.5px;">${q.contributor}</div>
                    <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(28,26,22,0.55);margin-top:5px;">${q.department}</div>
                </div>
                ${reflectionBlock}
                <div style="background:#1c1a16;padding:12px 32px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;z-index:1;">
                    <div style="font-family:'DM Mono',monospace;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:rgba(184,145,58,0.45);">andrewveda.github.io/a-quote-a-day</div>
                    <div style="font-family:'DM Mono',monospace;font-size:8px;letter-spacing:1px;color:rgba(184,145,58,0.3);">${q.dateStr}</div>
                </div>
            </div>`;

        const canvas = await html2canvas(document.getElementById('poster-export'), { scale: 2, useCORS: true });
        const blob   = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.92));
        const file   = new File([blob], `Quote-${q.id}.jpg`, { type: 'image/jpeg' });

        const shareUrl  = `https://andrewveda.github.io/a-quote-a-day/?id=${q.id}`;
        const shareText = `Check out this reflection by ${q.contributor.toUpperCase()} on SRM VEC English Archive.\n\n🔗 ${shareUrl}`;

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], text: shareText });
        } else {
            const link  = document.createElement('a');
            link.href   = canvas.toDataURL();
            link.download = `Quote-${q.id}.jpg`;
            link.click();
        }
    } catch (e) {
        if (e.name !== 'AbortError') console.error('Share error:', e);
    }

    btn.innerHTML = orig;
    btn.disabled  = false;
}

// ==========================================
// EXPORT FULL DATE TO HTML & PDF
// ==========================================

// Build the raw HTML string using data from DB directly
function generateDateTemplate(dateString) {
    const dateQuotes = DB.filter(q => q.dateStr === dateString);
    if (dateQuotes.length === 0) return null;

    let quotesHtml = '';
    dateQuotes.forEach(q => {
        const reflection = q.about ? `
            <div style="background:#1c1a16; color:#f5f0e8; padding:1.5rem; margin-top:1.5rem; border-left: 3px solid #b8913a;">
                <div style="font-family:'DM Mono',monospace; font-size:10px; color:#b8913a; text-transform:uppercase; letter-spacing:2px; margin-bottom:0.5rem;">What this means to me</div>
                <div style="font-style:italic;">"${q.about}"</div>
            </div>
        ` : '';

        quotesHtml += `
            <div style="margin-bottom:3rem; page-break-inside:avoid;">
                <div style="font-family:'DM Mono',monospace; font-size:12px; color:#b8913a; text-transform:uppercase; letter-spacing:2px; margin-bottom:1rem;">Quote #${q.id}</div>
                <div style="font-size:24px; font-weight:600; font-style:italic; line-height:1.4; color:#1c1a16; margin-bottom:1.5rem;">"${q.quote}"</div>
                <div>
                    <strong style="font-size:18px;">${q.author}</strong><br>
                    <span style="font-family:'DM Mono',monospace; font-size:11px; text-transform:uppercase; color:#6b3f10; letter-spacing:1px;">Contributed by ${q.contributor} &bull; ${q.department}</span>
                </div>
                ${reflection}
            </div>
            <hr style="border:0; border-top:1px dashed #d3cec4; margin:3rem 0;">
        `;
    });

    return `
        <div style="background:#fff; padding:4rem; max-width:800px; margin:0 auto; font-family:'Cormorant Garamond',Georgia,serif; color:#1c1a16; box-shadow:0 10px 30px rgba(0,0,0,0.05);">
            <div style="text-align:center; border-bottom:2px solid #b8913a; padding-bottom:1rem; margin-bottom:3rem;">
                <h1 style="margin:0; font-style:italic; font-size:36px;">A Quote A Day</h1>
                <div style="font-family:'DM Mono',monospace; font-size:12px; text-transform:uppercase; letter-spacing:3px; color:#6b3f10; margin-top:0.5rem;">Edition: ${dateString}</div>
            </div>
            ${quotesHtml}
            <div style="text-align:center; font-family:'DM Mono',monospace; font-size:10px; text-transform:uppercase; letter-spacing:2px; color:#888;">
                andrewveda.github.io/a-quote-a-day
            </div>
        </div>
    `;
}

function downloadDateAsHTML(dateString) {
    const bodyHtml = generateDateTemplate(dateString);
    if (!bodyHtml) return alert('No quotes found for this date.');

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Quotes - ${dateString}</title>
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400;1,600&family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet">
        <style>
            body { background-color:#f5f0e8; padding:3rem 1rem; margin:0; }
        </style>
    </head>
    <body>
        ${bodyHtml}
    </body>
    </html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Quotes_${dateString}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function downloadDateAsPDF(dateString) {
    const bodyHtml = generateDateTemplate(dateString);
    if (!bodyHtml) return alert('No quotes found for this date.');

    // 1. Create off-screen container matching the HTML structure exactly
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '800px'; 
    container.innerHTML = bodyHtml;
    
    document.body.appendChild(container);

    try {
        // Wait a tiny bit for fonts inside the new DOM node to apply
        await new Promise(r => setTimeout(r, 100));

        const canvas = await html2canvas(container.firstElementChild, {
            scale: 2, 
            useCORS: true,
            backgroundColor: '#f5f0e8'
        });

        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        
        // A4 Paper proportions
        const pdf = new jsPDF('p', 'pt', 'a4'); 
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Quotes_${dateString}.pdf`);
        
    } catch (error) {
        console.error("PDF Generation failed:", error);
        alert("Failed to generate PDF.");
    } finally {
        document.body.removeChild(container);
    }
}

// ─── EVENT LISTENERS ─────────────────────────

document.getElementById('btnDownloadHtml').addEventListener('click', () => {
    // Identify the date of the quote currently open in the deck
    const currentQuote = currentView[deckIdx];
    if (currentQuote) {
        downloadDateAsHTML(currentQuote.dateStr);
    }
});

document.getElementById('btnDownloadPdf').addEventListener('click', () => {
    // Identify the date of the quote currently open in the deck
    const currentQuote = currentView[deckIdx];
    if (currentQuote) {
        downloadDateAsPDF(currentQuote.dateStr);
    }
});
