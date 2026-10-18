// 管理ページ「画像・図」：一覧・絞り込み・チェック＋メモ → ChatGPT依頼文 / Claudeへの合図を作る。
// チェックとメモはこのブラウザの localStorage "adminImg" に保存：{ [画像名]: { on: true, note: '...' } }
(function () {
  var D = JSON.parse(document.getElementById('adm-data').textContent);
  var base = document.documentElement.dataset.base || '/';
  var items = D.items, grid = document.getElementById('grid');
  var KEY = 'adminImg', st = {};
  try { st = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var STATUS = { used: '使用中', made: '作成済み・未配置', todo: '未作成' };
  var FOLDER = {
    photos: 'マイドライブ ＞ 介護福祉士ブログ ＞ 画像_ChatGPT',
    guide: 'マイドライブ ＞ 介護福祉士ブログ ＞ 画像_ChatGPT ＞ 使い方ページ',
    figures: 'マイドライブ ＞ 介護福祉士ブログ ＞ 画像_ChatGPT ＞ 記事の図',
  };
  var SETNAME = { photos: '記事の写真風イラスト', guide: '使い方ページの絵', figures: '記事の図' };
  var REF = { photos: '', guide: '参照画像「全身_10_OK.png」を添付してください。', figures: '参照画像「全身_10_OK.png」を添付してください。' };

  // ── カード ──
  items.forEach(function (it) {
    var c = document.createElement('article'); c.className = 'card-img k-' + it.kind + ' s-' + it.status; c.dataset.id = it.id;
    var thumb;
    if (it.kind === 'svg') thumb = '<div class="th th-svg">' + it.svg + '</div>';
    else if (it.file) thumb = '<a class="th" href="' + base + it.file + '" target="_blank" rel="noopener"><img loading="lazy" src="' + base + it.file + '" alt=""></a>';
    else thumb = '<div class="th th-none">未作成</div>';
    var places = (it.places || []).map(function (p) {
      var href = p.id === 'guide' ? base + 'guide/' : base + 'articles/' + p.id + '/';
      return '<li' + (p.ok === false ? ' class="warn" title="この見出しが記事に見つかりません（記事を直したあと）"' : '') + '><a href="' + href + '" target="_blank" rel="noopener">' + esc(p.label) + '</a> ' + esc(p.heading || '') + (p.ok === false ? ' ⚠' : '') + '</li>';
    }).join('');
    var tags = '<span class="tag k">' + esc(D.kinds[it.kind]) + '</span><span class="tag st">' + STATUS[it.status] + '</span>' +
      (it.pri ? '<span class="tag pri' + it.pri + '">' + it.pri + '</span>' : '') + (it.first ? '<span class="tag first">まず作る</span>' : '') +
      (it.shared ? '<span class="tag">共用</span>' : '') + (it.steps ? '<span class="tag">' + it.steps + 'コマ</span>' : '') +
      (it.log ? '<span class="tag green">差し替え ' + esc(it.log.date) + (it.log.n > 1 ? '（' + it.log.n + '回目）' : '') + '</span>' : '');
    c.innerHTML = thumb + '<div class="cb">' +
      '<label class="pick"><input type="checkbox"> <b>' + esc(it.id) + '</b></label>' +
      '<div class="tags">' + tags + '</div>' +
      (places ? '<ul class="pl">' + places + '</ul>' : (it.where ? '<p class="wh">' + esc(it.where) + '</p>' : '<p class="wh warn">どの記事にも置かれていません</p>')) +
      (it.prompt ? '<details class="pr"><summary>指示文を見る</summary><p>' + esc(it.prompt) + '</p>' + (it.overlay ? '<p class="ov"><b>重ねる文字：</b>' + esc(it.overlay) + '</p>' : '') + '</details>' : '') +
      '<textarea class="note" rows="2" placeholder="' + (it.status === 'todo' ? '追加の希望（なくてもOK）' : 'どこがおかしい？（例：手が6本指、文字が入っている）') + '"></textarea>' +
      '</div>';
    var cb = c.querySelector('.pick input'), note = c.querySelector('.note');
    var s = st[it.id] || {};
    cb.checked = !!s.on; note.value = s.note || ''; c.classList.toggle('on', !!s.on);
    cb.onchange = function () { st[it.id] = st[it.id] || {}; st[it.id].on = cb.checked; c.classList.toggle('on', cb.checked); save(); filter(); };
    note.oninput = function () { st[it.id] = st[it.id] || {}; st[it.id].note = note.value; if (note.value && !cb.checked) { cb.checked = true; st[it.id].on = true; c.classList.add('on'); } save(); count(); };
    it.el = c; grid.appendChild(c);
  });

  // ── 絞り込み ──
  var F = { kind: document.getElementById('f-kind'), status: document.getElementById('f-status'), pri: document.getElementById('f-pri'), art: document.getElementById('f-art'), q: document.getElementById('f-q'), checked: document.getElementById('f-checked') };
  var m = location.hash.match(/art=([\w-]+)/); if (m) F.art.value = m[1];
  function filter() {
    var k = F.kind.value, s = F.status.value, p = F.pri.value, a = F.art.value, q = F.q.value.trim(), only = F.checked.checked, n = 0;
    items.forEach(function (it) {
      var ok = (!k || it.kind === k) && (!s || it.status === s) &&
        (!p || (p === 'first' ? it.first : it.pri === p)) &&
        (!a || (it.places || []).some(function (x) { return x.id === a; })) &&
        (!only || (st[it.id] && st[it.id].on)) &&
        (!q || (it.id + ' ' + (it.prompt || '') + ' ' + (it.where || '') + ' ' + (it.places || []).map(function (x) { return x.label + x.heading; }).join(' ')).indexOf(q) >= 0);
      it.el.hidden = !ok; if (ok) n++;
    });
    document.getElementById('f-count').textContent = n + ' / ' + items.length + '件';
    count();
  }
  Object.keys(F).forEach(function (k) { F[k].addEventListener(k === 'q' ? 'input' : 'change', filter); });
  function picked() { return items.filter(function (it) { return st[it.id] && st[it.id].on; }); }
  function count() { document.getElementById('sel-n').textContent = picked().length + '件 選択中'; }
  filter();

  // ── 出力 ──
  var dlg = document.getElementById('out');
  function show(h, p, t) {
    document.getElementById('out-h').textContent = h; document.getElementById('out-p').textContent = p;
    document.getElementById('out-t').value = t; dlg.showModal();
  }
  document.getElementById('out-close').onclick = function () { dlg.close(); };
  document.getElementById('out-copy').onclick = function () {
    var ta = document.getElementById('out-t'); ta.select();
    try { navigator.clipboard.writeText(ta.value); } catch (e) { document.execCommand('copy'); }
    var b = this; b.textContent = '✅ コピーしました'; setTimeout(function () { b.textContent = '📋 コピー'; }, 1500);
  };
  function noteOf(it) { return ((st[it.id] && st[it.id].note) || '').trim(); }

  document.getElementById('mk-gpt').onclick = function () {
    var sel = picked().filter(function (it) { return it.set !== 'claude'; });
    if (!sel.length) { alert('ChatGPT で作る画像（写真風・使い方の絵・記事の図）にチェックを入れてください。SVG図・スライドは「Claudeへの合図」で直します。'); return; }
    var bySet = {};
    sel.forEach(function (it) { (bySet[it.set] = bySet[it.set] || []).push(it); });
    var out = [];
    Object.keys(bySet).forEach(function (set) {
      var list = bySet[set];
      out.push('════════ ' + SETNAME[set] + '（' + list.length + '枚） ════════');
      out.push('【最初に1度だけ貼る：共通ルール】' + (REF[set] ? '　※' + REF[set] : ''));
      out.push(D.rules[set]);
      out.push('');
      list.forEach(function (it, i) {
        var note = noteOf(it), remake = it.status !== 'todo';
        out.push('──── ' + (i + 1) + '. ' + it.id + '.png（' + (remake ? '作り直し' : '新規') + '）────');
        if (remake) out.push('前に作ったこの画像を添付します。次の点を直して、下の指示どおりに作り直してください。画像名は同じ「' + it.id + '.png」にしてください。\n直してほしい点：' + (note || '全体を、指示と共通ルールどおりに描き直してください。'));
        else if (note) out.push('追加の希望：' + note);
        out.push(it.prompt);
        out.push('');
      });
      out.push('（保存先：' + FOLDER[set] + '）');
      out.push('');
    });
    show('ChatGPT に送る依頼文', 'ChatGPT の会話の最初に「共通ルール」を1度だけ貼り、そのあと1枚ずつ指示を貼ってください。作り直しのときは前の画像も添付します。長くなったら新しい会話にして共通ルールから貼り直してください。', out.join('\n'));
  };

  document.getElementById('mk-claude').onclick = function () {
    var sel = picked();
    if (!sel.length) { alert('画像にチェックを入れてください'); return; }
    var gpt = sel.filter(function (it) { return it.set !== 'claude'; }), cl = sel.filter(function (it) { return it.set === 'claude'; });
    var out = [];
    if (gpt.length) {
      out.push('ChatGPT で次の画像を作りました（作り直しました）。ドライブから取り込んで、サイトの画像を差し替えてください。');
      var bySet = {};
      gpt.forEach(function (it) { (bySet[it.set] = bySet[it.set] || []).push(it); });
      Object.keys(bySet).forEach(function (set) {
        out.push('');
        out.push('■ ' + FOLDER[set]);
        bySet[set].forEach(function (it) {
          var where = (it.places || []).map(function (p) { return p.label + (p.heading ? '「' + p.heading + '」' : ''); }).join('、');
          out.push('・' + it.id + '.png' + (it.status === 'todo' ? '（新規。記事に置いて、重ねる文字も入れる）' : '（差し替え）') + (where ? '　置き場所：' + where : ''));
        });
      });
      out.push('');
      out.push('取り込んだら、崩れていないか確認して、プレビューを作り直してください。');
    }
    if (cl.length) {
      if (out.length) out.push('');
      out.push('次の図・スライドを直してください（Claude が作るもの）。');
      cl.forEach(function (it) {
        var where = (it.places || []).map(function (p) { return p.label + (p.heading ? '「' + p.heading + '」' : ''); }).join('、');
        out.push('・' + it.id + '（' + D.kinds[it.kind] + '）' + (where ? '　場所：' + where : '') + '\n　直してほしい点：' + (noteOf(it) || '（見て判断してください）'));
      });
    }
    show('Claude に送る合図', 'ChatGPT の画像をドライブに保存したあとで、この文を Claude に送ってください。', out.join('\n'));
  };

  document.getElementById('sel-clear').onclick = function () {
    if (!confirm('チェックとメモをすべて外しますか？')) return;
    st = {}; save();
    items.forEach(function (it) { it.el.classList.remove('on'); it.el.querySelector('.pick input').checked = false; it.el.querySelector('.note').value = ''; });
    filter();
  };
})();
