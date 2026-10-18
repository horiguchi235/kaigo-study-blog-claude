// 記事の印（⭐お気に入り・🔁復習・⚠苦手）。このブラウザの localStorage "marks" に保存する。
// 保存形式：{ [記事ID]: { title, fav, rev, weak, t } }
// 記事の上には「☆ 保存」ボタン1つだけを置き、押すと3つの印を選べるメニューが開く。
(function () {
  var KINDS = [
    { k: 'fav', on: '⭐ お気に入り', off: '☆ お気に入り', label: 'お気に入り' },
    { k: 'rev', on: '🔁 復習する', off: '🔁 復習に入れる', label: '復習' },
    { k: 'weak', on: '⚠ 苦手', off: '⚠ 苦手に入れる', label: '苦手' },
  ];
  function load() { try { return JSON.parse(localStorage.getItem('marks') || '{}'); } catch (e) { return {}; } }
  function save(m) { try { localStorage.setItem('marks', JSON.stringify(m)); } catch (e) {} }
  window.kaigoMarks = { load: load, save: save, KINDS: KINDS };

  var box = document.getElementById('marks'); if (!box) return;
  var id = box.dataset.id, title = box.dataset.title;
  var open = false;
  function draw() {
    var m = load()[id] || {};
    var on = KINDS.filter(function (x) { return m[x.k]; });
    box.innerHTML = '';
    var main = document.createElement('button'); main.type = 'button';
    main.className = 'mark-main' + (on.length ? ' on' : '');
    main.setAttribute('aria-expanded', open ? 'true' : 'false');
    main.textContent = on.length ? '★ 保存済み（' + on.map(function (x) { return x.label; }).join('・') + '）▾' : '☆ この記事を保存 ▾';
    main.onclick = function () { open = !open; draw(); };
    box.appendChild(main);
    if (!open) return;
    var menu = document.createElement('div'); menu.className = 'mark-menu';
    KINDS.forEach(function (x) {
      var b = document.createElement('button'); b.type = 'button';
      b.className = 'mark mark-' + x.k + (m[x.k] ? ' on' : '');
      b.setAttribute('aria-pressed', m[x.k] ? 'true' : 'false');
      b.textContent = m[x.k] ? x.on : x.off;
      b.onclick = function () {
        var all = load(), cur = all[id] || { title: title };
        cur[x.k] = !cur[x.k]; cur.title = title; cur.t = Date.now();
        if (!cur.fav && !cur.rev && !cur.weak) delete all[id]; else all[id] = cur;
        save(all); draw();
      };
      menu.appendChild(b);
    });
    var a = document.createElement('a'); a.className = 'mark-list'; a.href = box.dataset.list; a.textContent = 'マイリストを見る →';
    menu.appendChild(a);
    box.appendChild(menu);
  }
  window.kaigoMarksDraw = draw;
  document.addEventListener('click', function (e) { if (open && !box.contains(e.target)) { open = false; draw(); } });
  draw();
})();
