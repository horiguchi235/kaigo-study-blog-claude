// 図・写真をタップすると全画面で拡大表示する（スマホで図の文字が小さくて読めないため）。
// ＋／－で倍率を変え、拡大中は指で上下左右にスクロールできる。閉じるは × か背景・Esc。
(function () {
  var figs = document.querySelectorAll('figure.fig');
  if (!figs.length) return;
  var ov = null, stage, inner, zoom = 1;
  function build() {
    ov = document.createElement('div'); ov.className = 'zoom-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', '図の拡大表示');
    ov.innerHTML = '<div class="zoom-bar"><button type="button" class="zm" aria-label="小さく">－</button><span class="zv">100%</span><button type="button" class="zp" aria-label="大きく">＋</button><button type="button" class="zx" aria-label="閉じる">× 閉じる</button></div><div class="zoom-stage"><div class="zoom-inner"></div></div><p class="zoom-cap"></p>';
    document.body.appendChild(ov);
    stage = ov.querySelector('.zoom-stage'); inner = ov.querySelector('.zoom-inner');
    ov.querySelector('.zm').onclick = function () { set(zoom / 1.5); };
    ov.querySelector('.zp').onclick = function () { set(zoom * 1.5); };
    ov.querySelector('.zx').onclick = close;
    stage.addEventListener('click', function (e) { if (e.target === stage) close(); });
    document.addEventListener('keydown', function (e) { if (ov.classList.contains('on') && e.key === 'Escape') close(); });
  }
  function set(z) {
    zoom = Math.max(1, Math.min(4, z));
    inner.style.width = (zoom * 100) + '%';
    ov.querySelector('.zv').textContent = Math.round(zoom * 100) + '%';
  }
  function close() { ov.classList.remove('on'); document.documentElement.classList.remove('zoom-lock'); inner.innerHTML = ''; }
  function openFig(f) {
    if (!ov) build();
    var media = f.querySelector('.fstep.on svg') || f.querySelector('svg, img'); if (!media) return;
    var c = media.cloneNode(true);
    if (c.tagName === 'IMG') c.removeAttribute('loading');
    inner.innerHTML = ''; inner.appendChild(c);
    var cap = f.querySelector('figcaption');
    ov.querySelector('.zoom-cap').textContent = cap ? cap.textContent : '';
    // スマホは最初から2倍（文字が読める大きさ）にする
    set(window.innerWidth < 700 && c.tagName !== 'IMG' ? 2 : 1);
    ov.classList.add('on'); document.documentElement.classList.add('zoom-lock');
    stage.scrollTop = 0; stage.scrollLeft = 0;
  }
  figs.forEach(function (f) {
    var media = f.querySelector('svg, img'); if (!media) return;
    f.classList.add('zoomable');
    var hint = document.createElement('button'); hint.type = 'button'; hint.className = 'zoom-btn'; hint.textContent = '🔍 拡大';
    hint.setAttribute('aria-label', '図を拡大して見る');
    f.appendChild(hint);
    hint.addEventListener('click', function (e) { e.stopPropagation(); openFig(f); });
    f.querySelectorAll('svg, img').forEach(function (m) { m.addEventListener('click', function () { openFig(f); }); });
  });
})();
