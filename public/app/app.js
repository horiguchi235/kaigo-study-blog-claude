/* 過去問演習（介護福祉士 過去問でつなぐ合格ノート）v2.0
 * 学習記録はこの端末の localStorage に保存（外には送らない）。問題データは Cache Storage に保存してオフラインで使う。
 * 画面に関係しない処理（連問・合格判定・間隔反復・記録の点検）は core.js にある。
 */
(function () {
  'use strict';
  const K = window.KaigoCore;
  const APP_VERSION = '2.0.0';
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
      v: 2, q: {}, log: [], days: {}, mocks: [],
      settings: { shuffle: true, confirmMode: true, font: 'm', theme: 'auto', goal: 20, sound: false, parts: ['A', 'B', 'C'], mockTime: 1, mockPreferNew: false, mockShuffle: false },
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
  const DATA = { index: null, bySubject: {}, byId: new Map(), loaded: 0, error: '', links: null };
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
    S.session = ses; saveNow(); return ses;
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
    const f = { due: '今日の復習', review: '今日の復習', new: 'まだ解いていない', wrong: '間違えた・自信がない', star: '★' }[opt.filter];
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
    if (window.speechSynthesis) try { window.speechSynthesis.cancel(); } catch (e) { /* なし */ }
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

  // ── ホーム ──
  function stat(v, k) { return el('div', null, el('div', { class: 'v', text: String(v) }), el('div', { class: 'k', text: k })); }
  function renderHome() {
    const today = S.days[dayKey()] || { n: 0, c: 0, sec: 0 };
    const goal = S.settings.goal || 20;
    const plan = todayPlan();
    const p = Object.assign({ by: 'subject', scope: 'mine', type: '過去問', round: '', filter: 'all', count: '10', order: 'random' }, S.prefs.practice || {});
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

    root.append(el('section', { class: 'card', 'aria-label': '今日の学習' },
      el('h2', null, '今日の学習', el('span', { class: 'sub', text: today.n >= goal ? '目標達成' : '目標 ' + goal + '問' })),
      el('div', { class: 'today' },
        stat(today.n, '解いた問題'), stat(today.n ? pct(today.c, today.n) + '%' : '–', '正答率'), stat(fmtMin(today.sec || 0), '学習時間'), stat(streak() + '日', '連続')),
      el('div', { class: 'goal', role: 'progressbar', 'aria-label': '1日の目標', 'aria-valuemin': '0', 'aria-valuemax': String(goal), 'aria-valuenow': String(Math.min(goal, today.n)) }, el('i', { style: 'width:' + Math.min(100, pct(today.n, goal)) + '%' }))));

    // 2. 自分で選ぶ（たたむ）
    const scopeSel = el('select', { class: 'input', id: 'f-scope' });
    const roundSel = el('select', { class: 'input', id: 'f-round' });
    const info = el('p', { class: 'small muted', style: 'margin:8px 0 0', 'aria-live': 'polite' });
    const startBtn = el('button', { type: 'button', class: 'btn primary block lg', style: 'margin-top:12px' });
    const scopeLbl = el('label', { for: 'f-scope', text: p.by === 'theme' ? 'テーマ' : '範囲' });
    function count(scope) { return pool({ scope }).length; }
    function fillScope() {
      if (p.by === 'theme') {
        scopeSel.replaceChildren(...themeCategories().map(([cat, ts]) => el('optgroup', { label: cat }, ts.map((t) => el('option', { value: t.id, text: t.id + ' ' + t.name + '（' + count(t.id) + '問）' })))));
      } else {
        scopeSel.replaceChildren(
          el('option', { value: 'mine', text: (myParts().length === 3 ? '全科目' : '受けるパート（' + myParts().join('・') + '）') + '（' + count('mine') + '問）' }),
          myParts().length < 3 ? el('option', { value: 'all', text: '全科目（' + count('all') + '問）' }) : null,
          el('optgroup', { label: '試験のパート' }, Object.keys(PARTS).map((k) => el('option', { value: k, text: PARTS[k].label + '：' + PARTS[k].subjects.length + '科目（' + count(k) + '問）' }))),
          el('optgroup', { label: '科目' }, SUBJECTS.map((s) => el('option', { value: s, text: s + '（' + count(s) + '問）' }))));
      }
      scopeSel.value = p.scope; if (scopeSel.value !== p.scope) { scopeSel.selectedIndex = 0; p.scope = scopeSel.value; }
    }
    function fillRounds() {
      const rounds = [...new Set(pool({ scope: p.scope }).filter((q) => q.round).map((q) => q.round))].sort((a, b) => b - a);
      const ex = (DATA.index && DATA.index.excluded) || [];
      roundSel.replaceChildren(el('option', { value: '', text: 'すべての回' }), rounds.map((r) => {
        const pend = ex.filter((e) => e.round === r && scopeSubjects(p.scope) && scopeSubjects(p.scope).includes(e.subject)).length;
        return el('option', { value: String(r), text: '第' + r + '回' + (pend ? '（図の問題' + pend + '問は準備中）' : '') });
      }));
      roundSel.value = rounds.includes(Number(p.round)) ? String(p.round) : ''; p.round = roundSel.value;
    }
    const chipGroup = (name, items, val, label) => el('div', { class: 'chips', role: 'group', 'aria-label': label }, items.map(([v, l]) => el('button', { type: 'button', class: 'chip', 'aria-pressed': String(v === val), onclick: (e) => {
      p[name] = v; if (name === 'type' && v !== '過去問') p.round = '';
      e.currentTarget.parentNode.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === e.currentTarget)));
      if (name === 'by') { p.scope = v === 'theme' ? (themeList()[0] || {}).id : 'mine'; fillScope(); scopeLbl.textContent = v === 'theme' ? 'テーマ' : '範囲'; fillRounds(); }
      update(); } }, l)));
    let lastPrefs = '';
    function update() {
      p.scope = scopeSel.value; p.round = roundSel.value;
      roundSel.disabled = types.length > 1 && p.type !== '過去問'; if (roundSel.disabled) roundSel.value = '';
      const n = pool(p).length, take = p.count === 'all' ? n : Math.min(Number(p.count), n);
      info.textContent = '条件に合う問題：' + n + '問';
      startBtn.textContent = n ? '▶ ' + take + '問を解く' : '問題がありません';
      startBtn.disabled = !n;
      const now = JSON.stringify(p);
      if (now !== lastPrefs) { lastPrefs = now; S.prefs.practice = Object.assign({}, p); save(); }
    }
    scopeSel.onchange = () => { fillRounds(); update(); };
    roundSel.onchange = update;
    startBtn.onclick = () => startPractice(Object.assign({}, p));
    fillScope(); fillRounds();
    const detailsOpen = !!S.prefs.formOpen;
    const form = el('details', { class: 'card fold', open: detailsOpen ? true : null, ontoggle: (e) => { S.prefs.formOpen = e.currentTarget.open ? 1 : 0; save(); } },
      el('summary', null, el('h2', null, ico('✏️'), ' 自分で選んで解く'), el('span', { class: 'sub', text: '科目・テーマ・回・問題数' })),
      ...[
        hasThemes ? el('div', { class: 'field' }, el('div', { class: 'label', text: '分け方' }), chipGroup('by', [['subject', '科目別'], ['theme', 'テーマ別']], p.by, '分け方')) : null,
        el('div', { class: 'field' }, scopeLbl, scopeSel),
        types.length > 1 ? el('div', { class: 'field' }, el('div', { class: 'label', text: '問題の種類' }), chipGroup('type', types.map((t) => [t, t]).concat([['all', 'すべて']]), p.type, '問題の種類')) : null,
        el('div', { class: 'field' }, el('label', { for: 'f-round', text: '回' }), roundSel),
        el('div', { class: 'field' }, el('div', { class: 'label', text: '出す問題' }), chipGroup('filter', [['all', 'すべて'], ['new', 'まだ解いていない'], ['due', '今日の復習'], ['wrong', '間違えた・自信がない'], ['star', '★をつけた']], p.filter === 'review' ? 'due' : p.filter, '出す問題')),
        el('div', { class: 'row', style: 'gap:16px;align-items:flex-start' },
          el('div', { class: 'field grow' }, el('div', { class: 'label', text: '問題数' }), chipGroup('count', [['5', '5'], ['10', '10'], ['20', '20'], ['50', '50'], ['all', '全部']], p.count, '問題数')),
          el('div', { class: 'field' }, el('div', { class: 'label', text: '順番' }), chipGroup('order', [['random', 'ランダム'], ['seq', '試験の順']], p.order, '順番'))),
        info, startBtn,
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
    const timer = el('span', { class: 'timer', role: 'timer', 'aria-live': 'off' });
    const top = el('div', { class: 'quiz-top' },
      el('div', { class: 'row' },
        el('button', { type: 'button', class: 'icon-btn', 'aria-label': reviewMode ? '解説を閉じる' : '中断してホームへ', onclick: () => { saveNow(); if (reviewMode) { S.session = null; saveNow(); go(S.lastResult ? 'result' : 'home', S.lastResult); } else go('home'); } }, '✕'),
        el('h1', { class: 'title', text: ses.title }),
        el('span', { class: 'counter', 'data-focus': '', text: (ses.i + 1) + ' / ' + ids.length }),
        timer,
        !isMock && !reviewMode && Object.keys(ses.ans).length ? el('button', { type: 'button', class: 'btn ghost small end-btn', onclick: async () => {
          const answered = Object.keys(ses.ans).length;
          if (answered >= ses.ids.length || await ask('ここで終えて結果を見ますか？\n（' + answered + '問 回答済み。残りの ' + (ses.ids.length - answered) + '問は「未回答」になります）', '結果を見る')) finishPractice();
        } }, '終える') : null),
      el('div', { class: 'qbar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + pct(isMock ? Object.keys(ses.ans).length : ses.i + (ses.ans[ids[ses.i]] ? 1 : 0), ids.length) + '%' })));

    // 問題がまだ読み込めていないとき：記録は書き換えず、先へ進めるだけにする
    if (!q) {
      app().replaceChildren(el('main', { class: 'shell quiz' }, top,
        el('div', { class: 'notice warn', text: 'この問題はまだ読み込めていません（電波のある所で開き直すと読み込みます）。' }),
        quizFoot(ses, { isMock, reviewMode, ans: null, isLast: ses.i === ids.length - 1 })));
      return;
    }
    const ans = ses.ans[q.id];
    const showAnswer = reviewMode || (!isMock && !!ans);
    const order = displayOrder(ses, q);
    const shuffled = order.join('') !== '12345';
    const ex = K.parseExplanation(q.explanation);
    const rq = S.q[q.id] || {};
    const sel = ses.sel && ses.sel[q.id];
    const disp = (orig) => order.indexOf(orig) + 1;

    const updTimer = () => {
      if (isMock && ses.deadline && !reviewMode) {
        const left = mockLeftMs(ses);
        timer.textContent = (ses.pausedAt ? '停止中 ' : '残り ') + fmtTime(left);
        timer.classList.toggle('low', left < 5 * 60000);
      } else timer.textContent = fmtTime(ses.qElapsed[q.id] || 0);
    };

    const metaTags = el('div', { class: 'meta' },
      el('span', { class: 'tag type', text: q.type === '過去問' && q.round ? '第' + q.round + '回 過去問' + (q.no ? ' 問題' + q.no : '') : q.type }),
      el('span', { class: 'tag', text: q.subject }),
      q.themes && q.themes.length ? q.themes.map((t) => el('span', { class: 'tag', text: themeName(t) })) : q.theme ? el('span', { class: 'tag', text: q.theme }) : null,
      q.lawStatus && q.lawStatus !== 'ok' ? el('span', { class: 'tag law', text: '⚠ 法改正あり' }) : null,
      rq.a ? el('span', { class: 'tag', text: 'これまで ' + rq.c + '/' + rq.a + ' 正解' }) : null);

    // 事例：連問の2問目以降は、事例の本文をたたんでおく
    const split = K.splitCase(q.stem);
    const prevSame = ses.i > 0 && DATA.byId.get(ids[ses.i - 1]) && K.caseKey(DATA.byId.get(ids[ses.i - 1])) === K.caseKey(q);
    let stemBlock;
    if (split && prevSame) {
      stemBlock = el('div', null,
        el('details', { class: 'case' }, el('summary', null, '事例を表示（前の問題と同じ事例）'), el('div', { class: 'stem case-text', text: split.case })),
        stemNode(split.question, q.negative));
    } else stemBlock = stemNode(q.stem, q.negative);
    const fig = q.figure && q.figure.stem ? el('div', { class: 'figure' }, el('img', { src: q.figure.stem, alt: q.figure.alt || '問題の図', loading: 'lazy' })) : null;
    const figText = q.figText ? el('div', { class: 'figtext' }, el('b', { text: q.figSrc === 'official' ? '図の内容（試験センター公表の文字情報）' : '図の内容（アプリによる説明。原文ではありません）' }), el('p', { text: q.figText })) : null;

    const elim = ses.elim[q.id] || [];
    const list = el('ol', { class: 'opts' + (showAnswer ? ' answered' : ''), 'aria-label': '選択肢' });
    const chosen = ans ? ans.c : null;
    order.forEach((orig, idx) => {
      const d = idx + 1;
      const isKey = q.keys.includes(orig);
      const isMine = chosen === orig;
      const isSel = !showAnswer && (isMock ? isMine : sel === orig);
      const isElim = !showAnswer && elim.includes(orig);
      const cls = ['opt'];
      if (showAnswer) { if (isKey) cls.push('correct'); else if (isMine) cls.push('wrong'); }
      else if (isSel) cls.push('selected');
      if (isElim) cls.push('eliminated');
      const optFig = q.figure && q.figure.options && q.figure.options[orig - 1];
      const label = showAnswer ? [isKey ? (q.negative ? '○ これが答え（適切でない）' : '○ 正解') : (q.negative ? '× 答えではない（適切な内容）' : '× 不正解'), shuffled ? '｜本試験では' + orig + '番' : ''].join('') : '';
      const li = el('li', { class: cls.join(' ') },
        el('div', { class: 'opt-main' },
          el('button', { type: 'button', class: 'pick', 'aria-pressed': showAnswer ? null : String(isSel), 'aria-disabled': isElim ? 'true' : null, onclick: () => pick(orig), disabled: showAnswer ? true : null },
            el('span', { class: 'num', 'aria-hidden': 'true', text: String(d) }),
            el('span', { class: 'txt' }, el('span', { class: 'sr-only', text: d + '番。' }), q.options[orig - 1], optFig ? el('img', { src: optFig, alt: '選択肢' + d + 'の図', loading: 'lazy' }) : null,
              isMine && showAnswer ? el('span', { class: 'mine-badge', text: '✓ あなたの答え' }) : null,
              isElim ? el('span', { class: 'sr-only', text: '（消去法で消した選択肢）' }) : null)),
          showAnswer ? null : el('button', { type: 'button', class: 'elim', 'aria-label': d + '番を' + (isElim ? '消去法から戻す' : '消去法で消す'), 'aria-pressed': String(isElim), onclick: () => toggleElim(orig) }, isElim ? '戻す' : '消す')),
        showAnswer && ex.opts[orig] ? el('div', { class: 'why' }, el('b', { text: label }), el('span', { text: K.remapNumbers(ex.opts[orig], order) })) : null);
      list.append(li);
    });

    const unsure = !!ses.unsure[q.id];
    const tools = el('div', { class: 'qtools' },
      reviewMode || showAnswer ? null : el('button', { type: 'button', class: 'toggle', 'aria-pressed': String(unsure), onclick: toggleUnsure }, ico('🤔'), unsure ? ' 自信がない（記録します）' : ' 自信がない'),
      el('button', { type: 'button', class: 'toggle star', 'aria-pressed': String(!!rq.st), onclick: toggleStar }, rq.st ? '★ あとで見る' : '☆ あとで見る'),
      'speechSynthesis' in window ? el('button', { type: 'button', class: 'toggle', onclick: () => speak(q, order) }, ico('🔊'), ' 読み上げ') : null,
      isMock && !reviewMode && ses.deadline ? el('button', { type: 'button', class: 'toggle', onclick: togglePause }, ses.pausedAt ? '▶ 再開' : '⏸ 一時停止') : null);

    const body = el('main', { class: 'shell quiz' }, top, metaTags, stemBlock, fig, figText);

    // 答え合わせの結果は選択肢の上に（自分の誤答の理由をいちばん目立つ所に）
    if (showAnswer) {
      const keyDisp = q.keys.map(disp).sort((a, b) => a - b);
      const ok = ans ? q.keys.includes(ans.c) : null;
      const msg = ans ? (ok ? '正解！' : '不正解') : '未回答';
      const mineWhy = ans && !ok && ex.opts[ans.c] ? K.remapNumbers(ex.opts[ans.c], order) : '';
      body.append(el('div', { class: 'verdict ' + (ok ? 'ok' : 'ng'), role: 'status' },
        el('span', { class: 'mark', 'aria-hidden': 'true', text: ok ? '○' : '×' }),
        el('div', { class: 'grow' }, el('div', { class: 'vt', text: msg }),
          el('small', { text: '正解は ' + keyDisp.join('・') + '番' + (keyDisp.length > 1 ? '（どれを選んでも正解）' : '') + (shuffled ? '（本試験では' + q.keys.join('・') + '番）' : '') + (ans ? '｜あなたの答え ' + disp(ans.c) + '番' : '') + (ses.qElapsed[q.id] ? '｜' + Math.round(ses.qElapsed[q.id] / 1000) + '秒' : '') }),
          mineWhy ? el('p', { class: 'mine-why' }, el('b', { text: 'あなたが選んだ「' + q.options[ans.c - 1].slice(0, 30) + (q.options[ans.c - 1].length > 30 ? '…' : '') + '」が違う理由：' }), mineWhy) : null)));
    }
    body.append(list, tools);

    if (showAnswer) {
      if (q.lawNote) body.append(el('div', { class: 'lawnote' }, el('b', { text: '⚠ 法改正の注記' }), el('p', { text: q.lawNote })));
      if (ex.head) body.append(el('section', { class: 'explain', 'aria-label': '解説' }, renderRich(K.remapNumbers(ex.head, order))));
      const links = rontenLinks(q);
      const wrong = ans && !q.keys.includes(ans.c);
      if (links.length) body.append(el('div', { class: 'artlinks' + (wrong || unsure ? ' strong' : '') },
        el('b', null, ico('📖'), ' この論点を記事でくわしく'),
        el('ul', null, links.map((l) => el('li', null, el('a', { href: l.url, onclick: () => track('article_click') }, l.label), l.art ? el('span', { class: 'muted small', text: '（' + l.art + '）' }) : null)))));
      const memo = el('textarea', { class: 'input', id: 'memo', placeholder: '自分のメモ（この端末に保存）' });
      memo.value = rq.n || '';
      memo.oninput = () => { const r = rec(q.id); r.n = memo.value; r.nt = Date.now(); r.s = SUBJECTS.indexOf(q.subject); save(); };
      body.append(el('div', { class: 'field' }, el('label', { for: 'memo', text: 'メモ' }), memo));
      body.append(el('div', { class: 'row small muted', style: 'justify-content:space-between;margin:8px 0' },
        el('span', { text: '出典：' + SOURCE + (q.round ? ' 第' + q.round + '回' : '') + '。解説は当サイト独自のもので、試験センターとは関係ありません。' }),
        el('button', { type: 'button', class: 'btn ghost small', onclick: () => reportError(q, order) }, '⚠ 誤りを報告')));
    }
    if (!showAnswer && !isMock && S.settings.confirmMode && !sel) body.append(el('p', { id: 'pick-hint', class: 'small muted', style: 'margin:10px 4px 0', text: '選択肢を選んでから「答え合わせ」を押します。' }));
    body.append(quizFoot(ses, { isMock, reviewMode, ans, isLast: ses.i === ids.length - 1, sel, q }));
    app().replaceChildren(body);
    updTimer();
    if (!reviewMode) startTick(updTimer);
    if (showAnswer && !reviewMode) { const v = $('.verdict'); if (v) { v.setAttribute('tabindex', '-1'); v.focus({ preventScroll: true }); if (v.getBoundingClientRect().top < 0 || v.getBoundingClientRect().top > window.innerHeight - 160) v.scrollIntoView({ block: 'start', behavior: 'smooth' }); } }

    function rerender() { const y = window.scrollY; renderQuiz(); window.scrollTo(0, y); }
    function pick(orig) {
      if (showAnswer) return;
      if (elim.includes(orig)) { toast('消去法で消した選択肢です。選ぶときは「戻す」を押してください'); return; }
      if (isMock) { ses.ans[q.id] = { c: orig, t: Date.now() }; save(); rerender(); return; }
      if (S.settings.confirmMode) { ses.sel = ses.sel || {}; ses.sel[q.id] = orig; save(); rerender(); const b = $('.quiz-foot .btn.primary'); b && b.focus({ preventScroll: true }); return; }
      submit(orig);
    }
    function toggleElim(orig) {
      const a = ses.elim[q.id] || (ses.elim[q.id] = []);
      const i = a.indexOf(orig); if (i >= 0) a.splice(i, 1); else { a.push(orig); if (ses.sel && ses.sel[q.id] === orig) delete ses.sel[q.id]; if (isMock && ses.ans[q.id] && ses.ans[q.id].c === orig) delete ses.ans[q.id]; }
      save(); rerender();
    }
    function toggleUnsure() { ses.unsure[q.id] = !ses.unsure[q.id]; save(); rerender(); }
    function toggleStar() {
      const r = rec(q.id); r.st = r.st ? 0 : 1; r.s = SUBJECTS.indexOf(q.subject); save();
      toast(r.st ? '「あとで見る」に入れました' : '「あとで見る」から外しました'); rerender();
    }
    function togglePause() {
      if (ses.pausedAt) { ses.deadline += Date.now() - ses.pausedAt; ses.pausedAt = 0; }
      else ses.pausedAt = Date.now();
      saveNow(); rerender();
    }
  }
  function submit(orig) {
    const ses = S.session, q = DATA.byId.get(ses.ids[ses.i]);
    if (!q || ses.ans[q.id]) return;
    const ok = q.keys.includes(orig);
    const sec = (ses.qElapsed[q.id] || 0) / 1000;
    const logIdx = recordAnswer(q, orig, ok, sec, !!ses.unsure[q.id], 'p');
    ses.ans[q.id] = { c: orig, ok, log: logIdx };
    if (ses.sel) delete ses.sel[q.id];
    saveNow(); sound(ok); if (navigator.vibrate && !ok) navigator.vibrate(60);
    announce(ok ? '正解です' : '不正解です');
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
    } else if (S.settings.confirmMode) {
      main = el('button', { type: 'button', class: 'btn primary', disabled: sel ? null : true, 'aria-describedby': sel ? null : 'pick-hint', onclick: () => sel && submit(sel) }, '答え合わせ');
    } else {
      main = el('button', { type: 'button', class: 'btn', onclick: () => move(1), disabled: isLast ? true : null }, 'とばす →');
    }
    const skip = !isMock && !reviewMode && !ans && S.settings.confirmMode && !isLast ? el('button', { type: 'button', class: 'btn narrow', onclick: () => move(1) }, 'とばす') : null;
    return el('div', { class: 'quiz-foot' }, el('div', { class: 'inner' },
      prev, (isMock || reviewMode) ? el('button', { type: 'button', class: 'btn narrow', onclick: openGrid }, '一覧') : skip, main));
  }
  function move(d) { const ses = S.session; ses.i = Math.max(0, Math.min(ses.ids.length - 1, ses.i + d)); save(); render('quiz'); window.scrollTo(0, 0); focusMain(); }
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
    return { ids: ses.ids, ans: ses.ans, order: ses.order, unsure: ses.unsure, qElapsed: ses.qElapsed, title: ses.title, kind: ses.kind, opt: ses.opt || null, mockSize: ses.mockSize, mockType: ses.mockType, sec: Math.round(ses.elapsed / 1000), at: Date.now() };
  }
  function finishPractice() {
    const ses = S.session; if (!ses) return;
    ses.done = true;
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
    const items = snap.ids.map((id) => { const q = DATA.byId.get(id); const a = snap.ans[id]; return { id, subject: q ? q.subject : '', ok: !!(a && q && q.keys.includes(a.c)), answered: !!a, unsure: !!(snap.unsure || {})[id] }; });
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
    root.append(card);

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
      wrongIds.length ? el('button', { type: 'button', class: 'btn primary grow lg', onclick: () => startIds(wrongIds, '間違えた・自信がない問題（' + wrongIds.length + '問）') }, '間違えた・自信がない ' + wrongIds.length + '問をもう一度') : null,
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
    if (!isMock && r.correct === r.answered && r.answered >= 5) sound(true);
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
    root.append(el('section', { class: 'card' }, el('h2', null, '解き方'),
      sw('選んでから「答え合わせ」で確定する', 'confirmMode', 'オフにすると、選択肢を押した瞬間に答え合わせします'),
      sw('選択肢の順番をシャッフル', 'shuffle', '番号の丸暗記を防ぎます。答え合わせのあとに本試験の番号も出します'),
      sw('効果音', 'sound', '正解・不正解のときに短い音を鳴らします'),
      el('div', { class: 'field' }, el('div', { class: 'label', text: '1日の目標' }), seg('goal', [[10, '10問'], [20, '20問'], [30, '30問'], [50, '50問'], [100, '100問']], '1日の目標')),
      el('div', { class: 'field' }, el('div', { class: 'label', text: '文字の大きさ' }), seg('font', [['s', '小'], ['m', '中'], ['l', '大'], ['xl', '特大']], '文字の大きさ')),
      el('div', { class: 'field' }, el('div', { class: 'label', text: '画面の色' }), seg('theme', [['auto', '端末に合わせる'], ['light', 'ライト'], ['dark', 'ダーク']], '画面の色'))));

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
    const json = JSON.stringify({ app: 'kaigo-study', v: 2, exportedAt: new Date().toISOString(), data: { q: S.q, log: S.log, days: S.days, mocks: S.mocks, settings: S.settings } });
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
        const r = K.merge(S, { v: o.v || 1, q: o.data.q, log: o.data.log, days: o.data.days, mocks: o.data.mocks, settings: {} }, blankStore());
        srsCache = null; saveNow();
        toast('読み込みました（新しい回答 ' + r.added + '件）'); renderSettings();
      } catch (e) { toast('このファイルは読み込めません'); }
    };
    reader.readAsText(f);
  }
  function applySettings() {
    const r = document.documentElement;
    r.dataset.font = S.settings.font || 'm';
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
    loadLinks();
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
