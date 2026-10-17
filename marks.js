// 記事の印（⭐お気に入り・🔁復習・⚠苦手）。このブラウザの localStorage "marks" に保存する。
// 保存形式：{ [記事ID]: { title, fav, rev, weak, t } }
(function () {
  var KINDS = [
    { k: 'fav', on: '⭐ お気に入り', off: '☆ お気に入り' },
    { k: 'rev', on: '🔁 復習する', off: '🔁 復習に入れる' },
    { k: 'weak', on: '⚠ 苦手', off: '⚠ 苦手に入れる' },
  ];
  function load() { try { return JSON.parse(localStorage.getItem('marks') || '{}'); } catch (e) { return {}; } }
  function save(m) { try { localStorage.setItem('marks', JSON.stringify(m)); } catch (e) {} }
  window.kaigoMarks = { load: load, save: save, KINDS: KINDS };

  var box = document.getElementById('marks'); if (!box) return;
  var id = box.dataset.id, title = box.dataset.title;
  function draw() {
    var m = load()[id] || {};
    box.innerHTML = '';
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
      box.appendChild(b);
    });
    var a = document.createElement('a'); a.className = 'mark-list'; a.href = box.dataset.list; a.textContent = '一覧を見る →';
    box.appendChild(a);
  }
  draw();
})();
