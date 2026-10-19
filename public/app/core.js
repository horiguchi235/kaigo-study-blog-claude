/* 過去問演習アプリの「画面に関係しない処理」。ブラウザでは window.KaigoCore、node では require で使う。
 * node で確かめる：node tools/app/test_core.cjs
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KaigoCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SUBJECTS = ['人間の尊厳と自立', '人間関係とコミュニケーション', '社会の理解', '介護の基本', 'コミュニケーション技術', '生活支援技術', 'こころとからだのしくみ', '発達と老化の理解', '認知症の理解', '障害の理解', '医療的ケア', '介護過程', '総合問題'];
  const PARTS = {
    A: { label: 'Aパート', subjects: ['人間の尊厳と自立', '介護の基本', '社会の理解', '人間関係とコミュニケーション', 'コミュニケーション技術', '生活支援技術'] },
    B: { label: 'Bパート', subjects: ['こころとからだのしくみ', '発達と老化の理解', '認知症の理解', '障害の理解', '医療的ケア'] },
    C: { label: 'Cパート', subjects: ['介護過程', '総合問題'] },
  };
  // 本番の出題数（全125問）
  const EXAM_DIST = { '人間の尊厳と自立': 2, '人間関係とコミュニケーション': 4, '社会の理解': 12, '介護の基本': 10, 'コミュニケーション技術': 6, '生活支援技術': 26, 'こころとからだのしくみ': 12, '発達と老化の理解': 8, '認知症の理解': 10, '障害の理解': 10, '医療的ケア': 5, '介護過程': 8, '総合問題': 12 };
  const EXAM_MINUTES = 220;
  // 合格基準で使う11の科目群
  const GROUPS = [
    ['人間の尊厳と自立', '介護の基本'], ['人間関係とコミュニケーション', 'コミュニケーション技術'], ['社会の理解'], ['生活支援技術'],
    ['こころとからだのしくみ'], ['発達と老化の理解'], ['認知症の理解'], ['障害の理解'], ['医療的ケア'],
    ['介護過程'], ['総合問題'],
  ];
  // 第38回の合格基準（厚生労働省の公表）。総得点で届かないときはパートごとに判定する。
  const PASS_LINE = { round: 38, total: 64, A: 32.23, B: 20.43, C: 11.33 };
  const PART_Q = { A: 60, B: 45, C: 20 };
  const partOf = (s) => Object.keys(PARTS).find((k) => PARTS[k].subjects.includes(s)) || '';
  const groupPart = (g) => partOf(g[0]);

  // ── 日付：1日の区切りは午前4時（夜勤明けでも「今日」が続く） ──
  const DAY_START_HOUR = 4;
  const pad = (n) => String(n).padStart(2, '0');
  function dayKey(t) {
    const d = new Date((t == null ? Date.now() : t) - DAY_START_HOUR * 3600000);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  // その日の区切り（午前4時）の時刻
  function dayStart(t) {
    const d = new Date((t == null ? Date.now() : t) - DAY_START_HOUR * 3600000);
    d.setHours(DAY_START_HOUR, 0, 0, 0);
    return d.getTime();
  }
  const DAY = 86400000;

  // ── 事例の連問 ──
  // 〔事例〕【事例】〔 事  例 〕のどれでも、同じ回・同じ科目で事例の本文の先頭60文字が同じなら同じ事例とみなす
  function caseKey(q) {
    const s = String(q.stem || '').replace(/\s+/g, '');
    const m = s.match(/[〔【\[]事例[〕】\]]([\s\S]*)/);
    return m ? q.subject + '|' + q.round + '|' + m[1].slice(0, 60) : q.id;
  }
  const byExamOrder = (a, b) => (a.round || 0) - (b.round || 0) || (a.no || 0) - (b.no || 0) || String(a.id).localeCompare(String(b.id));
  function groupCases(qs) {
    const m = new Map();
    for (const q of qs) { const k = caseKey(q); if (!m.has(k)) m.set(k, []); m.get(k).push(q); }
    const groups = [...m.values()];
    for (const g of groups) g.sort(byExamOrder);
    return groups;
  }
  function shuffle(a, rnd) { a = a.slice(); rnd = rnd || Math.random; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  // n問を選ぶ。連問は分けない。どうしても足りないときだけ、事例の先頭の問題から順に入れる。
  function pickWithCases(qs, n, opts) {
    opts = opts || {};
    const base = groupCases(qs);
    const order = (groups) => {
      if (!opts.prefer) return groups;
      const score = (g) => g.some(opts.prefer) ? 0 : 1; // prefer(q) が true の問題を含む事例を先に
      return groups.map((g, i) => [g, i]).sort((x, y) => score(x[0]) - score(y[0]) || x[1] - y[1]).map((x) => x[0]);
    };
    const fill = (groups) => {
      const out = [];
      for (const g of groups) { if (out.length >= n) break; if (out.length + g.length <= n) out.push(...g); }
      return out;
    };
    let groups = order(opts.random === false ? base : shuffle(base, opts.rnd));
    let out = fill(groups);
    // 事例を丸ごと入れてちょうど n 問にならないときは、並べ方を変えて何回か試す
    for (let k = 0; out.length < n && opts.random !== false && k < 40; k++) {
      const g2 = order(shuffle(base, opts.rnd)), o2 = fill(g2);
      if (o2.length > out.length) { out = o2; groups = g2; }
    }
    if (out.length < n) { // それでも足りないときだけ、事例の先頭の問題から順に入れる
      for (const g of groups) {
        if (out.length >= n) break;
        if (out.includes(g[0])) continue;
        for (const q of g) { if (out.length >= n) break; out.push(q); }
      }
    }
    return out.slice(0, n);
  }
  // 出題の順番：連問はまとめて、試験の順番どおり
  function sortExam(qs) { return groupCases(qs.slice().sort(byExamOrder)).flat(); }
  // 問題数の配分（本番の比率で total 問に）
  function scaleDist(total, subjects) {
    subjects = subjects || SUBJECTS;
    const all = subjects.reduce((a, s) => a + EXAM_DIST[s], 0);
    const raw = subjects.map((s) => ({ s, x: EXAM_DIST[s] * total / all }));
    raw.forEach((r) => { r.n = Math.floor(r.x); r.f = r.x - r.n; });
    let left = total - raw.reduce((a, r) => a + r.n, 0);
    raw.slice().sort((a, b) => b.f - a.f).forEach((r) => { if (left > 0) { r.n++; left--; } });
    const o = {}; raw.forEach((r) => { o[r.s] = r.n; }); return o;
  }

  // ── 合格判定（公式の手順）──
  // bySubject: {科目: {n: 出題数, c: 正解数}}。full=本番形式（125問）。partsTaken: 出題したパート
  function judge(bySubject, opts) {
    opts = opts || {};
    const sum = (subs, k) => subs.reduce((a, s) => a + ((bySubject[s] || {})[k] || 0), 0);
    const parts = Object.keys(PARTS).filter((p) => PARTS[p].subjects.some((s) => bySubject[s] && bySubject[s].n));
    const groups = GROUPS.filter((g) => g.some((s) => bySubject[s] && bySubject[s].n));
    const zeroGroups = groups.filter((g) => sum(g, 'c') === 0);
    const totalN = sum(SUBJECTS, 'n'), totalC = sum(SUBJECTS, 'c');
    const isFull = parts.length === 3;
    // 基準点：本番と同じ問題数ならそのまま。少ないときは問題数の比で按分した「目安」
    const totalLine = PASS_LINE.total * totalN / 125;
    const partRows = parts.map((p) => {
      const subs = PARTS[p].subjects, n = sum(subs, 'n'), c = sum(subs, 'c');
      const line = PASS_LINE[p] * n / PART_Q[p];
      const zero = zeroGroups.filter((g) => groupPart(g) === p);
      return { part: p, label: PARTS[p].label, n, c, line, scaled: n !== PART_Q[p], zeroGroups: zero, pass: c >= line && zero.length === 0, short: Math.max(0, Math.ceil(line - c - 1e-9)) };
    });
    const totalPass = isFull && totalC >= totalLine && zeroGroups.length === 0;
    return {
      isFull, scaled: totalN !== 125, totalN, totalC, totalLine, totalShort: Math.max(0, Math.ceil(totalLine - totalC - 1e-9)),
      zeroGroups, totalPass, parts: partRows,
      // 総得点で不合格のときに、合格になるパート
      passedParts: totalPass ? parts : partRows.filter((r) => r.pass).map((r) => r.part),
    };
  }

  // ── 間隔反復 ──
  // log: [時刻, 問題ID, 選んだ番号, 正解(1/0), 秒, 自信(0=自信あり 1=なんとなく 2=わからない), 'p'|'m', 科目番号]
  // 間違い・わからない → 翌日。自信ありで正解すると 3日→7日→14日→30日。30日後にも正解したら「定着」。
  // なんとなく正解 → 段階は上げず、今の間隔の半分（最短1日）でもう一度。
  // 同じ日にもう一度正解しても段階は上げない（直後の「もう一度」で外れないように）。
  // 試験日（opts.examAt）が近いときは、試験までに一巡できるよう間隔を「残り日数の1/3」までに縮める。
  const STEPS = [1, 3, 7, 14, 30];
  function srsFromLog(log, opts) {
    opts = opts || {};
    const st = Object.create(null);
    const sorted = log.slice().sort((a, b) => a[0] - b[0]);
    const cap = (t, days) => {
      if (!opts.examAt) return days;
      const left = Math.floor((opts.examAt - dayStart(t)) / DAY);
      return left > 0 ? Math.max(1, Math.min(days, Math.ceil(left / 3))) : days;
    };
    for (const e of sorted) {
      const id = e[1], t = e[0], conf = Number(e[5]) || 0;
      const s = st[id] || (st[id] = { stage: 0, due: 0, last: 0, lastDay: '', mastered: false });
      const dk = dayKey(t);
      if (e[3] !== 1 || conf >= 2) {
        s.stage = 0; s.mastered = false; s.due = dayStart(t) + DAY;
      } else if (conf === 1) {
        s.mastered = false; s.due = dayStart(t) + cap(t, Math.max(1, Math.floor(STEPS[s.stage] / 2))) * DAY;
      } else if (dk !== s.lastDay) {
        if (s.stage >= STEPS.length - 1 && s.last && t >= s.due) { s.mastered = true; s.due = 0; }
        else { s.stage = Math.min(s.stage + 1, STEPS.length - 1); s.due = dayStart(t) + cap(t, STEPS[s.stage]) * DAY; }
      }
      s.last = t; s.lastDay = dk;
    }
    return st;
  }
  const isDue = (s, now) => !!(s && !s.mastered && s.due && s.due <= (now == null ? Date.now() : now));

  // ── 解説 ──
  // 選択肢ごとの解説と、それ以外（学習ポイントなど）に分ける。
  // 機械的に作った「・基本＝／・混同注意＝」型の【知識のまとめ】は、選択肢の解説と重なるので出さない。
  function parseExplanation(text) {
    const opts = {}; let head = String(text || '');
    const first = head.search(/【選択肢[1-5]｜/);
    if (first >= 0) {
      const body = head.slice(first); head = head.slice(0, first);
      const re = /【選択肢([1-5])｜[^】]*?｜(正解|不正解)[^】]*】\n?([\s\S]*?)(?=【選択肢[1-5]｜|$)/g; let m;
      while ((m = re.exec(body))) opts[Number(m[1])] = m[3].trim();
    }
    head = head.replace(/^正解：[^\n]*\n*/, '').replace(/【選択肢解説】\s*$/, '').trim();
    head = head.replace(/【知識のまとめ】\n((?:・(?:基本|補足|混同注意)＝[^\n]*\n?)+)/g, '').trim();
    return { head, opts };
  }
  // スプレッドシート版と同じ並びで出すための分解：学習ポイント・知識のまとめ・（その他）・選択肢解説
  function explainSections(text) {
    const s = String(text || '');
    const first = s.search(/【選択肢[1-5]｜/);
    let head = first >= 0 ? s.slice(0, first) : s;
    const opts = {};
    if (first >= 0) {
      const re = /【選択肢([1-5])｜[^】]*?｜(正解|不正解)[^】]*】\n?([\s\S]*?)(?=【選択肢[1-5]｜|$)/g; let m;
      while ((m = re.exec(s.slice(first)))) opts[Number(m[1])] = { ok: m[2] === '正解', body: m[3].trim() };
    }
    head = head.replace(/^正解[：:][^\n]*\n*/, '').replace(/【選択肢解説】\s*$/, '').trim();
    const sections = [];
    const parts = head.split(/^【(学習ポイント|知識のまとめ|覚えるポイント|ポイント|補足|注意)】[ \t]*$/m);
    if (parts[0].trim()) sections.push({ title: '', body: parts[0].trim() });
    for (let i = 1; i < parts.length; i += 2) sections.push({ title: parts[i], body: (parts[i + 1] || '').trim() });
    return { sections: sections.filter((x) => x.body), opts };
  }
  // 解説の中の選択肢番号（元の番号）を、画面に出している番号に置き換える
  const toHalf = (d) => String(d).replace(/[１-５]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  function remapNumbers(text, order) {
    if (!order || order.join('') === '12345') return text;
    const disp = (d) => order.indexOf(Number(toHalf(d))) + 1;
    return String(text)
      .replace(/(選択肢\s*)([1-5１-５])(?![0-9０-９])/g, (m, p, d) => p + disp(d))
      .replace(/(^|[^0-9０-９.．,])([1-5１-５])([.．](?![0-9０-９]))/gm, (m, p, d, s) => p + disp(d) + s);
  }
  // 「適切でないもの」を選ぶ問題
  const NEG_RE = /(適切でないもの|適切ではないもの|不適切なもの|誤っているもの|正しくないもの|誤りのあるもの)/;
  function questionPart(stem) {
    const s = String(stem || '');
    const i = s.lastIndexOf('【問題】');
    if (i >= 0) return s.slice(i + 4).trim();
    const lines = s.split('\n').map((x) => x.trim()).filter(Boolean);
    if (lines.length >= 2 && /^（注）/.test(lines[lines.length - 1])) return lines.slice(-2).join('\n');
    return lines[lines.length - 1] || s;
  }
  // 事例の本文と設問に分ける（連問の2問目以降で事例を折りたたむため）
  function splitCase(stem) {
    const s = String(stem || '');
    if (!/[〔【\[]\s*事\s*例\s*[〕】\]]/.test(s)) return null;
    const q = questionPart(s);
    const i = s.lastIndexOf(q);
    if (i <= 0) return null;
    return { case: s.slice(0, i).replace(/【問題】\s*$/, '').trim(), question: q };
  }

  // ── 学習の積み重ね（GAS版と同じ考え方）──
  // 1問＝1EXP。レベルL→L+1に10L問。Lv.100まで累計49,500問。
  function careLevelAt(count) {
    const n = Math.max(0, Math.floor(Number(count) || 0));
    const level = Math.min(100, Math.floor((1 + Math.sqrt(1 + 0.8 * n)) / 2));
    const base = 5 * level * (level - 1), required = level === 100 ? 0 : level * 10;
    return { level, totalExp: n, baseExp: base, required, inLevel: level === 100 ? 0 : n - base, toNext: level === 100 ? 0 : base + required - n, progress: level === 100 ? 1 : (n - base) / required };
  }
  // 科目の能力値：レベルが上がるとき、そのレベルの間に解いた問題数に応じて上がる（1〜10問で+1、11〜20問で+2…）
  function careLearner(log) {
    const sorted = log.slice().sort((a, b) => a[0] - b[0]);
    const values = SUBJECTS.map(() => 0), stage = SUBJECTS.map(() => 0), stages = [];
    let level = 1, inLevel = 0;
    for (let i = 0; i < sorted.length && level < 100; i++) {
      const s = sorted[i][7]; if (s >= 0 && s < SUBJECTS.length) stage[s]++;
      inLevel++;
      if (inLevel === level * 10) {
        const gains = {};
        SUBJECTS.forEach((name, k) => { const g = Math.ceil(stage[k] / 10); if (g) { gains[name] = g; values[k] += g; } stage[k] = 0; });
        stages.push({ level: level + 1, atExp: i + 1, gains }); level++; inLevel = 0;
      }
    }
    return Object.assign(careLevelAt(sorted.length), {
      statuses: SUBJECTS.map((name, k) => ({ name, value: values[k], stageCount: stage[k], pending: level === 100 ? 0 : Math.ceil(stage[k] / 10) })), stages,
    });
  }
  // ある時点（count問目）のレベルと能力値
  function careSnapshotAt(learner, count) {
    const st = careLevelAt(count), v = {};
    for (const s of learner.statuses) v[s.name] = 0;
    for (const e of learner.stages) if (e.atExp <= count) for (const k of Object.keys(e.gains)) v[k] += e.gains[k];
    return Object.assign(st, { statuses: learner.statuses.map((s) => ({ name: s.name, value: v[s.name] })) });
  }
  const dayNum = (k) => Math.floor(Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)) / DAY);
  const numKey = (n) => new Date(n * DAY).toISOString().slice(0, 10);
  // log から、今日・昨日・今週（月曜〜）・先週・今月・累計・最近7日・自己ベスト・連続日数・実績を作る
  function growthSummary(log, opts) {
    opts = opts || {};
    const now = opts.now == null ? Date.now() : opts.now;
    const today = dayKey(now), td = dayNum(today);
    const monday = td - (new Date(td * DAY).getUTCDay() + 6) % 7, monthStart = dayNum(today.slice(0, 7) + '-01');
    const empty = () => ({ count: 0, correct: 0, seconds: 0 });
    const days = {}, weeks = {}, months = {}, total = empty(), unique = new Set(), subj = SUBJECTS.map(empty);
    for (const e of log) {
      if (e[0] > now + 300000) continue;
      const k = dayKey(e[0]), n = dayNum(k);
      const d = days[k] || (days[k] = empty());
      const wk = n - (new Date(n * DAY).getUTCDay() + 6) % 7;
      weeks[wk] = (weeks[wk] || 0) + 1; months[k.slice(0, 7)] = (months[k.slice(0, 7)] || 0) + 1;
      for (const v of [d, total, subj[e[7]]]) { if (!v) continue; v.count++; if (e[3]) v.correct++; v.seconds += Number(e[4]) || 0; }
      unique.add(e[1]);
    }
    const range = (a, b) => { const r = empty(); for (const k of Object.keys(days)) { const n = dayNum(k); if (n < a || n > b) continue; r.count += days[k].count; r.correct += days[k].correct; r.seconds += days[k].seconds; } return r; };
    // 連続日数。お休みチケット：1週間（月〜日）に1日だけ、休んだ日があっても途切れない（前後に学習した日があるとき）
    const has = (n) => !!(days[numKey(n)] && days[numKey(n)].count > 0);
    const weekOf = (n) => n - (new Date(n * DAY).getUTCDay() + 6) % 7;
    let streak = 0; const restDays = [], usedWeeks = new Set();
    for (let n = has(td) ? td : td - 1; ; n--) {
      if (has(n)) { streak++; continue; }
      if (opts.rest !== false && n < td && has(n - 1) && !usedWeeks.has(weekOf(n)) && streak > 0) { usedWeeks.add(weekOf(n)); restDays.push(numKey(n)); continue; }
      break;
    }
    const restThisWeek = restDays.some((k) => weekOf(dayNum(k)) === weekOf(td));
    let longest = 0, cur = 0, last = -2;
    for (const k of Object.keys(days).sort()) { const n = dayNum(k); cur = n === last + 1 ? cur + 1 : 1; longest = Math.max(longest, cur); last = n; }
    const achievements = [];
    for (const n of [7, 30]) achievements.push({ id: 'streak-' + n, label: n + '日連続学習', value: longest, target: n, achieved: longest >= n });
    for (const n of [500, 1000, 5000, 10000]) achievements.push({ id: 'total-' + n, label: '累計' + n.toLocaleString('ja-JP') + '問', value: total.count, target: n, achieved: total.count >= n });
    SUBJECTS.forEach((s, i) => achievements.push({ id: 'subject-' + s, label: s + '500問', value: subj[i].count, target: 500, achieved: subj[i].count >= 500 }));
    return {
      todayKey: today, today: days[today] || empty(), yesterday: days[numKey(td - 1)] || empty(),
      week: range(monday, td), lastWeek: range(monday - 7, monday - 1), month: range(monthStart, td), total,
      recent: Array.from({ length: 7 }, (_, i) => Object.assign({ date: numKey(td - 6 + i) }, days[numKey(td - 6 + i)] || empty())),
      best: { day: Math.max(0, ...Object.values(days).map((d) => d.count)), week: Math.max(0, ...Object.values(weeks)), month: Math.max(0, ...Object.values(months)) },
      streak, longestStreak: Math.max(longest, streak), restDays, restThisWeek, days, uniqueCount: unique.size, totalQuestions: opts.totalQuestions || 0,
      subjects: SUBJECTS.map((name, i) => Object.assign({ name }, subj[i])), achievements, learner: careLearner(log),
    };
  }
  // パート別・11科目群別の進み具合。正答率は「解いた問題の最新の結果」で数える（今の実力に近い）
  const PASS_RATE = 0.6;
  function groupProgress(questions, Q, now) {
    now = now == null ? Date.now() : now;
    const mk = (name) => ({ name, total: 0, answered: 0, correct: 0, last: 0 });
    const groups = GROUPS.map((g) => Object.assign(mk(g.join('・')), { subjects: g, part: groupPart(g) }));
    const parts = {}; for (const k of Object.keys(PARTS)) parts[k] = Object.assign(mk(PARTS[k].label), { part: k });
    for (const q of questions) {
      const gi = GROUPS.findIndex((g) => g.includes(q.subject)); if (gi < 0) continue;
      const r = Q[q.id], g = groups[gi], p = parts[g.part];
      for (const x of [g, p]) { x.total++; if (r && r.a) { x.answered++; if (r.l === 1) x.correct++; x.last = Math.max(x.last, r.t || 0); } }
    }
    const fin = (x) => {
      x.rate = x.answered ? x.correct / x.answered : null;
      x.coverage = x.total ? x.answered / x.total : 0;
      x.gap = x.rate == null ? null : Math.max(0, Math.ceil((PASS_RATE - x.rate) * 100));
      x.idleDays = x.last ? Math.floor((now - x.last) / DAY) : null;
      x.warn = !x.answered ? '未学習' : x.answered >= 5 && x.rate < 0.4 ? '正答率が低い' : x.idleDays >= 14 ? x.idleDays + '日解いていない' : '';
      return x;
    };
    groups.forEach(fin); Object.values(parts).forEach(fin);
    return { groups, parts, line: PASS_RATE };
  }

  // 要復習：最新の回答が不正解・時間切れ／正解でも迷った／コメントあり／未理解の選択肢あり
  function reviewFlags(r) {
    r = r || {};
    return { wrong: !!(r.a && r.l === 0), uncertain: !!(r.a && r.l === 1 && r.lu >= 1), comment: !!(r.n && String(r.n).trim()), understanding: !!(r.nu && r.nu.length) };
  }
  const needsReview = (r) => { const f = reviewFlags(r); return f.wrong || f.uncertain || f.comment || f.understanding; };
  // questions: [{id, subject, type}]、Q: 記録（S.q）
  function reviewSummary(questions, Q, groupsBy) {
    const blank = (name) => ({ name, total: 0, answered: 0, needed: 0, wrong: 0, uncertain: 0, comment: 0, understanding: 0, ratio: 0 });
    const total = blank('全体'), groups = {};
    for (const q of questions) {
      const r = Q[q.id], f = reviewFlags(r), need = f.wrong || f.uncertain || f.comment || f.understanding;
      const keys = (groupsBy || ['subject']).map((k) => k + ':' + q[k]);
      for (const g of [total].concat(keys.map((k) => groups[k] || (groups[k] = blank(k.slice(k.indexOf(':') + 1)))))) {
        g.total++; if (r && r.a) g.answered++; if (need) g.needed++;
        for (const k of Object.keys(f)) if (f[k]) g[k]++;
      }
    }
    for (const g of [total].concat(Object.values(groups))) g.ratio = g.total ? g.needed / g.total : 0;
    return { total, groups };
  }

  // ── 記録の点検・移行 ──
  const ID_RE = /^[A-Z]\d{4,}$/;
  const isObj = (o) => o && typeof o === 'object' && !Array.isArray(o);
  function migrate(o) {
    if (!isObj(o)) throw new Error('記録の形が違います');
    const v = Number(o.v) || 1;
    if (v < 2) {
      // v1 → v2：設定の追加（確定ボタン方式・受けるパートなど）
      o.settings = Object.assign({}, o.settings || {});
      if (o.settings.confirmMode == null) o.settings.confirmMode = true;
      delete o.lastResult; // v1 にはない
      o.v = 2;
    }
    if (v < 3) {
      // v2 → v3：GAS版と同じ初期値（1問60秒・効果音あり）に。目標を日・週・月・累計の4つに
      o.settings = Object.assign({}, o.settings || {});
      if (!o.settings.qLimit) o.settings.qLimit = 60;
      const d = Number(o.settings.goal) || 20;
      if (!o.settings.goals) o.settings.goals = { day: d, week: d * 7, month: d * 30, total: 3000 };
      o.v = 3;
    }
    if (v < 4) {
      // v3 → v4：標準の色をグリーンに。自信は3段階（0/1/2）
      o.settings = Object.assign({}, o.settings || {});
      if (!o.settings.palette || o.settings.palette === 'orange') o.settings.palette = 'green';
      o.v = 4;
    }
    if (v < 5) {
      // v4 → v5：標準の色をオレンジに戻す（グリーンは設定で選べる）
      o.settings = Object.assign({}, o.settings || {});
      if (!o.settings.palette || o.settings.palette === 'green') o.settings.palette = 'orange';
      if (o.settings.vibrate == null) o.settings.vibrate = true;
      o.v = 5;
    }
    return o;
  }
  function sanitizeLogEntry(e) {
    if (!Array.isArray(e) || e.length < 7) return null;
    const t = Number(e[0]), id = String(e[1]).toUpperCase(), c = Number(e[2]);
    if (!isFinite(t) || t < 1.5e12 || t > 4e12 || !ID_RE.test(id) || !(c >= 0 && c <= 5)) return null;
    const conf = Number(e[5]) === 2 ? 2 : e[5] ? 1 : 0;
    return [t, id, c, e[3] ? 1 : 0, Math.max(0, Math.min(86400, Math.round(Number(e[4]) || 0))), conf, e[6] === 'm' ? 'm' : 'p', Number.isInteger(e[7]) ? e[7] : -1];
  }
  function sanitize(S, blank) {
    const out = Object.assign(blank, {});
    out.v = 5;
    out.settings = Object.assign(blank.settings, isObj(S.settings) ? S.settings : {});
    out.prefs = isObj(S.prefs) ? S.prefs : {};
    out.q = {};
    if (isObj(S.q)) for (const id of Object.keys(S.q)) {
      if (!ID_RE.test(id) || !isObj(S.q[id])) continue;
      const r = S.q[id];
      const nu = Array.isArray(r.nu) ? [...new Set(r.nu.filter((n) => Number.isInteger(n) && n >= 1 && n <= 5))].sort() : [];
      out.q[id] = { a: 0, c: 0, n: typeof r.n === 'string' ? r.n.slice(0, 5000) : undefined, nt: Number(r.nt) || undefined, st: r.st ? 1 : undefined, s: Number.isInteger(r.s) ? r.s : undefined,
        nu: nu.length ? nu : undefined, nut: Number(r.nut) || undefined, xi: r.xi ? 1 : undefined, xit: Number(r.xit) || undefined, cd: r.cd ? 1 : undefined };
    }
    const p = isObj(S.profile) ? S.profile : {};
    out.profile = { name: typeof p.name === 'string' && p.name.trim() ? p.name.trim().slice(0, 40) : '学習者', age: Number.isInteger(p.age) && p.age >= 0 && p.age <= 120 ? p.age : '', pref: typeof p.pref === 'string' ? p.pref.slice(0, 10) : '', avatar: typeof p.avatar === 'string' && p.avatar.length <= 8 ? p.avatar : '📚', at: Number(p.at) || 0 };
    out.log = Array.isArray(S.log) ? S.log.map(sanitizeLogEntry).filter(Boolean) : [];
    out.days = {};
    if (isObj(S.days)) for (const k of Object.keys(S.days)) if (/^\d{4}-\d\d-\d\d$/.test(k) && isObj(S.days[k])) out.days[k] = { n: 0, c: 0, sec: Math.round(Number(S.days[k].sec) || 0) };
    out.mocks = Array.isArray(S.mocks) ? S.mocks.filter((m) => isObj(m) && isFinite(Number(m.at))).slice(-200) : [];
    out.session = isObj(S.session) && Array.isArray(S.session.ids) && S.session.ids.every((x) => typeof x === 'string') ? S.session : null;
    out.lastResult = isObj(S.lastResult) && Array.isArray(S.lastResult.ids) ? S.lastResult : null;
    out.lastBackup = Number(S.lastBackup) || 0;
    out.createdAt = Number(S.createdAt) || Date.now();
    out.launches = Number(S.launches) || 0;
    out.migratedIds = typeof S.migratedIds === 'string' ? S.migratedIds : '';
    return out;
  }
  // log から回数・正解数・日ごとの数を作り直す（メモ・★は残す）
  function rebuild(S) {
    const q = S.q;
    for (const id of Object.keys(q)) { const r = q[id]; r.a = 0; r.c = 0; delete r.l; delete r.t; delete r.lu; delete r.u; }
    for (const k of Object.keys(S.days)) { S.days[k].n = 0; S.days[k].c = 0; }
    S.log.sort((a, b) => a[0] - b[0]);
    const seen = new Set();
    S.log = S.log.filter((e) => { const k = e[0] + '|' + e[1]; if (seen.has(k)) return false; seen.add(k); return true; });
    for (const e of S.log) {
      const r = q[e[1]] || (q[e[1]] = { a: 0, c: 0 });
      if (e[7] >= 0) r.s = e[7];
      r.a++; if (e[3]) r.c++; r.l = e[3]; r.t = e[0]; r.lu = e[5]; if (e[5]) r.u = (r.u || 0) + 1;
      const d = S.days[dayKey(e[0])] || (S.days[dayKey(e[0])] = { n: 0, c: 0, sec: 0 });
      d.n++; if (e[3]) d.c++;
    }
    return S;
  }
  // 別の記録（バックアップ・別のタブ）を合わせる
  function merge(S, other, blank) {
    const o = sanitize(migrate(JSON.parse(JSON.stringify(other))), blank);
    let added = 0;
    const seen = new Set(S.log.map((e) => e[0] + '|' + e[1]));
    for (const e of o.log) { const k = e[0] + '|' + e[1]; if (!seen.has(k)) { seen.add(k); S.log.push(e); added++; } }
    let notes = 0;
    for (const id of Object.keys(o.q)) {
      const a = o.q[id], b = S.q[id] || (S.q[id] = { a: 0, c: 0 });
      if (a.n != null && (b.n == null || (a.nt || 0) > (b.nt || 0))) { b.n = a.n; b.nt = a.nt; notes++; }
      if (a.st) b.st = 1;
      if (a.cd) b.cd = 1;
      if (a.s != null) b.s = a.s;
      if (a.nut && (a.nut || 0) > (b.nut || 0)) { b.nu = a.nu; b.nut = a.nut; }
      if (a.xit && (a.xit || 0) > (b.xit || 0)) { b.xi = a.xi; b.xit = a.xit; }
    }
    if (o.profile && o.profile.at > ((S.profile || {}).at || 0)) S.profile = o.profile;
    for (const k of Object.keys(o.days)) { const d = S.days[k] || (S.days[k] = { n: 0, c: 0, sec: 0 }); d.sec = Math.max(d.sec || 0, o.days[k].sec || 0); }
    const mk = new Set(S.mocks.map((m) => m.at));
    for (const m of o.mocks) if (!mk.has(m.at)) S.mocks.push(m);
    S.mocks.sort((a, b) => a.at - b.at);
    if (S.log.length > 30000) S.log.splice(0, S.log.length - 30000);
    rebuild(S);
    return { added, notes };
  }
  // 問題IDの付け替え（index.idMap：{旧ID: 新ID}）
  function applyIdMap(S, map) {
    if (!isObj(map)) return 0;
    let n = 0;
    for (const e of S.log) if (map[e[1]]) { e[1] = map[e[1]]; n++; }
    for (const old of Object.keys(map)) {
      if (S.q[old]) { const nw = map[old]; S.q[nw] = Object.assign(S.q[nw] || {}, S.q[old]); delete S.q[old]; n++; }
    }
    if (S.session && Array.isArray(S.session.ids)) S.session.ids = S.session.ids.map((id) => map[id] || id);
    if (n) rebuild(S);
    return n;
  }

  return {
    SUBJECTS, PARTS, EXAM_DIST, EXAM_MINUTES, GROUPS, PASS_LINE, PART_Q, partOf, DAY, DAY_START_HOUR,
    dayKey, dayStart, caseKey, groupCases, pickWithCases, sortExam, byExamOrder, scaleDist, shuffle, judge,
    srsFromLog, isDue, STEPS, parseExplanation, explainSections, remapNumbers, NEG_RE, questionPart, splitCase,
    migrate, sanitize, rebuild, merge, applyIdMap, ID_RE,
    groupProgress, PASS_RATE, careLevelAt, careLearner, careSnapshotAt, growthSummary, reviewFlags, needsReview, reviewSummary,
  };
});
