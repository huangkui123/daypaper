'use strict';

/* UI strings. {x} placeholders are filled by t(key, {x: ...}). */
const I18N = {
  en: {
    todo: 'To-do',
    addTodo: 'Add a task, press Enter',
    remaining: '{n} left',
    clearDone: 'Clear completed',
    emptyTodo: 'Nothing to do. Enjoy the day.',
    editHint: 'Double-click to edit',
    del: 'Delete',
    markDone: 'Mark as done',
    markUndone: 'Mark as not done',
    scratch: 'Scratchpad',
    scratchPh: 'Jot something down…',
    chars: '{n} chars',
    saved: 'saved',
    today: 'Today',
    tomorrow: 'Tomorrow',
    yesterday: 'Yesterday',
    prevMonth: 'Previous month',
    nextMonth: 'Next month',
    openCal: 'Open calendar ↗',
    upcoming: 'Coming up',
    noEvents: 'No events',
    noUpcoming: 'Nothing in the next week',
    allDay: 'All day',
    until: 'until {t}',
    untitled: '(No title)',
    eventsCount: '{n} events',
    connectHint: 'Connect Google Calendar to see your schedule here.',
    connect: 'Connect Google Calendar',
    needClientId: 'Add your Google OAuth client ID in Settings first.',
    openSettings: 'Open settings',
    subline: '{y} · Week {w} · Day {d}',
    settings: 'Settings',
    language: 'Language',
    langAuto: 'Follow browser',
    weekStart: 'Week starts on',
    weekAuto: 'Follow language',
    monday: 'Monday',
    sunday: 'Sunday',
    calendar: 'Google Calendar',
    clientId: 'OAuth client ID',
    clientIdPh: 'xxxx.apps.googleusercontent.com',
    redirect: 'Authorized redirect URI',
    redirectHint: 'Paste this into your OAuth client in Google Cloud.',
    copy: 'Copy',
    copied: 'Copied',
    guide: 'Setup guide ↗',
    status: 'Status',
    connectedAs: 'Connected · {who}',
    connectedPlain: 'Connected',
    notConnected: 'Not connected',
    disconnect: 'Disconnect',
    save: 'Save',
    cancel: 'Cancel',
    errPrefix: 'Could not connect: {m}',
    errApiDisabled: 'Google Calendar API is not enabled in your Cloud project (APIs & Services → Library → Google Calendar API → Enable).',
    errScope: 'Calendar access was not granted. Disconnect, then connect again and tick the calendar permission.',
    errAccessDenied: 'Access denied. If your OAuth app is in Testing, add your Google account as a test user, or publish the app.',
    errRedirect: 'Redirect URI mismatch. Copy the redirect URI from Settings into your OAuth client.',
    errClient: 'Invalid client ID. Check that it was copied correctly and that the client type is "Web application".',
    errCancelled: 'Authorization was cancelled.',
    errHttp: 'Google Calendar returned {s}',
  },
  zh: {
    todo: '待办',
    addTodo: '添加一项，回车确认',
    remaining: '{n} 项未完成',
    clearDone: '清除已完成',
    emptyTodo: '今天没有待办，轻松一点。',
    editHint: '双击编辑',
    del: '删除',
    markDone: '标记为完成',
    markUndone: '标记为未完成',
    scratch: '草稿纸',
    scratchPh: '随手记点什么…',
    chars: '{n} 字',
    saved: '已保存',
    today: '今天',
    tomorrow: '明天',
    yesterday: '昨天',
    prevMonth: '上个月',
    nextMonth: '下个月',
    openCal: '打开日历 ↗',
    upcoming: '接下来',
    noEvents: '没有日程',
    noUpcoming: '之后一周没有安排',
    allDay: '全天',
    until: '至 {t}',
    untitled: '（无标题）',
    eventsCount: '{n} 个日程',
    connectHint: '连接 Google 日历后，这里会显示你的日程。',
    connect: '连接 Google 日历',
    needClientId: '请先在设置里填入你的 Google OAuth 客户端 ID。',
    openSettings: '打开设置',
    subline: '{y} 年 · 第 {w} 周 · 第 {d} 天',
    settings: '设置',
    language: '语言',
    langAuto: '跟随浏览器',
    weekStart: '每周起始日',
    weekAuto: '跟随语言',
    monday: '周一',
    sunday: '周日',
    calendar: 'Google 日历',
    clientId: 'OAuth 客户端 ID',
    clientIdPh: 'xxxx.apps.googleusercontent.com',
    redirect: '已获授权的重定向 URI',
    redirectHint: '把它粘贴到 Google Cloud 里你的 OAuth 客户端设置中。',
    copy: '复制',
    copied: '已复制',
    guide: '配置指南 ↗',
    status: '状态',
    connectedAs: '已连接 · {who}',
    connectedPlain: '已连接',
    notConnected: '未连接',
    disconnect: '断开连接',
    save: '保存',
    cancel: '取消',
    errPrefix: '连接失败：{m}',
    errApiDisabled: '你的 Cloud 项目还没启用 Google Calendar API（API 和服务 → 库 → Google Calendar API → 启用）。',
    errScope: '没有获得日历权限。请断开连接后重新连接，并勾选日历权限。',
    errAccessDenied: '访问被拒绝。如果 OAuth 应用处于测试状态，请把你的 Google 账号加为测试用户，或者发布应用。',
    errRedirect: '重定向 URI 不匹配。请把设置里显示的重定向 URI 填到 OAuth 客户端中。',
    errClient: '客户端 ID 无效。请检查是否复制完整，以及客户端类型是否为「Web 应用」。',
    errCancelled: '已取消授权。',
    errHttp: 'Google 日历返回 {s}',
  },
};

const GUIDE_URL = {
  en: 'https://github.com/huangkui123/daypaper#connect-google-calendar',
  zh: 'https://github.com/huangkui123/daypaper/blob/main/README.zh-CN.md#连接-google-日历',
};

let LANG = 'en';

function resolveLang(pref) {
  if (pref === 'en' || pref === 'zh') return pref;
  const nav = (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
  return /^zh/i.test(nav) ? 'zh' : 'en';
}

function t(key, vars) {
  let s = (I18N[LANG] && I18N[LANG][key]) || I18N.en[key] || key;
  if (vars) for (const k in vars) s = s.replace('{' + k + '}', vars[k]);
  return s;
}

function intlLocale() { return LANG === 'zh' ? 'zh-CN' : 'en-US'; }

function applyI18n(root = document) {
  document.documentElement.lang = intlLocale();
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  root.querySelectorAll('[data-i18n-label]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nLabel));
    el.title = t(el.dataset.i18nLabel);
  });
}
