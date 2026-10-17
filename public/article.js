// 記事ページ：見出し（h2）ごとに折りたたむ。開いた直後は目次のように見出しだけが並ぶ。
// ボタンの文言は #art-body の data-open-all / data-close-all / data-hint で変えられる（翻訳ページ用）。
(function () {
  var body = document.getElementById('art-body'); if (!body) return;
  // 先頭の「**この記事のポイント**」も見出しにして、ほかの見出しと同じように開け閉めする
  var first = body.firstElementChild;
  if (first && first.tagName === 'P' && first.children.length === 1 && first.firstElementChild.tagName === 'STRONG' && first.textContent.trim() === first.firstElementChild.textContent.trim()) {
    var h = document.createElement('h2'); h.className = 'point-h'; h.textContent = '📌 ' + first.textContent.trim(); h.id = 'points';
    first.replaceWith(h);
  }
  var h2s = Array.prototype.filter.call(body.children, function (el) { return el.tagName === 'H2'; });
  if (h2s.length < 2) return;
  h2s.forEach(function (h) {
    var d = document.createElement('details'); d.className = 'sec';
    var sm = document.createElement('summary'); var inner = document.createElement('div'); inner.className = 'sec-body';
    h.before(d); sm.appendChild(h); d.appendChild(sm); d.appendChild(inner);
    while (d.nextSibling && !(d.nextSibling.tagName === 'H2')) inner.appendChild(d.nextSibling);
  });
  var secs = body.querySelectorAll('details.sec');
  var bar = document.createElement('div'); bar.className = 'sec-bar';
  var ds = body.dataset;
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
  // 本文中の「#見出し」へのリンクも開いてから飛ぶ
  body.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]'); if (!a) return;
    setTimeout(openHash, 0);
  });
})();
