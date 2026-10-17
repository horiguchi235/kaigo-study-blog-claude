// 案内キャラクター（右下）。ページや操作に合わせて表情（ポーズ）とセリフを変える。
// 画像は public/chara/<pose>.webp。音声・口パクは今後（ElevenLabs など）に対応予定。
(function () {
  var h = document.documentElement;
  if (h.dataset.pageLang && h.dataset.pageLang !== 'ja') return; // まずは日本語ページだけ
  var base = (h.dataset.base || '/') + 'chara/';
  var hidden = false;
  try { hidden = localStorage.getItem('charaHidden') === '1'; } catch (e) {}

  var box = document.createElement('div');
  box.className = 'chara' + (hidden ? ' mini' : '');
  box.innerHTML =
    '<div class="chara-bubble" role="status" aria-live="polite"><p class="chara-text"></p><div class="chara-menu"></div>' +
    '<button type="button" class="chara-x" aria-label="しまう">×</button></div>' +
    '<button type="button" class="chara-btn" aria-label="案内キャラクター"><img alt="" width="120" height="160"></button>';
  document.body.appendChild(box);
  var img = box.querySelector('img'), text = box.querySelector('.chara-text'), menu = box.querySelector('.chara-menu');
  var POSES = ['base', 'hello', 'point', 'note', 'caution', 'think', 'idea', 'cheer', 'ok', 'study', 'question'];
  POSES.forEach(function (p) { var i = new Image(); i.src = base + p + '.webp'; }); // 先読み

  var timer;
  function say(pose, msg, links, keep) {
    img.src = base + pose + '.webp';
    box.classList.remove('bounce'); void box.offsetWidth; box.classList.add('bounce');
    text.textContent = msg;
    menu.innerHTML = '';
    (links || []).forEach(function (l) {
      var a = document.createElement(l.href ? 'a' : 'button');
      if (l.href) a.href = l.href; else { a.type = 'button'; a.onclick = l.fn; }
      a.textContent = l.label; menu.appendChild(a);
    });
    box.classList.add('talk');
    clearTimeout(timer);
    if (!keep) timer = setTimeout(function () { box.classList.remove('talk'); img.src = base + 'base.webp'; }, 7000);
  }

  var path = location.pathname;
  var isTop = !!document.querySelector('.guide-hero');
  var art = document.getElementById('art-body');
  var guideUrl = (h.dataset.base || '/') + 'guide/' + (h.dataset.idx || '');
  var mokuji = (h.dataset.base || '/') + (h.dataset.idx || '');

  function greet() {
    if (isTop) say('hello', 'こんにちは！ここでは、AIが過去問15年分を分析して作った教材で勉強できるよ。はじめてなら「使い方」から見てね。', [{ label: '🔰 使い方を見る', href: guideUrl }]);
    else if (art) say('point', 'まずは「📌 この記事のポイント」を開いてみよう。読み終わったら、見出しの下の過去問にチャレンジ！', [
      { label: '📌 ポイントを開く', fn: function () { var d = art.querySelector('details.sec'); if (d) { d.open = true; d.scrollIntoView({ behavior: 'smooth' }); } } },
    ]);
    else if (/\/guide\//.test(path)) say('note', '自分に合った始め方を選んでね。迷ったら、テーマ別目次の STEP 1 からがおすすめ！', [{ label: '📚 テーマ別目次へ', href: mokuji }]);
    else say('base', 'わからないことがあったら、わたしをタップしてね。', [{ label: '🔰 使い方', href: guideUrl }, { label: '📚 目次', href: mokuji }]);
  }

  box.querySelector('.chara-btn').addEventListener('click', function () {
    if (box.classList.contains('mini')) { box.classList.remove('mini'); try { localStorage.setItem('charaHidden', ''); } catch (e) {} }
    if (box.classList.contains('talk')) { box.classList.remove('talk'); return; }
    greet();
  });
  box.querySelector('.chara-x').addEventListener('click', function () {
    box.classList.remove('talk'); box.classList.add('mini');
    try { localStorage.setItem('charaHidden', '1'); } catch (e) {}
  });

  // 記事ページの操作に反応する
  if (art) {
    var answered = 0;
    art.addEventListener('toggle', function (e) {
      var d = e.target;
      if (!d.open || box.classList.contains('mini')) return;
      if (d.classList.contains('answer')) {
        answered++;
        var msgs = ['正解できたかな？まちがえた問題こそ、本文に戻ると力になるよ。', 'いいペース！その調子で次の見出しも見てみよう。', 'すごい、どんどん解けてるね！'];
        say(answered % 3 === 0 ? 'cheer' : 'ok', msgs[(answered - 1) % msgs.length]);
      } else if (d.classList.contains('quiz') || (d.tagName === 'DETAILS' && !d.classList.contains('sec') && /過去問/.test(d.querySelector('summary').textContent))) {
        say('think', 'どれだと思う？選んでから「正解を見る」を開いてね。');
      }
    }, true);
    var mask = document.querySelector('.mask-toggle');
    if (mask) mask.addEventListener('click', function () {
      if (box.classList.contains('mini')) return;
      if (document.querySelector('.article.masked')) say('study', 'オレンジのところをタップすると答えが出るよ。思い出してからタップしてね。');
    });
    var nav = document.getElementById('art-nav'), done = false;
    if (nav && 'IntersectionObserver' in window) new IntersectionObserver(function (es) {
      if (done || box.classList.contains('mini') || !es[0].isIntersecting) return;
      done = true;
      var next = nav.querySelector('.next:not(.none)');
      say('cheer', 'おつかれさま！1記事読み終わったね。次の記事へ進もう！', next ? [{ label: '次の記事へ →', href: next.href }] : null);
    }).observe(nav);
  }

  img.src = base + 'base.webp';
  if (!hidden) setTimeout(greet, 900);
})();
