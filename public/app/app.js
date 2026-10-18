/* KAIGO STUDY 過去問アプリ（PWA）v1.0
 * 学習記録はこの端末の localStorage に保存。問題データは Cache Storage に保存してオフラインで使う。
 */
(function () {
  'use strict';

  const APP_VERSION = '1.1.0';
  const CFG = Object.assign({ dataUrl: '', staticBase: 'data/', blogUrl: '../' }, window.KAIGO_CONFIG || {});
  const STORE_KEY = 'kaigoPwa.v1';
  const INDEX_KEY = 'kaigoPwa.index';
  const DATA_CACHE = 'kaigo-data-v1';

  const SUBJECTS = ['人間の尊厳と自立', '人間関係とコミュニケーション', '社会の理解', '介護の基本', 'コミュニケーション技術', '生活支援技術', 'こころとからだのしくみ', '発達と老化の理解', '認知症の理解', '障害の理解', '医療的ケア', '介護過程', '総合問題'];
  const PARTS = {
    A: { label: 'Aパート', subjects: ['人間の尊厳と自立', '介護の基本', '社会の理解', '人間関係とコミュニケーション', 'コミュニケーション技術', '生活支援技術'] },
    B: { label: 'Bパート', subjects: ['こころとからだのしくみ', '発達と老化の理解', '認知症の理解', '障害の理解', '医療的ケア'] },
    C: { label: 'Cパート', subjects: ['介護過程', '総合問題'] },
  };
  // 本番の出題数（全125問）
  const EXAM_DIST = { '人間の尊厳と自立': 2, '人間関係とコミュニケーション': 4, '社会の理解': 12, '介護の基本': 10, 'コミュニケーション技術': 6, '生活支援技術': 26, 'こころとからだのしくみ': 12, '発達と老化の理解': 8, '認知症の理解': 10, '障害の理解': 10, '医療的ケア': 5, '介護過程': 8, '総合問題': 12 };
  // 合格基準で使われる科目群（11群）
  const GROUPS = [
    ['人間の尊厳と自立', '介護の基本'], ['人間関係とコミュニケーション', 'コミュニケーション技術'], ['社会の理解'], ['生活支援技術'], ['介護過程'],
    ['こころとからだのしくみ'], ['発達と老化の理解'], ['認知症の理解'], ['障害の理解'], ['医療的ケア'], ['総合問題'],
  ];
  const TYPES = ['過去問', '模擬問題', '実務者研修'];

  // ───────── 小さな道具 ─────────
  const $ = (sel, root) => (root || document).querySelector(sel);
  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (k === 'style') n.style.cssText = v;
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) n.append(kid.nodeType ? kid : String(kid));
    return n;
  }
  const pad = (n) => String(n).padStart(2, '0');
  const dayKey = (t) => { const d = t ? new Date(t) : new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const fmtTime = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? h + ':' + pad(m) + ':' + pad(s % 60) : m + ':' + pad(s % 60); };
  const fmtMin = (sec) => sec >= 3600 ? Math.floor(sec / 3600) + '時間' + Math.round(sec % 3600 / 60) + '分' : Math.round(sec / 60) + '分';
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  let toastTimer;
  function toast(msg, action) {
    const t = $('#toast'); t.replaceChildren(el('span', { text: msg }));
    if (action) t.append(el('button', { type: 'button', text: action.label, onclick: () => { t.hidden = true; action.run(); } }));
    t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, action ? 10000 : 2600);
  }

  // 確認の小さな画面（アプリ内に表示する）
  function ask(msg, okLabel, danger) {
    return new Promise((resolve) => {
      const done = (v) => { bg.remove(); document.removeEventListener('keydown', onKey, true); resolve(v); };
      const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } };
      const ok = el('button', { type: 'button', class: 'btn grow ' + (danger ? 'danger' : 'primary'), onclick: () => done(true) }, okLabel || 'OK');
      const bg = el('div', { class: 'sheet-bg', onclick: (e) => { if (e.target === bg) done(false); } },
        el('div', { class: 'sheet ask', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': '確認' },
          el('p', { style: 'margin:4px 0 16px;white-space:pre-wrap', text: msg }),
          el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn grow', onclick: () => done(false) }, 'キャンセル'), ok)));
      document.addEventListener('keydown', onKey, true);
      document.body.append(bg); ok.focus();
    });
  }

  // ───────── 学習記録（端末内） ─────────
  function blankStore() {
    return { v: 1, q: {}, log: [], days: {}, mocks: [], settings: { shuffle: true, font: 'm', theme: 'auto', goal: 20, sound: false, practiceExplain: true }, session: null, prefs: {}, createdAt: Date.now(), lastBackup: 0 };
  }
  let S = blankStore();
  function loadStore() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) { const o = JSON.parse(raw); S = Object.assign(blankStore(), o); S.settings = Object.assign(blankStore().settings, o.settings || {}); }
    } catch (e) { /* 読めないときは空で始める */ }
  }
  let saveWarned = false;
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); }
    catch (e) { if (!saveWarned) { saveWarned = true; toast('記録を保存できませんでした。設定 → バックアップを書き出してください。'); } }
  }
  function rec(id) { return S.q[id] || (S.q[id] = { a: 0, c: 0 }); }
  function day(k) { return S.days[k] || (S.days[k] = { n: 0, c: 0, sec: 0 }); }
  // 1回の回答を記録する
  function recordAnswer(q, choice, ok, sec, unsure, mode) {
    const t = Date.now(), r = rec(q.id);
    r.s = SUBJECTS.indexOf(q.subject); r.a++; if (ok) r.c++; r.l = ok ? 1 : 0; r.t = t; r.lu = unsure ? 1 : 0; if (unsure) r.u = (r.u || 0) + 1;
    S.log.push([t, q.id, choice, ok ? 1 : 0, Math.round(sec), unsure ? 1 : 0, mode, r.s]);
    if (S.log.length > 30000) S.log.splice(0, S.log.length - 30000);
    const d = day(dayKey(t)); d.n++; if (ok) d.c++;
    return S.log.length - 1;
  }
  // 記録を log から作り直す（バックアップ読み込み後など）
  function rebuildFromLog() {
    const keep = {};
    for (const id in S.q) { const r = S.q[id]; if (r.n || r.st) keep[id] = { a: 0, c: 0, n: r.n, nt: r.nt, st: r.st, s: r.s }; }
    S.q = keep; const secByDay = {};
    for (const k in S.days) secByDay[k] = S.days[k].sec || 0;
    S.days = {};
    S.log.sort((a, b) => a[0] - b[0]);
    for (const e of S.log) {
      const r = rec(e[1]); r.s = e[7]; r.a++; if (e[3]) r.c++; r.l = e[3]; r.t = e[0]; r.lu = e[5]; if (e[5]) r.u = (r.u || 0) + 1;
      const d = day(dayKey(e[0])); d.n++; if (e[3]) d.c++;
    }
    for (const k in secByDay) day(k).sec = Math.max(day(k).sec, secByDay[k]);
  }
  const isReview = (r) => r && r.a > 0 && (r.l === 0 || r.lu === 1);
  function streak() {
    let n = 0; const d = new Date();
    if (!(S.days[dayKey(d)] || {}).n) d.setDate(d.getDate() - 1);
    while ((S.days[dayKey(d)] || {}).n) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  // ───────── 問題データ ─────────
  const DATA = { index: null, bySubject: {}, byId: new Map(), loaded: 0, error: '' };
  const isTheme = (s) => /^T\d{2}$/.test(s || '');
  const themeList = () => (DATA.index && Array.isArray(DATA.index.themes) ? DATA.index.themes : []);
  function themeName(id) { const t = themeList().find((x) => x.id === id); return t ? t.name : id; }
  function themeCategories() { const m = new Map(); for (const t of themeList()) { if (!m.has(t.category)) m.set(t.category, []); m.get(t.category).push(t); } return [...m]; }
  function dataTypes() { const set = new Set(); DATA.byId.forEach((q) => set.add(q.type)); return TYPES.filter((t) => set.has(t)); }
  function dataUrl(file, hash) {
    if (CFG.dataUrl) return CFG.dataUrl + (CFG.dataUrl.includes('?') ? '&' : '?') + 'file=' + file + (hash ? '&v=' + hash : '');
    return CFG.staticBase + (file === 'index' ? 'index.json' : file + '.json') + (hash ? '?v=' + hash : '');
  }
  async function fetchJson(url, ms) {
    const ctl = 'AbortController' in window ? new AbortController() : null;
    const timer = ctl && setTimeout(() => ctl.abort(), ms || 30000);
    try {
      const res = await fetch(url, { signal: ctl && ctl.signal, cache: 'no-store', redirect: 'follow' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text(); const obj = JSON.parse(text);
      if (obj && obj.error) throw new Error(obj.error);
      return { obj, text };
    } finally { if (timer) clearTimeout(timer); }
  }
  async function openCache() { try { return 'caches' in window ? await caches.open(DATA_CACHE) : null; } catch (e) { return null; } }
  async function loadIndex() {
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem(INDEX_KEY) || 'null'); } catch (e) { /* なし */ }
    try {
      const { obj } = await fetchJson(dataUrl('index'), navigator.onLine === false ? 1500 : 8000);
      if (!obj || !Array.isArray(obj.subjects)) throw new Error('データの形式が違います');
      try { localStorage.setItem(INDEX_KEY, JSON.stringify(obj)); } catch (e) { /* 容量 */ }
      return obj;
    } catch (e) {
      if (cached) return cached;
      throw e;
    }
  }
  function cacheKey(meta) { return new URL('__kaigo-data/' + meta.file + '-' + (meta.hash || 'x') + '.json', location.href).href; }
  async function loadSubject(meta, cache) {
    const key = cacheKey(meta);
    if (cache) { try { const hit = await cache.match(key); if (hit) return await hit.json(); } catch (e) { /* 取り直す */ } }
    let got;
    try { got = await fetchJson(dataUrl(meta.file, meta.hash), 60000); }
    catch (e) { // 新しい版を取れないときは、前に保存した版を使う
      if (cache) for (const req of await cache.keys().catch(() => [])) if (req.url.includes('/__kaigo-data/' + meta.file + '-')) { const old = await cache.match(req); if (old) return await old.json(); }
      throw e;
    }
    const { obj, text } = got;
    if (cache) {
      try {
        await cache.put(key, new Response(text, { headers: { 'Content-Type': 'application/json' } }));
        for (const req of await cache.keys()) if (req.url.includes('/__kaigo-data/' + meta.file + '-') && req.url !== key) await cache.delete(req);
      } catch (e) { /* 保存できなくても続ける */ }
    }
    return obj;
  }
  function addSubject(name, payload) {
    const list = (payload.questions || []).map((q) => Object.assign(q, { subject: name }));
    DATA.bySubject[name] = list;
    for (const q of list) DATA.byId.set(q.id, q);
  }
  async function loadAllData(onProgress) {
    DATA.index = await loadIndex();
    const cache = await openCache();
    const metas = DATA.index.subjects.filter((m) => SUBJECTS.includes(m.name));
    let done = 0, failed = [];
    await Promise.all(metas.map(async (m, i) => {
      await new Promise((r) => setTimeout(r, i * 60));
      try { addSubject(m.name, await loadSubject(m, cache)); }
      catch (e) { failed.push(m.name); }
      done++; onProgress && onProgress(done, metas.length);
    }));
    DATA.loaded = metas.length - failed.length;
    if (failed.length === metas.length) throw new Error('問題データを読み込めませんでした。電波のある所でもう一度開いてください。');
    if (failed.length) DATA.error = failed.join('・') + 'を読み込めませんでした（電波のある所で開き直すと読み込みます）。';
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  }

  // ───────── 出題の組み立て ─────────
  function scopeSubjects(scope) {
    if (!scope || scope === 'all' || isTheme(scope)) return SUBJECTS.slice();
    if (PARTS[scope]) return PARTS[scope].subjects.slice();
    return SUBJECTS.includes(scope) ? [scope] : SUBJECTS.slice();
  }
  function pool(opt) {
    let qs = scopeSubjects(opt.scope).flatMap((s) => DATA.bySubject[s] || []);
    if (isTheme(opt.scope)) qs = qs.filter((q) => (q.themes || []).includes(opt.scope));
    if (opt.type && opt.type !== 'all') qs = qs.filter((q) => q.type === opt.type);
    if (opt.round) qs = qs.filter((q) => q.type === '過去問' && q.round === Number(opt.round));
    if (opt.theme) qs = qs.filter((q) => q.theme.includes(opt.theme));
    if (opt.filter === 'new') qs = qs.filter((q) => !(S.q[q.id] && S.q[q.id].a));
    if (opt.filter === 'review') qs = qs.filter((q) => isReview(S.q[q.id]));
    if (opt.filter === 'star') qs = qs.filter((q) => S.q[q.id] && S.q[q.id].st);
    return qs;
  }
  // 事例問題（同じ【事例】の連問）はまとめて扱う
  function caseKey(q) { const i = q.stem.indexOf('【問題】'); return q.stem.includes('【事例】') && i > 0 ? q.subject + '|' + q.stem.slice(0, i) : q.id; }
  function groupCases(qs) { const m = new Map(); for (const q of qs) { const k = caseKey(q); if (!m.has(k)) m.set(k, []); m.get(k).push(q); } return [...m.values()]; }
  function pickWithCases(qs, n, random) {
    const groups = random ? shuffle(groupCases(qs)) : groupCases(qs);
    const out = [];
    for (const g of groups) { if (out.length >= n) break; if (out.length + g.length > n && out.length && random) continue; out.push(...g); }
    if (out.length < n) for (const g of groups) for (const q of g) { if (out.length >= n) break; if (!out.includes(q)) out.push(q); }
    return out.slice(0, n);
  }
  function scaleDist(total) {
    const all = 125, raw = SUBJECTS.map((s) => ({ s, x: EXAM_DIST[s] * total / all }));
    raw.forEach((r) => { r.n = Math.floor(r.x); r.f = r.x - r.n; });
    let left = total - raw.reduce((a, r) => a + r.n, 0);
    raw.slice().sort((a, b) => b.f - a.f).forEach((r) => { if (left > 0) { r.n++; left--; } });
    const o = {}; raw.forEach((r) => { o[r.s] = r.n; }); return o;
  }
  function newSession(kind, questions, extra) {
    const ses = Object.assign({
      id: uid(), kind, ids: questions.map((q) => q.id), i: 0, ans: {}, elim: {}, unsure: {}, order: {},
      startedAt: Date.now(), elapsed: 0, qElapsed: {}, title: '', done: false,
    }, extra || {});
    if (S.settings.shuffle) for (const q of questions) ses.order[q.id] = shuffle([1, 2, 3, 4, 5]);
    S.session = ses; save(); return ses;
  }
  function startPractice(opt, title) {
    let qs = pool(opt);
    if (!qs.length) { toast('条件に合う問題がありません'); return; }
    const n = opt.count === 'all' ? qs.length : Math.min(Number(opt.count) || 10, qs.length);
    qs = opt.order === 'seq' ? qs.slice(0, n) : pickWithCases(qs, n, true);
    newSession('practice', qs, { title: title || practiceTitle(opt), opt });
    go('quiz');
  }
  function practiceTitle(opt) {
    const scope = !opt.scope || opt.scope === 'all' ? '全科目' : PARTS[opt.scope] ? PARTS[opt.scope].label : isTheme(opt.scope) ? themeName(opt.scope) : opt.scope;
    const bits = [scope];
    if (opt.round) bits.push('第' + opt.round + '回'); else if (opt.type && opt.type !== 'all' && dataTypes().length > 1) bits.push(opt.type);
    if (opt.filter === 'review') bits.push('復習'); if (opt.filter === 'new') bits.push('未回答'); if (opt.filter === 'star') bits.push('★');
    return bits.join('・');
  }
  function startMock(size, type) {
    const dist = size === 'full' ? EXAM_DIST : scaleDist(25);
    const minutes = size === 'full' ? 220 : 44;
    const qs = [];
    for (const s of SUBJECTS) {
      let p = (DATA.bySubject[s] || []).filter((q) => type === 'mix' ? q.type !== '実務者研修' : q.type === type);
      if (p.length < dist[s]) p = (DATA.bySubject[s] || []).filter((q) => q.type !== '実務者研修');
      qs.push(...pickWithCases(p, dist[s], true));
    }
    if (!qs.length) { toast('問題がありません'); return; }
    const label = dataTypes().filter((t) => t !== '実務者研修').length > 1 ? '・' + ({ mix: '混合', '過去問': '過去問', '模擬問題': '模擬問題' }[type] || '') : '';
    newSession('mock', qs, { title: (size === 'full' ? '模擬試験（本番形式）' : 'ミニ模試') + label, limit: minutes * 60000, mockSize: size, mockType: type });
    go('quiz');
  }
  function startIds(ids, title) {
    const qs = ids.map((id) => DATA.byId.get(id)).filter(Boolean);
    if (!qs.length) { toast('問題が見つかりませんでした'); return false; }
    newSession('practice', qs, { title: title || '指定の問題' }); go('quiz'); return true;
  }

  // ───────── 画面 ─────────
  const app = () => $('#app');
  let route = 'home';
  let tick = null;
  function go(r, arg) {
    route = r; stopTick(); window.scrollTo(0, 0);
    if (r === 'home') renderHome();
    else if (r === 'stats') renderStats();
    else if (r === 'settings') renderSettings();
    else if (r === 'quiz') renderQuiz();
    else if (r === 'result') renderResult(arg);
  }
  function tabbar(cur) {
    const b = (key, icon, label) => el('button', { type: 'button', 'aria-current': cur === key ? 'page' : null, onclick: () => go(key) }, el('span', { 'aria-hidden': 'true', text: icon }), label);
    return el('nav', { class: 'tabbar', 'aria-label': 'メニュー' }, b('home', '✏️', '問題を解く'), b('stats', '📊', '成績'), b('settings', '⚙️', '設定'));
  }
  function topbar() {
    return el('header', { class: 'topbar' },
      el('a', { class: 'brand', href: './', onclick: (e) => { e.preventDefault(); go('home'); } }, el('img', { src: 'icons/icon.svg', alt: '' }), el('span', null, '過去問演習', el('small', { text: '介護福祉士 過去問でつなぐ合格ノート' }))),
      el('span', { class: 'spacer' }),
      installButton(),
      CFG.blogUrl ? el('a', { class: 'btn ghost small', href: CFG.blogUrl, text: 'ブログ' }) : null);
  }

  // インストール
  let installEvt = null;
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; if (route === 'home') renderHome(); });
  window.addEventListener('appinstalled', () => { installEvt = null; toast('ホーム画面に追加しました'); if (route === 'home') renderHome(); });
  function installButton() {
    if (isStandalone() || !installEvt) return null;
    return el('button', { type: 'button', class: 'btn soft small', onclick: async () => { installEvt.prompt(); await installEvt.userChoice.catch(() => {}); installEvt = null; renderHome(); } }, '📲 追加');
  }
  function installGuide() {
    if (isStandalone() || S.prefs.hideInstall) return null;
    const close = el('button', { type: 'button', class: 'icon-btn', 'aria-label': '閉じる', style: 'float:right;margin:-8px -8px 0 0;font-size:16px', onclick: () => { S.prefs.hideInstall = 1; save(); renderHome(); } }, '✕');
    if (isIOS()) return el('div', { class: 'notice' }, close, el('b', { text: '📲 ホーム画面に追加すると、アプリのように使えます' }),
      el('ol', null, el('li', { text: 'Safari の下にある共有ボタン（□に↑）をタップ' }), el('li', { text: '「ホーム画面に追加」を選ぶ' }), el('li', { text: 'ホーム画面のアイコンから開く（電波がなくても解けます）' })),
      el('p', { class: 'small', style: 'margin:6px 0 0', text: '※iPhoneでは、Safariで解いた記録とホーム画面のアプリの記録は別々に保存されます。追加してからアプリで解くのがおすすめです（記録は設定のバックアップで移せます）。' }));
    if (installEvt) return el('div', { class: 'notice' }, close, el('b', { text: '📲 ホーム画面に追加できます' }), el('p', { style: 'margin:4px 0 8px', text: 'アプリのように開けて、電波がなくても解けます。' }),
      el('button', { type: 'button', class: 'btn primary', onclick: async () => { installEvt.prompt(); await installEvt.userChoice.catch(() => {}); installEvt = null; renderHome(); } }, 'ホーム画面に追加'));
    return null;
  }

  // ── ホーム ──
  function renderHome() {
    const today = S.days[dayKey()] || { n: 0, c: 0, sec: 0 };
    const goal = S.settings.goal || 20;
    const reviewN = Object.keys(S.q).filter((id) => isReview(S.q[id]) && DATA.byId.has(id)).length;
    const p = Object.assign({ by: 'subject', scope: 'all', type: '過去問', round: '', filter: 'all', count: '10', order: 'random' }, S.prefs.practice || {});
    const types = dataTypes();
    if (types.length <= 1) p.type = 'all'; else if (p.type !== 'all' && !types.includes(p.type)) p.type = types[0];
    const hasThemes = themeList().length > 0;
    if (!hasThemes) p.by = 'subject';
    if (p.by === 'theme' && !isTheme(p.scope)) p.scope = themeList()[0].id;
    if (p.by === 'subject' && isTheme(p.scope)) p.scope = 'all';

    const root = el('div', { class: 'shell' }, topbar());
    if (DATA.error) root.append(el('div', { class: 'notice warn', text: DATA.error }));
    root.append(el('p', { class: 'small muted', style: 'margin:4px 0 0', text: '第24〜38回の過去問' + DATA.byId.size + '問。問題文と選択肢は社会福祉振興・試験センターが公表した原文のまま載せています。解説は当サイトが独自に作成したもので、試験センターとは関係ありません。図だけで答える問題（9問）は除いています。' }));
    const guide = installGuide(); if (guide) root.append(guide);

    root.append(el('section', { class: 'card', 'aria-label': '今日の学習' },
      el('h2', null, '今日の学習', el('span', { class: 'sub', text: today.n >= goal ? '🎉 目標達成' : '目標 ' + goal + '問' })),
      el('div', { class: 'today' },
        stat(today.n, '解いた問題'), stat(today.n ? pct(today.c, today.n) + '%' : '–', '正答率'), stat(fmtMin(today.sec || 0), '学習時間'), stat(streak() + '日', '連続')),
      el('div', { class: 'goal', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.min(100, pct(today.n, goal)) + '%' }))));

    const ses = S.session;
    if (ses && !ses.done) {
      const answered = Object.keys(ses.ans).length;
      root.append(el('section', { class: 'card resume' },
        el('h2', null, '⏸ 途中の問題があります'),
        el('p', { class: 'small muted', style: 'margin:0 0 8px', text: ses.title + '｜' + answered + ' / ' + ses.ids.length + '問 回答済み' }),
        el('div', { class: 'progressbar' }, el('i', { style: 'width:' + pct(answered, ses.ids.length) + '%' })),
        el('div', { class: 'row', style: 'margin-top:12px' },
          el('button', { type: 'button', class: 'btn primary grow', onclick: () => go('quiz') }, '続きから解く'),
          el('button', { type: 'button', class: 'btn', onclick: async () => { if (await ask('途中の問題をやめますか？\n回答した分の記録は残ります。', 'やめる')) { S.session = null; save(); renderHome(); } } }, 'やめる'))));
    }

    if (reviewN) root.append(el('button', { type: 'button', class: 'btn soft block lg', style: 'margin:4px 0 0', onclick: () => startPractice({ scope: 'all', type: 'all', filter: 'review', count: '20', order: 'random' }, '復習（間違えた・迷った問題）') }, '🔁 復習する（' + reviewN + '問）'));

    // 演習の設定
    const form = el('section', { class: 'card' }, el('h2', null, '✏️ 問題を解く'));
    const scopeSel = el('select', { class: 'input', id: 'f-scope' });
    function fillScope() {
      if (p.by === 'theme') {
        scopeSel.replaceChildren(...themeCategories().map(([cat, ts]) => el('optgroup', { label: cat }, ts.map((t) => el('option', { value: t.id, text: t.id + ' ' + t.name + '（' + count(t.id) + '問）' })))));
      } else {
        scopeSel.replaceChildren(
          el('option', { value: 'all', text: '全科目（' + count('all') + '問）' }),
          el('optgroup', { label: '試験のパート' }, Object.keys(PARTS).map((k) => el('option', { value: k, text: PARTS[k].label + '：' + PARTS[k].subjects.length + '科目（' + count(k) + '問）' }))),
          el('optgroup', { label: '科目' }, SUBJECTS.map((s) => el('option', { value: s, text: s + '（' + count(s) + '問）' }))));
      }
      scopeSel.value = p.scope; if (scopeSel.value !== p.scope) { scopeSel.selectedIndex = 0; p.scope = scopeSel.value; }
    }
    fillScope();
    const roundSel = el('select', { class: 'input', id: 'f-round' });
    const info = el('p', { class: 'small muted', style: 'margin:8px 0 0' });
    const startBtn = el('button', { type: 'button', class: 'btn primary block lg', style: 'margin-top:12px' });
    const chipGroup = (name, items, val) => el('div', { class: 'chips', role: 'group' }, items.map(([v, label]) => el('button', { type: 'button', class: 'chip', 'data-k': name, 'data-v': v, 'aria-pressed': String(v === val), onclick: (e) => {
      p[name] = v; if (name === 'type' && v !== '過去問') p.round = '';
      e.currentTarget.parentNode.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === e.currentTarget)));
      if (name === 'by') { p.scope = v === 'theme' ? (themeList()[0] || {}).id : 'all'; fillScope(); scopeLabel.textContent = v === 'theme' ? 'テーマ' : '範囲'; fillRounds(); }
      update(); } }, label)));
    function count(scope) { return isTheme(scope) ? pool({ scope }).length : scopeSubjects(scope).reduce((a, s) => a + (DATA.bySubject[s] || []).length, 0); }
    const scopeLabel = el('label', { for: 'f-scope', text: p.by === 'theme' ? 'テーマ' : '範囲' });
    function fillRounds() {
      const rounds = [...new Set(pool({ scope: p.scope }).filter((q) => q.type === '過去問' && q.round).map((q) => q.round))].sort((a, b) => b - a);
      roundSel.replaceChildren(el('option', { value: '', text: 'すべての回' }), rounds.map((r) => el('option', { value: String(r), text: '第' + r + '回' })));
      roundSel.value = rounds.includes(Number(p.round)) ? String(p.round) : ''; p.round = roundSel.value;
    }
    function update() {
      p.scope = scopeSel.value; p.round = roundSel.value;
      roundSel.disabled = types.length > 1 && p.type !== '過去問'; if (roundSel.disabled) roundSel.value = '';
      const n = pool(p).length, take = p.count === 'all' ? n : Math.min(Number(p.count), n);
      info.textContent = '条件に合う問題：' + n + '問';
      startBtn.textContent = n ? '▶ ' + take + '問を解く' : '問題がありません';
      startBtn.disabled = !n;
      S.prefs.practice = Object.assign({}, p); save();
    }
    scopeSel.onchange = () => { fillRounds(); update(); };
    roundSel.onchange = update;
    startBtn.onclick = () => startPractice(Object.assign({}, p));
    fillRounds();
    form.append(...[
      hasThemes ? el('div', { class: 'field' }, el('div', { class: 'label', text: '分け方' }), chipGroup('by', [['subject', '科目別'], ['theme', 'テーマ別']], p.by)) : null,
      el('div', { class: 'field' }, scopeLabel, scopeSel),
      types.length > 1 ? el('div', { class: 'field' }, el('div', { class: 'label', text: '問題の種類' }), chipGroup('type', types.map((t) => [t, t]).concat([['all', 'すべて']]), p.type)) : null,
      el('div', { class: 'field' }, el('label', { for: 'f-round', text: types.length > 1 ? '回（過去問のとき）' : '回' }), roundSel),
      el('div', { class: 'field' }, el('div', { class: 'label', text: '出す問題' }), chipGroup('filter', [['all', 'すべて'], ['new', 'まだ解いていない'], ['review', '間違えた・迷った'], ['star', '★をつけた']], p.filter)),
      el('div', { class: 'row', style: 'gap:16px;align-items:flex-start' },
        el('div', { class: 'field grow' }, el('div', { class: 'label', text: '問題数' }), chipGroup('count', [['10', '10'], ['20', '20'], ['50', '50'], ['all', '全部']], p.count)),
        el('div', { class: 'field' }, el('div', { class: 'label', text: '順番' }), chipGroup('order', [['random', 'ランダム'], ['seq', '番号順']], p.order))),
      info, startBtn].filter(Boolean));
    root.append(form);
    update();

    // 模試
    const mockTypes = types.filter((t) => t !== '実務者研修');
    let mtype = S.prefs.mockType || mockTypes[0] || '過去問';
    if (mtype !== 'mix' && !mockTypes.includes(mtype)) mtype = mockTypes[0] || '過去問';
    if (mtype === 'mix' && mockTypes.length < 2) mtype = mockTypes[0] || '過去問';
    const mockChoices = mockTypes.map((t) => [t, t]).concat(mockTypes.length > 1 ? [['mix', '混合']] : []);
    const mock = el('section', { class: 'card' }, el('h2', null, '⏱ 模擬試験'),
      el('p', { class: 'small muted', style: 'margin:0 0 10px', text: '本番と同じ科目の配分で' + (mockTypes.length === 1 ? mockTypes[0] + 'から' : '') + '出題します。答え合わせは最後にまとめて行います。' }),
      mockChoices.length > 1 ? el('div', { class: 'field' }, el('div', { class: 'label', text: '問題の種類' }), el('div', { class: 'chips' }, mockChoices.map(([v, l]) => el('button', { type: 'button', class: 'chip', 'aria-pressed': String(v === mtype), onclick: (e) => { mtype = v; S.prefs.mockType = v; save(); e.currentTarget.parentNode.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === e.currentTarget))); } }, l)))) : null,
      el('div', { class: 'row' },
        el('button', { type: 'button', class: 'btn primary grow', onclick: () => confirmMock('full', mtype) }, '本番形式 125問・220分'),
        el('button', { type: 'button', class: 'btn soft grow', onclick: () => confirmMock('mini', mtype) }, 'ミニ模試 25問・44分')));
    root.append(mock);

    root.append(el('p', { class: 'small muted', style: 'text-align:center;margin:20px 0', text: '記録はこの端末の中に保存されます（設定からバックアップできます）' }));
    root.append(tabbar('home'));
    app().replaceChildren(root);
  }
  function stat(v, k) { return el('div', null, el('div', { class: 'v', text: String(v) }), el('div', { class: 'k', text: k })); }
  async function confirmMock(size, type) {
    if (S.session && !S.session.done && !(await ask('途中の問題があります。やめて模擬試験を始めますか？', '模擬試験を始める'))) return;
    startMock(size, type);
  }

  // ── 問題画面 ──
  const lastTick = { t: 0 };
  function startTick(update) {
    stopTick(); if (!lastTick.t || performance.now() - lastTick.t > 2000) lastTick.t = performance.now();
    tick = setInterval(() => {
      const now = performance.now(), dt = now - lastTick.t; lastTick.t = now;
      if (document.hidden || !S.session || dt > 5000) return;
      const ses = S.session, id = ses.ids[ses.i];
      ses.elapsed += dt;
      const answered = ses.kind === 'practice' && ses.ans[id];
      if (!answered && !ses.review) ses.qElapsed[id] = (ses.qElapsed[id] || 0) + dt;
      day(dayKey()).sec += dt / 1000;
      update();
      if (ses.kind === 'mock' && ses.limit && ses.elapsed >= ses.limit && !ses.done) { stopTick(); toast('時間になりました。採点します。'); finishMock(); }
    }, 500);
  }
  function stopTick() { if (tick) { clearInterval(tick); tick = null; } }
  let saveThrottle = 0;
  document.addEventListener('visibilitychange', () => { lastTick.t = performance.now(); if (document.hidden) save(); });
  window.addEventListener('pagehide', save);

  function parseExplanation(text) {
    const opts = {}; let head = text || '';
    const first = head.search(/【選択肢[1-5]｜/);
    if (first >= 0) {
      const body = head.slice(first); head = head.slice(0, first);
      const re = /【選択肢([1-5])｜[^】]*?｜(正解|不正解)[^】]*】\n?([\s\S]*?)(?=【選択肢[1-5]｜|$)/g; let m;
      while ((m = re.exec(body))) opts[Number(m[1])] = m[3].trim();
    }
    head = head.replace(/^正解：[^\n]*\n*/, '').replace(/【選択肢解説】\s*$/, '').trim();
    return { head, opts };
  }
  function renderRich(text) {
    const box = el('div');
    let ul = null;
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (!line) { ul = null; continue; }
      const h = line.match(/^【(.+)】$/);
      if (h) { box.append(el('h4', { text: h[1] })); ul = null; continue; }
      if (/^[・●○]/.test(line)) { if (!ul) box.append(ul = el('ul')); ul.append(el('li', { text: line.replace(/^[・●○]\s*/, '') })); continue; }
      ul = null; box.append(el('p', { text: line }));
    }
    return box;
  }
  function displayOrder(ses, q) { return ses.order[q.id] || [1, 2, 3, 4, 5]; }

  function renderQuiz() {
    const ses = S.session;
    if (!ses) { go('home'); return; }
    const ids = ses.ids;
    if (ses.i >= ids.length) ses.i = ids.length - 1;
    const q = DATA.byId.get(ids[ses.i]);
    if (!q) { // データから消えた問題は飛ばす
      ses.ids = ids.filter((id) => DATA.byId.has(id));
      if (!ses.ids.length) { S.session = null; save(); toast('問題が見つかりません'); go('home'); return; }
      save(); renderQuiz(); return;
    }
    const isMock = ses.kind === 'mock';
    const reviewMode = !!ses.review;
    const ans = ses.ans[q.id];
    const showAnswer = reviewMode || (!isMock && !!ans);
    const order = displayOrder(ses, q);
    const ex = parseExplanation(q.explanation);
    const rq = S.q[q.id] || {};

    const timer = el('span', { class: 'timer', 'aria-label': '時間' });
    const updTimer = () => {
      if (isMock && ses.limit && !reviewMode) { const left = ses.limit - ses.elapsed; timer.textContent = '残り ' + fmtTime(left); timer.classList.toggle('low', left < 5 * 60000); }
      else timer.textContent = fmtTime(reviewMode ? (ses.qElapsed[q.id] || 0) : (ses.qElapsed[q.id] || 0));
      if (++saveThrottle % 20 === 0) save();
    };
    const answeredCount = Object.keys(ses.ans).length;
    const top = el('div', { class: 'quiz-top' },
      el('div', { class: 'row' },
        el('button', { type: 'button', class: 'icon-btn', 'aria-label': '中断してホームへ', onclick: () => { save(); if (ses.review && ses.done) S.session = null; go('home'); } }, '✕'),
        el('span', { class: 'title', text: ses.title }),
        el('span', { class: 'counter', text: (ses.i + 1) + ' / ' + ids.length }),
        timer),
      el('div', { class: 'qbar' }, el('i', { style: 'width:' + pct(isMock ? answeredCount : ses.i + (ans ? 1 : 0), ids.length) + '%' })));

    const metaTags = el('div', { class: 'meta' },
      el('span', { class: 'tag type', text: q.type === '過去問' && q.round ? '第' + q.round + '回 過去問' : q.type }),
      el('span', { class: 'tag', text: q.subject }),
      q.themes && q.themes.length ? q.themes.map((t) => el('span', { class: 'tag', text: themeName(t) })) : q.theme ? el('span', { class: 'tag', text: q.theme }) : null,
      q.difficulty ? el('span', { class: 'tag', text: q.difficulty }) : null,
      rq.a ? el('span', { class: 'tag', text: '過去 ' + rq.c + '/' + rq.a + ' 正解' }) : null);

    const stem = el('div', { class: 'stem', text: q.stem });
    const fig = q.figure && q.figure.stem ? el('div', { class: 'figure' }, el('img', { src: q.figure.stem, alt: '問題の図', loading: 'lazy' })) : null;

    const elim = ses.elim[q.id] || [];
    const list = el('ol', { class: 'opts' + (showAnswer ? ' answered' : ''), 'aria-label': '選択肢' });
    order.forEach((orig, idx) => {
      const disp = idx + 1;
      const isKey = q.keys.includes(orig);
      const cls = ['opt'];
      if (showAnswer) { if (isKey) cls.push('correct'); else if (ans && ans.c === orig) cls.push('wrong'); }
      else if (ans && ans.c === orig) cls.push('selected');
      if (!showAnswer && elim.includes(orig)) cls.push('eliminated');
      const optFig = q.figure && q.figure.options && q.figure.options[orig - 1];
      const li = el('li', { class: cls.join(' ') },
        el('button', { type: 'button', class: 'pick', 'aria-label': '選択肢' + disp, onclick: () => choose(orig), disabled: showAnswer ? true : null },
          el('span', { class: 'num', text: String(disp) }),
          el('span', { class: 'txt' }, q.options[orig - 1], optFig ? el('img', { src: optFig, alt: '選択肢' + disp + 'の図', loading: 'lazy' }) : null)),
        showAnswer ? null : el('button', { type: 'button', class: 'elim', 'aria-label': '選択肢' + disp + 'を消す', 'aria-pressed': String(elim.includes(orig)), onclick: () => toggleElim(orig) }, elim.includes(orig) ? '戻す' : '消す'),
        showAnswer && ex.opts[orig] ? el('div', { class: 'why' }, el('b', { text: isKey ? '○ 正解' : '× 不正解' }), ex.opts[orig]) : null);
      list.append(li);
    });

    const unsure = !!ses.unsure[q.id];
    const tools = el('div', { class: 'qtools' },
      reviewMode ? null : el('button', { type: 'button', class: 'toggle', 'aria-pressed': String(unsure), onclick: toggleUnsure }, unsure ? '🤔 迷った（記録します）' : '🤔 迷った'),
      el('button', { type: 'button', class: 'toggle star', 'aria-pressed': String(!!rq.st), onclick: toggleStar }, rq.st ? '★ 保存済み' : '☆ あとで見る'),
      'speechSynthesis' in window ? el('button', { type: 'button', class: 'toggle', onclick: () => speak(q, order) }, '🔊 読み上げ') : null);

    const body = el('main', { class: 'shell', style: 'padding-bottom:calc(110px + env(safe-area-inset-bottom))' }, top, metaTags, stem, fig, list, tools);

    if (showAnswer) {
      const keyDisp = q.keys.map((k) => order.indexOf(k) + 1).sort((a, b) => a - b);
      const ok = ans ? q.keys.includes(ans.c) : null;
      body.append(el('div', { class: 'verdict ' + (ok ? 'ok' : 'ng') },
        el('span', { class: 'mark', 'aria-hidden': 'true', text: ok ? '○' : '×' }),
        el('div', null, ans ? (ok ? '正解！' : '不正解') : '未回答',
          el('small', { text: '正解は ' + keyDisp.join('・') + (keyDisp.length > 1 ? '（どれを選んでも正解）' : '') + (ans ? '｜あなたの答え ' + (order.indexOf(ans.c) + 1) : '') + (ses.qElapsed[q.id] ? '｜' + Math.round(ses.qElapsed[q.id] / 1000) + '秒' : '') }))));
      if (ex.head) body.append(el('section', { class: 'explain', 'aria-label': '解説' }, renderRich(ex.head)));
      const memo = el('textarea', { class: 'input', placeholder: '自分のメモ（この端末に保存）', 'aria-label': '自分のメモ' });
      memo.value = rq.n || '';
      memo.oninput = () => { const r = rec(q.id); r.n = memo.value; r.nt = Date.now(); r.s = SUBJECTS.indexOf(q.subject); save(); };
      body.append(el('div', { class: 'field' }, el('label', { text: '📝 メモ' }), memo));
    }

    // 下のボタン
    const isLast = ses.i === ids.length - 1;
    const prev = el('button', { type: 'button', class: 'btn narrow', disabled: ses.i === 0 ? true : null, onclick: () => move(-1), 'aria-label': '前の問題' }, '←');
    let main;
    if (isMock && !reviewMode) {
      main = isLast ? el('button', { type: 'button', class: 'btn primary', onclick: openGrid }, '見直し・提出') : el('button', { type: 'button', class: 'btn primary', onclick: () => move(1) }, '次へ →');
    } else if (reviewMode) {
      main = isLast ? el('button', { type: 'button', class: 'btn primary', onclick: () => { go('result', ses.resultRef); } }, '結果にもどる') : el('button', { type: 'button', class: 'btn primary', onclick: () => move(1) }, '次へ →');
    } else if (ans) {
      main = isLast ? el('button', { type: 'button', class: 'btn primary', onclick: finishPractice }, '結果を見る') : el('button', { type: 'button', class: 'btn primary', onclick: () => move(1) }, '次の問題 →');
    } else {
      main = el('button', { type: 'button', class: 'btn', onclick: () => move(1), disabled: isLast ? true : null }, 'とばす →');
    }
    const foot = el('div', { class: 'quiz-foot' }, el('div', { class: 'inner' },
      prev,
      (isMock || reviewMode) ? el('button', { type: 'button', class: 'btn narrow', onclick: openGrid, 'aria-label': '問題の一覧' }, '一覧') : null,
      main));
    body.append(foot);
    app().replaceChildren(body);
    updTimer();
    startTick(updTimer);
    if (showAnswer && !reviewMode) { const v = $('.verdict'); if (v && v.getBoundingClientRect().top > window.innerHeight - 140) v.scrollIntoView({ behavior: 'smooth', block: 'center' }); }

    function choose(orig) {
      if (showAnswer) return;
      if (isMock) {
        ses.ans[q.id] = { c: orig, t: Date.now() }; save(); renderQuiz(); return;
      }
      const ok = q.keys.includes(orig);
      const sec = (ses.qElapsed[q.id] || 0) / 1000;
      const logIdx = recordAnswer(q, orig, ok, sec, !!ses.unsure[q.id], 'p');
      ses.ans[q.id] = { c: orig, ok, log: logIdx };
      save(); sound(ok); if (navigator.vibrate && !ok) navigator.vibrate(60);
      const y = window.scrollY; renderQuiz(); window.scrollTo(0, y);
    }
    function toggleElim(orig) {
      const a = ses.elim[q.id] || (ses.elim[q.id] = []);
      const i = a.indexOf(orig); if (i >= 0) a.splice(i, 1); else a.push(orig);
      save(); const y = window.scrollY; renderQuiz(); window.scrollTo(0, y);
    }
    function toggleUnsure() {
      ses.unsure[q.id] = !ses.unsure[q.id];
      if (!isMock && ans && ans.log != null && S.log[ans.log] && S.log[ans.log][1] === q.id) { // 回答後に付け外し
        const e = S.log[ans.log], r = rec(q.id), on = ses.unsure[q.id] ? 1 : 0;
        if (e[5] !== on) { e[5] = on; r.u = Math.max(0, (r.u || 0) + (on ? 1 : -1)); if (r.t === e[0]) r.lu = on; }
      }
      save(); const y = window.scrollY; renderQuiz(); window.scrollTo(0, y);
    }
    function toggleStar() {
      const r = rec(q.id); r.st = r.st ? 0 : 1; r.s = SUBJECTS.indexOf(q.subject); save();
      toast(r.st ? '★「あとで見る」に保存しました' : '★を外しました');
      const y = window.scrollY; renderQuiz(); window.scrollTo(0, y);
    }
  }
  function move(d) { const ses = S.session; ses.i = Math.max(0, Math.min(ses.ids.length - 1, ses.i + d)); save(); go('quiz'); }
  function openGrid() {
    const ses = S.session, isMock = ses.kind === 'mock';
    const unanswered = ses.ids.filter((id) => !ses.ans[id]).length;
    const bg = el('div', { class: 'sheet-bg', onclick: (e) => { if (e.target === bg) bg.remove(); } });
    const grid = el('div', { class: 'grid-nums' }, ses.ids.map((id, i) => {
      const a = ses.ans[id], q = DATA.byId.get(id);
      const cls = [];
      if (ses.review && q) cls.push(a && q.keys.includes(a.c) ? 'ok' : 'ng'); else if (a) cls.push('done');
      if (ses.unsure[id]) cls.push('unsure'); if (i === ses.i) cls.push('cur');
      return el('button', { type: 'button', class: cls.join(' '), onclick: () => { bg.remove(); ses.i = i; save(); go('quiz'); }, 'aria-label': (i + 1) + '問目' + (a ? ' 回答済み' : ' 未回答') }, String(i + 1));
    }));
    const sheet = el('div', { class: 'sheet', role: 'dialog', 'aria-label': '問題の一覧' },
      el('div', { class: 'row' }, el('b', { class: 'grow', text: '問題の一覧' }), el('button', { type: 'button', class: 'icon-btn', 'aria-label': '閉じる', onclick: () => bg.remove() }, '✕')),
      ses.review ? null : el('p', { class: 'small muted', style: 'margin:4px 0', text: '回答済み ' + (ses.ids.length - unanswered) + ' / ' + ses.ids.length + '　●＝迷った' }),
      grid,
      isMock && !ses.review ? el('button', { type: 'button', class: 'btn primary block lg', onclick: async () => { bg.remove(); if (!unanswered || await ask('未回答が ' + unanswered + '問あります。提出して採点しますか？', '提出する')) finishMock(); } }, '提出して採点する') : null);
    bg.append(sheet); document.body.append(bg);
  }
  function finishPractice() {
    const ses = S.session; ses.done = true;
    const result = buildResult(ses); S.session = null; save(); go('result', result);
  }
  function finishMock() {
    const ses = S.session; if (!ses || ses.done) return;
    ses.done = true;
    for (const id of ses.ids) {
      const q = DATA.byId.get(id), a = ses.ans[id]; if (!q || !a) continue;
      a.ok = q.keys.includes(a.c);
      recordAnswer(q, a.c, a.ok, (ses.qElapsed[id] || 0) / 1000, !!ses.unsure[id], 'm');
    }
    const result = buildResult(ses);
    S.mocks.push({ at: Date.now(), title: ses.title, total: result.total, correct: result.correct, sec: Math.round(ses.elapsed / 1000), size: ses.mockSize, groupsZero: result.groupsZero });
    if (S.mocks.length > 200) S.mocks.shift();
    S.session = null; save(); go('result', result);
  }
  function buildResult(ses) {
    const items = ses.ids.map((id) => { const q = DATA.byId.get(id); const a = ses.ans[id]; return { id, subject: q ? q.subject : '', ok: !!(a && q && q.keys.includes(a.c)), answered: !!a, unsure: !!ses.unsure[id] }; });
    const bySubject = {};
    for (const it of items) { const b = bySubject[it.subject] || (bySubject[it.subject] = { n: 0, c: 0 }); b.n++; if (it.ok) b.c++; }
    const groupsZero = ses.kind === 'mock' ? GROUPS.filter((g) => g.some((s) => bySubject[s]) && g.reduce((a, s) => a + (bySubject[s] ? bySubject[s].c : 0), 0) === 0).map((g) => g.join('・')) : [];
    return { kind: ses.kind, title: ses.title, total: items.length, correct: items.filter((x) => x.ok).length, items, bySubject, groupsZero, sec: Math.round(ses.elapsed / 1000), mockSize: ses.mockSize, snapshot: { ids: ses.ids, ans: ses.ans, order: ses.order, unsure: ses.unsure, qElapsed: ses.qElapsed, title: ses.title, kind: ses.kind } };
  }

  // ── 結果 ──
  function renderResult(r) {
    if (!r) { go('home'); return; }
    const root = el('div', { class: 'shell' }, topbar());
    const rate = pct(r.correct, r.total);
    const card = el('section', { class: 'card' }, el('h2', null, r.kind === 'mock' ? '⏱ 模擬試験の結果' : '✅ おつかれさまでした', el('span', { class: 'sub', text: r.title })),
      el('div', { class: 'score' },
        el('div', { class: 'big' }, String(r.correct), el('small', { text: ' / ' + r.total + '問' })),
        el('div', { class: 'muted', text: '正答率 ' + rate + '%｜' + fmtMin(r.sec) }),
        r.kind === 'mock' ? el('span', { class: 'pass ' + (rate >= 60 && !r.groupsZero.length ? 'ok' : 'ng'), text: rate >= 60 && !r.groupsZero.length ? '合格ライン（6割）を超えています' : '合格ライン（6割）まであと ' + Math.max(0, Math.ceil(r.total * 0.6) - r.correct) + '問' }) : null));
    root.append(card);
    if (r.kind === 'mock') {
      if (r.groupsZero.length) root.append(el('div', { class: 'notice warn' }, el('b', { text: '⚠ 0点の科目群があります：' }), r.groupsZero.join('／'), el('div', { class: 'small', text: '本番は総得点に加えて、すべての科目群で得点が必要です。' })));
      root.append(el('p', { class: 'small muted', style: 'margin:0 4px', text: '※合格ラインは目安です（例年は総得点の6割程度を基準に、問題の難しさで補正されます）。' }));
    }
    const bars = el('div', { class: 'bars' }, SUBJECTS.filter((s) => r.bySubject[s]).map((s) => {
      const b = r.bySubject[s];
      return el('div', { class: 'barrow' + (b.c === 0 && r.kind === 'mock' ? ' zero' : '') }, el('span', { class: 'name', text: s }), el('span', { class: 'val', text: b.c + '/' + b.n }),
        el('div', { class: 'track' }, el('i', { class: 'c', style: 'width:' + pct(b.c, b.n) + '%' }), el('i', { class: 'w', style: 'width:' + (100 - pct(b.c, b.n)) + '%' })));
    }));
    root.append(el('section', { class: 'card' }, el('h2', null, '科目別'), bars));

    const wrongIds = r.items.filter((x) => !x.ok || x.unsure).map((x) => x.id);
    root.append(el('div', { class: 'row', style: 'margin:12px 0' },
      wrongIds.length ? el('button', { type: 'button', class: 'btn primary grow lg', onclick: () => startIds(wrongIds, '間違えた・迷った問題（' + wrongIds.length + '問）') }, '🔁 間違えた・迷った ' + wrongIds.length + '問をもう一度') : null,
      el('button', { type: 'button', class: 'btn grow lg', onclick: () => go('home') }, 'ホームへ')));

    const list = el('ul', { class: 'qlist' }, r.items.map((it, i) => {
      const q = DATA.byId.get(it.id);
      return el('li', null, el('button', { type: 'button', onclick: () => openReview(r, i) },
        el('span', { class: 'res ' + (it.ok ? 'ok' : 'ng'), text: it.ok ? '○' : it.answered ? '×' : '–' }),
        el('span', { class: 't' }, el('span', { class: 's', text: (i + 1) + '. ' + it.subject + (it.unsure ? '・🤔迷った' : '') }), q ? q.stem.replace(/^次の事例を読んで[^\n]*\n/, '').replace(/【事例】[\s\S]*?【問題】\s*/, '') : it.id)));
    }));
    root.append(el('section', { class: 'card' }, el('h2', null, '問題ごとの結果', el('span', { class: 'sub', text: 'タップで解説' })), list));
    root.append(tabbar(''));
    app().replaceChildren(root);
    if (r.kind === 'practice' && r.correct === r.total && r.total >= 5) sound(true);
  }
  function openReview(r, i) {
    const snap = r.snapshot;
    S.session = { id: uid(), kind: snap.kind, ids: snap.ids, i, ans: snap.ans, elim: {}, unsure: snap.unsure || {}, order: snap.order || {}, qElapsed: snap.qElapsed || {}, elapsed: 0, title: snap.title + '（解説）', review: true, done: true, resultRef: r };
    go('quiz');
  }

  // ── 成績 ──
  function renderStats() {
    const root = el('div', { class: 'shell' }, topbar());
    const totalQ = [...DATA.byId.keys()].length;
    let answered = 0, att = 0, cor = 0, review = 0, stars = 0;
    const subj = SUBJECTS.map(() => ({ seen: 0, a: 0, c: 0, rv: 0 }));
    for (const id in S.q) {
      const r = S.q[id]; if (!DATA.byId.has(id)) continue;
      if (r.a) { answered++; att += r.a; cor += r.c; } if (isReview(r)) review++; if (r.st) stars++;
      const s = subj[r.s]; if (s && r.a) { s.seen++; s.a += r.a; s.c += r.c; if (isReview(r)) s.rv++; }
    }
    const totalSec = Object.values(S.days).reduce((a, d) => a + (d.sec || 0), 0);
    root.append(el('section', { class: 'card' }, el('h2', null, '📊 これまでの学習'),
      el('div', { class: 'today' }, stat(answered, '解いた問題'), stat(att ? pct(cor, att) + '%' : '–', '正答率'), stat(fmtMin(totalSec), '学習時間'), stat(streak() + '日', '連続')),
      el('div', { class: 'goal', title: '全問題のうち解いた割合' }, el('i', { style: 'width:' + pct(answered, totalQ) + '%' })),
      el('p', { class: 'small muted', style: 'margin:6px 0 0', text: '全' + totalQ + '問のうち ' + pct(answered, totalQ) + '% を解きました｜復習待ち ' + review + '問｜★ ' + stars + '問' })));

    // 14日
    const days = [], labels = [];
    let maxN = 1;
    for (let k = 13; k >= 0; k--) { const d = new Date(); d.setDate(d.getDate() - k); const key = dayKey(d); const v = S.days[key] || { n: 0 }; maxN = Math.max(maxN, v.n); days.push({ key, n: v.n, c: v.c || 0, today: k === 0 }); labels.push(d.getDate()); }
    root.append(el('section', { class: 'card' }, el('h2', null, '最近2週間', el('span', { class: 'sub', text: '解いた問題数' })),
      el('div', { class: 'days', role: 'img', 'aria-label': '最近14日の解いた問題数' }, days.map((d) => el('div', { class: 'd' + (d.today ? ' today' : '') + (d.n ? '' : ' empty'), title: d.key + '：' + d.n + '問（正解' + d.c + '）' }, el('i', { style: 'height:' + Math.max(2, d.n / maxN * 100) + '%' })))),
      el('div', { class: 'dlabels', 'aria-hidden': 'true' }, labels.map((l) => el('span', { text: String(l) })))));

    // 科目別
    const sec = el('section', { class: 'card' }, el('h2', null, '科目別', el('span', { class: 'sub', text: '科目名をタップで復習' })));
    for (const k of Object.keys(PARTS)) {
      sec.append(el('h4', { style: 'margin:12px 0 6px;font-size:.85em;color:var(--accent)', text: PARTS[k].label }));
      sec.append(el('div', { class: 'bars' }, PARTS[k].subjects.map((s) => {
        const i = SUBJECTS.indexOf(s), x = subj[i], n = (DATA.bySubject[s] || []).length;
        return el('div', { class: 'barrow' },
          el('button', { type: 'button', class: 'link name', onclick: () => startPractice({ scope: s, type: 'all', filter: x.rv ? 'review' : 'new', count: '10', order: 'random' }, s + (x.rv ? '・復習' : '・未回答')) }, s),
          el('span', { class: 'val', text: (x.a ? pct(x.c, x.a) + '%' : '–') + '｜' + x.seen + '/' + n + '問' }),
          el('div', { class: 'track', title: '解いた割合' }, el('i', { class: 'a', style: 'width:' + pct(x.seen, n) + '%' })));
      })));
    }
    sec.append(el('div', { class: 'legend' }, el('span', null, el('i', { style: 'background:var(--accent-strong)' }), 'バー＝解いた割合'), el('span', { text: '％＝正答率' })));
    root.append(sec);

    // テーマ別
    if (themeList().length) {
      const tsec = el('section', { class: 'card' }, el('h2', null, 'テーマ別', el('span', { class: 'sub', text: 'テーマ名をタップで復習' })));
      for (const [cat, ts] of themeCategories()) {
        tsec.append(el('h4', { style: 'margin:12px 0 6px;font-size:.85em;color:var(--accent)', text: cat }));
        tsec.append(el('div', { class: 'bars' }, ts.map((t) => {
          const qs = pool({ scope: t.id }); let seen = 0, a = 0, c = 0, rv = 0;
          for (const q of qs) { const r = S.q[q.id]; if (r && r.a) { seen++; a += r.a; c += r.c; if (isReview(r)) rv++; } }
          return el('div', { class: 'barrow' },
            el('button', { type: 'button', class: 'link name', onclick: () => startPractice({ scope: t.id, type: 'all', filter: rv ? 'review' : seen < qs.length ? 'new' : 'all', count: '10', order: 'random' }, t.name + (rv ? '・復習' : '')) }, t.id + ' ' + t.name),
            el('span', { class: 'val', text: (a ? pct(c, a) + '%' : '–') + '｜' + seen + '/' + qs.length + '問' }),
            el('div', { class: 'track' }, el('i', { class: 'a', style: 'width:' + pct(seen, qs.length) + '%' })));
        })));
      }
      root.append(tsec);
    }

    if (S.mocks.length) {
      root.append(el('section', { class: 'card' }, el('h2', null, '⏱ 模擬試験の記録'),
        el('ul', { class: 'list-plain' }, S.mocks.slice().reverse().slice(0, 20).map((m) => el('li', null,
          el('span', null, new Date(m.at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }) + '　' + m.title),
          el('b', { text: m.correct + '/' + m.total + '（' + pct(m.correct, m.total) + '%）' }))))));
    }
    root.append(tabbar('stats'));
    app().replaceChildren(root);
  }

  // ── 設定 ──
  function renderSettings() {
    const root = el('div', { class: 'shell' }, topbar());
    const sw = (label, key, desc) => el('label', { class: 'switch' }, el('span', null, label, desc ? el('span', { class: 'small muted', style: 'display:block', text: desc }) : null),
      el('input', { type: 'checkbox', checked: S.settings[key] ? true : null, onchange: (e) => { S.settings[key] = e.target.checked; save(); applySettings(); } }));
    const seg = (key, items) => el('div', { class: 'chips' }, items.map(([v, l]) => el('button', { type: 'button', class: 'chip', 'aria-pressed': String(String(S.settings[key]) === String(v)), onclick: () => { S.settings[key] = v; save(); applySettings(); renderSettings(); } }, l)));
    root.append(el('section', { class: 'card' }, el('h2', null, '⚙️ 解き方'),
      sw('選択肢の順番をシャッフル', 'shuffle', '番号の丸暗記を防ぎます（解説は表示の番号に合わせます）'),
      sw('効果音', 'sound', '正解・不正解のときに短い音を鳴らします'),
      el('div', { class: 'field' }, el('div', { class: 'label', text: '1日の目標' }), seg('goal', [[10, '10問'], [20, '20問'], [30, '30問'], [50, '50問'], [100, '100問']])),
      el('div', { class: 'field' }, el('div', { class: 'label', text: '文字の大きさ' }), seg('font', [['s', '小'], ['m', '中'], ['l', '大'], ['xl', '特大']])),
      el('div', { class: 'field' }, el('div', { class: 'label', text: '画面の色' }), seg('theme', [['auto', '端末に合わせる'], ['light', 'ライト'], ['dark', 'ダーク']]))));

    const idx = DATA.index || {};
    const offline = el('span', { class: 'small muted', text: '確認中…' });
    root.append(el('section', { class: 'card' }, el('h2', null, '📦 問題データ'),
      el('ul', { class: 'list-plain' },
        el('li', null, el('span', { text: '問題数' }), el('b', { text: DATA.byId.size + '問（' + DATA.loaded + '/' + SUBJECTS.length + '科目）' })),
        el('li', null, el('span', { text: 'データの日付' }), el('span', { text: idx.generatedAt ? new Date(idx.generatedAt).toLocaleString('ja-JP') : '–' })),
        el('li', null, el('span', { text: 'オフライン' }), offline)),
      el('button', { type: 'button', class: 'btn block', style: 'margin-top:10px', onclick: async (e) => { e.currentTarget.disabled = true; e.currentTarget.textContent = '確認中…'; await refreshData(true); renderSettings(); } }, '最新の問題データを確認する')));
    checkOffline(offline);

    const last = S.lastBackup ? new Date(S.lastBackup).toLocaleDateString('ja-JP') : 'まだありません';
    const file = el('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: (e) => importBackup(e.target.files[0]) });
    root.append(el('section', { class: 'card' }, el('h2', null, '💾 学習記録のバックアップ'),
      el('p', { class: 'small muted', style: 'margin:0 0 10px', text: '記録はこの端末の中だけにあります。機種変更やスマホ⇔パソコンで記録を移すときは、書き出したファイルを相手の端末で読み込んでください（読み込むと記録が合わさります）。最後のバックアップ：' + last }),
      el('div', { class: 'row' },
        el('button', { type: 'button', class: 'btn primary grow', onclick: exportBackup }, '書き出す'),
        el('button', { type: 'button', class: 'btn grow', onclick: () => file.click() }, '読み込む'), file)));

    root.append(el('section', { class: 'card' }, el('h2', null, 'その他'),
      el('ul', { class: 'list-plain' },
        el('li', null, el('span', { text: 'アプリのバージョン' }), el('span', { text: APP_VERSION })),
        el('li', null, el('span', { text: '記録している回答' }), el('span', { text: S.log.length + '件' }))),
      el('button', { type: 'button', class: 'btn danger block', style: 'margin-top:10px', onclick: async () => {
        if (!(await ask('この端末の学習記録をすべて消します。元に戻せません。\n先にバックアップの書き出しをおすすめします。', 'すべて消す', true))) return;
        const keep = S.settings; S = blankStore(); S.settings = keep; save(); toast('記録を消しました'); renderSettings();
      } }, '学習記録をすべて消す')));
    root.append(tabbar('settings'));
    app().replaceChildren(root);
  }
  async function checkOffline(node) {
    const cache = await openCache();
    if (!cache || !DATA.index) { node.textContent = 'この環境では保存できません'; return; }
    let n = 0; for (const m of DATA.index.subjects) if (await cache.match(cacheKey(m))) n++;
    const sw = 'serviceWorker' in navigator && navigator.serviceWorker.controller;
    node.textContent = (n === DATA.index.subjects.length ? '✅ 全科目を保存済み' : n + '/' + DATA.index.subjects.length + '科目を保存済み') + (sw ? '' : '（画面の保存は次回から）');
  }
  function exportBackup() {
    S.lastBackup = Date.now(); save();
    const blob = new Blob([JSON.stringify({ app: 'kaigo-study', v: 1, exportedAt: new Date().toISOString(), data: { q: S.q, log: S.log, days: S.days, mocks: S.mocks, settings: S.settings } })], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: 'kaigo-study-backup-' + dayKey() + '.json' });
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('バックアップを書き出しました');
  }
  function importBackup(f) {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const o = JSON.parse(reader.result);
        if (!o || o.app !== 'kaigo-study' || !o.data || !Array.isArray(o.data.log)) throw new Error('形式');
        const d = o.data;
        const seen = new Set(S.log.map((e) => e[0] + '|' + e[1]));
        let added = 0;
        for (const e of d.log) { if (!Array.isArray(e) || e.length < 8) continue; const k = e[0] + '|' + e[1]; if (!seen.has(k)) { seen.add(k); S.log.push(e); added++; } }
        for (const id in d.q || {}) {
          const a = d.q[id], b = S.q[id] || (S.q[id] = { a: 0, c: 0 });
          if (a.n && (!b.n || (a.nt || 0) > (b.nt || 0))) { b.n = a.n; b.nt = a.nt; }
          if (a.st) b.st = 1; if (a.s != null) b.s = a.s;
        }
        for (const k in d.days || {}) { const x = d.days[k]; day(k).sec = Math.max(day(k).sec || 0, x.sec || 0); }
        const mk = new Set(S.mocks.map((m) => m.at));
        for (const m of d.mocks || []) if (!mk.has(m.at)) S.mocks.push(m);
        S.mocks.sort((a, b) => a.at - b.at);
        rebuildFromLog(); save();
        toast('読み込みました（新しい回答 ' + added + '件）'); renderSettings();
      } catch (e) { toast('このファイルは読み込めません'); }
    };
    reader.readAsText(f);
  }
  function applySettings() {
    const r = document.documentElement;
    r.dataset.font = S.settings.font || 'm';
    if (S.settings.theme === 'auto') delete r.dataset.theme; else r.dataset.theme = S.settings.theme;
  }

  // ── 音 ──
  let actx;
  function sound(ok) {
    if (!S.settings.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const notes = ok ? [880, 1320] : [300, 220];
      notes.forEach((f, i) => {
        const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + i * 0.11;
        o.type = ok ? 'sine' : 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.15, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.2);
      });
    } catch (e) { /* 音が出せない環境 */ }
  }
  function speak(q, order) {
    const ss = window.speechSynthesis;
    if (ss.speaking) { ss.cancel(); return; }
    const text = q.stem + '。' + order.map((o, i) => (i + 1) + '。' + q.options[o - 1]).join('。');
    const u = new SpeechSynthesisUtterance(text); u.lang = 'ja-JP'; u.rate = 1.05; ss.speak(u);
  }

  // キーボード（パソコン）
  document.addEventListener('keydown', (e) => {
    if (route !== 'quiz' || e.target.closest('textarea,input,select') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^[1-5]$/.test(e.key)) { const b = document.querySelectorAll('.opt .pick')[Number(e.key) - 1]; if (b && !b.disabled) { b.click(); e.preventDefault(); } }
    else if (e.key === 'ArrowRight' || e.key === 'Enter') { const b = $('.quiz-foot .btn.primary') || $('.quiz-foot .inner > .btn:last-child'); if (b && !b.disabled) { b.click(); e.preventDefault(); } }
    else if (e.key === 'ArrowLeft') { const b = $('.quiz-foot .inner > .btn:first-child'); if (b && !b.disabled) { b.click(); e.preventDefault(); } }
  });

  // ───────── データ更新 ─────────
  async function refreshData(manual) {
    try {
      const { obj } = await fetchJson(dataUrl('index'), 12000);
      const old = DATA.index;
      const changed = !old || obj.version !== old.version || obj.subjects.some((m) => { const o = old.subjects.find((x) => x.name === m.name); return !o || o.hash !== m.hash; });
      if (!changed && !DATA.error) { if (manual) toast('最新の問題データです'); return; }
      try { localStorage.setItem(INDEX_KEY, JSON.stringify(obj)); } catch (e) { /* 容量 */ }
      DATA.index = obj; DATA.bySubject = {}; DATA.byId = new Map(); DATA.error = '';
      const cache = await openCache();
      let ok = 0;
      for (const m of obj.subjects) { try { addSubject(m.name, await loadSubject(m, cache)); ok++; } catch (e) { DATA.error = '一部の科目を読み込めませんでした。'; } }
      DATA.loaded = ok;
      toast('問題データを更新しました');
      if (route === 'home') renderHome();
    } catch (e) { if (manual) toast('更新を確認できませんでした（オフライン？）'); }
  }

  // ───────── ブログからのリンク ─────────
  // 例：app/?s=社会の理解&type=過去問&round=36&n=10
  //     app/?ids=K0019,K0065&title=介護保険の過去問
  //     app/?part=A&filter=review
  async function handleLinkParams() {
    const sp = new URLSearchParams(location.search);
    if (![...sp.keys()].length) return false;
    const clean = () => history.replaceState(null, '', location.pathname);
    const ids = (sp.get('ids') || '').split(/[,\s]+/).filter((x) => /^[KMJ]\d{4}$/.test(x));
    const mock = sp.get('mock');
    const pending = S.session && !S.session.done;
    if (ids.length || sp.get('s') || sp.get('t') || sp.get('part') || sp.get('round') || sp.get('theme') || mock) {
      if (pending && !(await ask('途中の問題があります。リンク先の問題を始めますか？\n（途中の問題は終わります）', '始める'))) { clean(); return false; }
    } else { clean(); return false; }
    clean();
    if (mock) { const mt = dataTypes().filter((x) => x !== '実務者研修'); startMock(mock === 'full' ? 'full' : 'mini', mt.includes(sp.get('type')) ? sp.get('type') : (mt[0] || '過去問')); return true; }
    if (ids.length) return startIds(ids, sp.get('title') || '');
    const t = (sp.get('t') || '').toUpperCase();
    const opt = { scope: isTheme(t) ? t : sp.get('part') && PARTS[sp.get('part').toUpperCase()] ? sp.get('part').toUpperCase() : (sp.get('s') || 'all'), type: sp.get('type') || (sp.get('round') ? '過去問' : 'all'), round: sp.get('round') || '', theme: sp.get('theme') || '', filter: sp.get('filter') || 'all', count: sp.get('n') || '10', order: sp.get('order') === 'seq' ? 'seq' : 'random' };
    if (!pool(opt).length) { toast('リンクの条件に合う問題がありません'); return false; }
    startPractice(opt, sp.get('title') || '');
    return true;
  }

  // ───────── Service Worker ─────────
  function registerSW() {
    return; // ブログ組み込み版ではオフライン用の仕組み（Service Worker）を使わない
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    navigator.serviceWorker.register('sw.js').then((reg) => {
      const ask = (w) => toast('新しいバージョンがあります', { label: '更新', run: () => w.postMessage('skipWaiting') });
      if (reg.waiting && navigator.serviceWorker.controller) ask(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) ask(w); });
      });
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    }).catch(() => { /* プレビュー環境などでは登録できない */ });
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloaded) return; reloaded = true; save(); location.reload(); });
  }

  // ───────── 起動 ─────────
  async function boot() {
    loadStore(); applySettings(); registerSW();
    const msg = $('.boot p');
    try {
      await loadAllData((d, n) => { if (msg) msg.textContent = '問題データを準備中… ' + d + ' / ' + n; });
    } catch (e) {
      app().replaceChildren(el('div', { class: 'shell' }, topbar(), el('div', { class: 'card' }, el('h2', null, '問題データを読み込めませんでした'),
        el('p', { text: '初めて開くときは、電波のある所で開いてください。一度読み込めば、次からは電波がなくても使えます。' }),
        el('p', { class: 'small muted', text: String(e && e.message || e) }),
        el('button', { type: 'button', class: 'btn primary', onclick: () => location.reload() }, 'もう一度読み込む'))));
      return;
    }
    go('home');
    await handleLinkParams();
    // 起動のあとで更新を確認（index は起動時に取得済みなので、ここでは定期確認だけ）
    window.addEventListener('online', () => refreshData(false));
  }
  boot();
})();
