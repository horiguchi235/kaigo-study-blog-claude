// 過去問アプリの core.js を、本物のデータ（s01・s06・s13 ほか）で確かめる。 node tools/app/test_core.cjs
const fs = require('fs'), path = require('path'), assert = require('assert');
// core.js はブラウザ用のファイルなので、module を渡して読み込む
const C = (() => { const m = { exports: {} }; new Function('module', 'exports', fs.readFileSync(path.join(__dirname, '../../public/app/core.js'), 'utf8'))(m, m.exports); return m.exports; })();
const dir = path.join(__dirname, '../../public/app/data');
const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
const bySubject = {};
for (const m of index.subjects) {
  const d = JSON.parse(fs.readFileSync(path.join(dir, m.file + '.json'), 'utf8'));
  bySubject[m.name] = d.questions.map((q) => Object.assign(q, { subject: m.name }));
}
let ok = 0; const t = (name, fn) => { fn(); ok++; console.log('✓', name); };

t('s13 総合問題：連問が事例ごとにまとまる', () => {
  const g = C.groupCases(bySubject['総合問題']);
  const sizes = {}; g.forEach((x) => { sizes[x.length] = (sizes[x.length] || 0) + 1; });
  console.log('   グループ', g.length, '大きさ別', sizes);
  assert.ok(g.length >= 57 && g.length <= 62, 'グループ数');
  assert.ok(!sizes[1] || sizes[1] <= 2, '1問だけのグループがほとんどない');
  for (const x of g) for (let i = 1; i < x.length; i++) assert.ok(x[i - 1].id < x[i].id, '連問の中は番号順 ' + x.map((q) => q.id));
});
t('s12 介護過程：連問がまとまる', () => {
  const g = C.groupCases(bySubject['介護過程']);
  const multi = g.filter((x) => x.length > 1).length;
  console.log('   グループ', g.length, '連問', multi);
  assert.ok(multi >= 12);  // 〔事例〕がある回（第32回以降など）の連問
});
t('s01・s06：事例でない問題は1問ずつ', () => {
  for (const s of ['人間の尊厳と自立', '生活支援技術']) {
    const qs = bySubject[s], g = C.groupCases(qs);
    assert.ok(g.length > qs.length * 0.9, s);
  }
});
t('連問を分けずに選ぶ（ミニ模試の総合問題 2問・本番 12問）', () => {
  for (let k = 0; k < 200; k++) {
    for (const n of [2, 3, 12]) {
      const p = C.pickWithCases(bySubject['総合問題'], n);
      assert.strictEqual(p.length, n);
      const keys = p.map(C.caseKey);
      // 同じ事例は続けて並ぶ
      const firstIdx = {}; keys.forEach((k2, i) => { if (!(k2 in firstIdx)) firstIdx[k2] = i; });
      keys.forEach((k2, i) => assert.ok(i === firstIdx[k2] || keys[i - 1] === k2, '連問が離れている'));
      if (n === 12) {  // 12問は事例を丸ごと（3問または2問の事例）で埋める
        const g = C.groupCases(bySubject['総合問題']); const size = {}; g.forEach((x) => { size[C.caseKey(x[0])] = x.length; });
        const cnt = {}; keys.forEach((k2) => { cnt[k2] = (cnt[k2] || 0) + 1; });
        assert.ok(Object.keys(cnt).every((k2) => cnt[k2] === size[k2]), '事例の途中で切れている');
      }
    }
  }
});
t('番号順：回→ID の順で、連問はまとまる', () => {
  const s = C.sortExam(bySubject['総合問題']);
  for (let i = 1; i < s.length; i++) assert.ok((s[i - 1].round || 0) <= (s[i].round || 0));
});
t('本番の配分は125問、ミニは25問、パート別は60/45/20', () => {
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  assert.strictEqual(sum(C.EXAM_DIST), 125);
  assert.strictEqual(sum(C.scaleDist(25)), 25);
  for (const p of ['A', 'B', 'C']) assert.strictEqual(sum(C.scaleDist(C.PART_Q[p], C.PARTS[p].subjects)), C.PART_Q[p]);
});
t('合格判定：第38回の基準（総得点64点・全科目群に得点）', () => {
  const full = (c) => { const o = {}; for (const s of C.SUBJECTS) o[s] = { n: C.EXAM_DIST[s], c: Math.min(C.EXAM_DIST[s], c(s)) }; return o; };
  let j = C.judge(full((s) => Math.ceil(C.EXAM_DIST[s] * 0.6)));
  assert.ok(j.isFull && j.totalPass, '6割で合格');
  j = C.judge(full((s) => (s === '医療的ケア' ? 0 : C.EXAM_DIST[s])));
  assert.ok(!j.totalPass, '0点の科目群があれば総得点で不合格');
  assert.deepStrictEqual(j.passedParts, ['A', 'C'], 'B だけ不合格（医療的ケア0点）');
  j = C.judge(full((s) => Math.floor(C.EXAM_DIST[s] * 0.45)));
  assert.ok(!j.totalPass);
  const b = j.parts.find((r) => r.part === 'B');
  console.log('   45%のとき', j.totalC, '/', j.totalN, 'B', b.c, '/', b.n, '基準', b.line, 'あと', b.short);
});
t('間隔反復：間違い→翌日、正解→3・7・14・30日、同じ日の2回目では上げない', () => {
  const D = C.DAY, t0 = new Date(2026, 9, 1, 10).getTime();
  let st = C.srsFromLog([[t0, 'K0001', 1, 0, 5, 0, 'p', 0]]);
  assert.strictEqual(st.K0001.due, C.dayStart(t0) + D);
  st = C.srsFromLog([[t0, 'K0001', 1, 0, 5, 0, 'p', 0], [t0 + 60000, 'K0001', 2, 1, 5, 0, 'p', 0]]);
  assert.strictEqual(st.K0001.due, C.dayStart(t0) + D, '直後のもう一度で正解しても翌日のまま');
  const seq = [[t0, 1]], days = [0, 1, 4, 11, 25, 55];
  const log = days.map((d) => [t0 + d * D, 'K0002', 1, 1, 5, 0, 'p', 0]);
  st = C.srsFromLog(log.slice(0, 1)); assert.strictEqual((st.K0002.due - C.dayStart(t0)) / D, 3);
  st = C.srsFromLog(log.slice(0, 5)); assert.strictEqual(st.K0002.stage, 4);
  st = C.srsFromLog(log); assert.ok(st.K0002.mastered, '30日後も正解で定着');
  st = C.srsFromLog([[t0, 'K0003', 1, 1, 5, 1, 'p', 0]]); assert.strictEqual(st.K0003.due, C.dayStart(t0) + D, '自信がない正解は翌日');
});
t('1日の区切りは午前4時', () => {
  assert.strictEqual(C.dayKey(new Date(2026, 9, 2, 3, 59).getTime()), '2026-10-01');
  assert.strictEqual(C.dayKey(new Date(2026, 9, 2, 4, 0).getTime()), '2026-10-02');
});
t('解説：全問で選択肢ごとの解説が5つ、機械的な【知識のまとめ】は出さない', () => {
  let hidden = 0;
  for (const s of C.SUBJECTS) for (const q of bySubject[s]) {
    const e = C.parseExplanation(q.explanation);
    if (q.id !== 'K1839') assert.strictEqual(Object.keys(e.opts).length, 5, q.id);
    assert.ok(!/【知識のまとめ】\n・基本＝/.test(e.head), q.id);
    if (/【知識のまとめ】\n・基本＝/.test(q.explanation)) hidden++;
  }
  console.log('   型どおりの【知識のまとめ】を隠した問題', hidden);
});
t('解説中の選択肢番号を表示の番号に置き換える', () => {
  const order = [3, 1, 5, 2, 4];
  assert.strictEqual(C.remapNumbers('選択肢4と同様に、選択肢１は誤り。', order), '選択肢5と同様に、選択肢2は誤り。');
  assert.strictEqual(C.remapNumbers('正解は、1.の終末期の…。1.5倍。', order), '正解は、2.の終末期の…。1.5倍。');
  let n = 0;
  for (const s of C.SUBJECTS) for (const q of bySubject[s]) { const e = C.parseExplanation(q.explanation); if (/選択肢\s*[1-5１-５]/.test(e.head + Object.values(e.opts).join(''))) n++; }
  console.log('   本文に「選択肢N」がある問題', n);
});
t('「適切でないもの」を見分ける', () => {
  const neg = C.SUBJECTS.flatMap((s) => bySubject[s]).filter((q) => C.NEG_RE.test(C.questionPart(q.stem)));
  console.log('   否定形の問題', neg.length, neg.slice(0, 8).map((q) => q.id).join(','));
  assert.ok(neg.some((q) => q.id === 'K1364'));
});
t('事例を本文と設問に分ける', () => {
  let n = 0;
  for (const q of bySubject['総合問題']) { const c = C.splitCase(q.stem); if (c) { n++; assert.ok(c.question.length > 5 && c.case.length > 20, q.id); } }
  console.log('   分けられた総合問題', n, '/', bySubject['総合問題'].length);
  assert.ok(n >= 170);
});
t('記録の点検：壊れた値・__proto__ を捨てる', () => {
  const blank = () => ({ v: 2, q: {}, log: [], days: {}, mocks: [], settings: { shuffle: true }, prefs: {}, session: null });
  const bad = JSON.parse('{"v":1,"q":{"__proto__":{"st":1},"K0001":{"a":3,"c":1,"st":1,"n":"メモ"}},"log":[[1760000000000,"K0001",1,1,3,0,"p",0],["x","K0002"],[1760000000001,"__proto__",1,1,1,0,"p",0]],"days":null,"session":{"ids":"x"}}');
  const S = C.rebuild(C.sanitize(C.migrate(bad), blank()));
  assert.strictEqual(({}).st, undefined);
  assert.strictEqual(S.log.length, 1);
  assert.strictEqual(S.q.K0001.a, 1); assert.strictEqual(S.q.K0001.n, 'メモ');
  assert.strictEqual(S.session, null);
  const other = { v: 2, q: { K0002: { st: 1 } }, log: [[1760000000500, 'K0002', 3, 0, 9, 1, 'p', 1]], days: {}, mocks: [] };
  const r = C.merge(S, other, blank());
  assert.strictEqual(r.added, 1); assert.strictEqual(S.q.K0002.st, 1); assert.strictEqual(S.q.K0002.a, 1);
});
t('介護福祉士レベル（GAS版と同じ式）', () => {
  assert.strictEqual(C.careLevelAt(0).level, 1); assert.strictEqual(C.careLevelAt(9).level, 1);
  assert.strictEqual(C.careLevelAt(10).level, 2); assert.strictEqual(C.careLevelAt(29).level, 2); assert.strictEqual(C.careLevelAt(30).level, 3);
  assert.strictEqual(C.careLevelAt(49500).level, 100); assert.strictEqual(C.careLevelAt(49499).level, 99);
  // 10問で Lv2。社会の理解を10問 → 能力値 +1
  const log = Array.from({ length: 10 }, (_, i) => [1760000000000 + i * 1000, 'K' + String(i).padStart(4, '0'), 1, 1, 5, 0, 'p', 2]);
  const L = C.careLearner(log);
  assert.strictEqual(L.level, 2); assert.strictEqual(L.statuses[2].value, 1);
  assert.strictEqual(C.careSnapshotAt(L, 5).statuses[2].value, 0);
});
t('積み重ね：今日・今週・連続日数・実績（1日の区切りは午前4時）', () => {
  const at = (s) => Date.parse(s);
  const log = [
    [at('2026-10-17T10:00:00+09:00'), 'K0001', 1, 1, 30, 0, 'p', 0],
    [at('2026-10-18T03:30:00+09:00'), 'K0002', 1, 0, 40, 0, 'p', 0], // 午前4時前 → 17日
    [at('2026-10-18T09:00:00+09:00'), 'K0003', 1, 1, 50, 0, 'p', 0],
    [at('2026-10-19T08:00:00+09:00'), 'K0004', 1, 1, 60, 0, 'p', 0],
  ];
  const g = C.growthSummary(log, { now: at('2026-10-19T12:00:00+09:00') });
  assert.strictEqual(g.today.count, 1); assert.strictEqual(g.yesterday.count, 1);
  assert.strictEqual(g.streak, 3); assert.strictEqual(g.best.day, 2);
  assert.strictEqual(g.week.count, 1); // 10/19 は月曜
  assert.strictEqual(g.lastWeek.count, 3);
  assert.strictEqual(g.total.seconds, 180);
  assert.strictEqual(g.recent.length, 7); assert.strictEqual(g.recent[6].date, '2026-10-19');
});
t('要復習の判定', () => {
  assert.ok(C.needsReview({ a: 1, l: 0 }));
  assert.ok(C.needsReview({ a: 1, l: 1, lu: 1 }));
  assert.ok(!C.needsReview({ a: 1, l: 1, lu: 0 }));
  assert.ok(C.needsReview({ n: 'メモ' })); assert.ok(C.needsReview({ nu: [2] }));
  const r = C.reviewSummary([{ id: 'A', subject: 'x', type: '過去問' }, { id: 'B', subject: 'x', type: '過去問' }], { A: { a: 1, l: 0, n: 'm' } }, ['subject']);
  assert.strictEqual(r.total.needed, 1); assert.strictEqual(r.total.wrong, 1); assert.strictEqual(r.total.comment, 1); assert.strictEqual(r.groups['subject:x'].ratio, 0.5);
});
t('未理解・解説がおかしい・プロフィールを保存して合わせる', () => {
  const blank = () => ({ v: 3, q: {}, log: [], days: {}, mocks: [], settings: {}, prefs: {}, session: null });
  const S = C.rebuild(C.sanitize(C.migrate({ v: 2, q: { K0001: { nu: [3, 9, 1], nut: 5 } }, log: [], settings: { qLimit: 0, goal: 30 } }), blank()));
  assert.deepStrictEqual(S.q.K0001.nu, [1, 3]);
  assert.strictEqual(S.settings.qLimit, 60); assert.strictEqual(S.settings.goals.day, 30);
  C.merge(S, { v: 3, q: { K0001: { nu: [2], nut: 9 }, K0002: { xi: 1, xit: 3 } }, log: [], profile: { name: 'たろう', avatar: '🐶', at: 10 } }, blank());
  assert.deepStrictEqual(S.q.K0001.nu, [2]); assert.strictEqual(S.q.K0002.xi, 1); assert.strictEqual(S.profile.name, 'たろう');
});
t('自信の3段階と試験前の間隔', () => {
  const t0 = Date.parse('2026-10-01T10:00:00+09:00'), D = 86400000;
  let st = C.srsFromLog([[t0, 'K1', 1, 1, 5, 0, 'p', 0]]);
  assert.strictEqual(Math.round((st.K1.due - C.dayStart(t0)) / D), 3);
  st = C.srsFromLog([[t0, 'K1', 1, 1, 5, 0, 'p', 0], [t0 + 3 * D, 'K1', 1, 1, 5, 0, 'p', 0]]);
  assert.strictEqual(Math.round((st.K1.due - C.dayStart(t0 + 3 * D)) / D), 7);
  st = C.srsFromLog([[t0, 'K1', 1, 1, 5, 0, 'p', 0], [t0 + 2 * D, 'K1', 1, 1, 5, 1, 'p', 0]]); // なんとなく
  assert.strictEqual(st.K1.stage, 1); assert.strictEqual(Math.round((st.K1.due - C.dayStart(t0 + 2 * D)) / D), 1);
  st = C.srsFromLog([[t0, 'K1', 1, 1, 5, 2, 'p', 0]]); // わからない
  assert.strictEqual(st.K1.stage, 0);
  // 試験まで6日 → 間隔は最大2日
  const log = [0, 3, 10, 20].map((d) => [t0 + d * D, 'K2', 1, 1, 5, 0, 'p', 0]);
  st = C.srsFromLog(log, { examAt: C.dayStart(t0 + 26 * D) });
  assert.ok((st.K2.due - C.dayStart(t0 + 20 * D)) / D <= 2);
});
t('お休みチケット（週に1日）', () => {
  const at = (d) => Date.parse('2026-10-' + d + 'T12:00:00+09:00');
  const e = (d) => [at(d), 'K' + d, 1, 1, 10, 0, 'p', 0];
  let g = C.growthSummary([e(13), e(14), e(16), e(17)], { now: at(17) }); // 15日（木）休み
  assert.strictEqual(g.streak, 4); assert.deepStrictEqual(g.restDays, ['2026-10-15']);
  g = C.growthSummary([e(13), e(15), e(17)], { now: at(17) }); // 同じ週に2日休み → 途切れる
  assert.strictEqual(g.streak, 2);
  g = C.growthSummary([e(13), e(14), e(16), e(17)], { now: at(17), rest: false });
  assert.strictEqual(g.streak, 2);
});
t('パート別・科目群別の進み具合', () => {
  const qs = [{ id: 'A', subject: '社会の理解' }, { id: 'B', subject: '社会の理解' }, { id: 'C', subject: '医療的ケア' }];
  const g = C.groupProgress(qs, { A: { a: 2, l: 1, t: Date.now() }, B: { a: 1, l: 0, t: Date.now() } });
  const s = g.groups.find((x) => x.name === '社会の理解');
  assert.strictEqual(s.rate, 0.5); assert.strictEqual(s.gap, 10);
  assert.strictEqual(g.parts.A.answered, 2); assert.strictEqual(g.groups.find((x) => x.name === '医療的ケア').warn, '未学習');
});
console.log('\nすべて合格：' + ok + '件');
