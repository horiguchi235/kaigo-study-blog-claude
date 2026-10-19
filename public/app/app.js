/* 過去問演習（介護福祉士 過去問でつなぐ合格ノート）v2.0
 * 学習記録はこの端末の localStorage に保存（外には送らない）。問題データは Cache Storage に保存してオフラインで使う。
 * 画面に関係しない処理（連問・合格判定・間隔反復・記録の点検）は core.js にある。
 */
(function () {
  'use strict';
  const K = window.KaigoCore;
  const APP_VERSION = '3.0.0';
  const CFG = Object.assign({
    dataUrl: '', staticBase: 'data/', blogUrl: '../', linksUrl: 'links.json',
    examDate: '2027-01-31',      // 次の試験日（残り日数と今日のメニューに使う）
    reportFormUrl: '',           // 誤り報告の Google フォーム（事前入力URL。{id}{round}{subject}{rev}{app}{order} を置き換える）
    goatcounter: '',             // 計測（例 'https://xxxx.goatcounter.com/count'）。空なら何も送らない
    privacyUrl: '',              // ブログのプライバシーポリシー
  }, window.KAIGO_CONFIG || {});
  const STORE_KEY = 'kaigoPwa.v1';
  const INDEX_KEY = 'kaigoPwa.index';
  const DATA_CACHE = 'kaigo-data-v1';
  const { SUBJECTS, PARTS, EXAM_DIST, GROUPS } = K;
  const TYPES = ['過去問', '模擬問題', '実務者研修'];
  const SOURCE = '社会福祉振興・試験センター 介護福祉士国家試験';
  const CONFIRM = true; // 選択肢を選んでから「答え合わせ」で確定する（押しただけでは答えにしない）
  const LIMITS = [[30, '30秒'], [60, '60秒'], [90, '90秒'], [120, '120秒'], ['custom', '指定'], [0, '無制限']];
  const DIFFS = ['初級', '中級', '上級'];
  const PALETTES = [['orange', 'オレンジ'], ['green', 'グリーン'], ['blue', 'ブルー'], ['pink', 'ピンク'], ['purple', 'ラベンダー'], ['beige', 'ベージュ']];
  const AVATARS = ['📚', '🌱', '🦉', '🐶', '🐰', '🐼', '🐧', '🦊', '🐻', '🐢', '🌸', '⭐', '🐱'];

  // ───────── 小さな道具 ─────────
  const $ = (sel, root) => (root || document).querySelector(sel);
  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    if (attrs) for (const k of Object.keys(attrs)) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (k === 'style') n.style.cssText = v;
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) n.append(kid.nodeType ? kid : String(kid));
    return n;
  }
  // 子要素を入れ替える（null・false は飛ばし、配列は広げる）
  const put = (node, ...kids) => node.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false));
  const ico = (s) => el('span', { class: 'ico', 'aria-hidden': 'true', text: s }); // 絵文字は読み上げない
  const dayKey = K.dayKey;
  const fmtTime = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); const p = (n) => String(n).padStart(2, '0'); return h ? h + ':' + p(m) + ':' + p(s % 60) : m + ':' + p(s % 60); };
  const fmtMin = (sec) => sec >= 3600 ? Math.floor(sec / 3600) + '時間' + Math.round(sec % 3600 / 60) + '分' : Math.round(sec / 60) + '分';
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const pt = (x) => (Math.round(x * 100) / 100).toString();
  let toastTimer;
  function toast(msg, action) {
    const t = $('#toast'); t.replaceChildren(el('span', { text: msg }));
    if (action) t.append(el('button', { type: 'button', text: action.label, onclick: () => { t.hidden = true; action.run(); } }));
    t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, action ? 10000 : 3000);
  }
  function announce(msg) { const n = $('#sr'); if (n) { n.textContent = ''; setTimeout(() => { n.textContent = msg; }, 30); } }

  // ── 計測（Cookie を使わない。送るのはイベント名だけで、問題IDや正誤は送らない）──
  function track(name) {
    if (!CFG.goatcounter) return;
    try { const u = CFG.goatcounter + '?p=' + encodeURIComponent('/app/' + name) + '&t=' + encodeURIComponent(name) + '&e=true&rnd=' + Math.random().toString(36).slice(2); (navigator.sendBeacon && navigator.sendBeacon(u)) || (new Image().src = u); } catch (e) { /* 送れなくてもよい */ }
  }

  // ── シート（確認・選択）。フォーカスを閉じ込め、閉じたら元に戻す ──
  function openSheet(build, opts) {
    opts = opts || {};
    const prev = document.activeElement;
    let closed = false;
    const close = () => { if (closed) return; closed = true; bg.remove(); document.removeEventListener('keydown', onKey, true); if (prev && prev.focus && document.contains(prev)) prev.focus(); opts.onClose && opts.onClose(); };
    const sheet = el('div', { class: 'sheet' + (opts.cls ? ' ' + opts.cls : ''), role: opts.role || 'dialog', 'aria-modal': 'true', 'aria-label': opts.label || '確認' });
    const bg = el('div', { class: 'sheet-bg', onclick: (e) => { if (e.target === bg) close(); } }, sheet);
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
      if (e.key === 'Tab') {
        const f = [...sheet.querySelectorAll('button,a[href],textarea,input,select,[tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };
    build(sheet, close);
    document.addEventListener('keydown', onKey, true);
    document.body.append(bg);
    const first = sheet.querySelector('[data-autofocus]') || sheet.querySelector('button,a[href]');
    first && first.focus();
    return close;
  }
  // 選択肢つきの確認。choices: [{label, value, cls}]。閉じたら null
  function choose(msg, choices) {
    return new Promise((resolve) => {
      let v = null;
      openSheet((sheet, close) => {
        sheet.append(el('p', { class: 'ask-msg', text: msg }),
          el('div', { class: 'ask-btns' }, choices.map((c, i) => el('button', { type: 'button', class: 'btn ' + (c.cls || ''), 'data-autofocus': i === choices.length - 1 ? '' : null, onclick: () => { v = c.value; close(); } }, c.label))));
      }, { cls: 'ask', role: 'alertdialog', onClose: () => resolve(v) });
    });
  }
  const ask = (msg, okLabel, danger) => choose(msg, [{ label: 'キャンセル', value: false }, { label: okLabel || 'OK', value: true, cls: danger ? 'danger' : 'primary' }]).then((v) => !!v);

  // ───────── 学習記録（端末内） ─────────
  function blankStore() {
    return {
      v: 3, q: {}, log: [], days: {}, mocks: [],
      settings: { shuffle: true, confirmMode: true, font: 'm', theme: 'auto', palette: 'orange', goal: 20, goals: { day: 20, week: 140, month: 600, total: 3000 }, sound: true, countdown: true,
        speech: true, autoSpeech: false, speechRate: 1, effects: true, foldTools: true, parts: ['A', 'B', 'C'], mockTime: 1, mockPreferNew: false, mockShuffle: false,
        qLimit: 60, qLimitCustom: 180, playMode: 'normal', lives: 3, showExplain: true, diffs: ['初級', '中級', '上級'] },
      profile: { name: '学習者', age: '', pref: '', avatar: '📚', at: 0 },
      session: null, lastResult: null, prefs: {}, createdAt: Date.now(), lastBackup: 0, launches: 0, migratedIds: '',
    };
  }
  let S = blankStore();
  const STATE = { recovered: false, saveFailed: false, readFailed: false };
  function loadStore() {
    let raw = null;
    try { raw = localStorage.getItem(STORE_KEY); } catch (e) { STATE.readFailed = true; return; }
    if (!raw) return;
    try {
      S = K.rebuild(K.sanitize(K.migrate(JSON.parse(raw)), blankStore()));
    } catch (e) {
      // 読めない記録は消さずに別名で残し、空の記録で始める
      try { localStorage.setItem(STORE_KEY + '.broken.' + Date.now(), raw); } catch (_) { /* 容量 */ }
      S = blankStore(); STATE.recovered = true;
    }
  }
  let saveTimer = null;
  function saveNow() {
    clearTimeout(saveTimer); saveTimer = null;
    const data = JSON.stringify(S, (k, v) => (k === 'resultRef' ? undefined : v));
    try { localStorage.setItem(STORE_KEY, data); STATE.saveFailed = false; return true; }
    catch (e) {
      // 容量が足りないときは、古い回答の記録を減らしてもう一度（成績の数はそのまま）
      if (S.log.length > 5000) {
        S.log.splice(0, Math.floor(S.log.length / 3));
        try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); toast('保存の容量が足りないため、古い回答の記録を整理しました'); return true; } catch (_) { /* 下へ */ }
      }
      if (!STATE.saveFailed) toast('記録を保存できませんでした。設定 → バックアップを書き出してください。');
      STATE.saveFailed = true; return false;
    }
  }
  const save = () => { if (!saveTimer) saveTimer = setTimeout(saveNow, 800); }; // まとめて保存（メモの入力中など）
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); else onVisible(); });
  window.addEventListener('pagehide', saveNow);
  // 別のタブで記録が変わったら、合わせて取り込む（あとから保存した方が勝って消える、を防ぐ）
  window.addEventListener('storage', (e) => {
    if (e.key !== STORE_KEY || !e.newValue) return;
    try {
      const other = JSON.parse(e.newValue);
      K.merge(S, other, blankStore());
      if (!S.session && other.session && !other.session.done) S.session = other.session;
      srsCache = null;
      if (route !== 'quiz') render(route);
    } catch (err) { /* 読めないときは何もしない */ }
  });

  function rec(id) { return S.q[id] || (S.q[id] = { a: 0, c: 0 }); }
  function day(k) { return S.days[k] || (S.days[k] = { n: 0, c: 0, sec: 0 }); }
  let srsCache = null;
  function srs() { return srsCache || (srsCache = K.srsFromLog(S.log)); }
  function recordAnswer(q, choice, ok, sec, unsure, mode) {
    const t = Date.now(), r = rec(q.id);
    r.s = SUBJECTS.indexOf(q.subject); r.a++; if (ok) r.c++; r.l = ok ? 1 : 0; r.t = t; r.lu = unsure ? 1 : 0; if (unsure) r.u = (r.u || 0) + 1;
    S.log.push([t, q.id, choice, ok ? 1 : 0, Math.round(sec), unsure ? 1 : 0, mode, r.s]);
    if (S.log.length > 30000) S.log.splice(0, S.log.length - 30000);
    const d = day(dayKey(t)); d.n++; if (ok) d.c++;
    srsCache = null;
    return S.log.length - 1;
  }
  const isDue = (id) => K.isDue(srs()[id]);
  const isWrong = (r) => r && r.a > 0 && (r.l === 0 || r.lu === 1);
  function streak() {
    let n = 0; let t = Date.now();
    if (!(S.days[dayKey(t)] || {}).n) t -= K.DAY;
    while ((S.days[dayKey(t)] || {}).n) { n++; t -= K.DAY; }
    return n;
  }

  // ───────── 問題データ ─────────
  const DATA = { index: null, bySubject: {}, byId: new Map(), loaded: 0, error: '', links: null, mocks: null };
  const isTheme = (s) => /^T\d{2}$/.test(s || '');
  const themeList = () => (DATA.index && Array.isArray(DATA.index.themes) ? DATA.index.themes : []);
  function themeName(id) { const t = themeList().find((x) => x.id === id); return t ? t.name : id; }
  function themeCategories() { const m = new Map(); for (const t of themeList()) { if (!m.has(t.category)) m.set(t.category, []); m.get(t.category).push(t); } return [...m]; }
  function dataTypes() { const set = new Set(); DATA.byId.forEach((q) => set.add(q.type)); return TYPES.filter((t) => set.has(t)); }
  function dataUrl(file, hash) {
    if (CFG.dataUrl) return CFG.dataUrl + (CFG.dataUrl.includes('?') ? '&' : '?') + 'file=' + file + (hash ? '&v=' + hash : '');
    return CFG.staticBase + (file === 'index' ? 'index.json' : file + '.json') + (hash ? '?v=' + hash : '');
  }
  async function fetchJson(url, ms, cacheMode) {
    const ctl = 'AbortController' in window ? new AbortController() : null;
    const timer = ctl && setTimeout(() => ctl.abort(), ms || 30000);
    try {
      const res = await fetch(url, { signal: ctl && ctl.signal, cache: cacheMode || 'no-cache', redirect: 'follow' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text(); const obj = JSON.parse(text);
      if (obj && obj.error) throw new Error(obj.error);
      return { obj, text };
    } finally { if (timer) clearTimeout(timer); }
  }
  async function openCache() { try { return 'caches' in window ? await caches.open(DATA_CACHE) : null; } catch (e) { return null; } }
  function cachedIndex() { try { const o = JSON.parse(localStorage.getItem(INDEX_KEY) || 'null'); return o && Array.isArray(o.subjects) ? o : null; } catch (e) { return null; } }
  async function fetchIndex(ms) {
    const { obj } = await fetchJson(dataUrl('index'), ms);
    if (!obj || !Array.isArray(obj.subjects)) throw new Error('データの形式が違います');
    try { localStorage.setItem(INDEX_KEY, JSON.stringify(obj)); } catch (e) { /* 容量 */ }
    return obj;
  }
  function cacheKey(meta) { return new URL('__kaigo-data/' + meta.file + '-' + (meta.hash || 'x') + '.json', location.href).href; }
  async function loadSubject(meta, cache, onlyCache) {
    const key = cacheKey(meta);
    if (cache) { try { const hit = await cache.match(key); if (hit) return await hit.json(); } catch (e) { /* 取り直す */ } }
    if (onlyCache) throw new Error('not cached');
    let got;
    try { got = await fetchJson(dataUrl(meta.file, meta.hash), 60000, 'default'); }
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
  function prepare(name, payload) {
    return (payload.questions || []).map((q) => {
      q.subject = name;
      q.negative = K.NEG_RE.test(K.questionPart(q.stem));
      return q;
    });
  }
  // 全科目を読み込んで、そろってから一度に入れ替える（途中で問題が消えないように）
  async function loadSet(index, opts) {
    opts = opts || {};
    const cache = await openCache();
    const metas = index.subjects.filter((m) => SUBJECTS.includes(m.name));
    const bySubject = {}, failed = [];
    let done = 0;
    await Promise.all(metas.map(async (m) => {
      try { bySubject[m.name] = prepare(m.name, await loadSubject(m, cache, opts.onlyCache)); }
      catch (e) { failed.push(m.name); }
      done++; opts.onProgress && opts.onProgress(done, metas.length);
    }));
    return { bySubject, failed, total: metas.length };
  }
  function applySet(index, set, keepOld) {
    const bySubject = Object.assign({}, keepOld ? DATA.bySubject : {}, set.bySubject);
    const byId = new Map();
    for (const s of Object.keys(bySubject)) for (const q of bySubject[s]) byId.set(q.id, q);
    DATA.index = index; DATA.bySubject = bySubject; DATA.byId = byId;
    DATA.loaded = Object.keys(bySubject).length;
    const missing = SUBJECTS.filter((s) => !bySubject[s] && index.subjects.some((m) => m.name === s));
    DATA.error = missing.length ? missing.join('・') + 'を読み込めませんでした（電波のある所で開き直すと読み込みます）。' : '';
    // 問題IDの付け替え（データ側で ID を変えたとき）
    if (index.idMap && S.migratedIds !== String(index.version)) {
      const n = K.applyIdMap(S, index.idMap); S.migratedIds = String(index.version); srsCache = null; if (n) saveNow();
    }
  }
  async function loadLinks() {
    try { const { obj } = await fetchJson(CFG.linksUrl, 15000, 'default'); DATA.links = obj; try { localStorage.setItem(INDEX_KEY + '.links', JSON.stringify(obj)); } catch (e) { /* 容量 */ } }
    catch (e) { try { DATA.links = JSON.parse(localStorage.getItem(INDEX_KEY + '.links') || 'null'); } catch (_) { DATA.links = null; } }
  }
  // 起動：保存してあるデータがあればそれで先に開き、裏で更新を確かめる
  async function loadAllData(onProgress) {
    const cached = cachedIndex();
    if (cached) {
      const set = await loadSet(cached, { onlyCache: true });
      if (!set.failed.length) { applySet(cached, set); setTimeout(() => refreshData(false), 1500); return; }
    }
    let index;
    try { index = await fetchIndex(navigator.onLine === false ? 1500 : 10000); }
    catch (e) { if (cached) index = cached; else throw e; }
    const set = await loadSet(index, { onProgress });
    if (set.failed.length === set.total) throw new Error('問題データを読み込めませんでした。電波のある所でもう一度開いてください。');
    applySet(index, set);
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  }
  let lastRefresh = 0;
  async function refreshData(manual) {
    lastRefresh = Date.now();
    try {
      const obj = await fetchIndex(12000);
      const old = DATA.index;
      const changed = !old || obj.version !== old.version || obj.subjects.some((m) => { const o = old.subjects.find((x) => x.name === m.name); return !o || o.hash !== m.hash; });
      if (!changed && !DATA.error) { if (manual) toast('最新の問題データです'); return; }
      const set = await loadSet(obj);
      applySet(obj, set, true); // 読めなかった科目は前のデータを残す
      const note = obj.changelog && obj.changelog[0] && (!old || obj.rev !== old.rev) ? '（' + obj.changelog[0].text + '）' : '';
      toast('問題データを更新しました' + note);
      if (route === 'home' || route === 'settings') render(route);
    } catch (e) { if (manual) toast('更新を確認できませんでした（電波がない場所かもしれません）'); }
  }
  function onVisible() {
    lastTick.t = performance.now();
    checkMockDeadline();
    if (Date.now() - lastRefresh > 6 * 3600000 && DATA.index) refreshData(false);
  }

  // ───────── 出題の組み立て ─────────
  const myParts = () => (Array.isArray(S.settings.parts) && S.settings.parts.length ? S.settings.parts : ['A', 'B', 'C']);
  const mySubjects = () => myParts().flatMap((p) => PARTS[p].subjects);
  function scopeSubjects(scope) {
    if (!scope || scope === 'mine') return mySubjects();
    if (scope === 'all' || isTheme(scope)) return SUBJECTS.slice();
    if (PARTS[scope]) return PARTS[scope].subjects.slice();
    return SUBJECTS.includes(scope) ? [scope] : null;
  }
  const playable = (q) => !(q.needsFigure && !q.figure);
  function pool(opt) {
    const subs = scopeSubjects(opt.scope) || [];
    let qs = subs.flatMap((s) => DATA.bySubject[s] || []).filter(playable);
    if (isTheme(opt.scope)) qs = qs.filter((q) => (q.themes || []).includes(opt.scope));
    if (opt.type && opt.type !== 'all') qs = qs.filter((q) => q.type === opt.type);
    if (opt.round) qs = qs.filter((q) => q.round === Number(opt.round));
    if (opt.theme) qs = qs.filter((q) => (q.theme || '') === opt.theme || (q.theme || '').includes(opt.theme));
    if (opt.filter === 'new') qs = qs.filter((q) => !(S.q[q.id] && S.q[q.id].a));
    if (opt.filter === 'due' || opt.filter === 'review') qs = qs.filter((q) => isDue(q.id));
    if (opt.filter === 'wrong') qs = qs.filter((q) => isWrong(S.q[q.id]));
    if (opt.filter === 'weak') qs = qs.filter((q) => K.needsReview(S.q[q.id]));
    if (opt.filter === 'nu') qs = qs.filter((q) => S.q[q.id] && S.q[q.id].nu && S.q[q.id].nu.length);
    if (opt.filter === 'xi') qs = qs.filter((q) => S.q[q.id] && S.q[q.id].xi);
    if (opt.field) qs = qs.filter((q) => (q.theme || '') === opt.field);
    if (opt.diffs && opt.diffs.length && opt.diffs.length < 3) qs = qs.filter((q) => opt.diffs.includes(q.diff || '中級'));
    if (opt.filter === 'star') qs = qs.filter((q) => S.q[q.id] && S.q[q.id].st);
    return qs;
  }
  // 途中の問題があれば、始める前に確かめる（模試は途中までを採点して記録することもできる）
  async function confirmReplace() {
    const s = S.session;
    if (!s || s.done || s.review) return true;
    const n = Object.keys(s.ans).length;
    if (s.kind === 'mock') {
      const v = await choose('途中の模擬試験があります（' + n + ' / ' + s.ids.length + '問 回答済み）。\nやめて新しい問題を始めますか？', [
        { label: 'キャンセル', value: null },
        { label: n ? '途中までを採点して記録する' : 'やめる', value: n ? 'grade' : 'drop' },
        { label: '記録せずにやめる', value: 'drop', cls: 'danger' },
      ]);
      if (!v) return false;
      if (v === 'grade') finishMock({ partial: true, silent: true });
      S.session = null; saveNow();
      return true;
    }
    return ask('途中の問題があります（' + n + ' / ' + s.ids.length + '問 回答済み）。\nやめて新しい問題を始めますか？\n回答した分の記録は残ります。', '始める');
  }
  function newSession(kind, questions, extra) {
    const ses = Object.assign({
      id: uid(), kind, ids: questions.map((q) => q.id), i: 0, ans: {}, sel: {}, elim: {}, unsure: {}, order: {},
      startedAt: Date.now(), elapsed: 0, qElapsed: {}, title: '', done: false,
    }, extra || {});
    const shuffleOn = kind === 'mock' ? S.settings.mockShuffle : S.settings.shuffle;
    if (shuffleOn) for (const q of questions) ses.order[q.id] = K.shuffle([1, 2, 3, 4, 5]);
    if (kind === 'practice' && ses.qLimit == null) ses.qLimit = qLimitSec();
    if (kind === 'practice' && !ses.rules) ses.rules = { mode: S.settings.playMode || 'normal', lives: S.settings.playMode === 'sudden' ? 1 : Math.max(1, Math.min(10, Number(S.settings.lives) || 3)), explain: S.settings.showExplain !== false };
    ses.marks = {};
    ses.base = growthBase();
    S.session = ses; saveNow(); return ses;
  }
  // 1問の制限時間（秒）。0 は無制限
  function qLimitSec() {
    const v = S.settings.qLimit;
    if (v === 'custom') return Math.max(1, Math.min(3600, Math.round(Number(S.settings.qLimitCustom) || 180)));
    return Number(v) || 0;
  }
  function qLimitLabel() { const v = qLimitSec(); return v ? v + '秒' : '無制限'; }
  // 「1問の時間」を選ぶ部品（ホームと設定で共通）
  function limitPicker(onChange) {
    const cur = S.settings.qLimit;
    const custom = el('input', { type: 'number', class: 'input', id: 'qlimit-custom', min: '1', max: '3600', step: '1', inputmode: 'numeric', style: 'max-width:120px', value: String(S.settings.qLimitCustom || 180),
      onchange: (e) => { S.settings.qLimitCustom = Math.max(1, Math.min(3600, Math.round(Number(e.target.value) || 180))); e.target.value = S.settings.qLimitCustom; saveNow(); onChange && onChange(); } });
    const wrap = el('div', { class: 'row', style: 'margin-top:8px', hidden: cur === 'custom' ? null : true }, el('label', { for: 'qlimit-custom', text: '1問あたり' }), custom, el('span', { text: '秒（1〜3600秒）' }));
    const chips = el('div', { class: 'chips', role: 'group', 'aria-label': '1問の制限時間' }, LIMITS.map(([v, l]) => el('button', { type: 'button', class: 'chip', 'aria-pressed': String(String(cur) === String(v)), onclick: (e) => {
      S.settings.qLimit = v; saveNow();
      e.currentTarget.parentNode.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === e.currentTarget)));
      wrap.hidden = v !== 'custom'; if (v === 'custom') custom.focus();
      onChange && onChange(); } }, l)));
    return el('div', null, chips, wrap);
  }
  async function startPractice(opt, title, skipConfirm) {
    let qs = pool(opt);
    if (!qs.length) { noQuestions(opt); return false; }
    if (!skipConfirm && !(await confirmReplace())) return false;
    const n = opt.count === 'all' ? qs.length : Math.max(1, Math.min(Number(opt.count) || 10, qs.length));
    qs = opt.order === 'seq' ? K.sortExam(qs).slice(0, n) : K.pickWithCases(qs, n);
    newSession('practice', qs, { title: title || practiceTitle(opt), opt });
    track('practice_start/' + (isTheme(opt.scope) ? 'theme' : opt.scope || 'mine'));
    go('quiz');
    return true;
  }
  // 条件に合う問題がないとき：行き止まりにせず、条件をゆるめる
  function noQuestions(opt) {
    const loosen = Object.assign({}, opt, { filter: 'all' });
    const can = opt.filter && opt.filter !== 'all' && pool(loosen).length;
    toast('条件に合う問題がありません', can ? { label: '「すべて」で始める', run: () => startPractice(loosen) } : null);
  }
  function scopeLabel(scope) {
    if (!scope || scope === 'mine') return myParts().length === 3 ? '全科目' : myParts().map((p) => PARTS[p].label).join('・');
    if (scope === 'all') return '全科目';
    if (PARTS[scope]) return PARTS[scope].label;
    if (isTheme(scope)) return themeName(scope);
    return scope;
  }
  function practiceTitle(opt) {
    const bits = [scopeLabel(opt.scope)];
    if (opt.round) bits.push('第' + opt.round + '回'); else if (opt.type && opt.type !== 'all' && dataTypes().length > 1) bits.push(opt.type);
    if (opt.field) bits.push(opt.field);
    const f = { due: '今日の復習', review: '今日の復習', new: 'まだ解いていない', wrong: '間違えた・迷った', weak: '要復習', nu: '未理解の選択肢あり', xi: '解説がおかしい', star: '★' }[opt.filter];
    if (f) bits.push(f);
    return bits.join('・');
  }
  // 今日のメニュー：期限の来た復習＋新しい問題を、科目を混ぜて
  function todayPlan() {
    const subs = mySubjects();
    const all = subs.flatMap((s) => DATA.bySubject[s] || []).filter(playable);
    const due = all.filter((q) => isDue(q.id));
    const fresh = all.filter((q) => !(S.q[q.id] && S.q[q.id].a));
    const left = daysLeft();
    const doneToday = (S.days[dayKey()] || {}).n || 0;
    const quota = left > 0 ? Math.ceil(fresh.length / left) : fresh.length;
    const newN = Math.max(0, Math.min(fresh.length, Math.max(5, quota) - Math.max(0, doneToday - due.length)));
    return { due, fresh, newN, quota, left };
  }
  async function startToday() {
    const p = todayPlan();
    const dueQs = K.pickWithCases(p.due, Math.min(p.due.length, 30));
    const newQs = K.pickWithCases(p.fresh, Math.min(p.newN || 5, 20));
    let qs = interleave(K.groupCases(dueQs.concat(newQs)));
    if (!qs.length) { toast('今日のメニューは終わっています。おつかれさまでした'); return; }
    if (!(await confirmReplace())) return;
    newSession('practice', qs, { title: '今日のメニュー（復習' + dueQs.length + '・新しい問題' + newQs.length + '）' });
    track('today_start'); go('quiz');
  }
  // 連問はまとめたまま、科目が続かないように並べる
  function interleave(groups) {
    groups = K.shuffle(groups);
    const out = []; let last = '';
    while (groups.length) {
      let i = groups.findIndex((g) => g[0].subject !== last); if (i < 0) i = 0;
      const g = groups.splice(i, 1)[0]; out.push(...g); last = g[0].subject;
    }
    return out;
  }
  function daysLeft() {
    const d = new Date(CFG.examDate + 'T00:00:00+09:00').getTime();
    return isFinite(d) ? Math.ceil((d - K.dayStart(Date.now())) / K.DAY) : 0;
  }
  async function startMock(size, type, skipConfirm) {
    // size: 'full'（全パート125問）／'mini'（25問）／'A'・'B'・'C'（パートだけ）
    let subs = SUBJECTS, total = 125;
    if (PARTS[size]) { subs = PARTS[size].subjects; total = K.PART_Q[size]; }
    const dist = size === 'mini' ? K.scaleDist(25, mySubjects()) : size === 'full' ? EXAM_DIST : K.scaleDist(total, subs);
    const qN = Object.values(dist).reduce((a, b) => a + b, 0);
    const minutes = Math.round(K.EXAM_MINUTES * qN / 125);
    const mult = S.settings.mockTime;
    const prefer = S.settings.mockPreferNew ? (q) => !(S.q[q.id] && S.q[q.id].a) : null;
    const qs = [];
    for (const s of Object.keys(dist)) {
      if (!dist[s]) continue;
      let p = (DATA.bySubject[s] || []).filter(playable).filter((q) => type === 'mix' ? q.type !== '実務者研修' : q.type === type);
      if (p.length < dist[s]) p = (DATA.bySubject[s] || []).filter(playable).filter((q) => q.type !== '実務者研修');
      qs.push(...K.pickWithCases(p, dist[s], { prefer }));
    }
    if (!qs.length) { toast('問題がありません'); return; }
    if (!skipConfirm && !(await confirmReplace())) return;
    const label = { full: '模擬試験（本番形式）', mini: 'ミニ模試', A: '模擬試験（Aパート）', B: '模擬試験（Bパート）', C: '模擬試験（Cパート）' }[size];
    const limit = mult ? minutes * 60000 * mult : 0;
    newSession('mock', qs, { title: label, limit, deadline: limit ? Date.now() + limit : 0, mockSize: size, mockType: type, minutes, mult });
    track('mock_start/' + size);
    go('quiz');
  }
  async function startIds(ids, title, skipConfirm) {
    const qs = ids.map((id) => DATA.byId.get(id)).filter((q) => q && playable(q));
    if (!qs.length) { toast('問題が見つかりませんでした'); return false; }
    if (!skipConfirm && !(await confirmReplace())) return false;
    newSession('practice', qs, { title: title || '指定の問題' }); go('quiz'); return true;
  }

  // ───────── 画面と履歴（戻るボタンでアプリが閉じないように）─────────
  const app = () => $('#app');
  let route = 'home';
  let tick = null;
  function render(r, arg) {
    stopTick();
    stopSpeech();
    if (r === 'stats') renderStats();
    else if (r === 'settings') renderSettings();
    else if (r === 'quiz') renderQuiz();
    else if (r === 'result') renderResult(arg);
    else { r = 'home'; renderHome(); }
    route = r;
  }
  function go(r, arg, opts) {
    opts = opts || {};
    const was = route;
    render(r, arg);
    window.scrollTo(0, 0);
    if (!opts.noHistory) {
      try {
        if (was === r || (was === 'quiz' && r === 'result')) history.replaceState({ r }, '', '#' + r);
        else history.pushState({ r }, '', '#' + r);
      } catch (e) { /* なし */ }
    }
    focusMain();
  }
  window.addEventListener('popstate', (e) => {
    $('.sheet-bg') && $('.sheet-bg').remove();
    const r = (e.state && e.state.r) || 'home';
    // 問題画面から戻ったらホーム（途中の問題は「続きから」で再開できる）
    render(r === 'quiz' && !(S.session && !S.session.done) ? 'home' : r, r === 'result' ? S.lastResult : undefined);
    focusMain();
  });
  // アドレスの #stats などを書き換えたとき（ブックマークやリンク）
  window.addEventListener('hashchange', () => {
    const r = location.hash.slice(1);
    if (r === route || !['home', 'stats', 'settings', 'quiz', 'result'].includes(r)) return;
    if (r === 'quiz' && !(S.session && !S.session.done)) return;
    render(r, r === 'result' ? S.lastResult : undefined); focusMain();
  });
  function focusMain() {
    requestAnimationFrame(() => { const h = $('#app [data-focus]') || $('#app h1, #app h2'); if (h) { if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } });
  }
  function tabbar(cur) {
    const b = (key, icon, label) => el('button', { type: 'button', 'aria-current': cur === key ? 'page' : null, onclick: () => go(key) }, ico(icon), el('span', { class: 'tl', text: label }));
    return el('nav', { class: 'tabbar', 'aria-label': 'メニュー' }, b('home', '✏️', '問題を解く'), b('stats', '📊', '成績'), b('settings', '⚙️', '設定'));
  }
  function topbar() {
    return el('header', { class: 'topbar' },
      el('a', { class: 'brand', href: './', onclick: (e) => { e.preventDefault(); go('home'); } }, el('img', { src: 'icons/icon.svg', alt: '' }), el('span', null, '過去問演習', el('small', { text: '介護福祉士 過去問でつなぐ合格ノート' }))),
      el('span', { class: 'spacer' }),
      installButton(),
      CFG.blogUrl ? el('a', { class: 'btn ghost small', href: CFG.blogUrl, text: 'ブログ' }) : null);
  }
  function articleUrl(slug, heading) { return CFG.blogUrl + 'articles/' + slug + '/' + (heading ? '#h=' + encodeURIComponent(heading) : ''); }

  // インストール
  let installEvt = null;
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; if (route === 'home') render('home'); });
  window.addEventListener('appinstalled', () => { installEvt = null; toast('ホーム画面に追加しました'); track('installed'); if (route === 'home') render('home'); });
  async function promptInstall() { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice.catch(() => {}); installEvt = null; render(route); }
  function installButton() {
    if (isStandalone() || !installEvt) return null;
    return el('button', { type: 'button', class: 'btn soft small', onclick: promptInstall }, ico('📲'), ' 追加');
  }
  function installGuide() {
    // 初めての起動では出さない（まず問題を解いてもらう）。2回目以降に小さく
    if (isStandalone() || S.prefs.hideInstall || S.launches < 2) return null;
    if (!isIOS() && !installEvt) return null;
    const close = el('button', { type: 'button', class: 'icon-btn small-x', 'aria-label': '閉じる', onclick: () => { S.prefs.hideInstall = 1; save(); render('home'); } }, '✕');
    if (isIOS()) return el('details', { class: 'notice slim' }, el('summary', null, ico('📲'), ' ホーム画面に追加すると、電波がなくても解けます', close),
      el('ol', null, el('li', { text: 'Safari の下にある共有ボタン（□に↑）をタップ' }), el('li', { text: '「ホーム画面に追加」を選ぶ' }), el('li', { text: 'ホーム画面のアイコンから開く' })),
      el('p', { class: 'small', text: '※iPhoneでは、Safariで解いた記録とホーム画面のアプリの記録は別々に保存されます（設定のバックアップで移せます）。' }));
    return el('div', { class: 'notice slim row' }, el('span', { class: 'grow' }, ico('📲'), ' ホーム画面に追加すると、電波がなくても解けます'),
      el('button', { type: 'button', class: 'btn primary small', onclick: promptInstall }, '追加'), close);
  }

  // ───────── 学習の積み重ね（GAS版の「今日の積み重ね」「介護福祉士レベル」「目標・実績」）─────────
  const goals = () => Object.assign({ day: 20, week: 140, month: 600, total: 3000 }, S.settings.goals || {});
  const fmtDur = (s) => { s = Math.max(0, Math.floor(Number(s) || 0)); return Math.floor(s / 3600) > 0 ? Math.floor(s / 3600) + '時間' + Math.floor(s % 3600 / 60) + '分' : Math.floor(s / 60) + '分' + (s < 600 ? s % 60 + '秒' : ''); };
  const minutes = (s) => Math.round(Math.max(0, Number(s) || 0) / 60 * 10) / 10;
  let growthCache = null;
  function growth() {
    const key = S.log.length + '|' + (S.log.length ? S.log[S.log.length - 1][0] : 0) + '|' + dayKey();
    if (!growthCache || growthCache.key !== key) growthCache = { key, g: K.growthSummary(S.log, { totalQuestions: DATA.byId.size }) };
    return growthCache.g;
  }
  function growthBase() {
    const g = growth();
    return { todayKey: g.todayKey, todayCount: g.today.count, goalDay: goals().day, level: g.learner.level, totalExp: g.learner.totalExp, achieved: g.achievements.filter((a) => a.achieved).map((a) => a.id), best: g.best };
  }
  function metric(label, value, fmt) { const b = el('b', { text: fmt(value) }); b.dataset.target = String(value); b._fmt = fmt; return el('div', { class: 'mstat' }, b, el('span', { text: label })); }
  function goalMeter(label, count, target) {
    const p = target ? Math.floor(count / target * 100) : 0;
    return el('div', { class: 'goal-row' },
      el('div', { class: 'row', style: 'justify-content:space-between' }, el('b', { text: label + ' ' + count.toLocaleString('ja-JP') + ' / ' + target.toLocaleString('ja-JP') + '問' }), el('span', { class: 'muted small', text: p + '%' })),
      el('div', { class: 'meter', role: 'progressbar', 'aria-label': label + 'の目標達成率', 'aria-valuemin': '0', 'aria-valuemax': String(target), 'aria-valuenow': String(Math.min(count, target)) }, el('i', { style: 'width:' + Math.min(100, p) + '%' })));
  }
  function barsChart(title, labels, values, unit, caption) {
    const max = Math.max(1, ...values);
    return el('section', { class: 'chart' }, el('h3', { text: title }), caption ? el('p', { class: 'small muted', text: caption }) : null,
      el('div', { class: 'bar-groups', role: 'img', 'aria-label': title + '：' + labels.map((l, i) => l + ' ' + values[i] + unit).join('、') },
        labels.map((l, i) => el('div', { class: 'bar-col' }, el('span', { class: 'bar-num', text: values[i] + unit }),
          el('div', { class: 'bar-space' }, el('i', { class: 'bar' + (labels.length === 2 && i === 0 ? ' prev' : ''), style: '--h:' + (values[i] / max * 100) + '%;--delay:' + (i * 0.08) + 's' })),
          el('span', { class: 'bar-label', text: l })))));
  }
  function statusTable(statuses, gains) {
    return el('div', { class: 'status-table' }, el('div', { class: 'srow head' }, el('b', { text: '科目' }), el('b', { text: '能力値' }), el('b', { text: gains ? '上昇' : '' })),
      statuses.map((s) => el('div', { class: 'srow' }, el('span', { text: s.name }), el('b', { text: String(s.value) }), el('span', { class: 'gain', text: gains && gains[s.name] ? '+' + gains[s.name] : '' }))));
  }
  function showStatuses() {
    const l = growth().learner, p = S.profile || {};
    openSheet((sh, close) => {
      sh.append(el('div', { class: 'row' }, el('h2', { class: 'grow', style: 'margin:0', text: (p.avatar || '📚') + ' ' + (p.name || '学習者') + ' · Lv.' + l.level }), el('button', { type: 'button', class: 'icon-btn', 'aria-label': '閉じる', onclick: close }, '✕')),
        statusTable(l.statuses),
        el('p', { class: 'small muted', text: '1問＝1EXP。レベルL→L+1に10L問。能力値はレベルが上がるときに確定します（その科目を1〜10問で+1、11〜20問で+2、その先も10問ごとに+1）。' }));
      if (l.level < 100) {
        const pend = l.statuses.filter((s) => s.stageCount);
        sh.append(el('div', { class: 'notice slim' }, el('b', { text: '今のレベルで積み重ねた科目' }),
          pend.length ? pend.map((s) => el('p', { style: 'margin:2px 0', text: s.name + ' ' + s.stageCount + '問 · 次のレベルで +' + s.pending + '予定' })) : el('p', { class: 'muted', style: 'margin:2px 0', text: '次の学習から積み重ねよう。' })));
      }
    }, { label: 'ステータス' });
  }
  function levelCard(l) {
    return el('div', { class: 'level-card' },
      el('div', { class: 'row', style: 'justify-content:space-between' }, el('b', { text: '学びの冒険' }), el('button', { type: 'button', class: 'lv-btn', onclick: showStatuses }, '介護福祉士 Lv.' + l.level)),
      el('p', { class: 'small muted', style: 'margin:2px 0', text: l.totalExp.toLocaleString('ja-JP') + ' EXP · 1問＝1EXP' }),
      el('div', { class: 'meter' }, el('i', { style: 'width:' + (l.progress * 100) + '%' })),
      el('small', { class: 'muted', text: l.level === 100 ? 'Lv.100達成！' : '次のレベルまで あと' + l.toNext.toLocaleString('ja-JP') + '問' }));
  }
  function profileCard() {
    const p = S.profile || {}, l = growth().learner;
    return el('section', { class: 'card profile' },
      el('div', { class: 'avatar', 'aria-hidden': 'true', text: p.avatar || '📚' }),
      el('div', { class: 'grow' }, el('b', { class: 'pname', text: p.name || '学習者' }),
        el('p', { class: 'small muted', style: 'margin:0', text: [p.age !== '' && p.age != null ? p.age + '歳' : '', p.pref].filter(Boolean).join(' · ') || 'プロフィールを自由に設定できます' }),
        el('div', { class: 'row', style: 'margin-top:4px' }, el('button', { type: 'button', class: 'lv-btn', onclick: showStatuses }, '介護福祉士 Lv.' + l.level),
          el('small', { class: 'muted', text: l.level === 100 ? '最高レベル到達！' : '次のレベルまで あと' + l.toNext.toLocaleString('ja-JP') + '問' }))),
      el('button', { type: 'button', class: 'btn small', onclick: editProfile }, '編集'));
  }
  async function loadMocks() {
    if (DATA.mocks) return DATA.mocks;
    try { const { obj } = await fetchJson('mocks.json', 15000, 'default'); DATA.mocks = obj; try { localStorage.setItem(INDEX_KEY + '.mocks', JSON.stringify(obj)); } catch (e) { /* 容量 */ } }
    catch (e) { try { DATA.mocks = JSON.parse(localStorage.getItem(INDEX_KEY + '.mocks') || 'null'); } catch (_) { DATA.mocks = null; } }
    return DATA.mocks;
  }
  async function editProfile() {
    const m = await loadMocks();
    const prefs = (m && m.prefs) || [];
    const p = Object.assign({ name: '学習者', age: '', pref: '', avatar: '📚' }, S.profile || {});
    openSheet((sh, close) => {
      const name = el('input', { class: 'input', id: 'pf-name', maxlength: '40', autocomplete: 'nickname', value: p.name });
      const age = el('input', { class: 'input', id: 'pf-age', type: 'number', min: '0', max: '120', step: '1', inputmode: 'numeric', value: p.age === '' ? '' : String(p.age) });
      const pref = el('select', { class: 'input', id: 'pf-pref' }, el('option', { value: '', text: '都道府県を選択' }), prefs.map((x) => el('option', { value: x, text: x })));
      pref.value = p.pref || '';
      const av = el('div', { class: 'chips', role: 'radiogroup', 'aria-label': 'アバター' }, AVATARS.map((a) => el('button', { type: 'button', class: 'chip avatar-chip', role: 'radio', 'aria-checked': String(a === p.avatar), 'aria-pressed': String(a === p.avatar), onclick: (e) => { p.avatar = a; av.querySelectorAll('.chip').forEach((c) => { c.setAttribute('aria-pressed', String(c === e.currentTarget)); c.setAttribute('aria-checked', String(c === e.currentTarget)); }); } }, a)));
      const msg = el('p', { class: 'small', role: 'status' });
      sh.append(el('h2', { text: 'あなたのプロフィール' }), el('p', { class: 'small muted', text: '名前・年齢・都道府県は自由に設定できます。この端末の中だけに保存します。都道府県は「近くで受けられる模擬試験」に使います。' }),
        el('div', { class: 'field' }, el('label', { for: 'pf-name', text: '名前（ニックネーム）' }), name),
        el('div', { class: 'field' }, el('label', { for: 'pf-age', text: '年齢（任意）' }), age),
        el('div', { class: 'field' }, el('label', { for: 'pf-pref', text: '都道府県' }), pref),
        el('div', { class: 'field' }, el('div', { class: 'label', text: 'アバター' }), av), msg,
        el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn grow', onclick: close }, '閉じる'),
          el('button', { type: 'button', class: 'btn primary grow', onclick: () => {
            const a = age.value.trim() === '' ? '' : Number(age.value);
            if (name.value.trim().length > 40 || (a !== '' && (!Number.isInteger(a) || a < 0 || a > 120))) { msg.textContent = '名前は40文字以内、年齢は0〜120歳または空欄にしてください。'; return; }
            S.profile = { name: name.value.trim() || '学習者', age: a, pref: pref.value, avatar: p.avatar, at: Date.now() }; saveNow(); close(); render(route);
          } }, '保存する')));
    }, { label: 'プロフィール' });
  }
  // 要復習の見える化（科目別・問題種別）
  function reviewOverview() {
    const qs = []; DATA.byId.forEach((q) => qs.push({ id: q.id, subject: q.subject, type: q.type || '過去問' }));
    const r = K.reviewSummary(qs, S.q, ['subject', 'type']);
    const t = r.total;
    const table = (title, prefix, names) => el('details', null, el('summary', { text: title + 'の復習問題数・割合' }),
      el('div', { class: 'table-wrap' }, el('table', { class: 'rtable' },
        el('tr', null, [title, '全問題', '要復習', '割合', '不正解・時間切れ', '正解・迷った', 'コメント', '未理解'].map((h) => el('th', { text: h }))),
        names.map((n) => r.groups[prefix + n]).filter(Boolean).map((g) => el('tr', null, [g.name, g.total + '問', g.needed + '問', (g.ratio * 100).toFixed(1) + '%（' + (g.ratio * 10).toFixed(1) + '割）', g.wrong + '問', g.uncertain + '問', g.comment + '問', g.understanding + '問'].map((v) => el('td', { text: v })))))));
    return el('section', { class: 'review-overview' }, el('h3', { text: '復習が必要な問題' }),
      el('p', { class: 'big-line', text: t.needed + ' / ' + t.total + '問 · ' + (t.ratio * 100).toFixed(1) + '%（' + (t.ratio * 10).toFixed(1) + '割）' }),
      el('div', { class: 'row small', style: 'margin:4px 0 8px' },
        el('span', { class: 'pill ng', text: '不正解・時間切れ ' + t.wrong }), el('span', { class: 'pill warn', text: '正解・迷った ' + t.uncertain }),
        el('span', { class: 'pill', text: 'コメント ' + t.comment }), el('span', { class: 'pill', text: '未理解 ' + t.understanding })),
      t.needed ? el('button', { type: 'button', class: 'btn soft small', onclick: () => startPractice({ scope: 'all', filter: 'weak', count: '20', order: 'random' }, '要復習の問題') }, '要復習から20問解く') : null,
      table('科目別', 'subject:', SUBJECTS), table('問題種別', 'type:', TYPES),
      el('p', { class: 'small muted', text: '最新の回答と今の記録で集計します。再回答で正解・迷いなしになれば「不正解・時間切れ」「迷った」から外れます。コメント・未理解は記録を消すまで対象です。複数の条件に当てはまっても要復習は1問として数えます。' }));
  }
  // ホームの「今日の積み重ね」
  function growthCard() {
    const g = growth(), G = goals();
    const goalInputs = ['day', 'week', 'month', 'total'].map((k) => el('div', { class: 'field' }, el('label', { for: 'goal-' + k, text: { day: '1日の目標', week: '1週間の目標', month: '1か月の目標', total: '累計の目標' }[k] }),
      el('input', { class: 'input', type: 'number', id: 'goal-' + k, min: '1', max: '10000000', step: '1', inputmode: 'numeric', value: String(G[k]) })));
    const goalMsg = el('p', { class: 'small muted', role: 'status' });
    const earned = g.achievements.filter((a) => a.achieved);
    return el('section', { class: 'card growth', 'aria-label': '今日の積み重ね' },
      el('h2', null, '今日の積み重ね', el('span', { class: 'sub', text: g.today.count >= G.day ? '今日の目標達成！' : '目標 ' + G.day + '問' })),
      el('div', { class: 'mstats' }, metric('連続学習', g.streak, (n) => Math.round(n) + '日'), metric('今日の解答数', g.today.count, (n) => Math.round(n) + '問'), metric('今日の解答時間', g.today.seconds, fmtDur), metric('介護福祉士レベル', g.learner.level, (n) => 'Lv.' + Math.round(n))),
      goalMeter('今日', g.today.count, G.day),
      el('div', { class: 'badges' }, el('span', { text: '今週 ' + g.week.count + '問' }), el('span', { text: '今月 ' + g.month.count + '問' }), el('span', { text: '累計 ' + g.total.count + '問' }), el('span', { text: '正答率 ' + (g.total.count ? pct(g.total.correct, g.total.count) + '%' : '–') })),
      el('div', { class: 'growth-grid' },
        barsChart('最近7日間 · 解答時間', g.recent.map((d) => Number(d.date.slice(5, 7)) + '/' + Number(d.date.slice(8, 10))), g.recent.map((d) => minutes(d.seconds)), '分', '解説を読む時間・中断の時間は含みません。'),
        levelCard(g.learner)),
      el('details', { class: 'more' }, el('summary', { text: '目標・自己ベスト・実績を見る' }),
        goalMeter('今週', g.week.count, G.week), goalMeter('今月', g.month.count, G.month), goalMeter('累計', g.total.count, G.total),
        el('p', { class: 'small muted', text: '自己ベスト：1日 ' + g.best.day + '問 ／ 1週間 ' + g.best.week + '問 ／ 1か月 ' + g.best.month + '問　｜　最長の連続学習 ' + g.longestStreak + '日' }),
        el('div', { class: 'achievements' }, earned.length ? earned.slice(0, 12).map((a) => el('span', { class: 'earned', text: '🏅 ' + a.label })) : el('span', { class: 'muted small', text: '最初のバッジを目指そう。7日連続学習・累計500問など。' })),
        el('details', { class: 'small' }, el('summary', { text: 'まだの実績' }), el('ul', { class: 'plain-list' }, g.achievements.filter((a) => !a.achieved).map((a) => el('li', { text: a.label + '（' + Math.min(a.value, a.target).toLocaleString('ja-JP') + ' / ' + a.target.toLocaleString('ja-JP') + '）' })))),
        el('div', { class: 'goal-inputs' }, goalInputs),
        el('button', { type: 'button', class: 'btn small primary', onclick: () => {
          const v = {}; for (const k of ['day', 'week', 'month', 'total']) v[k] = Number($('#goal-' + k).value);
          if (!Object.values(v).every((n) => Number.isSafeInteger(n) && n >= 1 && n <= 10000000)) { goalMsg.textContent = '目標は1〜10,000,000の整数で設定してください。'; return; }
          S.settings.goals = v; S.settings.goal = v.day; saveNow(); toast('目標を保存しました'); render('home');
        } }, '目標を保存'), goalMsg,
        el('p', { class: 'small muted', text: '1問＝1EXP（同じ問題の復習も数えます）。レベルは学習の積み重ねの目安で、Lv.100まであります。' })),
      el('details', { class: 'more' }, el('summary', { text: '復習が必要な問題（科目別・問題種別）' }), reviewOverview()));
  }
  // 近くで受けられる模擬試験（スプレッドシート「模試情報」の内容）
  function nearbyCard() {
    const box = el('section', { class: 'card' }, el('h2', null, ico('🏫'), ' 近くで受けられる模擬試験'));
    const body = el('div', null, el('p', { class: 'small muted', text: '読み込み中…' }));
    const inc = el('input', { type: 'checkbox', id: 'near-inc', checked: S.prefs.nearInclude === 0 ? null : true, onchange: (e) => { S.prefs.nearInclude = e.target.checked ? 1 : 0; save(); fill(); } });
    box.append(el('label', { class: 'row small', for: 'near-inc' }, inc, '周辺の都道府県も表示'), body);
    const fill = async () => {
      const m = await loadMocks();
      if (!m) { body.replaceChildren(el('p', { class: 'small muted', text: '模擬試験の情報を読み込めませんでした（電波のある所で開き直してください）。' })); return; }
      const pref = (S.profile || {}).pref || '', today = new Date().toISOString().slice(0, 10);
      const places = pref ? [pref].concat(inc.checked ? (m.near[pref] || []) : []) : [];
      const items = m.items.filter((x) => x.pref === '全国' || places.includes(x.pref))
        .map((x) => Object.assign({}, x, { closed: !!((x.date && x.date < today) || (x.deadline && x.deadline < today)), near: x.pref !== '全国' && x.pref !== pref }))
        .filter((x) => !x.closed)
        .sort((a, b) => (a.pref === '全国' ? 2 : a.near ? 1 : 0) - (b.pref === '全国' ? 2 : b.near ? 1 : 0) || (a.date || '9999').localeCompare(b.date || '9999'));
      const year = Number(today.slice(0, 4)) + (Number(today.slice(5, 7)) <= 1 ? 0 : 1);
      put(body, 
        el('p', { class: 'small muted', text: pref ? '対象：' + places.join('・') + '。県単位の候補で、距離順ではありません。' : '都道府県を設定すると、地域の模試の候補を表示します（今は全国・自宅受験だけ）。' }),
        pref ? null : el('button', { type: 'button', class: 'btn small soft', onclick: editProfile }, '都道府県を設定する'),
        el('div', { class: 'mock-cards' }, items.map((x) => el('article', { class: 'mock-card' },
          el('span', { class: 'mock-place', text: x.pref === '全国' ? '全国・自宅受験' : x.pref + (x.near ? ' · 周辺' : '') }),
          el('h4', { text: x.title }), el('p', { text: x.venue }),
          el('p', { text: [x.date ? '開催 ' + x.date : '日程は公式案内を確認', x.deadline ? '締切 ' + x.deadline : '', x.fee].filter(Boolean).join(' ／ ') }),
          x.note ? el('p', { class: 'small muted', text: x.note }) : null,
          el('a', { href: x.url, target: '_blank', rel: 'noopener noreferrer' }, '公式案内を見る ↗'),
          el('small', { class: 'muted', text: '　情報確認 ' + (x.verified || '未記入') })))),
        el('div', { class: 'row small', style: 'margin-top:8px' },
          places.map((pl) => el('a', { href: 'https://www.google.com/search?q=' + encodeURIComponent(pl + ' 介護福祉士 模擬試験 ' + year), target: '_blank', rel: 'noopener noreferrer' }, pl + 'の模試を探す ↗')),
          el('a', { href: m.associationUrl, target: '_blank', rel: 'noopener noreferrer' }, '都道府県介護福祉士会の一覧 ↗'),
          el('a', { href: m.examUrl, target: '_blank', rel: 'noopener noreferrer' }, '日本介護福祉士会の模試案内 ↗')),
        el('p', { class: 'small muted', text: '会場の空席・開催の変更は、必ず公式案内で確認してください。情報は ' + (m.updated || '') + ' 時点のものです。' }));
    };
    fill();
    return box;
  }

  // ── 結果画面：今回の積み重ね（EXP・レベルアップ・目標・実績）と学習グラフ ──
  function rewardsOf(base, g) {
    const out = []; if (!base) return out;
    if (base.todayKey === g.todayKey && base.todayCount < base.goalDay && g.today.count >= base.goalDay) out.push('今日の目標 ' + base.goalDay + '問、達成！');
    if (g.learner.level > base.level) out.push('介護福祉士 Lv.' + base.level + ' → Lv.' + g.learner.level);
    for (const a of g.achievements) if (a.achieved && !base.achieved.includes(a.id)) out.push('実績獲得：' + a.label);
    for (const [k, label, per] of [['day', '1日', g.today], ['week', '1週間', g.week], ['month', '1か月', g.month]]) if (base.best[k] > 0 && per.count > base.best[k]) out.push(label + 'の自己ベスト更新！ ' + per.count + '問');
    return out;
  }
  function levelScene(base, g, gained, animate) {
    const l = g.learner;
    const startCount = base ? Math.min(base.totalExp, l.totalExp) : Math.max(0, l.totalExp - gained);
    const before = K.careSnapshotAt(l, startCount);
    const stages = l.stages.filter((e) => e.atExp > startCount && e.atExp <= l.totalExp);
    const gains = {}; for (const s of l.statuses) { const o = before.statuses.find((x) => x.name === s.name); if (s.value > o.value) gains[s.name] = s.value - o.value; }
    const lv = el('strong', { class: 'game-lv' }), label = el('p', { class: 'exp-label' }), fillI = el('span', { class: 'exp-fill' });
    const track = el('div', { class: 'exp-track', role: 'progressbar', 'aria-label': '次のレベルへの経験値' }, fillI);
    const msg = el('p', { class: 'lv-announce', 'aria-live': 'polite' }), changes = el('div');
    const skip = el('button', { type: 'button', class: 'btn ghost small' }, '演出をスキップ');
    const p = S.profile || {};
    const frame = el('section', { class: 'level-scene' }, el('div', { class: 'row', style: 'justify-content:space-between' }, el('b', { text: (p.avatar || '📚') + ' ' + (p.name || '学習者') }), lv), label, track, msg, changes, skip);
    const show = (st) => { lv.textContent = 'Lv.' + st.level; fillI.style.width = st.progress * 100 + '%'; label.textContent = st.level === 100 ? 'MAX LEVEL' : st.inLevel + ' / ' + st.required + ' EXP'; };
    const timers = [];
    const final = () => {
      timers.forEach(clearTimeout); fillI.style.transition = 'none'; show(l);
      label.textContent = l.level === 100 ? 'MAX LEVEL · 累計 ' + l.totalExp.toLocaleString('ja-JP') + ' EXP' : l.inLevel + ' / ' + l.required + ' EXP · 次まであと' + l.toNext + '問';
      msg.textContent = stages.length ? 'LEVEL UP! Lv.' + before.level + ' → Lv.' + l.level : '+' + gained + ' EXP · 次の成長へ、積み重ねました。';
      changes.replaceChildren(...[statusTable(l.statuses, gains), stages.length ? null : el('p', { class: 'small muted', text: '今のレベルで学んだ科目は、次のレベルアップのときに能力値へ反映します。' })].filter(Boolean));
      skip.hidden = true;
    };
    skip.onclick = final;
    if (!animate || !S.settings.effects || reduced()) { final(); return frame; }
    fillI.style.transition = 'none'; show(before);
    let delay = 300; const dur = stages.length > 10 ? 480 : 850;
    for (const e of stages) {
      timers.push(setTimeout(() => { fillI.style.transition = 'width ' + dur / 1000 + 's cubic-bezier(.2,.8,.2,1)'; fillI.style.width = '100%'; msg.textContent = '経験値を獲得…'; }, delay)); delay += dur + 70;
      timers.push(setTimeout(() => { const nx = K.careSnapshotAt(l, e.atExp); fillI.style.transition = 'none'; show(nx); msg.textContent = 'LEVEL UP! Lv.' + e.level; changes.replaceChildren(statusTable(nx.statuses, e.gains)); frame.classList.remove('flash'); void frame.offsetWidth; frame.classList.add('flash'); }, delay)); delay += dur;
    }
    timers.push(setTimeout(() => { fillI.style.transition = 'width .9s cubic-bezier(.2,.8,.2,1)'; show(l); }, delay));
    timers.push(setTimeout(final, delay + 950));
    return frame;
  }
  function motivation(today, yesterday, unit) {
    const d = Math.round((today - yesterday) * 10) / 10;
    if (yesterday === 0) return today > 0 ? '昨日は0' + unit + '。今日は' + today + unit + 'の積み重ね。' : '今日の記録はこれから。';
    return d > 0 ? '昨日より ' + d + unit + 'アップ！' : d === 0 ? '昨日と同じ ' + today + unit + '。継続できています。' : '昨日は ' + yesterday + unit + '。今日はここまで ' + today + unit + '。自分のペースで続けよう。';
  }
  function sessionGrowth(snap, r) {
    const g = growth(), G = goals();
    const gained = r.answered;
    const box = el('section', { class: 'card growth' }, el('p', { class: 'eyebrow', text: 'YOUR STUDY STORY' }), el('h2', null, '積み重ねが、目に見える。'));
    const rewards = rewardsOf(snap.base, g);
    box.append(el('h3', { text: '今回の積み重ね' }),
      el('div', { class: 'mstats' }, metric('解いた問題', r.answered, (n) => Math.round(n) + '問'), metric('解答に取り組んだ時間', (snap.ansSec || 0), fmtDur), metric('今回獲得', gained, (n) => '+' + Math.round(n) + ' EXP'), metric('今回の正答率', r.answered ? r.correct / r.answered * 100 : 0, (n) => Math.round(n) + '%')),
      goalMeter('今日の目標', g.today.count, G.day),
      levelScene(snap.base, g, gained, !snap.celebrated),
      rewards.length ? el('div', { class: 'achievements' }, rewards.map((t) => el('span', { class: 'earned new', text: '✦ ' + t }))) : null);
    box.append(el('div', { class: 'mstats' }, metric('今日の解答数', g.today.count, (n) => Math.round(n) + '問'), metric('今日の解答時間', g.today.seconds, fmtDur), metric('今週の解答数（月曜〜今日）', g.week.count, (n) => Math.round(n) + '問'), metric('今週の解答時間', g.week.seconds, fmtDur)),
      el('p', { class: 'motivation', text: motivation(g.today.count, g.yesterday.count, '問') + ' ' + motivation(minutes(g.today.seconds), minutes(g.yesterday.seconds), '分') }),
      el('div', { class: 'chart-grid' },
        barsChart('今日と昨日 · 解いた回数', ['昨日', '今日'], [g.yesterday.count, g.today.count], '問', '昨日1日と、今日ここまでの比較'),
        barsChart('今日と昨日 · 解答時間', ['昨日', '今日'], [minutes(g.yesterday.seconds), minutes(g.today.seconds)], '分', '解説を読む時間・中断の時間は含みません'),
        barsChart('最近7日間 · 毎日の積み重ね', g.recent.map((d) => Number(d.date.slice(5, 7)) + '/' + Number(d.date.slice(8, 10))), g.recent.map((d) => minutes(d.seconds)), '分', '日ごとの解答時間。0分の日も表示します。'),
        barsChart('今週と先週 · 解いた回数', ['先週', '今週'], [g.lastWeek.count, g.week.count], '問', '先週の月〜日と、今週の月曜〜今日'),
        barsChart('今回 · 正誤', ['正解', '不正解'], [r.correct, r.answered - r.correct], '問', '今回の回答の結果')),
      el('section', { class: 'chart' }, el('h3', { text: '学習した問題が、増えている。' }),
        el('p', { class: 'small muted', text: g.uniqueCount + ' / ' + DATA.byId.size + '問を学習済み（同じ問題の再回答は1問として数えます）' }),
        el('div', { class: 'meter', role: 'progressbar', 'aria-label': '学習済みの割合', 'aria-valuemin': '0', 'aria-valuemax': String(DATA.byId.size), 'aria-valuenow': String(g.uniqueCount) }, el('i', { style: 'width:' + Math.min(100, pct(g.uniqueCount, DATA.byId.size)) + '%' })),
        el('div', { class: 'badges' }, el('span', { text: '今週 ' + g.week.count + '問' }), el('span', { text: '連続学習 ' + g.streak + '日' }), el('span', { text: '累計 ' + g.total.count + '回回答' }), el('span', { text: '累計解答時間 ' + fmtDur(g.total.seconds) }), el('span', { text: '今回正答率 ' + pct(r.correct, r.answered) + '%' }))));
    if (!snap.celebrated) {
      snap.celebrated = true; saveNow();
      // 数字が0から増えていく
      if (S.settings.effects && !reduced()) {
        const els = [...box.querySelectorAll('[data-target]')], start = performance.now();
        els.forEach((x) => { x.textContent = x._fmt(0); });
        const frame = (now) => { const t = Math.min(1, (now - start) / 1450), e = 1 - Math.pow(1 - t, 3); els.forEach((x) => { x.textContent = x._fmt(Number(x.dataset.target) * e); }); if (t < 1 && document.contains(box)) requestAnimationFrame(frame); };
        requestAnimationFrame(frame);
        box.classList.add('animate');
      }
      const life = snap.reason === 'life';
      milestone(life ? 'チャレンジ終了' : '全' + r.answered + '問、完了！', life ? r.answered + '問の学習を記録しました。振り返りから、次の一歩へ。' : 'おつかれさまでした。今日の積み重ねが、次の自信に。', true);
      const other = rewards.filter((t) => !t.startsWith('介護福祉士 Lv.'));
      if (other.length) setTimeout(() => { if (route === 'result') milestone(other[0], other.slice(1).join(' ／ ') || '積み重ねが、新しい達成につながりました。', true); }, 3800);
    }
    return box;
  }
  // 今回の振り返り（GAS版の振り返りシートの代わり。コピー・CSVで書き出せる）
  function reviewList(snap, r) {
    const rows = r.items.map((it, i) => {
      const q = DATA.byId.get(it.id), rq = S.q[it.id] || {}, a = snap.ans[it.id];
      const flags = [];
      if (a && a.timeout) flags.push('時間切れ'); else if (it.answered && !it.ok) flags.push('不正解');
      if (it.unsure) flags.push('迷った');
      if (rq.n && rq.n.trim()) flags.push('コメント');
      if (rq.nu && rq.nu.length) flags.push('未理解');
      return { i, id: it.id, q, flags, a, note: rq.n || '', nu: rq.nu || [] };
    }).filter((x) => x.flags.length);
    if (!rows.length) return null;
    const asText = () => rows.map((x) => (x.i + 1) + '. ' + x.id + '｜' + (x.q ? x.q.subject + (x.q.round ? '・第' + x.q.round + '回' : '') : '') + '｜' + x.flags.join('・') + (x.nu.length ? '（未理解の選択肢：' + x.nu.join('・') + '番）' : '') + (x.note ? '\n   コメント：' + x.note.replace(/\n/g, ' ') : '') + (x.q ? '\n   ' + (K.splitCase(x.q.stem) || { question: x.q.stem }).question.replace(/\n/g, ' ').slice(0, 80) : '')).join('\n');
    const csv = () => '﻿' + [['順', '問題ID', '科目', '回', '結果', '迷った', '未理解の選択肢（本試験の番号）', 'コメント', '問題文']].concat(rows.map((x) => [x.i + 1, x.id, x.q ? x.q.subject : '', x.q && x.q.round ? '第' + x.q.round + '回' : '', x.a ? (x.a.timeout ? '時間切れ' : x.flags.includes('不正解') ? '不正解' : '正解') : '未回答', x.flags.includes('迷った') ? '迷った' : '', x.nu.join('・'), x.note, x.q ? x.q.stem : ''])).map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const counts = (f) => rows.filter((x) => x.flags.includes(f)).length;
    return el('section', { class: 'card' }, el('h2', null, '今回の学習を振り返る', el('span', { class: 'sub', text: rows.length + '問' })),
      el('p', { class: 'small muted', style: 'margin:0 0 8px', text: '迷った ' + counts('迷った') + ' ／ コメント ' + counts('コメント') + ' ／ 不正解 ' + counts('不正解') + ' ／ 時間切れ ' + counts('時間切れ') + ' ／ 未理解 ' + counts('未理解') }),
      el('ul', { class: 'qlist' }, rows.map((x) => el('li', null, el('button', { type: 'button', onclick: () => openReview(snap, x.i) },
        el('span', { class: 'res ' + (x.flags.includes('不正解') || x.flags.includes('時間切れ') ? 'ng' : 'ok'), 'aria-hidden': 'true', text: x.flags.includes('不正解') || x.flags.includes('時間切れ') ? '×' : '○' }),
        el('span', { class: 't' }, el('span', { class: 's', text: (x.i + 1) + '. ' + x.flags.join('・') + (x.nu.length ? '（未理解 ' + x.nu.join('・') + '番）' : '') }), x.note ? '📝 ' + x.note : x.q ? (K.splitCase(x.q.stem) || { question: x.q.stem }).question : x.id))))),
      el('div', { class: 'row', style: 'margin-top:10px' },
        el('button', { type: 'button', class: 'btn small', onclick: async () => { try { await navigator.clipboard.writeText(asText()); toast('振り返りをコピーしました'); } catch (e) { toast('コピーできませんでした'); } } }, '📋 コピー'),
        el('button', { type: 'button', class: 'btn small', onclick: () => { const a = el('a', { href: URL.createObjectURL(new Blob([csv()], { type: 'text/csv' })), download: '振り返り_' + dayKey() + '.csv' }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); } }, '⬇ CSVで書き出す（スプレッドシート用）'),
        rows.length ? el('button', { type: 'button', class: 'btn small soft', onclick: () => startIds(rows.map((x) => x.id), '振り返りの問題（' + rows.length + '問）') }, 'この' + rows.length + '問をもう一度') : null));
  }

  // ── ホーム ──
  function stat(v, k) { return el('div', null, el('div', { class: 'v', text: String(v) }), el('div', { class: 'k', text: k })); }
  function renderHome() {
    const today = S.days[dayKey()] || { n: 0, c: 0, sec: 0 };
    const goal = S.settings.goal || 20;
    const plan = todayPlan();
    const p = Object.assign({ by: 'subject', scope: 'mine', type: '過去問', round: '', field: '', filter: 'all', count: '10', order: 'random', diffs: DIFFS.slice() }, S.prefs.practice || {});
    const types = dataTypes();
    if (types.length <= 1) p.type = 'all'; else if (p.type !== 'all' && !types.includes(p.type)) p.type = types[0];
    const hasThemes = themeList().length > 0;
    if (!hasThemes) p.by = 'subject';
    if (p.by === 'theme' && !isTheme(p.scope)) p.scope = themeList()[0].id;
    if (p.by === 'subject' && (isTheme(p.scope) || p.scope === 'all')) p.scope = 'mine';

    const root = el('main', { class: 'shell' }, topbar());
    if (STATE.recovered) root.append(el('div', { class: 'notice warn' }, el('b', { text: '前の学習記録を読めませんでした。' }), '読めなかった記録は端末の中に別の名前で残してあります。バックアップがあれば、設定から読み込んでください。'));
    if (STATE.saveFailed || STATE.readFailed) root.append(el('div', { class: 'notice warn', text: 'この画面では記録を保存できていません（プライベートブラウズや容量不足の可能性があります）。設定 → バックアップを書き出してください。' }));
    if (DATA.error) root.append(el('div', { class: 'notice warn', text: DATA.error }));
    const g = installGuide(); if (g) root.append(g);
    const backupAgo = S.lastBackup ? (Date.now() - S.lastBackup) / K.DAY : (Date.now() - S.createdAt) / K.DAY;
    const snoozed = S.prefs.backupSnooze && Date.now() < S.prefs.backupSnooze;
    if (S.log.length >= 50 && backupAgo >= 14 && !snoozed) {
      root.append(el('div', { class: 'notice row' }, el('span', { class: 'grow', text: (S.lastBackup ? '最後のバックアップから' + Math.floor(backupAgo) + '日たちました。' : 'まだバックアップがありません。') + '記録は端末の中だけにあるので、ときどき書き出しておくと安心です。' }),
        el('button', { type: 'button', class: 'btn small primary', onclick: () => exportBackup() }, '書き出す'),
        el('button', { type: 'button', class: 'btn small ghost', onclick: () => { S.prefs.backupSnooze = Date.now() + 7 * K.DAY; save(); render('home'); } }, 'あとで')));
    }

    root.append(profileCard());
    // 1. いちばん上：1ボタンで始める
    const left = plan.left;
    const ses = S.session;
    const todayCard = el('section', { class: 'card hero' },
      el('h1', { class: 'hero-h', 'data-focus': '' }, '今日のメニュー'),
      el('p', { class: 'hero-sub' },
        left > 0 ? ['試験（', CFG.examDate.replace(/^(\d+)-0?(\d+)-0?(\d+)$/, '$2月$3日'), '）まで ', el('b', { text: 'あと' + left + '日' }), '。'] : null,
        plan.due.length ? ['復習の時期が来た問題 ', el('b', { text: plan.due.length + '問' }), '、'] : null,
        '新しい問題 ', el('b', { text: Math.min(plan.newN || 5, 20) + '問' }),
        left > 0 && plan.fresh.length ? '（まだ解いていない' + plan.fresh.length + '問を、1日' + plan.quota + '問で終わるペース）' : ''),
      el('button', { type: 'button', class: 'btn primary block lg', onclick: startToday }, ico('▶'), ' 今日のメニューを始める'),
      el('div', { class: 'row', style: 'margin-top:8px' },
        el('button', { type: 'button', class: 'btn soft grow', onclick: () => startPractice({ scope: 'mine', filter: 'all', count: '5', order: 'random' }, 'すきま時間の5問') }, '5問だけ'),
        plan.due.length ? el('button', { type: 'button', class: 'btn soft grow', onclick: () => startPractice({ scope: 'mine', filter: 'due', count: '20', order: 'random' }, '今日の復習') }, '復習だけ（' + plan.due.length + '）') : null));
    root.append(todayCard);

    if (ses && !ses.done && !ses.review) {
      const answered = Object.keys(ses.ans).length;
      const mockLeft = ses.kind === 'mock' && ses.deadline ? ses.deadline - (ses.pausedAt || Date.now()) : null;
      root.append(el('section', { class: 'card resume' },
        el('h2', null, ico('⏸'), ' 途中の問題があります'),
        el('p', { class: 'small muted', style: 'margin:0 0 8px', text: ses.title + '｜' + answered + ' / ' + ses.ids.length + '問 回答済み' + (mockLeft != null ? '｜残り ' + fmtTime(mockLeft) + (ses.pausedAt ? '（一時停止中）' : '') : '') }),
        el('div', { class: 'progressbar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(ses.ids.length), 'aria-valuenow': String(answered), 'aria-label': '回答済み' }, el('i', { style: 'width:' + pct(answered, ses.ids.length) + '%' })),
        el('div', { class: 'row', style: 'margin-top:12px' },
          el('button', { type: 'button', class: 'btn primary grow', onclick: () => go('quiz') }, '続きから解く'),
          el('button', { type: 'button', class: 'btn', onclick: async () => { if (await confirmReplace()) { S.session = null; saveNow(); render('home'); } } }, 'やめる'))));
    }

    root.append(growthCard());

    // 2. 自分で選ぶ（たたむ）
    const scopeSel = el('select', { class: 'input', id: 'f-scope' });
    const roundSel = el('select', { class: 'input', id: 'f-round' });
    const fieldSel = el('select', { class: 'input', id: 'f-field' });
    const info = el('p', { class: 'small muted', style: 'margin:8px 0 0', 'aria-live': 'polite' });
    const startBtn = el('button', { type: 'button', class: 'btn primary block lg', style: 'margin-top:12px' });
    const scopeLbl = el('label', { for: 'f-scope', text: p.by === 'theme' ? 'テーマ' : '科目・パート' });
    const scopeStats = el('div', { class: 'scope-stats' });
    if (!Array.isArray(p.diffs) || !p.diffs.length) p.diffs = DIFFS.slice();
    function count(scope) { return pool({ scope }).length; }
    function fillScope() {
      if (p.by === 'theme') {
        put(scopeSel, ...themeCategories().map(([cat, ts]) => el('optgroup', { label: cat }, ts.map((t) => el('option', { value: t.id, text: t.id + ' ' + t.name + '（' + count(t.id) + '問）' })))));
      } else {
        put(scopeSel, 
          el('optgroup', { label: 'まとめて選ぶ' },
            el('option', { value: 'mine', text: (myParts().length === 3 ? '全科目' : '受けるパート（' + myParts().join('・') + '）') + '（' + count('mine') + '問）' }),
            myParts().length < 3 ? el('option', { value: 'all', text: '全科目（' + count('all') + '問）' }) : null,
            Object.keys(PARTS).map((k) => el('option', { value: k, text: PARTS[k].label + '（' + PARTS[k].subjects.length + '科目・' + count(k) + '問）' }))),
          el('optgroup', { label: '科目ごとに選ぶ' }, SUBJECTS.map((s) => el('option', { value: s, text: s + '（' + count(s) + '問）' }))));
      }
      scopeSel.value = p.scope; if (scopeSel.value !== p.scope) { scopeSel.selectedIndex = 0; p.scope = scopeSel.value; }
    }
    function fillRounds() {
      const rounds = [...new Set(pool({ scope: p.scope }).filter((q) => q.round).map((q) => q.round))].sort((a, b) => b - a);
      const ex = (DATA.index && DATA.index.excluded) || [];
      const cnt = (r) => pool({ scope: p.scope, round: r }).length;
      put(roundSel, el('option', { value: '', text: 'すべての回' }), rounds.map((r) => {
        const pend = ex.filter((e) => e.round === r && scopeSubjects(p.scope) && scopeSubjects(p.scope).includes(e.subject)).length;
        return el('option', { value: String(r), text: '第' + r + '回（' + cnt(r) + '問）' + (pend ? '（図の問題' + pend + '問は準備中）' : '') });
      }));
      roundSel.value = rounds.includes(Number(p.round)) ? String(p.round) : ''; p.round = roundSel.value;
    }
    // 分野（科目の中の細かい分類。GAS版の「分野」）
    function fillFields() {
      const m = new Map();
      for (const q of pool({ scope: p.scope, round: p.round })) if (q.theme) m.set(q.theme, (m.get(q.theme) || 0) + 1);
      const names = [...m.keys()].sort((a, b) => a.localeCompare(b, 'ja'));
      put(fieldSel, el('option', { value: '', text: 'すべて' }), names.map((n) => el('option', { value: n, text: n + '（' + m.get(n) + '問）' })));
      fieldSel.value = names.includes(p.field) ? p.field : ''; p.field = fieldSel.value;
    }
    const chipGroup = (name, items, val, label) => el('div', { class: 'chips', role: 'group', 'aria-label': label }, items.map(([v, l]) => el('button', { type: 'button', class: 'chip', 'aria-pressed': String(v === val), onclick: (e) => {
      p[name] = v; if (name === 'type' && v !== '過去問') p.round = '';
      e.currentTarget.parentNode.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === e.currentTarget)));
      if (name === 'by') { p.scope = v === 'theme' ? (themeList()[0] || {}).id : 'mine'; fillScope(); scopeLbl.textContent = v === 'theme' ? 'テーマ' : '科目・パート'; fillRounds(); fillFields(); }
      update(); } }, l)));
    const diffChips = el('div', { class: 'chips', role: 'group', 'aria-label': '難易度（複数選べます）' }, DIFFS.map((d) => el('button', { type: 'button', class: 'chip', 'aria-pressed': String(p.diffs.includes(d)), onclick: (e) => {
      const on = p.diffs.includes(d); if (on && p.diffs.length === 1) { toast('1つ以上選んでください'); return; }
      p.diffs = on ? p.diffs.filter((x) => x !== d) : DIFFS.filter((x) => x === d || p.diffs.includes(x));
      e.currentTarget.setAttribute('aria-pressed', String(!on)); update(); } }, d)));
    const sw = (label, key, desc, after) => { const id = 'h-' + key; return el('div', { class: 'switch' }, el('label', { for: id }, label, desc ? el('span', { class: 'small muted', style: 'display:block', text: desc }) : null),
      el('input', { type: 'checkbox', role: 'switch', id, checked: S.settings[key] ? true : null, onchange: (e) => { S.settings[key] = e.target.checked; saveNow(); after && after(); } })); };
    const livesSel = el('select', { class: 'input', id: 'f-lives', style: 'max-width:110px', onchange: (e) => { S.settings.lives = Number(e.target.value); saveNow(); } }, Array.from({ length: 10 }, (_, i) => el('option', { value: String(i + 1), text: (i + 1) + '個' })));
    livesSel.value = String(S.settings.lives || 3);
    const livesWrap = el('label', { class: 'row small', for: 'f-lives', hidden: S.settings.playMode === 'life' ? null : true }, 'ライフの個数', livesSel);
    const playChips = el('div', { class: 'chips', role: 'group', 'aria-label': 'プレイモード' }, [['normal', '通常'], ['life', 'ライフ'], ['sudden', 'サドンデス']].map(([v, l]) => el('button', { type: 'button', class: 'chip', 'aria-pressed': String((S.settings.playMode || 'normal') === v), onclick: (e) => {
      S.settings.playMode = v; saveNow(); e.currentTarget.parentNode.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === e.currentTarget))); livesWrap.hidden = v !== 'life'; } }, l)));
    let lastPrefs = '';
    function update() {
      p.scope = scopeSel.value; p.round = roundSel.value; p.field = fieldSel.value;
      roundSel.disabled = types.length > 1 && p.type !== '過去問'; if (roundSel.disabled) roundSel.value = '';
      const n = pool(p).length, take = p.count === 'all' ? n : Math.min(Number(p.count), n);
      info.textContent = '条件に合う問題：' + n + '問';
      startBtn.textContent = n ? '▶ ' + take + '問を解く（学習開始）' : '問題がありません';
      startBtn.disabled = !n;
      renderScopeStats();
      const now = JSON.stringify(p);
      if (now !== lastPrefs) { lastPrefs = now; S.prefs.practice = Object.assign({}, p); save(); }
    }
    // 選んだ範囲の分野別成績（GAS版の「この科目の分野別成績」）
    function renderScopeStats() {
      const qs = pool({ scope: p.scope, round: p.round, diffs: p.diffs });
      let seen = 0, a = 0, c = 0, weak = 0;
      const rows = new Map();
      for (const q of qs) {
        const r = S.q[q.id] || {}, k = q.theme || '（分野なし）';
        const row = rows.get(k) || { n: 0, seen: 0, a: 0, c: 0, weak: 0 }; rows.set(k, row);
        row.n++; if (r.a) { seen++; row.seen++; a += r.a; c += r.c; row.a += r.a; row.c += r.c; }
        if (K.needsReview(r)) { weak++; row.weak++; }
      }
      const list = [...rows.entries()].sort((x, y) => y[1].weak - x[1].weak || x[0].localeCompare(y[0], 'ja'));
      put(scopeStats, 
        el('div', { class: 'row', style: 'justify-content:space-between' }, el('b', { text: scopeLabel(p.scope) + (p.round ? '・第' + p.round + '回' : '') + 'の分野別成績' }), el('span', { class: 'small muted', text: '不正解・時間切れ・迷った・コメント・未理解を集計' })),
        el('div', { class: 'today', style: 'margin:8px 0' }, stat(seen + '/' + qs.length, '解いた問題'), stat(a ? pct(c, a) + '%' : '—', '正答率'), stat(weak, '復習対象'), stat(qs.length - seen, '未回答')),
        list.length ? el('div', { class: 'table-wrap' }, el('table', { class: 'rtable' }, el('tr', null, ['分野', '学習済み', '正答率', '復習対象'].map((h) => el('th', { text: h }))),
          list.map(([k, r]) => el('tr', null, el('td', null, el('button', { type: 'button', class: 'linklike', onclick: () => { fieldSel.value = k === '（分野なし）' ? '' : k; update(); fieldSel.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }, k)), el('td', { text: r.seen + '/' + r.n }), el('td', { text: r.a ? pct(r.c, r.a) + '%' : '—' }), el('td', { text: r.weak + '問' }))))) : null);
    }
    scopeSel.onchange = () => { p.scope = scopeSel.value; fillRounds(); fillFields(); update(); };
    roundSel.onchange = () => { p.round = roundSel.value; fillFields(); update(); };
    fieldSel.onchange = update;
    startBtn.onclick = () => startPractice(Object.assign({}, p));
    fillScope(); fillRounds(); fillFields();
    const detailsOpen = !!S.prefs.formOpen;
    const form = el('details', { class: 'card fold', open: detailsOpen ? true : null, ontoggle: (e) => { S.prefs.formOpen = e.currentTarget.open ? 1 : 0; save(); } },
      el('summary', null, el('h2', null, ico('✏️'), ' 自分で選んで解く'), el('span', { class: 'sub', text: '科目・分野・回・難易度・制限時間' })),
      ...[
        hasThemes ? el('div', { class: 'field' }, el('div', { class: 'label', text: '分け方' }), chipGroup('by', [['subject', '科目別'], ['theme', 'テーマ別']], p.by, '分け方')) : null,
        el('div', { class: 'field' }, scopeLbl, scopeSel),
        el('div', { class: 'two-col' },
          el('div', { class: 'field' }, el('label', { for: 'f-field', text: '分野' }), fieldSel),
          el('div', { class: 'field' }, el('label', { for: 'f-round', text: '過去問の回' }), roundSel)),
        types.length > 1 ? el('div', { class: 'field' }, el('div', { class: 'label', text: '問題の種類' }), chipGroup('type', types.map((t) => [t, t]).concat([['all', 'すべて']]), p.type, '問題の種類')) : null,
        el('div', { class: 'field' }, el('div', { class: 'label', text: '出題モード' }), chipGroup('filter', [['all', 'すべて'], ['new', '未回答'], ['due', '今日の復習'], ['weak', '要復習（不正解・迷った・コメント・未理解）'], ['nu', '未理解の選択肢あり'], ['xi', '解説がおかしいと記録した問題'], ['star', '★をつけた']], p.filter === 'review' ? 'due' : p.filter === 'wrong' ? 'weak' : p.filter, '出題モード')),
        el('div', { class: 'field' }, el('div', { class: 'label', text: '難易度（複数選べます）' }), diffChips,
          el('p', { class: 'small muted', style: 'margin:4px 0 0', text: '初級：一般常識・基本的な配慮／中級：用語や基本知識／上級：細かな条件・数値・複合判断。公式の区分ではなく学習用の目安です。' })),
        el('div', { class: 'row', style: 'gap:16px;align-items:flex-start' },
          el('div', { class: 'field grow' }, el('div', { class: 'label', text: '問題数' }), chipGroup('count', [['5', '5'], ['10', '10'], ['20', '20'], ['50', '50'], ['100', '100'], ['all', '対象すべて']], p.count, '問題数')),
          el('div', { class: 'field' }, el('div', { class: 'label', text: '出題の順番' }), chipGroup('order', [['random', 'ランダム'], ['seq', '試験の順']], p.order, '出題の順番'))),
        el('div', { class: 'field' }, el('div', { class: 'label', text: '1問の制限時間（時間切れは不正解）' }), limitPicker()),
        el('div', { class: 'field' }, el('div', { class: 'label', text: 'プレイモード' }), playChips, livesWrap,
          el('p', { class: 'small muted', style: 'margin:4px 0 0', text: 'ライフ：決めた数だけまちがえると終了。サドンデス：1問まちがえると終了。時間切れも1回のまちがいです。' })),
        el('div', { class: 'switches' },
          sw('答え合わせ後に解説を表示する', 'showExplain', 'オフにすると、答え合わせのあとすぐ次の問題へ進みます（解説は結果の画面から見られます）'),
          sw('選択肢の順番をランダムにする', 'shuffle', '問題ごとに並べ替えます。記録は本試験の番号で残します'),
          sw('残り5秒でカウントダウン音', 'countdown', '効果音がオンのときに鳴ります')),
        info, startBtn,
        el('details', { class: 'more', style: 'margin-top:12px' }, el('summary', { text: '選んだ範囲の分野別成績' }), scopeStats),
      ].filter(Boolean));
    root.append(form);
    update();

    // 3. 模擬試験
    const mockTypes = types.filter((t) => t !== '実務者研修');
    let mtype = S.prefs.mockType || mockTypes[0] || '過去問';
    if (mtype !== 'mix' && !mockTypes.includes(mtype)) mtype = mockTypes[0] || '過去問';
    if (mtype === 'mix' && mockTypes.length < 2) mtype = mockTypes[0] || '過去問';
    const mockChoices = mockTypes.map((t) => [t, t]).concat(mockTypes.length > 1 ? [['mix', '混合']] : []);
    const tl = (min) => S.settings.mockTime ? Math.round(min * S.settings.mockTime) + '分' : '時間制限なし';
    const parts = myParts();
    root.append(el('section', { class: 'card' }, el('h2', null, ico('⏱'), ' 模擬試験'),
      el('p', { class: 'small muted', style: 'margin:0 0 10px', text: '本番と同じ科目の配分で' + (mockTypes.length === 1 ? mockTypes[0] + 'から' : '') + '出題します。答え合わせは最後にまとめて行い、第38回の合格基準で判定します。' }),
      mockChoices.length > 1 ? el('div', { class: 'field' }, el('div', { class: 'label', text: '問題の種類' }), el('div', { class: 'chips' }, mockChoices.map(([v, l]) => el('button', { type: 'button', class: 'chip', 'aria-pressed': String(v === mtype), onclick: (e) => { mtype = v; S.prefs.mockType = v; save(); e.currentTarget.parentNode.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === e.currentTarget))); } }, l)))) : null,
      el('div', { class: 'mock-btns' },
        parts.length === 3 ? el('button', { type: 'button', class: 'btn primary', onclick: () => startMock('full', mtype) }, el('b', { text: '本番形式' }), el('small', { text: '125問・' + tl(220) })) : null,
        parts.map((k) => el('button', { type: 'button', class: 'btn soft', onclick: () => startMock(k, mtype) }, el('b', { text: PARTS[k].label }), el('small', { text: K.PART_Q[k] + '問・' + tl(Math.round(220 * K.PART_Q[k] / 125)) }))),
        el('button', { type: 'button', class: 'btn soft', onclick: () => startMock('mini', mtype) }, el('b', { text: 'ミニ模試' }), el('small', { text: '25問・' + tl(44) }))),
      el('p', { class: 'small muted', style: 'margin:8px 0 0', text: '時間の延長（1.3倍・1.5倍）や、まだ解いていない問題を優先する設定は「設定」にあります。' })));

    root.append(nearbyCard());
    root.append(aboutBlock());
    root.append(tabbar('home'));
    app().replaceChildren(root);
  }
  // 出典・独自解説・法改正・プライバシーの表示
  function aboutBlock(full) {
    const ex = (DATA.index && DATA.index.excluded) || [];
    return el('section', { class: 'about small muted', 'aria-label': 'このアプリについて' },
      el('p', null, '出典：', SOURCE, '（第24〜38回）。問題文と選択肢は試験センターが公表した文言のまま載せています（選択肢の並べ替えは表示上のもので、文言は変えていません）。'),
      el('p', null, '解説は当サイトが独自に作成したもので、社会福祉振興・試験センター・厚生労働省とは関係ありません。法改正により、今の制度と異なる問題があります（注記のある問題は「法改正あり」と表示）。'),
      ex.length ? el('p', { text: '図がないと答えられない問題（' + ex.length + '問）は、図を用意するまで出題していません。' }) : null,
      full ? el('p', null, '学習記録・メモはこの端末の中（localStorage）だけに保存し、運営者には送りません。問題データを読み込むときに配信元（GitHub Pages' + (CFG.dataUrl ? '・Google Apps Script' : '') + '）と通信し、接続の記録がそのサービスに残る場合があります。' + (CFG.goatcounter ? '利用状況を知るため、Cookie を使わない計測（GoatCounter）で画面の操作名だけを送っています。問題の正誤や記録は送りません。' : '') + 'バックアップのファイルにはメモも含まれるので、取り扱いに気をつけてください。') : null,
      full && CFG.privacyUrl ? el('p', null, el('a', { href: CFG.privacyUrl }, 'プライバシーポリシー')) : null);
  }

  // ── 問題画面 ──
  const lastTick = { t: 0 };
  function mockLeftMs(ses) { return ses.deadline ? ses.deadline - (ses.pausedAt || Date.now()) : Infinity; }
  function checkMockDeadline() {
    const ses = S.session;
    if (ses && ses.kind === 'mock' && !ses.done && !ses.review && ses.deadline && !ses.pausedAt && Date.now() >= ses.deadline) {
      toast('時間になりました。採点します。'); finishMock();
      return true;
    }
    return false;
  }
  function startTick(update) {
    stopTick(); if (!lastTick.t || performance.now() - lastTick.t > 2000) lastTick.t = performance.now();
    let n = 0;
    tick = setInterval(() => {
      const now = performance.now(), dt = now - lastTick.t; lastTick.t = now;
      if (document.hidden || !S.session || dt > 5000) return;
      const ses = S.session, id = ses.ids[ses.i];
      if (ses.pausedAt) { update(); return; }
      ses.elapsed += dt;
      const answered = ses.kind === 'practice' && ses.ans[id];
      if (!answered && !ses.review) ses.qElapsed[id] = (ses.qElapsed[id] || 0) + dt;
      day(dayKey()).sec = Math.round((day(dayKey()).sec || 0) + dt / 1000);
      update();
      if (++n % 20 === 0) save();
      if (checkMockDeadline()) stopTick();
    }, 500);
  }
  function stopTick() { if (tick) { clearInterval(tick); tick = null; } }

  function renderRich(text) {
    const box = el('div');
    let ul = null;
    for (const raw of String(text).split('\n')) {
      const line = raw.trim();
      if (!line) { ul = null; continue; }
      const h = line.match(/^【(.+)】$/);
      if (h) { box.append(el('h4', { text: h[1] })); ul = null; continue; }
      if (/^[・●○]/.test(line)) { if (!ul) box.append(ul = el('ul')); ul.append(el('li', { text: line.replace(/^[・●○]\s*/, '') })); continue; }
      ul = null; box.append(el('p', { text: line }));
    }
    return box;
  }
  // 「適切でないもの」などを強調して表示する
  function stemNode(text, negative) {
    const box = el('div', { class: 'stem' });
    if (!negative) { box.textContent = text; return box; }
    const parts = String(text).split(K.NEG_RE);
    for (const part of parts) box.append(K.NEG_RE.test(part) ? el('mark', { text: part }) : document.createTextNode(part));
    return box;
  }
  function displayOrder(ses, q) { return ses.order[q.id] || [1, 2, 3, 4, 5]; }
  function rontenLinks(q) {
    const L = DATA.links; if (!L) return [];
    const out = [], seen = new Set();
    for (const r of q.ronten || []) { const x = L.ronten && L.ronten[r]; if (x && !seen.has(x.a + x.h)) { seen.add(x.a + x.h); out.push({ url: articleUrl(x.a, x.h), label: x.name, art: (L.articles[x.a] || {}).label }); } }
    if (!out.length) for (const t of q.themes || []) for (const slug of (L.themes && L.themes[t]) || []) { const a = L.articles[slug] || {}; out.push({ url: articleUrl(slug), label: a.title || slug, art: a.label }); }
    return out.slice(0, 3);
  }

  // ── 問題文のマーク（GAS版と同じ5種類）──
  // 範囲は問題文（原文）の文字位置で持つ。表示を飾るだけで、文章は変えない。
  const MARK_TYPES = [
    { sym: '○', label: '本人・希望', hint: '誰の意思か／本人の望み' },
    { sym: '□', label: '状態・事実', hint: '病気・能力・生活状況・支援者' },
    { sym: '△', label: '変化・困りごと', hint: '以前と現在の違い／困っていること' },
    { sym: '☆', label: '問われていること', hint: '何を1つ選ぶのか／判断する目的' },
    { sym: '！', label: '条件・否定・数字', hint: '「ない」「まず」「最も」／時期・年齢・数値' },
  ];
  const markUndo = {};
  function markSig(text) { let n = 2166136261; for (let i = 0; i < text.length; i++) n = Math.imul(n ^ text.charCodeAt(i), 16777619); return text.length + ':' + (n >>> 0).toString(36); }
  function markEntry(ses, q) {
    ses.marks = ses.marks || {};
    const sig = markSig(q.stem);
    let e = ses.marks[q.id];
    if (!e || e.s !== sig) e = { s: sig, r: [] };
    let end = 0;
    e.r = (Array.isArray(e.r) ? e.r : []).filter((a) => Array.isArray(a) && a.length === 3 && a[0] >= 0 && a[1] > a[0] && a[1] <= q.stem.length && a[2] >= 0 && a[2] < MARK_TYPES.length)
      .sort((a, b) => a[0] - b[0]).filter((a) => { if (a[0] < end) return false; end = a[1]; return true; }).slice(0, 80);
    ses.marks[q.id] = e; return e;
  }
  function replaceMarkRange(ranges, a, b, type) {
    const next = [];
    for (const [x, y, t] of ranges) { if (y <= a || x >= b) next.push([x, y, t]); else { if (x < a) next.push([x, a, t]); if (y > b) next.push([b, y, t]); } }
    if (type >= 0) next.push([a, b, type]);
    next.sort((x, y) => x[0] - y[0]);
    const out = [];
    for (const r of next) { const l = out[out.length - 1]; if (l && l[1] === r[0] && l[2] === r[2]) l[1] = r[1]; else out.push(r); }
    return out;
  }
  // 問題文の from〜to を、マークと「適切でないもの」の強調つきで描く。どの span も data-o（原文の位置）を持つ
  function markedText(stem, from, to, ranges, negative) {
    const cuts = new Set([from, to]);
    const inRange = (x) => x > from && x < to;
    for (const [a, b] of ranges) { if (inRange(a)) cuts.add(a); if (inRange(b)) cuts.add(b); }
    const negs = [];
    if (negative) { const re = new RegExp(K.NEG_RE.source, 'g'); let m; while ((m = re.exec(stem))) { negs.push([m.index, m.index + m[0].length]); if (inRange(m.index)) cuts.add(m.index); if (inRange(m.index + m[0].length)) cuts.add(m.index + m[0].length); } }
    const pts = [...cuts].sort((x, y) => x - y);
    const frag = document.createDocumentFragment();
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1]; if (b <= a) continue;
      const mk = ranges.find((r) => r[0] <= a && r[1] >= b);
      const ng = negs.some((r) => r[0] <= a && r[1] >= b);
      const span = el('span', { 'data-o': String(a), text: stem.slice(a, b) });
      if (ng) span.classList.add('neg');
      if (mk) {
        span.classList.add('rmark', 'rm-' + mk[2]);
        span.dataset.a = mk[0]; span.dataset.b = mk[1];
        if (a === mk[0]) span.dataset.sym = MARK_TYPES[mk[2]].sym;
        span.title = MARK_TYPES[mk[2]].sym + ' ' + MARK_TYPES[mk[2]].label + '（押すと切り替え／2回押すと消す）';
      }
      frag.append(span);
    }
    return frag;
  }
  function posOf(root, node, off) {
    if (node.nodeType === 3) { const sp = node.parentElement && node.parentElement.closest('[data-o]'); return sp && root.contains(sp) ? Number(sp.dataset.o) + off : null; }
    const kids = node.childNodes;
    if (off < kids.length) { const c = kids[off]; const sp = c.nodeType === 1 ? (c.matches('[data-o]') ? c : c.querySelector('[data-o]')) : c.parentElement && c.parentElement.closest('[data-o]'); return sp ? Number(sp.dataset.o) : null; }
    const all = node.nodeType === 1 ? node.querySelectorAll('[data-o]') : []; const last = all[all.length - 1];
    return last ? Number(last.dataset.o) + last.textContent.length : null;
  }
  function selectionRange(root) {
    const sel = window.getSelection && window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount !== 1) return null;
    const r = sel.getRangeAt(0);
    if (!root.contains(r.startContainer) || !root.contains(r.endContainer)) return null;
    const a = posOf(root, r.startContainer, r.startOffset), b = posOf(root, r.endContainer, r.endOffset);
    return a != null && b != null && b > a ? [a, b] : null;
  }

  // ── 効果音（端末の中で合成。音のファイルや外部の通信は使わない）──
  let actx = null;
  function audioCtx() {
    try { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; if (!actx || actx.state === 'closed') actx = new C(); if (actx.state === 'suspended') actx.resume().catch(() => {}); return actx; } catch (e) { return null; }
  }
  function tone(list, type, vol) {
    const ctx = audioCtx(); if (!ctx) return;
    try {
      const at = ctx.currentTime + 0.01;
      for (const [hz, off, dur] of list) {
        const o = ctx.createOscillator(), g = ctx.createGain(), t = at + off;
        o.type = type; o.frequency.setValueAtTime(hz, t); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
      }
    } catch (e) { /* 音が出せない環境 */ }
  }
  function sound(ok) {
    if (!S.settings.sound) return;
    if (ok) tone([[1046.5, 0, 0.14], [783.99, 0.16, 0.22], [1046.5, 0.43, 0.14], [783.99, 0.59, 0.28]], 'sine', 0.08);
    else tone([[146.83, 0, 0.16], [130.81, 0.23, 0.46]], 'square', 0.045);
  }
  function beep(last) { if (S.settings.sound && S.settings.countdown) tone([[last ? 1200 : 900, 0, 0.095]], 'sine', 0.065); }
  // iPhone は、画面を触ったときに音と読み上げを有効にする
  let speechPrimed = false;
  function unlockAudio() {
    audioCtx();
    if (!speechPrimed && S.settings.speech && window.speechSynthesis && window.SpeechSynthesisUtterance) {
      try { const u = new SpeechSynthesisUtterance(' '); u.lang = 'ja-JP'; u.volume = 0; window.speechSynthesis.speak(u); speechPrimed = true; } catch (e) { /* なし */ }
    }
  }
  document.addEventListener('pointerdown', () => { if (S.settings.sound || S.settings.speech) unlockAudio(); }, { capture: true, once: true });

  // ── 読み上げ（端末の日本語音声だけを使う）──
  const SPEECH = { gen: 0, on: false, paused: false, onChange: null };
  function jaVoice() { const ss = window.speechSynthesis; if (!ss) return null; const vs = ss.getVoices().filter((v) => /^ja(?:[-_]|$)/i.test(v.lang)); return vs.find((v) => v.localService) || vs[0] || null; }
  function canSpeak() { return !!(window.speechSynthesis && window.SpeechSynthesisUtterance); }
  function stopSpeech() { SPEECH.gen++; if (window.speechSynthesis) try { window.speechSynthesis.cancel(); } catch (e) { /* なし */ } SPEECH.on = false; SPEECH.paused = false; SPEECH.onChange && SPEECH.onChange(); }
  function speakText(text) {
    if (!S.settings.speech || !canSpeak()) { toast(canSpeak() ? '設定で「音声解説」がオフになっています' : 'このブラウザは読み上げに対応していません'); return; }
    stopSpeech();
    const ss = window.speechSynthesis, v = jaVoice(), token = SPEECH.gen;
    const chunks = [];
    for (const para of String(text).replace(/[【】]/g, ' ').replace(/｜/g, '、').split(/\n+/).filter((x) => x.trim())) for (let i = 0; i < para.length; i += 180) chunks.push(para.slice(i, i + 180));
    let at = 0; SPEECH.on = true; SPEECH.onChange && SPEECH.onChange();
    const next = () => {
      if (token !== SPEECH.gen) return;
      if (at >= chunks.length) { SPEECH.on = false; SPEECH.onChange && SPEECH.onChange(); return; }
      const u = new SpeechSynthesisUtterance(chunks[at++]); u.lang = 'ja-JP'; if (v) u.voice = v; u.rate = Number(S.settings.speechRate) || 1;
      u.onend = next; u.onerror = () => { if (token === SPEECH.gen) stopSpeech(); };
      ss.speak(u);
    };
    next();
  }
  function pauseSpeech() { const ss = window.speechSynthesis; if (!SPEECH.on || !ss) return; SPEECH.paused = !SPEECH.paused; if (SPEECH.paused) ss.pause(); else ss.resume(); SPEECH.onChange && SPEECH.onChange(); }

  // ── 正解・不正解の演出（はなまる／×）と、10問ごとの演出 ──
  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function hanamaru(ok) {
    if (!ok) return '<svg viewBox="0 0 240 240" aria-hidden="true"><path d="M57 57L183 183M183 57L57 183" fill="none" stroke="#6688a8" stroke-width="15" stroke-linecap="round"/></svg>';
    let petal = '';
    for (let i = 0; i <= 360; i++) { const a = i * Math.PI / 180, r = 86 + 10 * Math.cos(12 * a); petal += (i ? 'L' : 'M') + (120 + r * Math.cos(a)).toFixed(2) + ' ' + (120 + r * Math.sin(a)).toFixed(2) + ' '; }
    return '<svg viewBox="0 0 240 240" aria-hidden="true"><g fill="none" stroke="#df704e" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"><path d="' + petal + 'Z"/><circle cx="120" cy="120" r="65"/><path d="M177 123C177 156 150 177 118 176C84 175 64 150 65 119C66 89 89 70 119 72C146 74 163 93 162 118C161 143 140 158 119 153C100 149 91 136 93 118C96 102 109 95 121 98C135 101 142 113 136 124C132 132 123 132 119 125"/></g></svg>';
  }
  let fbTimer = null;
  function showFeedback(ok) {
    let o = $('#feedback');
    if (!o) { o = el('div', { id: 'feedback', class: 'feedback', 'aria-hidden': 'true' }); document.body.append(o); }
    clearTimeout(fbTimer); o.innerHTML = hanamaru(ok); o.className = 'feedback'; void o.offsetWidth; o.className = 'feedback playing' + (ok ? ' ok' : ' ng'); o.hidden = false;
    fbTimer = setTimeout(() => { o.hidden = true; }, reduced() ? 700 : 1500);
    sound(ok);
  }
  let msTimer = null;
  function milestone(title, message, major) {
    if (!S.settings.effects) return;
    let o = $('#milestone');
    if (!o) { o = el('div', { id: 'milestone', class: 'milestone', role: 'status', onclick: () => { o.hidden = true; } }); document.body.append(o); }
    clearTimeout(msTimer);
    const conf = el('div', { class: 'confetti', 'aria-hidden': 'true' });
    if (!reduced()) {
      const colors = ['#e5b65d', '#82b8a1', '#93b0dc', '#dea1b4'];
      for (let i = 0; i < (major ? 64 : 28); i++) {
        const p = el('i'); p.style.setProperty('--c', colors[i % 4]); p.style.setProperty('--x', ((i % 2 ? -1 : 1) * (70 + (i * 47) % 360)) + 'px');
        p.style.setProperty('--y', (150 + (i * 59) % 430) + 'px'); p.style.setProperty('--r', ((i % 2 ? -1 : 1) * (90 + i * 31)) + 'deg'); p.style.setProperty('--d', (i % 7 * 0.025) + 's'); conf.append(p);
      }
    }
    o.className = 'milestone' + (major ? ' major' : '');
    o.replaceChildren(conf, el('div', { class: 'ms-card' }, el('div', { class: 'ms-star', 'aria-hidden': 'true', text: '✦' }), el('b', { text: title }), el('p', { text: message || '' })));
    o.hidden = false; msTimer = setTimeout(() => { o.hidden = true; }, major ? 3500 : 2700);
  }

  // ねこ（GAS版のキャラクター）
  const CAT_SVG = '<svg viewBox="0 0 70 76" aria-hidden="true"><path d="M52 60 Q69 60 61 43" fill="none" stroke="#ddb98d" stroke-width="7" stroke-linecap="round"/><ellipse cx="35" cy="58" rx="19" ry="14" fill="#edc99d"/><ellipse cx="35" cy="61" rx="10" ry="9" fill="#fff4df"/><path d="M13 31 L12 9 L29 20 M42 20 L59 9 L57 34" fill="#edc99d" stroke="#9c754f" stroke-width="1.5" stroke-linejoin="round"/><path d="M16 14 L17 27 L25 21 M54 14 L52 27 L45 21" fill="#efb5a3"/><ellipse cx="35" cy="35" rx="25" ry="21" fill="#f3d5ad" stroke="#9c754f" stroke-width="1.5"/><path d="M30 16 L32 23 M39 16 L38 23" stroke="#ca995f" stroke-width="4" stroke-linecap="round"/><circle cx="25" cy="33" r="2.8" fill="#4e4339"/><circle cx="45" cy="33" r="2.8" fill="#4e4339"/><ellipse cx="19" cy="40" rx="5" ry="3" fill="#edb5a0"/><ellipse cx="51" cy="40" rx="5" ry="3" fill="#edb5a0"/><path d="M32 39 Q35 43 38 39 M35 42 Q31 46 29 43 M35 42 Q39 46 41 43" fill="none" stroke="#78584a" stroke-width="1.4" stroke-linecap="round"/><path d="M11 36 L4 33 M11 41 L3 42 M58 36 L66 33 M58 41 L67 42" stroke="#a78261" stroke-width="1.4" stroke-linecap="round"/><ellipse cx="24" cy="69" rx="7" ry="4" fill="#f3d5ad"/><ellipse cx="46" cy="69" rx="7" ry="4" fill="#f3d5ad"/></svg>';
  const catNode = (cls) => { const s = el('span', { class: cls || 'cat' }); s.innerHTML = CAT_SVG; return s; };

  // ライフ（ライフモード・サドンデス）
  function lifeState(ses) {
    const r = ses.rules || { mode: 'normal' };
    const mistakes = Object.values(ses.ans).filter((a) => a && a.ok === false).length;
    const limit = r.mode === 'sudden' ? 1 : r.mode === 'life' ? r.lives : null;
    return { mode: r.mode, mistakes, limit, left: limit == null ? null : Math.max(0, limit - mistakes), over: limit != null && mistakes >= limit };
  }
  const answerSec = (ses) => Object.values(ses.qElapsed || {}).reduce((a, b) => a + b, 0);

  function renderQuiz() {
    const ses = S.session;
    if (!ses) { render('home'); return; }
    const ids = ses.ids;
    if (ses.i >= ids.length) ses.i = ids.length - 1;
    if (ses.i < 0) ses.i = 0;
    if (checkMockDeadline()) return;
    const q = DATA.byId.get(ids[ses.i]);
    const isMock = ses.kind === 'mock';
    const reviewMode = !!ses.review;
    const life = !isMock && !reviewMode ? lifeState(ses) : null;
    const top = el('div', { class: 'quiz-top' },
      el('div', { class: 'row' },
        el('button', { type: 'button', class: 'icon-btn', 'aria-label': reviewMode ? '解説を閉じる' : '中断して保存', title: reviewMode ? '閉じる' : '中断して保存（ホームの「続きから」で再開できます）', onclick: () => { stopSpeech(); saveNow(); if (reviewMode) { S.session = null; saveNow(); go(S.lastResult ? 'result' : 'home', S.lastResult); } else { toast('途中経過を保存しました。ホームの「続きから解く」で再開できます'); go('home'); } } }, '✕'),
        el('h1', { class: 'title', text: ses.title }),
        life && life.limit != null ? el('span', { class: 'life' + (life.left <= 1 ? ' low' : ''), 'aria-label': 'ライフ 残り' + life.left + '／' + life.limit, title: life.mode === 'sudden' ? 'サドンデス：1問まちがえると終了' : 'ライフモード' }, '❤'.repeat(Math.min(life.left, 10)) + '♡'.repeat(Math.min(life.limit - life.left, 10))) : null,
        el('span', { class: 'counter', 'data-focus': '', text: (ses.i + 1) + ' / ' + ids.length }),
        !isMock && !reviewMode && Object.keys(ses.ans).length ? el('button', { type: 'button', class: 'btn ghost small end-btn', onclick: async () => {
          const answered = Object.keys(ses.ans).length;
          if (answered >= ses.ids.length || await ask('ここで終えて結果を見ますか？\n（' + answered + '問 回答済み。残りの ' + (ses.ids.length - answered) + '問は「未回答」になります）', '結果を見る')) finishPractice();
        } }, '終える') : null),
      el('div', { class: 'qbar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + pct(isMock ? Object.keys(ses.ans).length : ses.i + (ses.ans[ids[ses.i]] ? 1 : 0), ids.length) + '%' })));

    if (!q) {
      app().replaceChildren(el('main', { class: 'shell quiz' }, top,
        el('div', { class: 'notice warn', text: 'この問題はまだ読み込めていません（電波のある所で開き直すと読み込みます）。' }),
        quizFoot(ses, { isMock, reviewMode, ans: null, isLast: ses.i === ids.length - 1 })));
      return;
    }
    const ans = ses.ans[q.id];
    const showAnswer = reviewMode || (!isMock && !!ans);
    const hideExplain = false; // 解説OFFでは答え合わせのあとすぐ次へ進む。戻ったときは解説を出す（GAS版の「前の問題の解説」）
    const order = displayOrder(ses, q);
    const shuffled = order.join('') !== '12345';
    const ex = K.parseExplanation(q.explanation);
    const rq = S.q[q.id] || {};
    const sel = ses.sel && ses.sel[q.id];
    const disp = (orig) => order.indexOf(orig) + 1;
    const fold = S.settings.foldTools && window.matchMedia('(max-width: 650px)').matches;

    // ── タイマー：ねこが右（スタート）から左（時間切れ）へ歩く。残りが減るほど横棒が短くなる ──
    const qLimit = !isMock && !reviewMode && ses.qLimit ? ses.qLimit : 0;
    const mockTotal = isMock && ses.limit && !reviewMode ? ses.limit : 0;
    const paused = !!ses.pausedAt;
    const fill = el('div', { class: 'trail-fill' });
    const cat = catNode('trail-cat');
    const trail = el('div', { class: 'trail', role: 'progressbar', 'aria-label': isMock ? '模擬試験の残り時間' : 'この問題の残り時間', 'aria-valuemin': '0', 'aria-valuemax': '100' }, fill, cat);
    const tQ = el('b'), tLeft = el('b'), tAll = el('b'), state = el('span', { class: 'trail-state' });
    const canPause = !reviewMode && ((!isMock && !showAnswer) || (isMock && ses.deadline));
    const pauseBtn = canPause ? el('button', { type: 'button', class: 'btn small pause', 'aria-pressed': String(paused), onclick: togglePause }, paused ? '▶ 再開' : '⏸ 一時停止') : null;
    const timerPanel = reviewMode ? null : el('div', { class: 'timerbox' + (qLimit || mockTotal ? '' : ' unlimited'), role: 'timer' },
      el('div', { class: 'timer-metrics' }, pauseBtn,
        isMock ? null : el('span', null, 'この問題 ', tQ),
        el('span', { class: 'remaining' }, '残り ', tLeft),
        el('span', null, isMock ? '経過 ' : '全体 ', tAll)),
      trail,
      el('div', { class: 'trail-caption', 'aria-hidden': 'true' }, el('span', { text: '時間切れ' }), state, el('span', { text: 'スタート' })));
    if (timerPanel) top.append(timerPanel);
    let lastSec = null;
    const updTimer = () => {
      const qe = ses.qElapsed[q.id] || 0;
      let left = Infinity, ratio = 1, limitMs = 0;
      if (isMock) { if (mockTotal) { limitMs = mockTotal; left = mockLeftMs(ses); ratio = Math.max(0, left / mockTotal); } }
      else if (qLimit) { limitMs = qLimit * 1000; left = Math.max(0, limitMs - qe); ratio = left / limitMs; }
      if (!timerPanel) return;
      tQ.textContent = fmtTime(qe);
      tAll.textContent = fmtTime(isMock ? ses.elapsed : answerSec(ses));
      tLeft.textContent = paused && !showAnswer ? '一時停止中' : limitMs ? (left <= 0 && !isMock ? '時間切れ' : fmtTime(Math.ceil(left / 1000) * 1000)) : '無制限';
      const p = Math.max(0, Math.min(100, ratio * 100));
      fill.style.width = p + '%'; cat.style.left = p + '%';
      const walking = !paused && !showAnswer && limitMs && p > 0;
      cat.classList.toggle('walking', !!walking);
      trail.classList.toggle('low', !!limitMs && p <= 20);
      trail.setAttribute('aria-valuenow', String(Math.round(p)));
      trail.setAttribute('aria-valuetext', limitMs ? Math.ceil(Math.max(0, left) / 1000) + '秒残り' : '制限時間なし');
      state.textContent = showAnswer ? '答え合わせ完了・タイマー停止' : paused ? 'タイマー停止中' : !limitMs ? '自分のペースで、じっくり。' : p === 0 ? '時間切れ' : '点が左端に着くまでに答えよう';
      const urgent = !!limitMs && !paused && !showAnswer && left > 0 && left <= 5000;
      timerPanel.classList.toggle('urgent', urgent);
      if (urgent) { const s = Math.ceil(left / 1000); if (s !== lastSec) { lastSec = s; beep(s === 1); } }
      if (!isMock && qLimit && !showAnswer && !paused && left <= 0) timeUp();
    };

    const roundTag = q.type === '過去問' && q.round ? '第' + q.round + '回 過去問' + (q.no ? ' 問題' + q.no : '') : q.type;
    const metaTags = el('div', { class: 'meta' },
      el('span', { class: 'tag type', text: roundTag }),
      el('span', { class: 'tag', text: q.subject }),
      q.theme ? el('span', { class: 'tag', text: q.theme }) : null,
      q.themes && q.themes.length ? q.themes.map((t) => el('span', { class: 'tag', text: themeName(t) })) : null,
      q.diff ? el('span', { class: 'tag diff d' + DIFFS.indexOf(q.diff), title: q.diffWhy || '学習用の目安（公式の区分ではありません）', text: q.diff }) : null,
      q.lawStatus && q.lawStatus !== 'ok' ? el('span', { class: 'tag law', text: '⚠ 法改正あり' }) : null,
      rq.a ? el('span', { class: 'tag', text: 'これまで ' + rq.c + '/' + rq.a + ' 正解' }) : null,
      el('span', { class: 'tag id', text: q.id }));

    // 問題文（マークつき）。連問の2問目以降は事例の本文をたたむ
    const mEntry = markEntry(ses, q);
    const stemBox = el('div', { class: 'stem-wrap' });
    const drawStem = () => {
      const split = K.splitCase(q.stem);
      const prevSame = ses.i > 0 && DATA.byId.get(ids[ses.i - 1]) && K.caseKey(DATA.byId.get(ids[ses.i - 1])) === K.caseKey(q);
      const cut = split && prevSame ? q.stem.lastIndexOf(split.question) : -1;
      if (cut > 0) {
        const det = el('details', { class: 'case' }, el('summary', null, '事例を表示（前の問題と同じ事例）'), el('div', { class: 'stem case-text' }, markedText(q.stem, 0, cut, mEntry.r, q.negative)));
        det.open = !!stemBox.dataset.open; det.ontoggle = () => { stemBox.dataset.open = det.open ? '1' : ''; };
        stemBox.replaceChildren(det, el('div', { class: 'stem' }, markedText(q.stem, cut, q.stem.length, mEntry.r, q.negative)));
      } else stemBox.replaceChildren(el('div', { class: 'stem' }, markedText(q.stem, 0, q.stem.length, mEntry.r, q.negative)));
      undoBtn.disabled = !(markUndo[q.id] || []).length; clearBtn.disabled = !mEntry.r.length;
    };
    const markStatus = el('p', { class: 'small muted mark-status', role: 'status', 'aria-live': 'polite' });
    const markType = el('select', { class: 'input', 'aria-label': 'マークの種類', style: 'max-width:220px' },
      MARK_TYPES.map((t, i) => el('option', { value: String(i), text: t.sym + ' ' + t.label })), el('option', { value: 'erase', text: '消しゴム（選んだ範囲）' }), el('option', { value: 'off', text: 'OFF（ふつうの選択・コピー）' }));
    markType.value = S.prefs.markType == null ? '0' : S.prefs.markType;
    markType.onchange = () => { S.prefs.markType = markType.value; save(); const t = MARK_TYPES[Number(markType.value)]; markStatus.textContent = markType.value === 'off' ? 'マークOFF：ふつうに範囲を選んでコピーできます。' : markType.value === 'erase' ? '選んだ範囲のマークを消します。' : t ? '問題文をなぞると ' + t.sym + ' ' + t.label + '（' + t.hint + '）' : ''; };
    const commit = (next, msg) => {
      if (next.length > 80) { markStatus.textContent = '1問のマークは80か所までです。'; return; }
      if (JSON.stringify(next) === JSON.stringify(mEntry.r)) return;
      (markUndo[q.id] = markUndo[q.id] || []).push(mEntry.r.map((a) => a.slice())); if (markUndo[q.id].length > 20) markUndo[q.id].shift();
      mEntry.r = next; save(); drawStem(); if (window.getSelection) window.getSelection().removeAllRanges(); markStatus.textContent = msg;
    };
    const applyMark = (force) => {
      const mode = force || markType.value; if (mode === 'off') return false;
      const r = selectionRange(stemBox); if (!r) { if (force) markStatus.textContent = '先に問題文の文字を選んでください（長押し・ドラッグ）。'; return false; }
      const type = mode === 'erase' ? -1 : Number(mode);
      commit(replaceMarkRange(mEntry.r, r[0], r[1], type), type < 0 ? '選んだ範囲のマークを消しました。' : MARK_TYPES[type].sym + ' ' + MARK_TYPES[type].label + ' を付けました。');
      return true;
    };
    const undoBtn = el('button', { type: 'button', class: 'btn small', onclick: () => { const st = markUndo[q.id]; if (!st || !st.length) return; mEntry.r = st.pop(); save(); drawStem(); markStatus.textContent = '直前のマーク操作を戻しました。'; } }, '↶ 戻す');
    const clearBtn = el('button', { type: 'button', class: 'btn small', onclick: () => commit([], 'この問題のマークを全部消しました（「戻す」で戻せます）。') }, '全部消す');
    const coarse = window.matchMedia && window.matchMedia('(pointer:coarse)').matches;
    let down = null, lastTap = null;
    stemBox.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
    stemBox.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'touch') return;
      const moved = down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 3; down = null;
      if (moved) setTimeout(() => applyMark(), 0);
    });
    stemBox.addEventListener('click', (e) => {
      const m = e.target.closest && e.target.closest('.rmark'); if (!m) return;
      const sel2 = window.getSelection && window.getSelection(); if (sel2 && !sel2.isCollapsed) return;
      const a = Number(m.dataset.a), b = Number(m.dataset.b), i = mEntry.r.findIndex((r) => r[0] === a && r[1] === b); if (i < 0) return;
      const now = Date.now(), twice = lastTap && lastTap.a === a && lastTap.b === b && now - lastTap.t < 350;
      if (twice) { lastTap = null; const st = markUndo[q.id]; if (st && st.length) mEntry.r = st.pop(); commit(mEntry.r.filter((_, k) => k !== i), 'マークを消しました。'); return; }
      const next = mEntry.r.map((r) => r.slice()); next[i][2] = (next[i][2] + 1) % MARK_TYPES.length;
      lastTap = { a, b, t: now };
      commit(next, MARK_TYPES[next[i][2]].sym + ' ' + MARK_TYPES[next[i][2]].label + ' に切り替えました。');
    });
    const copyBtn = el('button', { type: 'button', class: 'btn small', onclick: async () => {
      const text = '【問題】\n' + q.stem + '\n\n【選択肢】\n' + order.map((o, i) => (i + 1) + '. ' + q.options[o - 1]).join('\n\n');
      try { await navigator.clipboard.writeText(text); toast('問題文と選択肢1〜5をコピーしました'); }
      catch (e) { openSheet((sh, close) => { const ta = el('textarea', { class: 'input', rows: '10', readonly: true }); ta.value = text; sh.append(el('p', { class: 'small', text: '自動でコピーできませんでした。全文を選んでコピーしてください。' }), ta, el('button', { type: 'button', class: 'btn block', style: 'margin-top:8px', onclick: close }, '閉じる')); setTimeout(() => { ta.focus(); ta.select(); }, 50); }, { label: 'コピー' }); }
    } }, '📋 問題・選択肢をコピー');
    const markTools = el('details', { class: 'tools-fold', open: !fold && S.prefs.markOpen ? true : null, ontoggle: (e) => { if (!fold) { S.prefs.markOpen = e.currentTarget.open ? 1 : 0; save(); } } },
      el('summary', null, '✏️ マーク・コピー'),
      el('div', { class: 'row', style: 'margin-top:8px' }, markType,
        el('button', { type: 'button', class: 'btn small primary', onpointerdown: (e) => e.preventDefault(), onclick: () => applyMark(markType.value === 'off' ? '0' : markType.value) }, '選択に付ける'),
        el('button', { type: 'button', class: 'btn small', onpointerdown: (e) => e.preventDefault(), onclick: () => applyMark('erase') }, '選択のマークを消す'),
        undoBtn, clearBtn, copyBtn),
      markStatus,
      el('details', { class: 'small muted reading-guide' }, el('summary', null, '長文の読み方・マークの使い分け'),
        el('p', null, '① 最後の設問に☆：誰に対する、何の判断か。② 本人の希望に○、必要な状態・事実に□。③ 以前と今の変化・困りごとに△、否定語・条件・数字に！。④「本人は○を望み、□の状態で、△に困っている」と1文にまとめて選択肢を比べる。全文に付けず短い語句に絞る。家族の希望と本人の希望を区別する。'),
        el('p', null, coarse ? '文字を長押しして範囲を選び、「選択に付ける」を押します。マークを押すと ○→□→△→☆→！ と切り替わり、すばやく2回押すと消えます。' : '先にマークの種類を選び、問題文をドラッグします。マークを押すと ○→□→△→☆→！ と切り替わり、すばやく2回押すと消えます。キーボードで選んだときは「選択に付ける」を押します。'),
        el('p', null, 'マークは、この回の演習の途中経過と一緒に保存されます（新しく始めるとリセット）。')));
    drawStem();

    const fig = q.figure && q.figure.stem ? figBox(q.figure.stem, '問題の図') : null;
    const figText = q.figText ? el('div', { class: 'figtext' }, el('b', { text: q.figSrc === 'official' ? '図の内容（試験センター公表の文字情報）' : '図の内容（アプリによる説明。原文ではありません）' }), el('p', { text: q.figText })) : null;

    const elim = ses.elim[q.id] || [];
    const nu = rq.nu || [];
    const list = el('ol', { class: 'opts' + (showAnswer ? ' answered' : ''), 'aria-label': '選択肢' });
    const chosen = ans ? ans.c : null;
    order.forEach((orig, idx) => {
      const d = idx + 1;
      const isKey = q.keys.includes(orig);
      const isMine = chosen === orig;
      const isSel = !showAnswer && (isMock ? isMine : sel === orig);
      const isElim = !showAnswer && elim.includes(orig);
      const isNu = nu.includes(orig);
      const cls = ['opt'];
      if (showAnswer) { if (isKey) cls.push('correct'); else if (isMine) cls.push('wrong'); }
      else if (isSel) cls.push('selected');
      if (isElim) cls.push('eliminated');
      if (isNu) cls.push('unknown');
      const optFig = q.figure && q.figure.options && q.figure.options[orig - 1];
      const label = showAnswer ? [isKey ? (q.negative ? '○ これが答え（適切でない）' : '○ 正解') : (q.negative ? '× 答えではない（適切な内容）' : '× 不正解'), shuffled ? '｜本試験では' + orig + '番' : ''].join('') : '';
      const li = el('li', { class: cls.join(' ') },
        el('div', { class: 'opt-main' },
          el('button', { type: 'button', class: 'pick', 'aria-pressed': showAnswer ? null : String(isSel), 'aria-disabled': isElim ? 'true' : null, onclick: () => pick(orig), disabled: showAnswer ? true : null },
            el('span', { class: 'num', 'aria-hidden': 'true', text: String(d) }),
            el('span', { class: 'txt' }, el('span', { class: 'sr-only', text: d + '番。' }), q.options[orig - 1],
              isMine && showAnswer ? el('span', { class: 'mine-badge', text: '✓ あなたの答え' }) : null,
              isElim ? el('span', { class: 'sr-only', text: '（不正解として消した選択肢）' }) : null)),
          el('div', { class: 'opt-side' },
            showAnswer ? null : el('button', { type: 'button', class: 'elim', 'aria-label': d + '番を' + (isElim ? '不正解の印から戻す' : '不正解として消す（選べなくなります）'), 'aria-pressed': String(isElim), onclick: () => toggleElim(orig) }, isElim ? ['↩', el('small', { text: '解除' })] : ['✕', el('small', { text: '不正解' })]),
            el('button', { type: 'button', class: 'nu-btn', 'aria-pressed': String(isNu), 'aria-label': d + '番を' + (isNu ? '理解済みに戻す' : '理由を説明できない（未理解）として記録する'), title: '理由を説明できない選択肢を記録します（「未理解の選択肢あり」で出題できます）', onclick: () => toggleNu(orig) }, isNu ? '理解に戻す' : '未理解'))),
        optFig ? figBox(optFig, '選択肢' + d + 'の図') : null,
        showAnswer && !hideExplain && ex.opts[orig] ? el('div', { class: 'why' }, el('b', { text: label }), el('span', { text: K.remapNumbers(ex.opts[orig], order) })) : null);
      list.append(li);
    });

    const unsure = !!ses.unsure[q.id];
    const unsureBtn = reviewMode ? null : el('button', { type: 'button', class: 'toggle', 'aria-pressed': String(unsure), onclick: toggleUnsure, title: '正解しても「迷った」問題は復習に回ります' }, ico('🤔'), unsure ? ' 迷った（記録します）' : ' 迷った');
    const memo = el('textarea', { class: 'input', id: 'memo', maxlength: '5000', placeholder: '迷った点や覚えたいこと（この端末に保存）' });
    memo.value = rq.n || '';
    memo.oninput = () => { const r = rec(q.id); r.n = memo.value; r.nt = Date.now(); r.s = SUBJECTS.indexOf(q.subject); save(); };
    const tools = el('div', { class: 'qtools' }, unsureBtn,
      el('button', { type: 'button', class: 'toggle star', 'aria-pressed': String(!!rq.st), onclick: toggleStar }, rq.st ? '★ あとで見る' : '☆ あとで見る'),
      canSpeak() && !showAnswer ? el('button', { type: 'button', class: 'toggle', onclick: () => speakText(q.stem + '\n' + order.map((o, i) => (i + 1) + '。' + q.options[o - 1]).join('\n')) }, ico('🔊'), ' 問題を読み上げ') : null);
    const notes = el('details', { class: 'tools-fold', open: showAnswer || rq.n ? true : null }, el('summary', null, '📝 コメント（自分のメモ）'),
      el('div', { class: 'field', style: 'margin-top:8px' }, el('label', { for: 'memo', class: 'sr-only', text: 'この問題のコメント' }), memo,
        el('p', { class: 'small muted', style: 'margin:4px 0 0', text: 'コメントがある問題は「要復習」に入ります。消すと外れます。' })));

    const body = el('main', { class: 'shell quiz' }, top, metaTags, markTools, fig, figText, stemBox);

    if (showAnswer) {
      const keyDisp = q.keys.map(disp).sort((a, b) => a - b);
      const ok = ans ? q.keys.includes(ans.c) && !(ans.timeout && !ans.c) && ans.ok !== false : null;
      const msg = ans ? (ans.timeout ? '時間切れ（' + (ses.qLimit || '') + '秒の制限時間を超えたため不正解）' : ok ? '正解！' : '不正解') : '未回答';
      const mineWhy = ans && !ok && ans.c && ex.opts[ans.c] && !hideExplain ? K.remapNumbers(ex.opts[ans.c], order) : '';
      body.append(el('div', { class: 'verdict ' + (ok ? 'ok' : 'ng'), role: 'status' },
        el('span', { class: 'mark', 'aria-hidden': 'true', text: ok ? '○' : '×' }),
        el('div', { class: 'grow' }, el('div', { class: 'vt', text: msg }),
          el('small', { text: '正解は ' + keyDisp.join('・') + '番' + (keyDisp.length > 1 ? '（どれを選んでも正解）' : '') + (shuffled ? '（本試験では' + q.keys.join('・') + '番）' : '') + (ans && ans.c ? '｜あなたの答え ' + disp(ans.c) + '番' : '') + '｜所要時間 ' + fmtTime(ses.qElapsed[q.id] || 0) }),
          mineWhy ? el('p', { class: 'mine-why' }, el('b', { text: 'あなたが選んだ「' + q.options[ans.c - 1].slice(0, 30) + (q.options[ans.c - 1].length > 30 ? '…' : '') + '」が違う理由：' }), mineWhy) : null)));
    }
    body.append(list, tools, notes);

    if (showAnswer) {
      if (q.lawNote) body.append(el('div', { class: 'lawnote' }, el('b', { text: '⚠ 法改正の注記' }), el('p', { text: q.lawNote })));
      if (hideExplain) body.append(el('p', { class: 'small muted', text: '解説は表示しない設定です（ホームの「答え合わせ後に解説を表示する」）。結果の画面から、あとで解説を見られます。' }));
      else if (ex.head) body.append(el('section', { class: 'explain', 'aria-label': '解説' }, renderRich(K.remapNumbers(ex.head, order))));
      const links = rontenLinks(q);
      const wrong = ans && !q.keys.includes(ans.c);
      if (links.length && !hideExplain) body.append(el('div', { class: 'artlinks' + (wrong || unsure ? ' strong' : '') },
        el('b', null, ico('📖'), ' この論点を記事でくわしく'),
        el('ul', null, links.map((l) => el('li', null, el('a', { href: l.url, onclick: () => track('article_click') }, l.label), l.art ? el('span', { class: 'muted small', text: '（' + l.art + '）' }) : null)))));
      // 読み上げ・解説の報告
      const speakBtn = el('button', { type: 'button', class: 'btn small', onclick: () => speakText(explainText()) }, '🔊 解説を読み上げ');
      const pBtn = el('button', { type: 'button', class: 'btn small', disabled: true, onclick: pauseSpeech }, '一時停止');
      const sBtn = el('button', { type: 'button', class: 'btn small', disabled: true, onclick: stopSpeech }, '停止');
      SPEECH.onChange = () => { pBtn.disabled = !SPEECH.on; sBtn.disabled = !SPEECH.on; pBtn.textContent = SPEECH.paused ? '再開' : '一時停止'; };
      const rate = el('input', { type: 'range', min: '0.8', max: '2.4', step: '0.1', value: String(S.settings.speechRate || 1), 'aria-label': '読み上げの速さ', oninput: (e) => { S.settings.speechRate = Math.round(Number(e.target.value) * 10) / 10; rateLbl.textContent = S.settings.speechRate.toFixed(1) + '倍'; save(); } });
      const rateLbl = el('output', { text: (Number(S.settings.speechRate) || 1).toFixed(1) + '倍' });
      const xi = el('input', { type: 'checkbox', id: 'xi', checked: rq.xi ? true : null, onchange: (e) => { const r = rec(q.id); r.xi = e.target.checked ? 1 : 0; r.xit = Date.now(); r.s = SUBJECTS.indexOf(q.subject); saveNow(); toast(e.target.checked ? '「解説がおかしい」と記録しました。気になる所はコメントにも残せます' : '記録を外しました'); } });
      body.append(el('details', { class: 'tools-fold', open: !fold ? true : null }, el('summary', null, '🔊 音声・速さ・解説の報告'),
        el('div', { class: 'row', style: 'margin-top:8px' }, canSpeak() && S.settings.speech ? [speakBtn, pBtn, sBtn] : el('span', { class: 'small muted', text: canSpeak() ? '音声解説は設定でオフになっています。' : 'このブラウザは読み上げに対応していません。' })),
        canSpeak() && S.settings.speech ? el('label', { class: 'row small', style: 'margin-top:6px' }, '読み上げの速さ', rate, rateLbl) : null,
        el('label', { class: 'row', style: 'margin-top:8px', for: 'xi' }, xi, '解説がおかしい（あとで見直す・報告する）'),
        el('div', { class: 'row small muted', style: 'justify-content:space-between;margin:8px 0 0' },
          el('span', { text: '出典：' + SOURCE + (q.round ? ' 第' + q.round + '回' : '') + '。解説は当サイト独自のもので、試験センターとは関係ありません。' }),
          el('button', { type: 'button', class: 'btn ghost small', onclick: () => reportError(q, order) }, '⚠ 誤りを報告'))));
    }
    if (!showAnswer && !isMock && CONFIRM && !sel) body.append(el('p', { id: 'pick-hint', class: 'small muted', style: 'margin:10px 4px 0', text: '選択肢を選んでから「答え合わせ」を押します。違うと思う選択肢は「✕ 不正解」で消せます（消した選択肢は選べません）。理由を説明できない選択肢は「未理解」で記録できます。' }));
    body.append(quizFoot(ses, { isMock, reviewMode, ans, isLast: ses.i === ids.length - 1, sel, q }));
    app().replaceChildren(body);
    updTimer();
    if (!reviewMode) startTick(updTimer);
    if (showAnswer && !reviewMode) {
      const v = $('.verdict'); if (v) { v.setAttribute('tabindex', '-1'); v.focus({ preventScroll: true }); if (v.getBoundingClientRect().top < 0 || v.getBoundingClientRect().top > window.innerHeight - 160) v.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
      if (ses.justAnswered === q.id) {
        delete ses.justAnswered;
        if (S.settings.autoSpeech && S.settings.speech && canSpeak() && !hideExplain) setTimeout(() => { if (route === 'quiz' && S.session === ses && ses.ids[ses.i] === q.id) speakText(explainText()); }, S.settings.sound ? 950 : 0);
      }
    }

    function explainText() {
      const ok = ans && q.keys.includes(ans.c);
      return (ans ? (ok ? '正解。' : '不正解。') : '') + '正解は' + q.keys.map(disp).join('と') + '番。' + (ex.head ? '\n' + K.remapNumbers(ex.head, order) : '') + '\n' + order.filter((o) => ex.opts[o]).map((o) => disp(o) + '番。' + K.remapNumbers(ex.opts[o], order)).join('\n');
    }
    function rerender() { const y = window.scrollY; renderQuiz(); window.scrollTo(0, y); }
    function pick(orig) {
      if (showAnswer) return;
      if (elim.includes(orig)) { toast('「不正解」で消した選択肢は選べません。「解除」で元に戻せます'); return; }
      if (isMock) { ses.ans[q.id] = { c: orig, t: Date.now() }; save(); rerender(); return; }
      if (CONFIRM) { ses.sel = ses.sel || {}; ses.sel[q.id] = orig; save(); rerender(); const b = $('.quiz-foot .btn.primary'); b && b.focus({ preventScroll: true }); return; }
      submit(orig);
    }
    function toggleElim(orig) {
      const a = ses.elim[q.id] || (ses.elim[q.id] = []);
      const i = a.indexOf(orig); if (i >= 0) a.splice(i, 1); else { a.push(orig); if (ses.sel && ses.sel[q.id] === orig) delete ses.sel[q.id]; if (isMock && ses.ans[q.id] && ses.ans[q.id].c === orig) delete ses.ans[q.id]; }
      save(); rerender();
    }
    function toggleNu(orig) {
      const r = rec(q.id); const a = (r.nu || []).slice(); const i = a.indexOf(orig);
      if (i >= 0) a.splice(i, 1); else a.push(orig);
      r.nu = a.sort(); if (!r.nu.length) delete r.nu; r.nut = Date.now(); r.s = SUBJECTS.indexOf(q.subject); saveNow();
      announce(a.length ? '未理解の選択肢：' + a.map(disp).sort().join('・') + '番' : 'すべて理解済み'); rerender();
    }
    // 「迷った」は答え合わせのあとでも変えられる（記録も直す）
    function toggleUnsure() {
      ses.unsure[q.id] = !ses.unsure[q.id];
      if (ans && ans.t) { const e = S.log.find((x) => x[1] === q.id && x[0] === ans.t); if (e) { e[5] = ses.unsure[q.id] ? 1 : 0; K.rebuild(S); srsCache = null; } }
      saveNow(); rerender();
    }
    function toggleStar() {
      const r = rec(q.id); r.st = r.st ? 0 : 1; r.s = SUBJECTS.indexOf(q.subject); save();
      toast(r.st ? '「あとで見る」に入れました' : '「あとで見る」から外しました'); rerender();
    }
    function togglePause() {
      if (ses.pausedAt) { if (ses.deadline) ses.deadline += Date.now() - ses.pausedAt; ses.pausedAt = 0; }
      else ses.pausedAt = Date.now();
      saveNow(); rerender();
    }
  }
  function figBox(src, alt) {
    const img = el('img', { src, alt, loading: 'lazy' });
    return el('div', { class: 'figure' }, img, el('button', { type: 'button', class: 'btn ghost small', onclick: () => openSheet((sh, close) => { sh.append(el('img', { src, alt, class: 'fig-big' }), el('button', { type: 'button', class: 'btn block', style: 'margin-top:8px', onclick: close }, '閉じる')); }, { label: alt + 'の拡大', cls: 'figsheet' }) }, '🔍 図を拡大'));
  }
  // 時間切れ：選んでいた選択肢があっても「時間切れ」で不正解（GAS版と同じ）
  function timeUp() {
    const ses = S.session, q = ses && DATA.byId.get(ses.ids[ses.i]);
    if (!q || ses.ans[q.id] || ses.kind !== 'practice') return;
    stopTick();
    const sel = ses.sel && ses.sel[q.id];
    submit(sel || 0, true);
  }
  function submit(orig, byTimeout) {
    const ses = S.session, q = DATA.byId.get(ses.ids[ses.i]);
    if (!q || ses.ans[q.id]) return;
    const ok = !byTimeout && q.keys.includes(orig);
    const sec = (ses.qElapsed[q.id] || 0) / 1000;
    const logIdx = recordAnswer(q, orig || 0, ok, sec, !!ses.unsure[q.id], 'p');
    ses.ans[q.id] = { c: orig || 0, ok, log: logIdx, t: S.log[logIdx] && S.log[logIdx][0], timeout: byTimeout ? true : undefined };
    if (ses.sel) delete ses.sel[q.id];
    ses.pausedAt = 0; ses.justAnswered = q.id;
    saveNow(); showFeedback(ok); if (navigator.vibrate && !ok) navigator.vibrate(60);
    announce(byTimeout && !orig ? '時間切れです' : ok ? '正解です' : '不正解です');
    const n = Object.keys(ses.ans).length, isLast = ses.i >= ses.ids.length - 1;
    const life = lifeState(ses);
    if (life.over) {
      renderQuiz();
      setTimeout(() => { if (S.session === ses) finishPractice('life'); }, 1600);
      return;
    }
    if (n % 10 === 0 && !isLast) setTimeout(() => milestone(n % 100 === 0 ? '祝・' + n + '問達成！' : n + '問クリア！', 'ここまでの積み重ねに拍手。いいペースです。', n % 100 === 0), 900);
    if (ses.rules && ses.rules.explain === false) {
      setTimeout(() => { if (S.session !== ses) return; if (isLast) finishPractice(); else { ses.i++; save(); renderQuiz(); window.scrollTo(0, 0); focusMain(); } }, 900);
      return;
    }
    renderQuiz();
  }
  function quizFoot(ses, o) {
    const { isMock, reviewMode, ans, isLast, sel } = o;
    const prev = el('button', { type: 'button', class: 'btn narrow', disabled: ses.i === 0 ? true : null, onclick: () => move(-1), 'aria-label': '前の問題' }, '←');
    let main;
    if (isMock && !reviewMode) {
      main = isLast ? el('button', { type: 'button', class: 'btn primary', onclick: openGrid }, '見直し・提出') : el('button', { type: 'button', class: 'btn primary', onclick: () => move(1) }, '次へ →');
    } else if (reviewMode) {
      main = isLast ? el('button', { type: 'button', class: 'btn primary', onclick: () => { S.session = null; saveNow(); go('result', S.lastResult); } }, '結果にもどる') : el('button', { type: 'button', class: 'btn primary', onclick: () => move(1) }, '次へ →');
    } else if (ans) {
      main = isLast ? el('button', { type: 'button', class: 'btn primary', onclick: () => finishPractice() }, '結果を見る') : el('button', { type: 'button', class: 'btn primary', onclick: () => move(1) }, '次の問題 →');
    } else if (CONFIRM) {
      main = el('button', { type: 'button', class: 'btn primary', disabled: sel ? null : true, 'aria-describedby': sel ? null : 'pick-hint', onclick: () => sel && submit(sel) }, '答え合わせ');
    } else {
      main = el('button', { type: 'button', class: 'btn', onclick: () => move(1), disabled: isLast ? true : null }, 'とばす →');
    }
    const skip = !isMock && !reviewMode && !ans && CONFIRM && !isLast ? el('button', { type: 'button', class: 'btn narrow', onclick: () => move(1) }, 'とばす') : null;
    return el('div', { class: 'quiz-foot' }, el('div', { class: 'inner' },
      prev, (isMock || reviewMode) ? el('button', { type: 'button', class: 'btn narrow', onclick: openGrid }, '一覧') : skip, main));
  }
  function move(d) { const ses = S.session; if (ses.kind === 'practice') ses.pausedAt = 0; stopSpeech(); ses.i = Math.max(0, Math.min(ses.ids.length - 1, ses.i + d)); save(); render('quiz'); window.scrollTo(0, 0); focusMain(); }
  function openGrid() {
    const ses = S.session, isMock = ses.kind === 'mock';
    const unanswered = ses.ids.filter((id) => !ses.ans[id]).length;
    openSheet((sheet, close) => {
      const grid = el('div', { class: 'grid-nums' }, ses.ids.map((id, i) => {
        const a = ses.ans[id], q = DATA.byId.get(id);
        const cls = [];
        if (ses.review && q) cls.push(a && q.keys.includes(a.c) ? 'ok' : 'ng'); else if (a) cls.push('done');
        if (ses.unsure[id]) cls.push('unsure'); if (i === ses.i) cls.push('cur');
        return el('button', { type: 'button', class: cls.join(' '), onclick: () => { close(); ses.i = i; save(); render('quiz'); focusMain(); }, 'aria-label': (i + 1) + '問目' + (a ? ' 回答済み' : ' 未回答') + (ses.unsure[id] ? ' 自信がない' : '') }, String(i + 1));
      }));
      sheet.append(
        el('div', { class: 'row' }, el('b', { class: 'grow', text: '問題の一覧' }), el('button', { type: 'button', class: 'icon-btn', 'aria-label': '閉じる', onclick: close }, '✕')),
        ses.review ? null : el('p', { class: 'small muted', style: 'margin:4px 0', text: '回答済み ' + (ses.ids.length - unanswered) + ' / ' + ses.ids.length + '　●＝自信がない' }),
        grid,
        isMock && !ses.review ? el('button', { type: 'button', class: 'btn primary block lg', onclick: async () => { close(); if (!unanswered || await ask('未回答が ' + unanswered + '問あります。提出して採点しますか？', '提出する')) finishMock(); } }, '提出して採点する') : null);
    }, { label: '問題の一覧' });
  }
  function snapshot(ses) {
    return { ids: ses.ids, ans: ses.ans, order: ses.order, unsure: ses.unsure, qElapsed: ses.qElapsed, title: ses.title, kind: ses.kind, opt: ses.opt || null, mockSize: ses.mockSize, mockType: ses.mockType, sec: Math.round(ses.elapsed / 1000), ansSec: Math.round(answerSec(ses) / 1000), rules: ses.rules || null, base: ses.base || null, reason: ses.reason || 'complete', qLimit: ses.qLimit || 0, at: Date.now() };
  }
  function finishPractice(reason) {
    const ses = S.session; if (!ses) return;
    ses.done = true; ses.reason = typeof reason === 'string' ? reason : 'complete'; stopSpeech();
    S.lastResult = snapshot(ses); S.session = null; saveNow(); go('result', S.lastResult);
  }
  function finishMock(o) {
    o = o || {};
    const ses = S.session; if (!ses || ses.done) return;
    ses.done = true;
    for (const id of ses.ids) {
      const q = DATA.byId.get(id), a = ses.ans[id]; if (!q || !a) continue;
      a.ok = q.keys.includes(a.c);
      recordAnswer(q, a.c, a.ok, (ses.qElapsed[id] || 0) / 1000, !!ses.unsure[id], 'm');
    }
    const snap = snapshot(ses);
    const r = buildResult(snap);
    S.mocks.push({ at: Date.now(), title: ses.title + (o.partial ? '（途中まで）' : ''), size: ses.mockSize, total: r.total, answered: r.answered, correct: r.correct, sec: snap.sec, bySubject: r.bySubject, byPart: r.judge.parts.map((p) => ({ part: p.part, n: p.n, c: p.c, line: p.line, pass: p.pass })), pass: r.judge.totalPass, passedParts: r.judge.passedParts });
    if (S.mocks.length > 200) S.mocks.shift();
    track('mock_finish/' + ses.mockSize);
    S.lastResult = snap; S.session = null; saveNow();
    if (!o.silent) go('result', snap);
  }
  function buildResult(snap) {
    const items = snap.ids.map((id) => { const q = DATA.byId.get(id); const a = snap.ans[id]; return { id, subject: q ? q.subject : '', ok: !!(a && q && (a.ok != null ? a.ok : q.keys.includes(a.c))), answered: !!a, timeout: !!(a && a.timeout), unsure: !!(snap.unsure || {})[id] }; });
    const bySubject = {};
    for (const it of items) { const b = bySubject[it.subject] || (bySubject[it.subject] = { n: 0, c: 0, a: 0 }); b.n++; if (it.ok) b.c++; if (it.answered) b.a++; }
    return { items, bySubject, total: items.length, answered: items.filter((x) => x.answered).length, correct: items.filter((x) => x.ok).length, judge: K.judge(bySubject) };
  }

  // ── 結果 ──
  function renderResult(snap) {
    snap = snap || S.lastResult;
    if (!snap) { render('home'); return; }
    const r = buildResult(snap);
    const isMock = snap.kind === 'mock';
    const root = el('main', { class: 'shell' }, topbar());
    const base = isMock ? r.total : r.answered;
    const rate = pct(r.correct, base);
    const j = r.judge;
    const card = el('section', { class: 'card' }, el('h1', { class: 'h2like', 'data-focus': '' }, isMock ? '模擬試験の結果' : 'おつかれさまでした', el('span', { class: 'sub', text: snap.title })),
      el('div', { class: 'score' },
        el('div', { class: 'big' }, String(r.correct), el('small', { text: ' / ' + base + '問' })),
        el('div', { class: 'muted', text: '正答率 ' + rate + '%｜' + fmtMin(snap.sec || 0) + (r.total > r.answered ? '｜未回答 ' + (r.total - r.answered) + '問' : '') })));
    if (!isMock) {
      card.append(el('div', { class: 'today', style: 'margin-top:8px' }, stat(r.answered + ' / ' + r.total, '回答した問題'), stat(r.correct, '正解'), stat(r.answered - r.correct, '不正解'), stat(fmtTime((snap.ansSec || 0) * 1000), '全体解答時間')));
      const rl = snap.rules || {};
      card.append(el('p', { class: 'small muted', style: 'margin:8px 0 0', text: (snap.reason === 'life' ? (rl.mode === 'sudden' ? '1問不正解でチャレンジ終了。' : 'ライフ ' + rl.lives + '個を使い切ってチャレンジ終了。') + '未回答 ' + (r.total - r.answered) + '問。' : '') + (snap.qLimit ? '1問の制限時間 ' + snap.qLimit + '秒（時間切れ ' + r.items.filter((x) => x.timeout).length + '問）。' : '') + '解説を読む時間・中断中の時間は全体解答時間に含みません。' }));
    }
    root.append(card);
    if (!isMock && r.answered) { root.append(sessionGrowth(snap, r)); const rv = reviewList(snap, r); if (rv) root.append(rv); }

    if (isMock) {
      // 公式の手順：①総得点の基準と、全11科目群に得点があるか ②届かなければパートごと
      const rows = [];
      const scaledNote = j.scaled ? '（問題数に合わせて按分した目安）' : '';
      if (j.isFull) rows.push(el('div', { class: 'judge-row ' + (j.totalPass ? 'ok' : 'ng') },
        el('b', { text: '総得点 ' + j.totalC + ' / ' + j.totalN }),
        el('span', { text: '基準 ' + pt(j.totalLine) + '点' + scaledNote }),
        el('span', { class: 'jr', text: j.totalPass ? '合格' : j.zeroGroups.length ? '0点の科目群あり' : 'あと' + j.totalShort + '点' })));
      for (const p of j.parts) rows.push(el('div', { class: 'judge-row ' + (p.pass ? 'ok' : 'ng') },
        el('b', { text: p.label + ' ' + p.c + ' / ' + p.n }),
        el('span', { text: '基準 ' + pt(p.line) + '点' + (p.scaled ? '（目安）' : '') }),
        el('span', { class: 'jr', text: p.pass ? '合格' : p.zeroGroups.length ? '0点の科目群あり' : 'あと' + p.short + '点' })));
      root.append(el('section', { class: 'card' }, el('h2', null, '合格判定（第' + K.PASS_LINE.round + '回の基準）'),
        el('p', { class: 'pass ' + (j.totalPass ? 'ok' : j.passedParts.length ? 'part' : 'ng'), text: j.totalPass ? '合格基準を超えています' : j.isFull ? (j.passedParts.length ? 'パート合格：' + j.passedParts.map((x) => K.PARTS[x].label).join('・') : '今回は合格基準に届いていません') : (j.passedParts.length ? '基準に届いたパート：' + j.passedParts.map((x) => K.PARTS[x].label).join('・') : '基準に届いていません') }),
        el('div', { class: 'judge' }, rows),
        j.zeroGroups.length ? el('p', { class: 'notice warn' }, el('b', { text: '0点の科目群：' }), j.zeroGroups.map((g) => g.join('・')).join('／'), el('br'), 'すべての科目群で得点することが合格の条件です。') : null,
        el('p', { class: 'small muted', text: '第' + K.PASS_LINE.round + '回の基準：総得点' + K.PASS_LINE.total + '点以上、かつ11の科目群すべてで得点。総得点で届かない場合はパートごとに判定（A ' + K.PASS_LINE.A + '点・B ' + K.PASS_LINE.B + '点・C ' + K.PASS_LINE.C + '点以上、かつパート内の科目群すべてで得点）。基準点は毎年、問題の難しさで変わります。' })));
    }
    const bars = el('div', { class: 'bars' }, SUBJECTS.filter((s) => r.bySubject[s]).map((s) => {
      const b = r.bySubject[s];
      return el('div', { class: 'barrow' + (b.c === 0 && isMock ? ' zero' : '') }, el('span', { class: 'name', text: s }), el('span', { class: 'val', text: b.c + '/' + b.n + (b.a < b.n ? '（未回答' + (b.n - b.a) + '）' : '') }),
        el('div', { class: 'track', 'aria-hidden': 'true' }, el('i', { class: 'c', style: 'width:' + pct(b.c, b.n) + '%' }), el('i', { class: 'w', style: 'width:' + pct(b.a - b.c, b.n) + '%' })));
    }));
    root.append(el('section', { class: 'card' }, el('h2', null, '科目別'), bars,
      el('div', { class: 'legend' }, el('span', null, el('i', { style: 'background:var(--ok)' }), '正解'), el('span', null, el('i', { style: 'background:var(--ng)' }), '不正解'), el('span', { text: '色なし＝未回答' }))));

    // 間違えた論点の記事
    const wrongQs = r.items.filter((x) => x.answered && (!x.ok || x.unsure)).map((x) => DATA.byId.get(x.id)).filter(Boolean);
    const linkCount = new Map();
    for (const q of wrongQs) for (const l of rontenLinks(q)) { const k = l.url; const v = linkCount.get(k) || Object.assign({ n: 0 }, l); v.n++; linkCount.set(k, v); }
    const topLinks = [...linkCount.values()].sort((a, b) => b.n - a.n).slice(0, 3);
    if (topLinks.length) root.append(el('section', { class: 'card artlinks strong' }, el('h2', null, ico('📖'), ' 読んでおきたい記事'),
      el('ul', null, topLinks.map((l) => el('li', null, el('a', { href: l.url, onclick: () => track('article_click') }, l.label), el('span', { class: 'muted small', text: '（間違えた・自信がない ' + l.n + '問）' }))))));

    const wrongIds = r.items.filter((x) => x.answered && (!x.ok || x.unsure)).map((x) => x.id);
    const unIds = r.items.filter((x) => !x.answered).map((x) => x.id);
    root.append(el('div', { class: 'row', style: 'margin:12px 0;flex-wrap:wrap' },
      wrongIds.length ? el('button', { type: 'button', class: 'btn primary grow lg', onclick: () => startIds(wrongIds, '間違えた・迷った問題（' + wrongIds.length + '問）') }, '間違えた・迷った ' + wrongIds.length + '問をもう一度') : null,
      unIds.length && !isMock ? el('button', { type: 'button', class: 'btn soft grow lg', onclick: () => startIds(unIds, '未回答の問題（' + unIds.length + '問）') }, '未回答の ' + unIds.length + '問を解く') : null,
      snap.opt ? el('button', { type: 'button', class: 'btn soft grow lg', onclick: () => startPractice(Object.assign({}, snap.opt, { count: '10' }), null) }, '続けて10問') : null,
      el('button', { type: 'button', class: 'btn grow lg', onclick: () => go('home') }, 'ホームへ')));

    const list = el('ul', { class: 'qlist' }, r.items.map((it, i) => {
      const q = DATA.byId.get(it.id);
      const s = q ? (K.splitCase(q.stem) || { question: q.stem }).question : it.id;
      return el('li', null, el('button', { type: 'button', onclick: () => openReview(snap, i) },
        el('span', { class: 'res ' + (it.ok ? 'ok' : it.answered ? 'ng' : 'un'), 'aria-hidden': 'true', text: it.ok ? '○' : it.answered ? '×' : '–' }),
        el('span', { class: 't' }, el('span', { class: 's', text: (i + 1) + '. ' + (it.ok ? '正解' : it.answered ? '不正解' : '未回答') + '・' + it.subject + (it.unsure ? '・自信がない' : '') }), s)));
    }));
    root.append(el('section', { class: 'card' }, el('h2', null, '問題ごとの結果', el('span', { class: 'sub', text: 'タップで解説' })), list));
    root.append(tabbar(''));
    app().replaceChildren(root);

  }
  function openReview(snap, i) {
    S.session = { id: uid(), kind: snap.kind, ids: snap.ids, i, ans: snap.ans, elim: {}, sel: {}, unsure: snap.unsure || {}, order: snap.order || {}, qElapsed: snap.qElapsed || {}, elapsed: 0, title: snap.title + '（解説）', review: true, done: true };
    go('quiz');
  }

  // ── 成績 ──
  function renderStats() {
    const root = el('main', { class: 'shell' }, topbar());
    const totalQ = DATA.byId.size;
    let answered = 0, att = 0, cor = 0, due = 0, stars = 0, unsureN = 0;
    const st = srs();
    const subj = SUBJECTS.map(() => ({ seen: 0, a: 0, c: 0, due: 0 }));
    for (const id in S.q) {
      const r = S.q[id]; if (!DATA.byId.has(id)) continue;
      if (r.a) { answered++; att += r.a; cor += r.c; unsureN += r.u || 0; } if (K.isDue(st[id])) due++; if (r.st) stars++;
      const s = subj[SUBJECTS.indexOf(DATA.byId.get(id).subject)]; if (s && r.a) { s.seen++; s.a += r.a; s.c += r.c; if (K.isDue(st[id])) s.due++; }
    }
    const mastered = Object.keys(st).filter((id) => st[id].mastered && DATA.byId.has(id)).length;
    const totalSec = Object.values(S.days).reduce((a, d) => a + (d.sec || 0), 0);
    root.append(el('section', { class: 'card' }, el('h1', { class: 'h2like', 'data-focus': '' }, 'これまでの学習'),
      el('div', { class: 'today' }, stat(answered, '解いた問題'), stat(att ? pct(cor, att) + '%' : '–', '正答率'), stat(fmtMin(totalSec), '学習時間'), stat(streak() + '日', '連続')),
      el('div', { class: 'goal', role: 'progressbar', 'aria-label': '全問題のうち解いた割合', 'aria-valuemin': '0', 'aria-valuemax': String(totalQ), 'aria-valuenow': String(answered) }, el('i', { style: 'width:' + pct(answered, totalQ) + '%' })),
      el('p', { class: 'small muted', style: 'margin:6px 0 0', text: '全' + totalQ + '問のうち ' + pct(answered, totalQ) + '% を解きました｜今日の復習 ' + due + '問｜定着（30日後も正解）' + mastered + '問｜★ ' + stars + '問' + (att ? '｜自信がない ' + pct(unsureN, att) + '%' : '') })));

    // 14日
    const days = [], labels = [];
    let maxN = 1;
    for (let k = 13; k >= 0; k--) { const t = Date.now() - k * K.DAY; const key = dayKey(t); const v = S.days[key] || { n: 0 }; maxN = Math.max(maxN, v.n); days.push({ key, n: v.n, c: v.c || 0, today: k === 0 }); labels.push(Number(key.slice(8))); }
    root.append(el('section', { class: 'card' }, el('h2', null, '最近2週間', el('span', { class: 'sub', text: '解いた問題数' })),
      el('div', { class: 'days', role: 'img', 'aria-label': '最近14日の解いた問題数：' + days.map((d) => d.key.slice(5) + ' ' + d.n + '問').join('、') }, days.map((d) => el('div', { class: 'd' + (d.today ? ' today' : '') + (d.n ? '' : ' empty'), title: d.key + '：' + d.n + '問（正解' + d.c + '）' }, el('i', { style: 'height:' + Math.max(2, d.n / maxN * 100) + '%' })))),
      el('div', { class: 'dlabels', 'aria-hidden': 'true' }, labels.map((l) => el('span', { text: String(l) }))),
      el('p', { class: 'small muted', style: 'margin:6px 0 0', text: '1日の区切りは午前4時です（夜勤明けでも連続日数が切れないように）。' })));

    const rowBtn = (label, onclick) => el('button', { type: 'button', class: 'link name', onclick }, el('span', { text: label }), el('span', { class: 'chev', 'aria-hidden': 'true', text: '›' }));
    const sec = el('section', { class: 'card' }, el('h2', null, '科目別', el('span', { class: 'sub', text: '科目名を押すと、その科目を解けます' })));
    for (const k of Object.keys(PARTS)) {
      sec.append(el('h3', { class: 'parth', text: PARTS[k].label + (myParts().includes(k) ? '' : '（受けないパート）') }));
      sec.append(el('div', { class: 'bars' }, PARTS[k].subjects.map((s) => {
        const x = subj[SUBJECTS.indexOf(s)], n = (DATA.bySubject[s] || []).filter(playable).length;
        return el('div', { class: 'barrow' },
          rowBtn(s, () => startPractice({ scope: s, filter: x.due ? 'due' : x.seen < n ? 'new' : 'all', count: '10', order: 'random' }, s + (x.due ? '・今日の復習' : x.seen < n ? '・まだ解いていない' : ''))),
          el('span', { class: 'val', text: (x.a ? pct(x.c, x.a) + '%' : '–') + '｜' + x.seen + '/' + n + '問' + (x.due ? '｜復習' + x.due : '') }),
          el('div', { class: 'track', 'aria-hidden': 'true' }, el('i', { class: 'a', style: 'width:' + pct(x.seen, n) + '%' })));
      })));
    }
    sec.append(el('div', { class: 'legend' }, el('span', null, el('i', { style: 'background:var(--accent-strong)' }), 'バー＝解いた割合'), el('span', { text: '％＝正答率' })));
    root.append(sec);

    if (themeList().length) {
      const tsec = el('section', { class: 'card' }, el('h2', null, 'テーマ別', el('span', { class: 'sub', text: 'テーマ名で解く／「記事」で読む' })));
      const weak = [];
      for (const [cat, ts] of themeCategories()) {
        tsec.append(el('h3', { class: 'parth', text: cat }));
        tsec.append(el('div', { class: 'bars' }, ts.map((t) => {
          const qs = pool({ scope: t.id }); let seen = 0, a = 0, c = 0, d = 0;
          for (const q of qs) { const r = S.q[q.id]; if (r && r.a) { seen++; a += r.a; c += r.c; if (K.isDue(st[q.id])) d++; } }
          if (a >= 5) weak.push({ t, rate: c / a });
          const arts = (DATA.links && DATA.links.themes && DATA.links.themes[t.id]) || [];
          return el('div', { class: 'barrow' },
            rowBtn(t.id + ' ' + t.name, () => startPractice({ scope: t.id, filter: d ? 'due' : seen < qs.length ? 'new' : 'all', count: '10', order: 'random' }, t.name + (d ? '・今日の復習' : ''))),
            el('span', { class: 'val' }, (a ? pct(c, a) + '%' : '–') + '｜' + seen + '/' + qs.length + '問', arts.length ? [' ', el('a', { class: 'artlink', href: articleUrl(arts[0]), onclick: () => track('article_click') }, '記事')] : null),
            el('div', { class: 'track', 'aria-hidden': 'true' }, el('i', { class: 'a', style: 'width:' + pct(seen, qs.length) + '%' })));
        })));
      }
      weak.sort((x, y) => x.rate - y.rate);
      if (weak.length >= 3) tsec.prepend(el('div', { class: 'notice slim' }, el('b', { text: '正答率が低いテーマ：' }), weak.slice(0, 3).map((w, i) => {
        const arts = (DATA.links && DATA.links.themes && DATA.links.themes[w.t.id]) || [];
        return [i ? '、' : '', arts.length ? el('a', { href: articleUrl(arts[0]) }, w.t.name) : w.t.name, '（' + Math.round(w.rate * 100) + '%）'];
      })));
      root.append(tsec);
    }

    root.append(el('section', { class: 'card' }, reviewOverview()));
    if (S.mocks.length) {
      root.append(el('section', { class: 'card' }, el('h2', null, '模擬試験の記録'),
        el('ul', { class: 'list-plain' }, S.mocks.slice().reverse().slice(0, 20).map((m) => el('li', null,
          el('span', null, new Date(m.at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }) + '　' + m.title,
            m.byPart ? el('span', { class: 'small muted', text: '　' + m.byPart.map((p) => p.part + ' ' + p.c + '/' + p.n).join('・') }) : null),
          el('b', { text: m.correct + '/' + m.total + (m.pass ? ' 合格' : m.passedParts && m.passedParts.length ? ' パート' + m.passedParts.join('') : '') }))))));
    }
    root.append(tabbar('stats'));
    app().replaceChildren(root);
  }

  // ── 設定 ──
  function renderSettings() {
    const root = el('main', { class: 'shell' }, topbar());
    const sw = (label, key, desc) => { const id = 'sw-' + key; return el('div', { class: 'switch' }, el('label', { for: id }, label, desc ? el('span', { class: 'small muted', style: 'display:block', text: desc }) : null),
      el('input', { type: 'checkbox', role: 'switch', id, checked: S.settings[key] ? true : null, onchange: (e) => { S.settings[key] = e.target.checked; saveNow(); applySettings(); } })); };
    const seg = (key, items, label) => el('div', { class: 'chips', role: 'group', 'aria-label': label }, items.map(([v, l]) => el('button', { type: 'button', class: 'chip', 'aria-pressed': String(String(S.settings[key]) === String(v)), onclick: () => { S.settings[key] = v; saveNow(); applySettings(); renderSettings(); } }, l)));
    root.append(el('h1', { class: 'h2like', 'data-focus': '', style: 'margin:12px 4px 0' }, '設定'));
    root.append(el('section', { class: 'card profile-set' }, el('h2', null, 'プロフィール'), profileCard()));
    root.append(el('section', { class: 'card' }, el('h2', null, '解き方'),
      sw('選択肢の順番をシャッフル', 'shuffle', '番号の丸暗記を防ぎます。答え合わせのあとに本試験の番号も出します'),
      sw('答え合わせ後に解説を表示する', 'showExplain', 'オフにすると、答え合わせのあとすぐ次の問題へ進みます'),
      el('div', { class: 'field' }, el('div', { class: 'label', text: '1問の制限時間（今日のメニュー・演習）' }), limitPicker(),
        el('p', { class: 'small muted', text: '問題の上の横棒が、時間が減るにつれて短くなります（ねこが右のスタートから左の「時間切れ」へ歩きます）。時間切れは不正解として記録します。「⏸ 一時停止」で止められます。模擬試験は全体の時間で計ります。' })),
      el('div', { class: 'field' }, el('div', { class: 'label', text: 'プレイモード' }), seg('playMode', [['normal', '通常'], ['life', 'ライフ'], ['sudden', 'サドンデス']], 'プレイモード'),
        S.settings.playMode === 'life' ? el('div', { style: 'margin-top:6px' }, seg('lives', Array.from({ length: 10 }, (_, i) => [i + 1, (i + 1) + '個']), 'ライフの個数')) : null),
      el('div', { class: 'field' }, el('div', { class: 'label', text: '文字の大きさ' }), seg('font', [['s', '小'], ['m', '中'], ['l', '大'], ['xl', '特大']], '文字の大きさ')),
      el('div', { class: 'field' }, el('div', { class: 'label', text: '画面の色' }), seg('palette', PALETTES, '画面の色')),
      el('div', { class: 'field' }, el('div', { class: 'label', text: '明るさ' }), seg('theme', [['auto', '端末に合わせる'], ['light', 'ライト'], ['dark', 'ダーク']], '明るさ')),
      sw('スマホでは補助機能を折りたたむ', 'foldTools', 'マーク・コピー・音声などを、押したときだけ開くようにして画面をすっきりさせます')));
    root.append(el('section', { class: 'card' }, el('h2', null, '音・音声・演出'),
      sw('効果音', 'sound', '正解（チャイム）・不正解のときに音を鳴らします'),
      sw('残り5秒でカウントダウン音', 'countdown', '1問の制限時間があるときに鳴ります'),
      sw('音声解説', 'speech', '端末の日本語音声で、問題や解説を読み上げます（外部には送りません）'),
      sw('答え合わせ後に自動で読み上げ', 'autoSpeech', '解説を表示する設定のときに読み上げます'),
      el('label', { class: 'row small', style: 'margin:10px 0' }, '読み上げの速さ',
        el('input', { type: 'range', min: '0.8', max: '2.4', step: '0.1', value: String(S.settings.speechRate || 1), 'aria-label': '読み上げの速さ', oninput: (e) => { S.settings.speechRate = Math.round(Number(e.target.value) * 10) / 10; e.target.nextSibling.textContent = S.settings.speechRate.toFixed(1) + '倍'; save(); } }),
        el('output', { text: (Number(S.settings.speechRate) || 1).toFixed(1) + '倍' })),
      sw('達成演出', 'effects', '10問ごと・完了・レベルアップのときに、お祝いの画面を出します'),
      el('div', { class: 'row', style: 'margin-top:10px' },
        el('button', { type: 'button', class: 'btn small', onclick: () => { unlockAudio(); sound(true); toast('音を有効にしました。鳴らないときは端末の音量・消音スイッチを確かめてください'); } }, '🔊 音を有効にする（iPhone）'),
        canSpeak() ? el('button', { type: 'button', class: 'btn small', onclick: () => speakText('読み上げのテストです。介護福祉士国家試験、合格をめざしましょう。') }, '読み上げを試す') : null),
      canSpeak() ? null : el('p', { class: 'small muted', text: 'このブラウザは読み上げに対応していません。' })));

    const partsBox = el('div', { class: 'chips', role: 'group', 'aria-label': '受けるパート' }, Object.keys(PARTS).map((k) => el('button', { type: 'button', class: 'chip', 'aria-pressed': String(myParts().includes(k)), onclick: () => {
      let a = myParts().slice(); a = a.includes(k) ? a.filter((x) => x !== k) : a.concat(k).sort();
      if (!a.length) { toast('1つ以上のパートを選んでください'); return; }
      S.settings.parts = a; saveNow(); renderSettings(); } }, PARTS[k].label)));
    root.append(el('section', { class: 'card' }, el('h2', null, '試験・模擬試験'),
      el('div', { class: 'field' }, el('div', { class: 'label', text: '受けるパート（パート合格の再受験など）' }), partsBox,
        el('p', { class: 'small muted', text: '今日のメニュー・復習・模擬試験は、選んだパートだけから出します。' })),
      el('div', { class: 'field' }, el('div', { class: 'label', text: '模擬試験の時間' }), seg('mockTime', [[1, '本番どおり'], [1.3, '1.3倍'], [1.5, '1.5倍'], [0, '時間制限なし']], '模擬試験の時間'),
        el('p', { class: 'small muted', text: '外国籍の受験者や障害のある受験者の、試験時間の延長などに合わせて練習できます。' })),
      sw('模擬試験で、まだ解いていない問題を優先する', 'mockPreferNew', '解いたことのある問題で点数が上がりすぎるのを防ぎます'),
      sw('模擬試験でも選択肢をシャッフルする', 'mockShuffle', 'オフのときは本試験と同じ並びです'),
      el('p', { class: 'small muted', text: '試験日：' + CFG.examDate + '（残り日数の計算に使います）' })));

    const idx = DATA.index || {};
    const offline = el('span', { class: 'small muted', text: '確認中…' });
    const cl = (idx.changelog || []).slice(0, 10);
    root.append(el('section', { class: 'card' }, el('h2', null, '問題データ'),
      el('ul', { class: 'list-plain' },
        el('li', null, el('span', { text: '問題数' }), el('b', { text: DATA.byId.size + '問（' + DATA.loaded + '/' + SUBJECTS.length + '科目）' })),
        el('li', null, el('span', { text: 'データの版' }), el('span', { text: (idx.rev ? 'rev ' + idx.rev + '・' : '') + (idx.version || '–') + (idx.generatedAt ? '（' + new Date(idx.generatedAt).toLocaleDateString('ja-JP') + '）' : '') })),
        el('li', null, el('span', { text: 'オフライン' }), offline)),
      cl.length ? el('details', { class: 'small' }, el('summary', { text: '更新履歴' }), el('ul', null, cl.map((c) => el('li', { text: c.date + '　' + c.text })))) : null,
      el('button', { type: 'button', class: 'btn block', style: 'margin-top:10px', onclick: async (e) => { e.currentTarget.disabled = true; e.currentTarget.textContent = '確認中…'; await refreshData(true); renderSettings(); } }, '最新の問題データを確認する')));
    checkOffline(offline);

    root.append(el('section', { class: 'card' }, el('h2', null, '学習記録はどこに保存される？'),
      el('ul', { class: 'plain-list' },
        el('li', { text: '解いた記録・メモ・★・模試の結果は、いま使っているこの端末のこのブラウザの中（localStorage）だけに保存されます。' }),
        el('li', { text: 'サーバーには送りません。運営者を含め、ほかの人があなたの記録を見ることはできません。' }),
        el('li', { text: 'そのため、スマホとパソコン、Safari と Chrome、ブラウザとホーム画面のアプリでは、記録は別々です。移すときは下の「バックアップ」で書き出して、相手の端末で読み込みます。' }),
        el('li', { text: 'ブラウザの「履歴・サイトデータの消去」をすると記録も消えます。ときどきバックアップを書き出してください。' })),
      el('p', { class: 'small muted', text: 'この端末の記録：回答 ' + S.log.length.toLocaleString() + '件・メモ ' + Object.keys(S.q).filter((id) => S.q[id].n).length + '件・模試 ' + S.mocks.length + '回' })));

    const last = S.lastBackup ? new Date(S.lastBackup).toLocaleDateString('ja-JP') : 'まだありません';
    const file = el('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: (e) => importBackup(e.target.files[0]) });
    root.append(el('section', { class: 'card' }, el('h2', null, '学習記録のバックアップ'),
      el('p', { class: 'small muted', style: 'margin:0 0 10px', text: '記録はこの端末の中だけにあります。機種変更やスマホ⇔パソコンで記録を移すときは、書き出したファイルを相手の端末で読み込んでください（読み込むと記録が合わさります）。最後のバックアップ：' + last }),
      el('div', { class: 'row' },
        el('button', { type: 'button', class: 'btn primary grow', onclick: exportBackup }, '書き出す'),
        el('button', { type: 'button', class: 'btn grow', onclick: () => file.click() }, '読み込む'), file)));

    root.append(el('section', { class: 'card' }, el('h2', null, 'このアプリについて'), aboutBlock(true),
      el('ul', { class: 'list-plain' },
        el('li', null, el('span', { text: 'アプリのバージョン' }), el('span', { text: APP_VERSION })),
        el('li', null, el('span', { text: '記録している回答' }), el('span', { text: S.log.length + '件' }))),
      el('button', { type: 'button', class: 'btn danger block', style: 'margin-top:10px', onclick: async () => {
        if (!(await ask('この端末の学習記録をすべて消します。元に戻せません。\n先にバックアップの書き出しをおすすめします。', 'すべて消す', true))) return;
        const keep = S.settings; S = blankStore(); S.settings = keep; srsCache = null; saveNow(); toast('記録を消しました'); renderSettings();
      } }, '学習記録をすべて消す')));
    root.append(tabbar('settings'));
    app().replaceChildren(root);
  }
  async function checkOffline(node) {
    const cache = await openCache();
    if (!cache || !DATA.index) { node.textContent = 'この環境では保存できません'; return; }
    let n = 0; for (const m of DATA.index.subjects) if (await cache.match(cacheKey(m))) n++;
    const sw = 'serviceWorker' in navigator && navigator.serviceWorker.controller;
    node.textContent = (n === DATA.index.subjects.length ? '全科目を保存済み' : n + '/' + DATA.index.subjects.length + '科目を保存済み') + (sw ? '' : '（画面の保存は次回から）');
  }
  async function exportBackup() {
    const json = JSON.stringify({ app: 'kaigo-study', v: 3, exportedAt: new Date().toISOString(), data: { q: S.q, log: S.log, days: S.days, mocks: S.mocks, settings: S.settings, profile: S.profile } });
    const name = 'kaigo-study-backup-' + dayKey() + '.json';
    try {
      // iPhone のホーム画面アプリなどでは、共有シートからファイル・LINE・メールに保存する
      const f = typeof File === 'function' ? new File([json], name, { type: 'application/json' }) : null;
      if (f && navigator.canShare && navigator.canShare({ files: [f] }) && isStandalone()) {
        await navigator.share({ files: [f], title: '学習記録のバックアップ' });
      } else {
        const a = el('a', { href: URL.createObjectURL(new Blob([json], { type: 'application/json' })), download: name });
        document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      }
      S.lastBackup = Date.now(); delete S.prefs.backupSnooze; saveNow();
      toast('バックアップを書き出しました');
      if (route !== 'quiz') render(route);
    } catch (e) { if (e && e.name !== 'AbortError') toast('書き出せませんでした'); }
  }
  function importBackup(f) {
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) { toast('ファイルが大きすぎます'); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const o = JSON.parse(reader.result);
        if (!o || o.app !== 'kaigo-study' || !o.data || !Array.isArray(o.data.log)) throw new Error('形式');
        const notes = Object.keys(o.data.q || {}).filter((id) => K.ID_RE.test(id) && o.data.q[id] && o.data.q[id].n).length;
        if (!(await ask('回答 ' + o.data.log.length.toLocaleString() + '件・メモ ' + notes + '件の記録を、この端末の記録に合わせます。よろしいですか？', '合わせる'))) return;
        const r = K.merge(S, { v: o.v || 1, q: o.data.q, log: o.data.log, days: o.data.days, mocks: o.data.mocks, profile: o.data.profile, settings: {} }, blankStore());
        // 目標は、この端末がまだ初期値のときだけ移す
        const g = o.data.settings && o.data.settings.goals;
        if (g && JSON.stringify(S.settings.goals) === JSON.stringify(blankStore().settings.goals)) S.settings.goals = Object.assign({}, S.settings.goals, g);
        srsCache = null; growthCache = null; saveNow();
        toast('読み込みました（新しい回答 ' + r.added + '件）'); renderSettings();
      } catch (e) { toast('このファイルは読み込めません'); }
    };
    reader.readAsText(f);
  }
  function applySettings() {
    const r = document.documentElement;
    r.dataset.font = S.settings.font || 'm';
    r.dataset.palette = S.settings.palette || 'orange';
    if (S.settings.theme === 'auto') delete r.dataset.theme; else r.dataset.theme = S.settings.theme;
  }
  // 誤りの報告：Google フォームを事前入力つきで開く。フォームがまだなければ、内容をコピーできるようにする
  function reportError(q, order) {
    const vals = { id: q.id, round: q.round || '', subject: q.subject, rev: (DATA.index && (DATA.index.rev || DATA.index.version)) || '', app: APP_VERSION, order: order.join('') };
    track('report_click');
    if (CFG.reportFormUrl) { window.open(CFG.reportFormUrl.replace(/\{(\w+)\}/g, (m, k) => encodeURIComponent(vals[k] == null ? '' : vals[k])), '_blank', 'noopener'); return; }
    const text = '【過去問演習の誤り報告】\n問題ID：' + vals.id + '\n回：第' + vals.round + '回\n科目：' + vals.subject + '\nデータ版：' + vals.rev + '\nアプリ版：' + vals.app + '\n表示の順：' + vals.order + '\n内容（問題文・正答・解説・その他）：\n';
    openSheet((sheet, close) => {
      const ta = el('textarea', { class: 'input', id: 'report-text', rows: '8' }); ta.value = text;
      sheet.append(el('h2', { text: '誤りを報告' }), el('p', { class: 'small', text: '下の内容をコピーして、ブログのお問い合わせから送ってください。' }), ta,
        el('div', { class: 'row', style: 'margin-top:10px' },
          el('button', { type: 'button', class: 'btn primary grow', onclick: async () => { try { await navigator.clipboard.writeText(ta.value); toast('コピーしました'); } catch (e) { ta.select(); toast('選択しました。コピーしてください'); } } }, 'コピー'),
          el('button', { type: 'button', class: 'btn grow', onclick: close }, '閉じる')));
    }, { label: '誤りを報告' });
  }

  // キーボード（パソコン）：1〜5で選ぶ、→で次へ、←で前へ。ボタンや入力欄にいるときは横取りしない
  document.addEventListener('keydown', (e) => {
    if (route !== 'quiz' || $('.sheet-bg') || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t.closest('textarea,input,select,summary')) return;
    if (/^[1-5]$/.test(e.key)) { const b = document.querySelectorAll('.opt .pick')[Number(e.key) - 1]; if (b && !b.disabled) { b.click(); e.preventDefault(); } return; }
    if (t.closest('button,a')) return; // Enter・矢印はフォーカスのある部品に任せる
    if (e.key === 'ArrowRight' || e.key === 'Enter') { const b = $('.quiz-foot .btn.primary'); if (b && !b.disabled) { b.click(); e.preventDefault(); } }
    else if (e.key === 'ArrowLeft') { const b = $('.quiz-foot .inner > .btn:first-child'); if (b && !b.disabled) { b.click(); e.preventDefault(); } }
  });

  // ───────── ブログからのリンク ─────────
  // 例：app/?t=T18&n=10&from=haisetsu-01-benpi ／ ?s=社会の理解&round=36 ／ ?ids=K0019,K0065&title=… ／ ?part=A&filter=due ／ ?mock=mini
  async function handleLinkParams() {
    const sp = new URLSearchParams(location.search);
    if (![...sp.keys()].length) return false;
    const clean = () => { try { history.replaceState({ r: route }, '', location.pathname + '#' + route); } catch (e) { /* なし */ } };
    const from = sp.get('from');
    const map = (DATA.index && DATA.index.idMap) || {};
    const ids = (sp.get('ids') || '').split(/[,\s]+/).map((x) => x.trim().toUpperCase()).map((x) => map[x] || x).filter((x) => K.ID_RE.test(x));
    const mock = sp.get('mock');
    const t = (sp.get('t') || '').toUpperCase();
    const s = sp.get('s');
    const part = (sp.get('part') || '').toUpperCase();
    const menu = sp.get('menu');
    const want = ids.length || s || isTheme(t) || PARTS[part] || sp.get('round') || sp.get('theme') || mock || menu === 'today';
    clean();
    if (!want) return false;
    if (menu === 'today') { await startToday(); return true; }
    track('link/' + (mock ? 'mock' : ids.length ? 'ids' : isTheme(t) ? 'theme' : 'scope') + (from ? '/' + from : ''));
    if (s && !SUBJECTS.includes(s)) { toast('リンクの科目名が見つかりません：' + s); return false; }
    if (!(await confirmReplace())) return false;
    if (mock) {
      const mt = dataTypes().filter((x) => x !== '実務者研修');
      const size = ['full', 'mini'].includes(mock) ? mock : PARTS[mock.toUpperCase()] ? mock.toUpperCase() : 'mini';
      await startMock(size, mt.includes(sp.get('type')) ? sp.get('type') : (mt[0] || '過去問'), true); return true;
    }
    if (ids.length) return startIds(ids, sp.get('title') || '', true);
    const n = sp.get('n') === 'all' ? 'all' : String(Math.max(1, Math.min(200, parseInt(sp.get('n'), 10) || 10)));
    const opt = { scope: isTheme(t) ? t : PARTS[part] ? part : (s || 'all'), type: sp.get('type') || 'all', round: sp.get('round') || '', theme: sp.get('theme') || '', filter: sp.get('filter') || 'all', count: n, order: sp.get('order') === 'seq' ? 'seq' : 'random' };
    if (!pool(opt).length) { noQuestions(opt); return false; }
    return startPractice(opt, sp.get('title') || '', true);
  }

  // ───────── Service Worker（オフライン用）─────────
  function registerSW() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:' || CFG.noServiceWorker) return;
    const hadCtl = !!navigator.serviceWorker.controller; // 初めて開いたときは、制御が付いても再読み込みしない
    navigator.serviceWorker.register('sw.js').then((reg) => {
      const offer = (w) => toast('新しいバージョンがあります', { label: '更新', run: () => w.postMessage('skipWaiting') });
      if (reg.waiting && hadCtl) offer(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); });
      });
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    }).catch(() => { /* プレビュー環境などでは登録できない */ });
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadCtl || reloading) return;
      reloading = true; saveNow();
      // 問題を解いている途中なら、画面を出るまで待つ
      if (route === 'quiz' && S.session && !S.session.done) { toast('次に問題画面を出たときに新しいバージョンになります'); const id = setInterval(() => { if (route !== 'quiz') { clearInterval(id); location.reload(); } }, 1000); }
      else location.reload();
    });
  }

  // 図の画像を、電波のあるうちに保存しておく（電波がない所でも図が出るように）
  async function cacheFigures() {
    if (!('caches' in window) || navigator.onLine === false) return;
    try {
      const c = await caches.open('kaigo-fig-v1'), urls = new Set();
      DATA.byId.forEach((q) => { if (q.figure) { if (q.figure.stem) urls.add(q.figure.stem); for (const o of q.figure.options || []) if (o) urls.add(o); } });
      for (const u of urls) { const abs = new URL(u, location.href).href; if (!(await c.match(abs))) { const res = await fetch(abs).catch(() => null); if (res && res.ok) await c.put(abs, res); } }
    } catch (e) { /* 保存できなくても続ける */ }
  }

  // ───────── 起動 ─────────
  async function boot() {
    loadStore(); S.launches = (S.launches || 0) + 1; applySettings(); registerSW();
    const msg = $('.boot p');
    try {
      await loadAllData((d, n) => { if (msg) msg.textContent = '問題データを準備中… ' + d + ' / ' + n; });
    } catch (e) {
      app().replaceChildren(el('main', { class: 'shell' }, topbar(), el('div', { class: 'card' }, el('h1', { class: 'h2like', text: '問題データを読み込めませんでした' }),
        el('p', { text: '初めて開くときは、電波のある所で開いてください。一度読み込めば、次からは電波がなくても使えます。' }),
        el('p', { class: 'small muted', text: String(e && e.message || e) }),
        el('button', { type: 'button', class: 'btn primary', onclick: () => location.reload() }, 'もう一度読み込む'))));
      return;
    }
    loadLinks(); loadMocks(); cacheFigures();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); // 端末の空き容量が減っても消されにくくする
    saveNow();
    track('boot');
    lastRefresh = Date.now();
    const startRoute = (location.hash || '').slice(1);
    try { history.replaceState({ r: 'home' }, '', location.pathname + location.search + '#home'); } catch (e) { /* なし */ }
    if (checkMockDeadline()) return;
    render('home');
    if (startRoute === 'quiz' && S.session && !S.session.done) go('quiz');
    else if (startRoute === 'result' && S.lastResult) go('result', S.lastResult);
    else if (startRoute === 'stats' || startRoute === 'settings') go(startRoute);
    await handleLinkParams();
    window.addEventListener('online', () => refreshData(false));
  }
  boot();
})();
