// 記事ページの動き
// ・見出し（h2）ごとに折りたたむ（「この記事のポイント」は最初から開く。比較・読みもの＝data-nofold は折りたたまない）
// ・過去問：見出しに問題文の書き出しを足す／選択肢をタップで答え合わせ
// ・ひっかけパターン集：「なぜ×」をかくしてタップで表示（思い出す練習）
// ・つながる知識：〔T17〕や「排泄②」を記事へのリンクに
// ・右側（広い画面）に「この記事の見出し」を固定表示し、今読んでいる見出しをハイライト
// ボタンの文言は #art-body の data-open-all / data-close-all / data-hint で変えられる（翻訳ページ用）。
(function () {
  var body = document.getElementById('art-body'); if (!body) return;
  var ds = body.dataset;
  var nofold = !!ds.nofold;

  // 先頭の「**この記事のポイント**」も見出しにする
  var first = body.firstElementChild;
  if (first && first.tagName === 'P' && first.children.length === 1 && first.firstElementChild.tagName === 'STRONG' && first.textContent.trim() === first.firstElementChild.textContent.trim()) {
    var h = document.createElement('h2'); h.className = 'point-h'; h.textContent = '📌 ' + first.textContent.trim(); h.id = 'points';
    first.replaceWith(h);
  }
  var h2s = Array.prototype.filter.call(body.children, function (el) { return el.tagName === 'H2'; });
  h2s.forEach(function (h, i) { if (!h.id) h.id = 'sec-' + (i + 1); });

  // ── 過去問（記事中）：見出しに問題文の書き出し、選択肢をボタンに ──
  body.querySelectorAll('details.quiz, details:not(.quiz-group):not(.answer):not(.sec)').forEach(function (q) {
    var sm = q.querySelector(':scope > summary'); if (!sm) return;
    var ans = q.querySelector(':scope > details.answer'); if (!ans) return;
    var p = q.querySelector(':scope > p');
    if (q.classList.contains('quiz') && p && !sm.querySelector('.qz-stem')) {
      var t = p.textContent.replace(/\s+/g, '');
      var st = document.createElement('span'); st.className = 'qz-stem';
      st.textContent = t.length > 26 ? t.slice(0, 26) + '…' : t;
      sm.appendChild(st);
    }
    var ol = q.querySelector(':scope > ol'); if (!ol) return;
    var m = ans.textContent.match(/正解\s*[:：]\s*([1-5１-５])/);
    if (!m) return;
    var right = '１２３４５'.indexOf(m[1]) >= 0 ? '１２３４５'.indexOf(m[1]) + 1 : +m[1];
    ol.classList.add('qz-ch');
    Array.prototype.forEach.call(ol.children, function (li, k) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'qz-btn';
      var tx = document.createElement('span'); tx.className = 'qz-t';
      while (li.firstChild) tx.appendChild(li.firstChild);
      b.appendChild(tx); li.appendChild(b);
      b.addEventListener('click', function () {
        if (ol.classList.contains('done')) return;
        ol.classList.add('done');
        Array.prototype.forEach.call(ol.querySelectorAll('.qz-btn'), function (x, j) {
          if (j + 1 === right) x.classList.add('right'); else if (x === b) x.classList.add('wrong');
        });
        var r = document.createElement('p'); r.className = 'qz-judge ' + (k + 1 === right ? 'ok' : 'ng');
        r.textContent = k + 1 === right ? '⭕ 正解！' : '❌ ざんねん。正解は ' + right + ' です';
        ol.after(r);
        ans.open = true;
      });
    });
    var hint = document.createElement('p'); hint.className = 'qz-hint'; hint.textContent = '👆 答えだと思う選択肢をタップ';
    ol.before(hint);
  });

  // ── ひっかけパターン集：「なぜ×」をかくす ──
  h2s.forEach(function (h) {
    if (!/ひっかけ/.test(h.textContent)) return;
    var el = h.nextElementSibling;
    while (el && el.tagName !== 'H2') {
      if (el.tagName === 'TABLE') {
        el.classList.add('why-table', 'why-hide');
        el.querySelectorAll('tbody tr').forEach(function (tr) {
          var td = tr.children[tr.children.length - 1]; if (td && tr.children.length > 1) td.classList.add('why');
        });
        var bar = document.createElement('p'); bar.className = 'why-bar';
        bar.innerHTML = '<span>🧠 「なぜ×」をかくしています。理由を思い出してからタップ</span><button type="button">ぜんぶ見せる</button>';
        el.before(bar);
        (function (tbl, b) {
          b.querySelector('button').addEventListener('click', function () {
            var hide = !tbl.classList.contains('why-hide');
            tbl.classList.toggle('why-hide', hide);
            tbl.querySelectorAll('td.why').forEach(function (td) { td.classList.remove('shown'); });
            this.textContent = hide ? 'ぜんぶ見せる' : 'もう一度かくす';
          });
          tbl.addEventListener('click', function (e) {
            var td = e.target.closest('td.why'); if (td) td.classList.toggle('shown');
          });
        })(el, bar);
      }
      el = el.nextElementSibling;
    }
  });

  // ── つながる知識：記事へのリンク ──
  var map = null; try { map = JSON.parse(document.getElementById('art-links').textContent); } catch (e) {}
  if (map) h2s.forEach(function (h) {
    if (!/つながる知識|関連/.test(h.textContent)) return;
    var el = h.nextElementSibling;
    while (el && el.tagName !== 'H2') {
      el.querySelectorAll('li, p').forEach(function (li) {
        if (li.querySelector('a')) return;
        var html = li.innerHTML, done = false;
        html = html.replace(/〔(T\d+)〕/g, function (s, id) { if (!map.t[id]) return s; done = true; return '<a class="tl" href="' + map.t[id] + '">' + s + '</a>'; });
        if (!done) {
          // 「排泄②」など記事の呼び名（ふりがな付きのHTMLでも見つかるよう、文字だけで探す）
          var txt = li.textContent.replace(/\s+/g, ''), keys = Object.keys(map.a).sort(function (a, b) { return b.length - a.length; });
          for (var i = 0; i < keys.length; i++) {
            if (keys[i].length >= 3 && txt.indexOf(keys[i]) >= 0) { html += ' <a class="tl tl-go" href="' + map.a[keys[i]] + '">→ 記事を開く</a>'; break; }
          }
        }
        li.innerHTML = html;
      });
      el = el.nextElementSibling;
    }
  });

  // ── 右側の「この記事の見出し」（広い画面だけ表示） ──
  if (h2s.length >= 3) {
    var toc = document.createElement('nav'); toc.className = 'art-toc'; toc.setAttribute('aria-label', 'この記事の見出し');
    toc.innerHTML = '<p class="art-toc-h">この記事の見出し</p><ol></ol>';
    var tol = toc.querySelector('ol');
    h2s.forEach(function (h) {
      var li = document.createElement('li'); var a = document.createElement('a');
      a.href = '#' + h.id; a.textContent = h.textContent.replace(/^📌\s*/, '');
      li.appendChild(a); tol.appendChild(li);
    });
    var lay = document.querySelector('.layout');
    if (lay) { lay.appendChild(toc); lay.classList.add('has-toc'); }
    var links = tol.querySelectorAll('a');
    var spy = function () {
      var y = 120, cur = 0;
      h2s.forEach(function (h, i) { if (h.getBoundingClientRect().top < y) cur = i; });
      links.forEach(function (a, i) { a.classList.toggle('on', i === cur); });
    };
    window.addEventListener('scroll', function () { requestAnimationFrame(spy); }, { passive: true });
    spy();
  }

  if (nofold || h2s.length < 2) return;

  // ── 折りたたみ ──
  h2s.forEach(function (h) {
    var d = document.createElement('details'); d.className = 'sec';
    var sm = document.createElement('summary'); var inner = document.createElement('div'); inner.className = 'sec-body';
    h.before(d); sm.appendChild(h); d.appendChild(sm); d.appendChild(inner);
    while (d.nextSibling && !(d.nextSibling.tagName === 'H2')) inner.appendChild(d.nextSibling);
  });
  var secs = body.querySelectorAll('details.sec');
  var pt = body.querySelector('#points'); if (pt) pt.closest('details.sec').open = true;
  var bar = document.createElement('div'); bar.className = 'sec-bar';
  bar.innerHTML = '<span>' + (ds.hint || '📖 見出しをタップすると中身が開きます') + '</span><span><button type="button" data-o="1">' + (ds.openAll || 'すべて開く') + '</button><button type="button" data-o="">' + (ds.closeAll || 'すべて閉じる') + '</button></span>';
  secs[0].before(bar);
  bar.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    secs.forEach(function (d) { d.open = !!b.dataset.o; });
  });
  function openHash() {
    if (!location.hash) return;
    var t; try { t = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (e) { return; }
    var d = t && t.closest('details.sec');
    if (d) { d.open = true; t.scrollIntoView(); }
  }
  openHash(); window.addEventListener('hashchange', openHash);
  // 本文中・右の見出し一覧の「#見出し」へのリンクも開いてから飛ぶ
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]'); if (!a) return;
    if (a.getAttribute('href') === location.hash) { e.preventDefault(); openHash(); return; }
    setTimeout(openHash, 0);
  });
  window.kaigoOpenSec = function (id) { location.hash = id; setTimeout(openHash, 0); };
})();

// 画像のon/off：記事中の図・写真（figure.fig）をまとめて隠す。設定は localStorage "hideImg"（全記事共通）。
// 隠しているあいだは、各図の位置に「🖼 図：説明文」の1行を残し、タップでその図だけ表示できる。
(function () {
  var body = document.getElementById('art-body'); if (!body) return;
  var figs = body.querySelectorAll('figure.fig'); if (!figs.length) return;
  var h = document.documentElement, en = h.lang && h.lang !== 'ja';
  var T = en ? { off: '🖼 Hide images', on: '🖼 Show images', fig: '🖼 Image: ', open: 'show' } : { off: '🖼 画像を隠す', on: '🖼 画像を表示', fig: '🖼 図：', open: 'ひらく' };
  figs.forEach(function (f) {
    var cap = f.querySelector('.steps-title') || f.querySelector('figcaption') || f.querySelector('img');
    var t = cap ? (cap.alt || cap.textContent || '').replace(/^▶\s*/, '').trim() : '';
    var b = document.createElement('button'); b.type = 'button'; b.className = 'fig-ph';
    b.textContent = T.fig + (t.length > 60 ? t.slice(0, 60) + '…' : t) + '（' + T.open + '）';
    b.onclick = function () { f.classList.toggle('fig-force'); b.classList.toggle('on'); };
    f.parentNode.insertBefore(b, f);
  });
  var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'img-toggle';
  function draw() { var off = h.classList.contains('img-off'); btn.textContent = off ? T.on : T.off; btn.setAttribute('aria-pressed', off ? 'true' : 'false'); }
  btn.onclick = function () {
    var off = !h.classList.contains('img-off'); h.classList.toggle('img-off', off);
    try { localStorage.setItem('hideImg', off ? '1' : ''); } catch (e) {}
    body.querySelectorAll('.fig-force').forEach(function (f) { f.classList.remove('fig-force'); });
    body.querySelectorAll('.fig-ph.on').forEach(function (b) { b.classList.remove('on'); });
    draw();
  };
  draw();
  var slot = document.querySelector('.art-tools .study-links') || document.querySelector('.art-tools');
  if (slot) slot.appendChild(btn);
  else { var p = document.createElement('p'); p.className = 'img-toggle-row'; p.appendChild(btn); body.parentNode.insertBefore(p, body); }
})();
