// 自分で作る暗記シート：読者が大事だと思ったところを選んでかくす。
// かくした場所はこのブラウザ（localStorage の "myanki"）に保存する。
// 保存形式：{ [記事ID]: { title, items: [{ b: ブロック番号, s: 開始, e: 終了, t: かくした文字 }] } }
(function () {
  var root = document.getElementById('sheet'); if (!root) return;
  var page = document.getElementById('anki');
  var slug = page.dataset.slug, title = page.dataset.title;
  var BLOCK = 'li, td, th, p, h3';
  var blocks = Array.prototype.slice.call(root.querySelectorAll(BLOCK)).filter(function (b) { return !b.querySelector(BLOCK); });

  function load() { try { return JSON.parse(localStorage.getItem('myanki') || '{}'); } catch (e) { return {}; } }
  function save(items) {
    var all = load();
    if (items.length) all[slug] = { title: title, items: items, t: Date.now() }; else delete all[slug];
    try { localStorage.setItem('myanki', JSON.stringify(all)); } catch (e) {}
  }
  var items = (load()[slug] || {}).items || [];

  function texts(block) {
    var w = document.createTreeWalker(block, NodeFilter.SHOW_TEXT), out = [], n;
    while ((n = w.nextNode())) out.push(n);
    return out;
  }
  function offsetOf(block, node, off) {
    var pos = 0, list = texts(block);
    for (var i = 0; i < list.length; i++) {
      if (list[i] === node) return pos + off;
      pos += list[i].nodeValue.length;
    }
    // node が要素のとき
    if (node.nodeType === 1) {
      var r = document.createRange(); r.setStart(block, 0); r.setEnd(node, off);
      return r.toString().length;
    }
    return -1;
  }
  // block 内の文字位置 [s, e) を <span class="h"> で包む（要素をまたいでもよい）
  function wrap(block, s, e, gid) {
    var pos = 0;
    texts(block).forEach(function (n) {
      var len = n.nodeValue.length, a = Math.max(s, pos), b = Math.min(e, pos + len);
      if (a < b && n.nodeValue.slice(a - pos, b - pos).trim()) {
        var mid = n.splitText(a - pos); mid.splitText(b - a);
        var sp = document.createElement('span'); sp.className = 'h'; sp.dataset.g = gid;
        mid.parentNode.insertBefore(sp, mid); sp.appendChild(mid);
      }
      pos += len;
    });
  }
  function unwrapAll() {
    root.querySelectorAll('span.h').forEach(function (sp) {
      var p = sp.parentNode; while (sp.firstChild) p.insertBefore(sp.firstChild, sp); p.removeChild(sp); p.normalize();
    });
  }
  function render() {
    unwrapAll();
    items = items.filter(function (it) {
      var b = blocks[it.b]; if (!b) return false;
      var txt = b.textContent;
      if (txt.slice(it.s, it.e) !== it.t) { // 記事が直されて位置がずれたら、同じ文字を探し直す
        var i = txt.indexOf(it.t); if (i < 0) return false;
        it.s = i; it.e = i + it.t.length;
      }
      return true;
    });
    items.forEach(function (it, i) { wrap(blocks[it.b], it.s, it.e, i); });
    var n = items.length;
    document.getElementById('my-count').textContent = n ? 'かくした所：' + n + 'か所' : 'まだかくした所はありません。「✏️ かくす所を選ぶ」から、覚えたい言葉を選んでください。';
  }
  function add(b, s, e) {
    var bi = blocks.indexOf(b); if (bi < 0 || e <= s) return;
    var t = b.textContent.slice(s, e); if (!t.trim()) return;
    // 重なる範囲はまとめる
    items = items.filter(function (it) {
      if (it.b === bi && it.s < e && s < it.e) { s = Math.min(s, it.s); e = Math.max(e, it.e); return false; }
      return true;
    });
    items.push({ b: bi, s: s, e: e, t: b.textContent.slice(s, e) });
    save(items); render();
  }
  function blockOf(node) { var el = node.nodeType === 1 ? node : node.parentElement; var b = el && el.closest(BLOCK); return blocks.indexOf(b) >= 0 ? b : null; }

  // ── 編集モード ──
  var editBtn = document.getElementById('my-edit'), editing = false;
  var pop = document.createElement('button'); pop.type = 'button'; pop.className = 'my-pop'; pop.textContent = '🙈 ここをかくす'; pop.hidden = true;
  document.body.appendChild(pop);
  function setEdit(on) {
    editing = on; page.classList.toggle('editing', on);
    editBtn.textContent = on ? '✅ 選び終わった' : '✏️ かくす所を選ぶ';
    editBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    document.getElementById('my-help').hidden = !on;
    pop.hidden = true;
    root.querySelectorAll('span.h.show').forEach(function (x) { x.classList.remove('show'); });
  }
  editBtn.addEventListener('click', function () { setEdit(!editing); });

  var pending = null;
  function checkSel() {
    if (!editing) return;
    var sel = window.getSelection();
    if (!sel.rangeCount || sel.isCollapsed) { pop.hidden = true; pending = null; return; }
    var r = sel.getRangeAt(0), b1 = blockOf(r.startContainer), b2 = blockOf(r.endContainer);
    if (!b1 || b1 !== b2) { pop.hidden = true; pending = null; return; }
    var s = offsetOf(b1, r.startContainer, r.startOffset), e = offsetOf(b1, r.endContainer, r.endOffset);
    if (s < 0 || e <= s) { pop.hidden = true; return; }
    pending = { b: b1, s: s, e: e };
    var rect = r.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(window.innerWidth - 150, rect.left + rect.width / 2 - 70)) + 'px';
    pop.style.top = Math.min(window.innerHeight - 56, Math.max(8, rect.bottom + 8)) + 'px';
    pop.hidden = false;
  }
  document.addEventListener('selectionchange', function () { clearTimeout(checkSel.t); checkSel.t = setTimeout(checkSel, 120); });
  pop.addEventListener('mousedown', function (e) { e.preventDefault(); });
  pop.addEventListener('click', function () {
    if (pending) add(pending.b, pending.s, pending.e);
    window.getSelection().removeAllRanges(); pop.hidden = true; pending = null;
  });

  root.addEventListener('click', function (e) {
    var h = e.target.closest('span.h');
    if (editing) {
      if (!window.getSelection().isCollapsed) return;
      if (h) { // かくした所をもう一度タップ → 取り消し
        items.splice(+h.dataset.g, 1); save(items); render(); return;
      }
      var st = e.target.closest('strong'); // 太字をタップ → その語をまるごとかくす
      if (st) { var b = blockOf(st); if (b) { var s = offsetOf(b, st, 0), len = st.textContent.length; add(b, s, s + len); } }
      return;
    }
    if (h) root.querySelectorAll('span.h[data-g="' + h.dataset.g + '"]').forEach(function (x) { x.classList.toggle('show'); });
  });

  document.getElementById('my-all').onclick = function () { root.querySelectorAll('span.h').forEach(function (x) { x.classList.add('show'); }); };
  document.getElementById('my-hide').onclick = function () { root.querySelectorAll('span.h').forEach(function (x) { x.classList.remove('show'); }); };
  document.getElementById('my-auto').onclick = function () {
    if (!window.kaigoMask) return;
    window.kaigoMask(root);
    root.querySelectorAll('strong.m').forEach(function (st) {
      var b = blockOf(st); if (!b) return;
      var s = offsetOf(b, st, 0); add(b, s, s + st.textContent.length);
      st.classList.remove('m');
    });
  };
  document.getElementById('my-clear').onclick = function () {
    if (!items.length || !confirm('かくした所をすべて取り消しますか？')) return;
    items = []; save(items); render();
  };
  render();
})();
