// 分野別・科目別の1問1答（IchimonDeck.astro）。
// 出題のしかた：fwd＝用語・人物→説明、rev＝説明→用語・人物、ox＝○×。
// 結果は記事ごとの1問1答と同じ localStorage "qa" に保存：{ [記事ID]: { title, ans: { [番号]: 1/0, [番号+'r']: 1/0 }, t } }
(function () {
  var D = JSON.parse(document.getElementById('qd-data').textContent);
  var RUBY = document.documentElement.classList.contains('ruby');
  // ふりがなモードでは、ビルドで付けたルビ（_r）を使う
  function f(it, k) { return RUBY && it._r && it._r[k] != null ? window.kaigoRuby(it._r[k]) : it[k]; }
  // ほぼ同じ文の問題は1問にまとめる
  (function () { var seen = {}; D.items = D.items.filter(function (it) { var k = it.t + '|' + String(it.q).replace(/<[^>]+>|[\s。、]/g, ''); if (seen[k]) return false; seen[k] = 1; return true; }); })();
  var list = document.getElementById('qd-list');
  var mode = 'fwd';
  try { mode = localStorage.getItem('qdMode') || 'fwd'; } catch (e) {}
  function load() { try { return JSON.parse(localStorage.getItem('qa') || '{}'); } catch (e) { return {}; } }
  function key(it) { return mode === 'rev' ? it.i + 'r' : String(it.i); }
  function save(it, ok) {
    var all = load(), r = all[it.a] || { ans: {} };
    r.ans[key(it)] = ok ? 1 : 0; r.title = D.titles[it.a] || it.lb; r.t = Date.now(); all[it.a] = r;
    try { localStorage.setItem('qa', JSON.stringify(all)); } catch (e) {}
  }
  function pool() {
    return D.items.filter(function (it) { return mode === 'ox' ? it.t === 'ox' : mode === 'rev' ? !!it.rq : it.t === 'card'; });
  }
  var done = 0, ok = 0;
  function score(n) {
    document.getElementById('qd-done').textContent = done; document.getElementById('qd-ok').textContent = ok;
    if (n != null) document.getElementById('qd-total').textContent = n;
    var l = document.getElementById('qd-okl'); if (l) l.textContent = mode === 'ox' ? '正解' : '覚えた';
  }
  // 前回までの記録（再読み込みしても見えるように）
  function past() {
    var all = load(), p = pool(), a = 0, g = 0;
    p.forEach(function (it) { var v = (all[it.a] && all[it.a].ans || {})[key(it)]; if (v !== undefined) { a++; if (v) g++; } });
    var el = document.getElementById('qd-past'); if (!el) return;
    el.hidden = !a;
    el.innerHTML = '📒 前回までの記録（この出題のしかた）：' + p.length + '問中 <b>' + a + '問</b>に答えて、' + (mode === 'ox' ? '正解' : '「覚えた」') + ' <b>' + g + '問</b>' + (a - g ? '、' + (mode === 'ox' ? 'まちがい' : '「もう一度」') + ' <b class="ng">' + (a - g) + '問</b>（範囲「前回まちがえた問題」で解き直せます）' : '');
  }
  function start() {
    var all = load(), p = pool(), scope = document.getElementById('qd-scope').value;
    if (scope !== 'all') p = p.filter(function (it) {
      var v = (all[it.a] && all[it.a].ans || {})[key(it)];
      return scope === 'new' ? v === undefined : v === 0;
    });
    if (document.getElementById('qd-order').value === 'rand') {
      p = p.slice(); for (var i = p.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = p[i]; p[i] = p[j]; p[j] = t; }
    }
    var n = +document.getElementById('qd-n').value; if (n) p = p.slice(0, n);
    done = 0; ok = 0; score(p.length); past();
    list.innerHTML = '';
    var msg = document.getElementById('qd-msg');
    msg.textContent = p.length ? '' : (scope === 'wrong' ? '前回まちがえた問題はありません 🎉' : scope === 'new' ? 'すべて答えました 🎉' : '問題がありません');
    p.forEach(function (it) {
      var li = document.createElement('li'); li.className = 'qa';
      var q, a;
      if (mode === 'rev') { q = f(it, 'rq'); a = '<p class="qa-a">' + f(it, 'ra') + '</p>'; }
      else if (mode === 'fwd') { q = f(it, 'q'); a = '<p class="qa-a">' + f(it, 'an') + '</p>'; }
      else { q = f(it, 'q'); a = '<p class="qa-res"><b class="mark">' + it.ox + '</b><span class="judge"></span></p>'; }
      var act = mode === 'ox'
        ? '<div class="qa-act"><button type="button" class="ox" data-v="○">○</button><button type="button" class="ox" data-v="×">×</button></div>'
        : '<div class="qa-act"><button type="button" class="show">答えを見る</button></div>';
      li.innerHTML = '<div class="qa-sec"><a href="' + it.h + '?h=' + encodeURIComponent(it.sec) + '" title="記事のこの見出しを読む">📖 ' + f(it, 'lb') + ' ' + f(it, 'sec') + '</a></div><div class="qa-q">' + q + '</div>' + act +
        '<div class="qa-ans">' + a + (it.exp ? '<p class="qa-exp">' + f(it, 'exp') + '</p>' : '') +
        (mode === 'ox' ? '' : '<div class="qa-self"><button type="button" class="self" data-v="1">覚えた</button><button type="button" class="self" data-v="0">もう一度</button></div>') + '</div>';
      li._it = it; list.appendChild(li);
    });
    var end = document.getElementById('qd-end'); end.hidden = true;
  }
  list.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var li = b.closest('.qa'); if (li.classList.contains('answered')) return;
    var it = li._it;
    if (b.classList.contains('ox')) {
      var right = b.dataset.v === it.ox;
      li.querySelector('.judge').textContent = right ? '　正解！' : '　残念…答えは「' + it.ox + '」';
      li.classList.add('open'); fin(li, right);
    } else if (b.classList.contains('show')) li.classList.add('open');
    else if (b.classList.contains('self')) fin(li, b.dataset.v === '1');
  });
  function fin(li, right) {
    li.classList.add('answered', right ? 'right' : 'wrong'); done++; if (right) ok++; score();
    save(li._it, right);
    var n = list.children.length;
    if (done === n && n) {
      var end = document.getElementById('qd-end'); end.hidden = false;
      end.innerHTML = '<b>' + ok + ' / ' + n + '問 ' + (mode === 'ox' ? '正解' : '覚えた') + '</b>　<button type="button" id="qd-again">もう一度（同じ条件で）</button> <button type="button" id="qd-wrong">まちがえた問題だけ</button>';
      document.getElementById('qd-again').onclick = function () { start(); window.scrollTo(0, list.offsetTop - 120); };
      document.getElementById('qd-wrong').onclick = function () { if (ok === n) { document.getElementById('qd-msg').textContent = '🎉 まちがえた問題はありません'; return; } document.getElementById('qd-scope').value = 'wrong'; start(); window.scrollTo(0, list.offsetTop - 120); };
    }
  }
  var tabs = document.querySelectorAll('.qd-modes button');
  function setMode(m) {
    mode = m; try { localStorage.setItem('qdMode', m); } catch (e) {}
    tabs.forEach(function (t) { t.setAttribute('aria-selected', t.dataset.m === m ? 'true' : 'false'); });
    start();
  }
  tabs.forEach(function (t) { t.onclick = function () { setMode(t.dataset.m); }; });
  ['qd-n', 'qd-order', 'qd-scope'].forEach(function (id) { document.getElementById(id).onchange = start; });
  document.getElementById('qd-start').onclick = start;
  setMode(mode);
})();
