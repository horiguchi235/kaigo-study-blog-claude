// 過去問1問ごとの記録（ブログの記事中の問題・記事末テスト・過去問演習アプリで共通）
// localStorage "qlog"：{ [問題ID]: { a: 回答回数, c: 正解回数, ba/bc: ブログで解いた回数・正解数（アプリに取り込むため）, w: まちがえた回数, f: 最初の結果(1/0), l: 最新の結果(1/0), t: 最後に解いた時刻, s: 最後に解いた場所('art'|'test'|'app') } }
// 「一度でもまちがえた問題」は w > 0。解き直して正解しても w は残る。
(function () {
  var KEY = 'qlog';
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } }
  function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }
  window.kaigoQ = {
    all: load,
    get: function (id) { return load()[id] || null; },
    rec: function (id, ok, src) {
      if (!id) return;
      var d = load(), r = d[id] || { a: 0, c: 0, w: 0 };
      if (!r.a) r.f = ok ? 1 : 0;
      r.a++; if (ok) r.c++; else r.w = (r.w || 0) + 1;
      if (src !== 'app') { r.ba = (r.ba || 0) + 1; if (ok) r.bc = (r.bc || 0) + 1; }
      r.l = ok ? 1 : 0; r.t = Date.now(); r.s = src || '';
      d[id] = r; save(d);
      return r;
    },
    // 一度でもまちがえた問題のID（新しい順）
    wrongIds: function () {
      var d = load();
      return Object.keys(d).filter(function (k) { return d[k].w > 0; }).sort(function (a, b) { return d[b].t - d[a].t; });
    }
  };
})();
