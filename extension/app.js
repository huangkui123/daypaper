'use strict';

const $ = (id) => document.getElementById(id);
const IS_EXT = typeof chrome !== 'undefined' && !!(chrome.storage && chrome.storage.local);
const HAS_IDENTITY = IS_EXT && !!chrome.identity;
const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

/* ---------- storage (chrome.storage in the extension, localStorage when previewed as a file) ---------- */
const store = {
  async get(key, dflt) {
    if (IS_EXT) {
      const r = await chrome.storage.local.get(key);
      return r[key] === undefined ? dflt : r[key];
    }
    try { const v = localStorage.getItem(key); return v == null ? dflt : JSON.parse(v); } catch { return dflt; }
  },
  async set(key, val) {
    if (IS_EXT) return chrome.storage.local.set({ [key]: val });
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  },
  async remove(keys) {
    if (IS_EXT) return chrome.storage.local.remove(keys);
    try { [].concat(keys).forEach((k) => localStorage.removeItem(k)); } catch {}
  },
};

/* ---------- settings ---------- */
let settings = { lang: 'auto', week: 'auto', clientId: '' };
function weekStart() {
  if (settings.week === '0' || settings.week === '1') return Number(settings.week);
  return LANG === 'zh' ? 1 : 0;
}

/* ---------- date helpers ---------- */
const pad2 = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fmt = (d, opts) => new Intl.DateTimeFormat(intlLocale(), opts).format(d);
const fmtTime = (d) => (LANG === 'zh'
  ? fmt(d, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  : fmt(d, { hour: 'numeric', minute: '2-digit' }));
const fmtMonthDay = (d) => fmt(d, { month: 'long', day: 'numeric' });
const fmtShortDay = (d) => fmt(d, { month: 'short', day: 'numeric' });
const fmtWeekday = (d, style = 'long') => fmt(d, { weekday: style });

function dayOfYear(d) { return Math.round((startOfDay(d) - new Date(d.getFullYear(), 0, 1)) / 864e5) + 1; }
function isoWeek(d) {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return Math.ceil(((x - y0) / 864e5 + 1) / 7);
}
function relLabel(d) {
  const diff = Math.round((startOfDay(d) - startOfDay(new Date())) / 864e5);
  return diff === 0 ? t('today') : diff === 1 ? t('tomorrow') : diff === -1 ? t('yesterday') : '';
}

/* ---------- header ---------- */
let lastDay = '';
function renderHeader() {
  const now = new Date();
  $('d-md').textContent = fmtMonthDay(now);
  $('d-week').textContent = fmtWeekday(now);
  $('d-sub').textContent = t('subline', { y: now.getFullYear(), w: isoWeek(now), d: dayOfYear(now) });
  $('clock').textContent = fmtTime(now);
}
function tick() {
  const now = new Date();
  $('clock').textContent = fmtTime(now);
  const key = ymd(now);
  if (key !== lastDay) {
    const first = lastDay === '';
    lastDay = key;
    renderHeader();
    if (!first) { cal.selected = key; cal.view = new Date(now.getFullYear(), now.getMonth(), 1); renderCal(); }
  } else {
    renderAgenda();
  }
}

/* ---------- scratchpad ---------- */
const padEl = $('pad');
let padTimer = null;
async function initPad() {
  padEl.value = await store.get('pad', '');
  updatePadStatus();
  padEl.addEventListener('input', () => {
    $('pad-status').textContent = '…';
    clearTimeout(padTimer);
    padTimer = setTimeout(async () => { await store.set('pad', padEl.value); updatePadStatus(true); }, 350);
  });
  padEl.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      padEl.setRangeText('  ', padEl.selectionStart, padEl.selectionEnd, 'end');
      padEl.dispatchEvent(new Event('input'));
    }
  });
}
function updatePadStatus(saved) {
  const n = LANG === 'zh' ? padEl.value.replace(/\s/g, '').length : padEl.value.length;
  const parts = [];
  if (n) parts.push(t('chars', { n }));
  if (saved) parts.push(t('saved'));
  $('pad-status').textContent = parts.join(' · ');
}

/* ---------- to-do ---------- */
let todos = [];
async function initTodo() {
  todos = await store.get('todos', []);
  renderTodos();
  $('todo-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('todo-input').value.trim();
    if (!v) return;
    todos.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text: v, done: false });
    $('todo-input').value = '';
    saveTodos();
  });
  $('todo-clear').addEventListener('click', () => { todos = todos.filter((x) => !x.done); saveTodos(); });
}
function saveTodos() { store.set('todos', todos); renderTodos(); }
function renderTodos() {
  const list = $('todo-list');
  list.textContent = '';
  const ordered = [...todos.filter((x) => !x.done), ...todos.filter((x) => x.done)];
  if (!ordered.length) {
    const li = document.createElement('li');
    li.className = 'todo-empty';
    li.textContent = t('emptyTodo');
    list.appendChild(li);
  }
  for (const item of ordered) {
    const li = document.createElement('li');
    li.className = 'todo-item' + (item.done ? ' done' : '');
    const chk = document.createElement('button');
    chk.className = 'check';
    chk.setAttribute('aria-label', item.done ? t('markUndone') : t('markDone'));
    chk.onclick = () => { item.done = !item.done; saveTodos(); };
    const txt = document.createElement('div');
    txt.className = 'todo-text';
    txt.textContent = item.text;
    txt.title = t('editHint');
    txt.ondblclick = () => {
      txt.contentEditable = 'true';
      txt.focus();
      document.getSelection().selectAllChildren(txt);
    };
    const finish = (commit) => {
      if (txt.contentEditable !== 'true') return;
      txt.contentEditable = 'false';
      const v = txt.textContent.trim();
      if (commit && v) item.text = v;
      else if (commit && !v) todos = todos.filter((x) => x !== item);
      saveTodos();
    };
    txt.onkeydown = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      if (e.key === 'Escape') finish(false);
    };
    txt.onblur = () => finish(true);
    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '×';
    del.setAttribute('aria-label', t('del'));
    del.onclick = () => { todos = todos.filter((x) => x !== item); saveTodos(); };
    li.append(chk, txt, del);
    list.appendChild(li);
  }
  const open = todos.filter((x) => !x.done).length;
  $('todo-count').textContent = todos.length ? t('remaining', { n: open }) : '';
  $('todo-clear').hidden = todos.length === open;
}

/* ---------- calendar ---------- */
const now0 = new Date();
const cal = {
  view: new Date(now0.getFullYear(), now0.getMonth(), 1),
  selected: ymd(now0),
  events: [],
  byDay: new Map(),
  connected: false,
  account: '',
  error: '',
};

function gridStart(view) {
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  return addDays(first, -((first.getDay() - weekStart() + 7) % 7));
}

function indexEvents() {
  cal.byDay = new Map();
  for (const ev of cal.events) {
    let d = startOfDay(new Date(ev.start));
    const last = new Date(new Date(ev.end).getTime() - 1);
    for (let i = 0; d <= last && i < 62; i++) {
      const k = ymd(d);
      if (!cal.byDay.has(k)) cal.byDay.set(k, []);
      cal.byDay.get(k).push(ev);
      d = addDays(d, 1);
    }
  }
  for (const arr of cal.byDay.values()) {
    arr.sort((a, b) => (b.allDay - a.allDay) || (new Date(a.start) - new Date(b.start)));
  }
}

function renderWeekdays() {
  const wd = $('weekdays');
  wd.textContent = '';
  const base = new Date(2024, 0, 7 + weekStart()); // 2024-01-07 is a Sunday
  for (let i = 0; i < 7; i++) {
    const s = document.createElement('span');
    s.textContent = fmtWeekday(addDays(base, i), 'narrow');
    wd.appendChild(s);
  }
}

function renderCal() {
  const v = cal.view;
  $('cal-title').textContent = fmt(v, { year: 'numeric', month: 'long' });
  renderWeekdays();
  const start = gridStart(v);
  const days = $('days');
  days.textContent = '';
  const tkey = ymd(new Date());
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i);
    const k = ymd(d);
    const b = document.createElement('button');
    b.className = 'day';
    if (d.getMonth() !== v.getMonth()) b.classList.add('other');
    if (k === tkey) b.classList.add('today');
    if (k === cal.selected) b.classList.add('selected');
    if (cal.byDay.has(k)) b.classList.add('has');
    const n = document.createElement('span');
    n.textContent = d.getDate();
    b.appendChild(n);
    const cnt = (cal.byDay.get(k) || []).length;
    b.title = fmtShortDay(d) + (cnt ? ' · ' + t('eventsCount', { n: cnt }) : '');
    b.onclick = () => {
      cal.selected = k;
      if (d.getMonth() !== v.getMonth()) { cal.view = new Date(d.getFullYear(), d.getMonth(), 1); loadEvents(); }
      renderCal();
    };
    days.appendChild(b);
  }
  renderAgenda();
}

function eventItem(ev, dayKey, now) {
  const li = document.createElement('li');
  const a = document.createElement('a');
  a.href = ev.link || 'https://calendar.google.com/calendar/r';
  a.target = '_blank';
  a.rel = 'noopener';
  const s = new Date(ev.start), e = new Date(ev.end);
  if (e <= now) li.className = 'ev-past';
  else if (s <= now && !ev.allDay) li.className = 'ev-now';
  const time = document.createElement('div');
  time.className = 'ev-time';
  if (ev.allDay) time.textContent = t('allDay');
  else if (ymd(s) !== dayKey) time.textContent = ymd(e) === dayKey ? t('until', { t: fmtTime(e) }) : t('allDay');
  else { time.append(fmtTime(s), document.createElement('br'), fmtTime(e)); }
  const bar = document.createElement('div');
  bar.className = 'ev-bar';
  if (ev.color) bar.style.background = ev.color;
  const body = document.createElement('div');
  const title = document.createElement('div');
  title.className = 'ev-title';
  title.textContent = ev.title || t('untitled');
  body.appendChild(title);
  if (ev.location) {
    const m = document.createElement('div');
    m.className = 'ev-meta';
    m.textContent = ev.location;
    body.appendChild(m);
  }
  a.append(time, bar, body);
  li.appendChild(a);
  return li;
}

function emptyLi(text) {
  const li = document.createElement('li');
  li.className = 'empty';
  li.textContent = text;
  return li;
}

function renderAgenda() {
  const now = new Date();
  const sel = parseYmd(cal.selected);
  const rel = relLabel(sel);
  $('agenda-title').textContent = `${rel ? rel + ' · ' : ''}${fmtMonthDay(sel)} ${fmtWeekday(sel, 'short')}`;
  $('cal-open').href = `https://calendar.google.com/calendar/r/day/${sel.getFullYear()}/${sel.getMonth() + 1}/${sel.getDate()}`;

  const dayList = $('agenda-day');
  const nextList = $('agenda-next');
  dayList.textContent = '';
  nextList.textContent = '';

  const showConnect = !cal.connected;
  $('cal-connect').hidden = !showConnect;
  $('upcoming-title').hidden = showConnect;
  if (showConnect) {
    const hasClient = !!settings.clientId;
    $('cal-connect-hint').textContent = hasClient ? t('connectHint') : t('needClientId');
    $('cal-connect-btn').textContent = hasClient ? t('connect') : t('openSettings');
    $('cal-err').textContent = cal.error;
    return;
  }

  const evs = cal.byDay.get(cal.selected) || [];
  if (!evs.length) dayList.appendChild(emptyLi(t('noEvents')));
  else for (const ev of evs) dayList.appendChild(eventItem(ev, cal.selected, now));

  let shown = 0;
  for (let i = 1; i <= 7 && shown < 8; i++) {
    const d = addDays(sel, i);
    const k = ymd(d);
    const list = (cal.byDay.get(k) || []).filter((ev) => ymd(new Date(ev.start)) === k);
    if (!list.length) continue;
    const head = document.createElement('li');
    head.className = 'ev-day';
    head.textContent = `${relLabel(d) || fmtMonthDay(d)} ${fmtWeekday(d, 'short')}`;
    nextList.appendChild(head);
    for (const ev of list) { if (shown++ >= 8) break; nextList.appendChild(eventItem(ev, k, now)); }
  }
  if (!nextList.children.length) nextList.appendChild(emptyLi(t('noUpcoming')));
}

/* ---------- Google sign-in (OAuth implicit flow via chrome.identity.launchWebAuthFlow) ---------- */
function redirectUri() {
  return HAS_IDENTITY ? chrome.identity.getRedirectURL() : 'https://<extension-id>.chromiumapp.org/';
}

class CalError extends Error { constructor(code, msg) { super(msg || code); this.code = code; } }

async function authorize(interactive) {
  if (!settings.clientId) throw new CalError('noClient');
  const p = new URLSearchParams({
    client_id: settings.clientId,
    response_type: 'token',
    redirect_uri: redirectUri(),
    scope: SCOPE,
    include_granted_scopes: 'true',
  });
  const hint = await store.get('account', '');
  if (hint) p.set('login_hint', hint);
  if (!interactive) p.set('prompt', 'none');
  let url;
  try {
    url = await chrome.identity.launchWebAuthFlow({
      url: 'https://accounts.google.com/o/oauth2/v2/auth?' + p.toString(),
      interactive,
    });
  } catch (e) {
    const m = String(e && e.message || e);
    if (/did not approve|cancel|closed/i.test(m)) throw new CalError('cancelled', m);
    throw new CalError('auth', m);
  }
  const frag = new URLSearchParams((new URL(url).hash || '').slice(1));
  const err = frag.get('error');
  if (err) throw new CalError(err === 'access_denied' ? 'denied' : 'auth', err);
  const token = frag.get('access_token');
  if (!token) throw new CalError('auth', 'no token');
  const granted = frag.get('scope') || '';
  if (granted && !granted.split(' ').includes(SCOPE)) throw new CalError('scope');
  const ttl = Number(frag.get('expires_in')) || 3600;
  await store.set('auth', { token, exp: Date.now() + (ttl - 60) * 1000 });
  return token;
}

async function getToken(interactive) {
  const a = await store.get('auth', null);
  if (a && a.token && a.exp > Date.now()) return a.token;
  return authorize(interactive);
}

async function api(path, token) {
  const res = await fetch('https://www.googleapis.com/calendar/v3' + path, { headers: { Authorization: 'Bearer ' + token } });
  if (res.status === 401) throw new CalError('expired');
  if (!res.ok) {
    let reason = '';
    try { const j = await res.json(); reason = (j.error && (j.error.message || j.error.status)) || ''; } catch {}
    if (res.status === 403 && /has not been used|is disabled|SERVICE_DISABLED|accessNotConfigured/i.test(reason)) throw new CalError('apiDisabled');
    if (res.status === 403 && /insufficient|scope/i.test(reason)) throw new CalError('scope');
    throw new CalError('http', t('errHttp', { s: res.status }) + (reason ? ' · ' + reason : ''));
  }
  return res.json();
}

async function fetchRange(token, start, end) {
  const cl = await api('/users/me/calendarList?minAccessRole=reader&maxResults=100', token);
  const items = cl.items || [];
  const primary = items.find((c) => c.primary);
  if (primary) { cal.account = primary.id; store.set('account', primary.id); }
  const cals = items.filter((c) => c.selected && !c.hidden);
  const q = `timeMin=${encodeURIComponent(start.toISOString())}&timeMax=${encodeURIComponent(end.toISOString())}&singleEvents=true&orderBy=startTime&maxResults=250`;
  const results = await Promise.all(cals.map((c) =>
    api(`/calendars/${encodeURIComponent(c.id)}/events?${q}`, token)
      .then((r) => ({ c, items: r.items || [] }))
      .catch(() => ({ c, items: [] }))
  ));
  const out = [];
  for (const { c, items: evs } of results) {
    for (const it of evs) {
      if (it.status === 'cancelled') continue;
      const me = (it.attendees || []).find((a) => a.self);
      if (me && me.responseStatus === 'declined') continue;
      const allDay = !!(it.start && it.start.date);
      const s = allDay ? parseYmd(it.start.date) : new Date(it.start.dateTime);
      const e = allDay ? parseYmd(it.end.date) : new Date(it.end.dateTime);
      out.push({
        id: c.id + '/' + it.id,
        title: it.summary || '',
        start: s.toISOString(),
        end: e.toISOString(),
        allDay,
        color: c.backgroundColor || '',
        link: it.htmlLink || '',
        location: it.location || '',
      });
    }
  }
  return out;
}

function errText(e) {
  switch (e && e.code) {
    case 'apiDisabled': return t('errApiDisabled');
    case 'scope': return t('errScope');
    case 'denied': return t('errAccessDenied');
    case 'cancelled': return t('errCancelled');
    case 'http': return t('errPrefix', { m: e.message });
    default: {
      const m = String(e && e.message || e);
      if (/redirect_uri_mismatch/i.test(m)) return t('errRedirect');
      if (/invalid_client|unauthorized_client/i.test(m)) return t('errClient');
      return t('errPrefix', { m });
    }
  }
}

let loading = false;
async function loadEvents(interactive = false) {
  if (!HAS_IDENTITY) { loadDemo(); return; }
  if (!settings.clientId) { cal.connected = false; renderCal(); return; }
  if (loading) return;
  loading = true;
  const start = gridStart(cal.view);
  const end = new Date(Math.max(addDays(start, 42), addDays(parseYmd(cal.selected), 9), addDays(new Date(), 9)));
  try {
    let evs;
    try {
      evs = await fetchRange(await getToken(interactive), start, end);
    } catch (e) {
      if (e.code !== 'expired') throw e;
      await store.remove('auth');
      evs = await fetchRange(await getToken(interactive), start, end);
    }
    cal.events = evs;
    cal.connected = true;
    cal.error = '';
    indexEvents();
    await store.set('calCache', { at: Date.now(), events: evs });
  } catch (e) {
    // A silent refresh that fails keeps whatever is cached. Only surface errors the user asked for.
    if (interactive) { cal.error = errText(e); cal.connected = false; }
    else if (!cal.events.length) cal.connected = false;
  } finally {
    loading = false;
    renderCal();
    renderAuthStatus();
  }
}

async function disconnect() {
  const a = await store.get('auth', null);
  if (a && a.token) {
    try { await fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(a.token), { method: 'POST' }); } catch {}
  }
  await store.remove(['auth', 'calCache', 'account']);
  cal.events = [];
  cal.account = '';
  cal.connected = false;
  cal.error = '';
  indexEvents();
  renderCal();
  renderAuthStatus();
}

/* Preview with sample data when newtab.html is opened directly in a browser. */
function loadDemo() {
  const d0 = startOfDay(new Date());
  const at = (dd, h, m) => new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + dd, h, m);
  const zh = LANG === 'zh';
  const mk = (title, s, e, color, location, allDay = false) =>
    ({ id: title + s, title, start: s.toISOString(), end: e.toISOString(), allDay, color, link: '', location: location || '' });
  cal.events = [
    mk(zh ? '周会' : 'Team sync', at(0, 10, 0), at(0, 11, 0), '#4f7cac', zh ? '3 楼会议室' : 'Room 3B'),
    mk(zh ? '专注写作' : 'Deep work: writing', at(0, 14, 0), at(0, 16, 0), '#7a9e7e'),
    mk(zh ? '交报告' : 'Report due', at(1, 0, 0), at(2, 0, 0), '#c0553b', '', true),
    mk(zh ? '午饭 · 小林' : 'Lunch with Sam', at(2, 12, 30), at(2, 13, 30), '#b08a3e'),
    mk(zh ? '牙医' : 'Dentist', at(3, 9, 30), at(3, 10, 15), '#8e7cc3'),
    mk(zh ? '读书会' : 'Book club', at(5, 19, 0), at(5, 20, 30), '#4f7cac'),
  ];
  cal.connected = true;
  cal.account = 'you@example.com';
  indexEvents();
  renderCal();
  renderAuthStatus();
}

async function initCal() {
  $('cal-prev').onclick = () => { cal.view = new Date(cal.view.getFullYear(), cal.view.getMonth() - 1, 1); renderCal(); loadEvents(); };
  $('cal-next').onclick = () => { cal.view = new Date(cal.view.getFullYear(), cal.view.getMonth() + 1, 1); renderCal(); loadEvents(); };
  $('cal-today').onclick = () => { const n = new Date(); cal.view = new Date(n.getFullYear(), n.getMonth(), 1); cal.selected = ymd(n); renderCal(); loadEvents(); };
  $('cal-connect-btn').onclick = () => { if (settings.clientId) loadEvents(true); else openSettings(); };

  if (HAS_IDENTITY && settings.clientId) {
    const cache = await store.get('calCache', null);
    cal.account = await store.get('account', '');
    if (cache && cache.events) { cal.events = cache.events; cal.connected = true; indexEvents(); }
  }
  renderCal();
  loadEvents(false);
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible' || !HAS_IDENTITY) return;
    const cache = await store.get('calCache', null);
    if (!cache || Date.now() - cache.at > 3 * 60 * 1000) loadEvents(false);
  });
}

/* ---------- settings dialog ---------- */
function renderAuthStatus() {
  const ok = cal.connected && (HAS_IDENTITY ? !!settings.clientId : true);
  $('auth-status').textContent = ok ? (cal.account ? t('connectedAs', { who: cal.account }) : t('connectedPlain')) : t('notConnected');
  $('auth-dot').classList.toggle('on', ok);
  $('disconnect').hidden = !ok || !HAS_IDENTITY;
}

function openSettings() {
  $('set-lang').value = settings.lang;
  $('set-week').value = settings.week;
  $('set-client').value = settings.clientId;
  $('redirect-uri').textContent = redirectUri();
  $('guide-link').href = GUIDE_URL[LANG];
  $('copy-redirect').textContent = t('copy');
  renderAuthStatus();
  $('settings').showModal();
}

function initSettings() {
  $('settings-btn').onclick = openSettings;
  $('settings-cancel').onclick = () => $('settings').close();
  $('copy-redirect').onclick = async () => {
    try { await navigator.clipboard.writeText(redirectUri()); } catch {}
    $('copy-redirect').textContent = t('copied');
    setTimeout(() => { $('copy-redirect').textContent = t('copy'); }, 1500);
  };
  $('disconnect').onclick = disconnect;
  $('settings-form').addEventListener('submit', async () => {
    const prevClient = settings.clientId;
    settings = {
      lang: $('set-lang').value,
      week: $('set-week').value,
      clientId: $('set-client').value.trim(),
    };
    await store.set('settings', settings);
    applyLanguage();
    if (settings.clientId !== prevClient) {
      await store.remove(['auth', 'calCache']);
      cal.events = []; cal.connected = false; cal.error = '';
      indexEvents();
      if (settings.clientId) loadEvents(true);
    }
    renderCal();
  });
}

function applyLanguage() {
  LANG = resolveLang(settings.lang);
  applyI18n();
  renderHeader();
  renderTodos();
  updatePadStatus();
  renderCal();
}

/* ---------- keep open tabs in sync ---------- */
if (IS_EXT && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.todos) { todos = changes.todos.newValue || []; renderTodos(); }
    if (changes.pad && document.activeElement !== padEl) { padEl.value = changes.pad.newValue || ''; updatePadStatus(); }
    if (changes.settings && changes.settings.newValue) { settings = changes.settings.newValue; applyLanguage(); }
  });
}

/* ---------- start ---------- */
(async function start() {
  settings = Object.assign(settings, await store.get('settings', {}));
  LANG = resolveLang(settings.lang);
  applyI18n();
  tick();
  setInterval(tick, 15 * 1000);
  initSettings();
  await Promise.all([initPad(), initTodo()]);
  await initCal();
})();
