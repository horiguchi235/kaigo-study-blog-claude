// 記事末の「過去問テスト」（その記事に割り当てた第34〜38回の本試験問題すべて）。
// 結果はこのブラウザの localStorage "ptest" に保存：{ [記事ID]: { title, n, ans: { [問題ID]: true/false }, w: { [問題ID]: 1 }（一度でもまちがえた）, inl: { [問題ID]: 1 }（記事中で解いた）, t } }
// 1問ごとの記録は qlog.js（全記事・アプリ共通）にも入れる。
(function () {
  var box = document.getElementById('ptest'); if (!box) return;
  var data = JSON.parse(document.getElementById('ptest-data').textContent);
  var art = box.dataset.id, title = box.dataset.title;
  var view = box.querySelector('.pt-view'), stat = box.querySelector('.pt-stat'), btns = box.querySelector('.pt-btns');
  var RUBY = document.documentElement.classList.contains('ruby');

  function load() { try { return JSON.parse(localStorage.getItem('ptest') || '{}'); } catch (e) { return {}; } }
  function rec() { var r = load()[art] || {}; r.ans = r.ans || {}; r.w = r.w || {}; r.inl = r.inl || {}; return r; }
  function put(fn) {
    var all = load(), r = all[art] || {}; r.ans = r.ans || {}; r.w = r.w || {}; r.inl = r.inl || {};
    fn(r); r.title = title; r.n = data.length; r.t = Date.now(); all[art] = r;
    try { localStorage.setItem('ptest', JSON.stringify(all)); } catch (e) {}
  }
  function save(id, ok) {
    put(function (r) { r.ans[id] = ok; if (!ok) r.w[id] = 1; delete r.inl[id]; });
    if (window.kaigoQ) window.kaigoQ.rec(id, ok, 'test');
  }
  // 記事中の問題に答えたら、テストの記録にも入れる（同じ問題を二度解かなくてよいように）
  window.kaigoPtestInline = function (id, ok) {
    if (!data.some(function (q) { return q.id === id; })) return;
    put(function (r) { if (r.ans[id] === undefined || r.inl[id]) { r.ans[id] = ok; r.inl[id] = 1; } if (!ok) r.w[id] = 1; });
    summary();
  };

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function md(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/&lt;(\/?)strong&gt;/g, '<$1strong>').replace(/\n/g, '<br>'); }
  // ふりがなモードでは、ビルドで付けたルビ（q._r）を使う
  function f(q, k, j) {
    if (RUBY && q._r && q._r[k] != null) { var h = j == null ? q._r[k] : q._r[k][j]; return window.kaigoRuby(h).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>'); }
    return md(j == null ? q[k] : q[k][j]);
  }
  function norm(t) { return String(t).replace(/<[^>]+>|\*\*/g, '').replace(/[\s、。，．・「」（）()？?①-⑳]/g, ''); }

  // 読み直す見出し（qmap で決めた「記事・見出し」。この記事の見出しなら、その場で開く）
  function secOf(q) {
    if (!q.sh) return null;
    if (q.sa && q.sa !== art) return { ext: true, href: '../' + q.sa + '/?h=' + encodeURIComponent(q.sh), t: q.sh, at: q.sat || '' };
    var key = norm(q.sh), hs = document.querySelectorAll('#art-body h2, #art-body h3');
    for (var k = 0; k < hs.length; k++) {
      var c = hs[k].cloneNode(true); c.querySelectorAll('rt,rp').forEach(function (x) { x.remove(); });
      if (norm(c.textContent).indexOf(key) >= 0 || key.indexOf(norm(c.textContent)) >= 0 && norm(c.textContent).length > 3) return { el: hs[k], t: q.sh };
    }
    return null;
  }
  var back = null;
  function goSec(sec, no) {
    var el = sec.el, d = el.closest('details');
    while (d) { d.open = true; d = d.parentElement && d.parentElement.closest('details'); }
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (!back) {
      back = document.createElement('button'); back.type = 'button'; back.className = 'pt-return';
      back.onclick = function () { back.hidden = true; box.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
      document.body.appendChild(back);
    }
    back.textContent = '↩ テストの続きへ（' + no + '問目）'; back.hidden = false;
  }
  function backLink(q, no) {
    var sec = secOf(q); if (!sec) return '';
    if (sec.ext) return '<p class="pt-back">📖 <a href="' + sec.href + '">' + (sec.at ? esc(sec.at) + 'の ' : '') + '「' + esc(sec.t) + '」を読む</a>（別の記事）</p>';
    return '<p class="pt-back">📖 <a href="#" data-sec="' + esc(q.id) + '" data-no="' + no + '">「' + esc(sec.t) + '」を読み直す</a></p>';
  }
  box.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-sec]'); if (!a) return;
    e.preventDefault();
    var q = data.filter(function (x) { return x.id === a.dataset.sec; })[0], sec = q && secOf(q);
    if (sec && sec.el) goSec(sec, a.dataset.no);
  });

  var PARTS = {}; data.forEach(function (q) { PARTS[q.p] = (PARTS[q.p] || 0) + 1; });
  var part = '';
  function pool() { return part ? data.filter(function (q) { return q.p === part; }) : data; }

  function summary() {
    var r = rec(), d = pool(), done = d.filter(function (q) { return r.ans[q.id] !== undefined; });
    var ok = done.filter(function (q) { return r.ans[q.id]; }).length, ng = done.length - ok;
    var inl = done.filter(function (q) { return r.inl[q.id]; }).length;
    var everW = d.filter(function (q) { return r.w[q.id]; }).length;
    stat.innerHTML = done.length
      ? '解いた問題 <b>' + done.length + ' / ' + d.length + '</b>' + (inl ? '（うち記事中で ' + inl + '問）' : '') + '　正解 <b>' + ok + '</b>　まちがい <b class="ng">' + ng + '</b>' + (everW > ng ? '　<span class="pt-ever">一度でもまちがえた ' + everW + '問</span>' : '')
      : 'まだ解いていません。全' + d.length + '問・1問ずつ答え合わせしながら進みます。';
    var left = d.filter(function (q) { return r.ans[q.id] === undefined; });
    var h = '';
    if (done.length && left.length) h += '<button type="button" data-m="rest">▶ 続きから（残り' + left.length + '問）</button>';
    h += '<button type="button" data-m="all"' + (done.length && left.length ? ' class="sub"' : '') + '>' + (done.length ? '↻ 1問目からもう一度' : '▶ 1問目から解く') + '</button>';
    if (ng) h += '<button type="button" data-m="wrong" class="sub">✖ まちがえた' + ng + '問だけ</button>';
    if (everW > ng) h += '<button type="button" data-m="ever" class="sub">一度でもまちがえた' + everW + '問</button>';
    if (Object.keys(PARTS).length > 1) {
      h += '<span class="pt-parts">パートで絞る：' + ['', 'A', 'B', 'C'].filter(function (p) { return !p || PARTS[p]; }).map(function (p) {
        return '<button type="button" data-p="' + p + '" class="chip' + (p === part ? ' on' : '') + '">' + (p ? p + 'パート（' + PARTS[p] + '）' : 'すべて') + '</button>';
      }).join('') + '</span>';
    }
    btns.innerHTML = h;
    var bar = box.querySelector('.pt-bar span'); bar.style.width = Math.round(done.length / d.length * 100) + '%';
  }
  btns.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.p != null) { part = b.dataset.p; summary(); return; }
    start(b.dataset.m);
  });

  var list = [], i = 0, score = 0, wrongNow = [];
  function start(mode) {
    var r = rec(), d = pool();
    list = mode === 'rest' ? d.filter(function (q) { return r.ans[q.id] === undefined; })
      : mode === 'wrong' ? d.filter(function (q) { return r.ans[q.id] === false; })
      : mode === 'ever' ? d.filter(function (q) { return r.w[q.id]; })
      : d.slice();
    if (!list.length) return;
    i = 0; score = 0; wrongNow = []; box.classList.add('running'); show();
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function caseOf(s) { var L = String(s).split('\n'); return L.length > 2 ? L.slice(0, -1).join('\n') : ''; }
  function show() {
    var q = list[i], prev = list[i - 1];
    var qh = f(q, 'q');
    var cs = caseOf(q.q);
    if (cs && prev && caseOf(prev.q) && caseOf(prev.q).slice(0, 80) === cs.slice(0, 80)) {
      var lines = qh.split('<br>'), last = lines.pop();
      qh = '<details class="pt-case"><summary>事例（前の問題と同じ）を読む</summary>' + lines.join('<br>') + '</details>' + last;
    }
    view.innerHTML =
      '<div class="pt-head"><span class="pt-no">' + (i + 1) + ' / ' + list.length + '</span><span class="pt-src">第' + q.kai + '回：' + esc(q.sub) + '</span></div>' +
      '<p class="pt-q">' + qh + '</p>' + (q.note ? '<p class="q-note">' + f(q, 'note') + '</p>' : '') + '<ol class="pt-ch">' +
      q.c.map(function (c, k) { return '<li><button type="button" data-k="' + (k + 1) + '">' + f(q, 'c', k) + '</button></li>'; }).join('') +
      '</ol><p class="q-src">出典：第' + q.kai + '回 介護福祉士国家試験（' + esc(q.sub) + '）。解説は当サイト独自のものです。</p><div class="pt-res" hidden></div>';
    view.querySelectorAll('.pt-ch button').forEach(function (b) { b.onclick = function () { answer(+b.dataset.k); }; });
  }
  function answer(k) {
    var q = list[i], ok = k === q.a;
    if (ok) score++; else wrongNow.push(q);
    save(q.id, ok);
    view.querySelectorAll('.pt-ch button').forEach(function (b) {
      var n = +b.dataset.k; b.disabled = true;
      if (n === q.a) b.classList.add('right'); else if (n === k) b.classList.add('wrong');
    });
    var res = view.querySelector('.pt-res');
    res.hidden = false;
    res.innerHTML = '<p class="pt-mark ' + (ok ? 'ok' : 'ng') + '" role="status">' + (ok ? '⭕ 正解！' : '❌ 不正解（正解は ' + q.a + '）') + '</p><p>' + f(q, 'e') + '</p>' +
      backLink(q, i + 1) +
      '<button type="button" class="pt-next">' + (i + 1 < list.length ? '次の問題へ →' : '結果を見る') + '</button>';
    res.querySelector('.pt-next').onclick = function () { if (back) back.hidden = true; i++; if (i < list.length) { show(); view.scrollIntoView({ behavior: 'smooth', block: 'start' }); } else finish(); };
    // 解説と「次の問題へ」が見える位置まで動かす
    setTimeout(function () { res.querySelector('.pt-next').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 50);
    summary();
  }
  function finish() {
    var rate = Math.round(score / list.length * 100);
    var msg = rate >= 80 ? 'よくできました！この記事は合格ラインです。' : rate >= 60 ? 'あと少し！まちがえた問題の見出しを読み直してから、もう一度チャレンジしましょう。' : 'まずは本文をもう一度読んでから、まちがえた問題だけ解き直してみましょう。';
    var note = '';
    if (window.kaigoMarks) {
      var all = window.kaigoMarks.load(), cur = all[art] || { title: title };
      if (rate < 60 && list.length >= 3 && !cur.weak) { cur.weak = true; note += '<p class="pt-weak">⚠ 正答率が60%未満だったので、この記事をマイリストの「苦手」に入れました。</p>'; }
      if (wrongNow.length && !cur.rev) { cur.rev = true; note += '<p class="pt-weak">🔁 まちがえた問題があるので、この記事をマイリストの「復習」に入れました。</p>'; }
      cur.title = title; cur.t = Date.now(); all[art] = cur; window.kaigoMarks.save(all); if (window.kaigoMarksDraw) window.kaigoMarksDraw();
    }
    var wl = wrongNow.length ? '<div class="pt-wl"><p><b>まちがえた問題と読み直す見出し</b></p><ul>' + wrongNow.map(function (q) {
      var s = secOf(q);
      return '<li>第' + q.kai + '回：' + esc(String(q.q).split('\n').pop().slice(0, 40)) + '…' + (s ? (s.ext ? '<br>→ <a href="' + s.href + '">' + (s.at ? esc(s.at) + 'の ' : '') + '「' + esc(s.t) + '」</a>' : '<br>→ <a href="#" data-sec="' + esc(q.id) + '" data-no="結果">「' + esc(s.t) + '」</a>') : '') + '</li>';
    }).join('') + '</ul></div>' : '';
    var next = document.querySelector('#art-nav .next:not(.none)');
    view.innerHTML = '<div class="pt-end"><p class="pt-score">' + score + ' / ' + list.length + '問 正解（' + rate + '%）</p><p>' + msg + '</p>' + note + wl +
      '<p class="pt-endbtns">' + (next ? '<a class="pt-go" href="' + next.getAttribute('href') + '">次の記事へ →</a>' : '') +
      (wrongNow.length ? '<button type="button" class="pt-redo">まちがえた問題を解き直す</button>' : '') +
      (rate === 100 ? '<button type="button" class="pt-done">この記事を「完璧」にする</button>' : '') + '</p></div>';
    box.classList.remove('running');
    var redo = view.querySelector('.pt-redo'); if (redo) redo.onclick = function () { start('wrong'); };
    var dn = view.querySelector('.pt-done'); if (dn) dn.onclick = function () {
      var all = window.kaigoMarks.load(), cur = all[art] || {}; cur.done = true; cur.title = title; cur.t = Date.now(); all[art] = cur; window.kaigoMarks.save(all); if (window.kaigoMarksDraw) window.kaigoMarksDraw();
      dn.textContent = '✓ 完璧にしました'; dn.disabled = true;
    };
    summary();
  }
  summary();
  // 「前回の続きから」でテストの位置に来たとき
  if (location.hash === '#ptest' && rec().ans && Object.keys(rec().ans).length) setTimeout(function () { box.scrollIntoView({ block: 'start' }); }, 300);
})();
