// 記事末の「過去問テスト」（その記事に割り当てた第34〜38回の本試験問題すべて）。
// 結果はこのブラウザの localStorage "ptest" に保存：{ [記事ID]: { title, n, ans: { [問題ID]: true/false }, t } }
(function () {
  var box = document.getElementById('ptest'); if (!box) return;
  var data = JSON.parse(document.getElementById('ptest-data').textContent);
  var art = box.dataset.id, title = box.dataset.title;
  var view = box.querySelector('.pt-view'), stat = box.querySelector('.pt-stat');

  function load() { try { return JSON.parse(localStorage.getItem('ptest') || '{}'); } catch (e) { return {}; } }
  function rec() { return load()[art] || { ans: {} }; }
  function save(id, ok) {
    var all = load(), r = all[art] || { ans: {} };
    r.ans[id] = ok; r.title = title; r.n = data.length; r.t = Date.now();
    all[art] = r;
    try { localStorage.setItem('ptest', JSON.stringify(all)); } catch (e) {}
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  // まちがえた問題の内容が書いてある見出しを探す（記事中の同じ過去問がある見出し）
  function norm(t) { return String(t).replace(/<[^>]+>|\*\*/g, '').replace(/[\s、。，．・「」（）()？?]/g, ''); }
  function secOf(q) {
    var lines = String(q.q).split('\n'), key = norm(lines[lines.length - 1]).slice(0, 18); if (key.length < 6) return null;
    var ps = document.querySelectorAll('#art-body details > p');
    for (var k = 0; k < ps.length; k++) {
      var c = ps[k].cloneNode(true); c.querySelectorAll('rt,rp').forEach(function (x) { x.remove(); });
      if (norm(c.textContent).indexOf(key) === 0) {
        var d = ps[k].closest('details.sec'), h = d ? d.querySelector('summary h2') : null;
        if (h) return { id: h.id, t: h.textContent.replace(/^📌\s*/, '') };
      }
    }
    return null;
  }
  function md(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/&lt;(\/?)strong&gt;/g, '<$1strong>').replace(/\n/g, '<br>'); }

  function summary() {
    var r = rec(), ids = Object.keys(r.ans).filter(function (k) { return data.some(function (q) { return q.id === k; }); });
    var ok = ids.filter(function (k) { return r.ans[k]; }).length, ng = ids.length - ok;
    stat.innerHTML = ids.length
      ? '解いた問題 <b>' + ids.length + ' / ' + data.length + '</b>　正解 <b>' + ok + '</b>　まちがい <b class="ng">' + ng + '</b>'
      : 'まだ解いていません。全' + data.length + '問・1問ずつ答え合わせしながら進みます。';
    box.querySelector('.pt-wrong').hidden = ng === 0;
    box.querySelector('.pt-wrong').textContent = '✖ まちがえた' + ng + '問だけ解く';
    var bar = box.querySelector('.pt-bar span'); bar.style.width = Math.round(ids.length / data.length * 100) + '%';
  }

  var list = [], i = 0, score = 0;
  function start(only) {
    var r = rec();
    list = only ? data.filter(function (q) { return r.ans[q.id] === false; }) : data.slice();
    if (!list.length) return;
    i = 0; score = 0; box.classList.add('running'); show();
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function show() {
    var q = list[i];
    view.innerHTML =
      '<div class="pt-head"><span class="pt-no">' + (i + 1) + ' / ' + list.length + '</span><span class="pt-src">第' + q.kai + '回：' + esc(q.sub) + '</span></div>' +
      '<p class="pt-q">' + md(q.q) + '</p>' + (q.note ? '<p class="q-note">' + esc(q.note) + '</p>' : '') + '<ol class="pt-ch">' +
      q.c.map(function (c, k) { return '<li><button type="button" data-k="' + (k + 1) + '">' + md(c) + '</button></li>'; }).join('') +
      '</ol><p class="q-src">出典：第' + q.kai + '回 介護福祉士国家試験（' + esc(q.sub) + '）。解説は当サイト独自のものです。</p><div class="pt-res" hidden></div>';
    view.querySelectorAll('.pt-ch button').forEach(function (b) { b.onclick = function () { answer(+b.dataset.k); }; });
  }
  function answer(k) {
    var q = list[i], ok = k === q.a;
    if (ok) score++;
    save(q.id, ok);
    view.querySelectorAll('.pt-ch button').forEach(function (b) {
      var n = +b.dataset.k; b.disabled = true;
      if (n === q.a) b.classList.add('right'); else if (n === k) b.classList.add('wrong');
    });
    var res = view.querySelector('.pt-res');
    res.hidden = false;
    var sec = ok ? null : secOf(q);
    res.innerHTML = '<p class="pt-mark ' + (ok ? 'ok' : 'ng') + '">' + (ok ? '⭕ 正解！' : '❌ 不正解（正解は ' + q.a + '）') + '</p><p>' + md(q.e) + '</p>' +
      (sec ? '<p class="pt-back">📖 <a href="#' + sec.id + '">「' + esc(sec.t) + '」を読み直す</a></p>' : '') +
      '<button type="button" class="pt-next">' + (i + 1 < list.length ? '次の問題へ →' : '結果を見る') + '</button>';
    res.querySelector('.pt-next').onclick = function () { i++; if (i < list.length) show(); else finish(); };
    summary();
  }
  function finish() {
    var rate = Math.round(score / list.length * 100);
    var msg = rate >= 80 ? 'よくできました！この記事は合格ラインです。次の記事へ進みましょう。' : rate >= 60 ? 'あと少し！まちがえた問題の見出しを読み直してから、もう一度チャレンジしましょう。' : 'まずは本文をもう一度読んでから、まちがえた問題だけ解き直してみましょう。';
    var weak = '';
    if (rate < 60 && list.length >= 3 && window.kaigoMarks) {
      var all = window.kaigoMarks.load(), cur = all[art] || { title: title };
      if (!cur.weak) { cur.weak = true; cur.title = title; cur.t = Date.now(); all[art] = cur; window.kaigoMarks.save(all); weak = '<p class="pt-weak">⚠ 正答率が60%未満だったので、この記事をマイリストの「苦手」に入れました。</p>'; if (window.kaigoMarksDraw) window.kaigoMarksDraw(); }
    }
    view.innerHTML = '<div class="pt-end"><p class="pt-score">' + score + ' / ' + list.length + '問 正解（' + rate + '%）</p><p>' + msg + '</p>' + weak + '</div>';
    box.classList.remove('running');
    summary();
  }
  box.querySelector('.pt-all').onclick = function () { start(false); };
  box.querySelector('.pt-wrong').onclick = function () { start(true); };
  summary();
})();
