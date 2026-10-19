// 管理ページ「画像・図」：記事ごとの画像一覧 → 崩れた画像を選ぶ → ChatGPT 修正プロンプト / Claude への合図を作る。
// チェック・問題点・メモはこのブラウザの localStorage "adminImg" に保存：{ [画像名]: { on, note, probs: [..] } }
(function () {
  var D = JSON.parse(document.getElementById('adm-data').textContent);
  var base = document.documentElement.dataset.base || '/';
  var items = D.items, box = document.getElementById('groups');
  var KEY = 'adminImg', st = {};
  try { st = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }
  function S(id) { return (st[id] = st[id] || {}); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function plain(s) { return String(s || '').replace(/\*\*/g, ''); }
  var STATUS = { used: '使用中', made: '作成済み・未配置', todo: 'ChatGPTで作成待ち', plan: '候補（未作成）' };
  var GPT = { photo: 1, guide: 1 };
  var SETNAME = { photos: '記事の画像', guide: '使い方ページの絵' };

  // 問題点 → 修正プロンプトに入れる「直し方」と「追加の確認」
  var PROBS = [
    ['person', '指示にない人・キャラクター・手が入っている', '人物・キャラクター・手・顔は、指示に書いたもの以外は一切描かない。指示の物だけを描く', '指示にない人・手・顔が1つもない'],
    ['text', '文字・数字・記号・ロゴが入っている', '文字・数字・記号・ロゴは一切入れない。画面・紙・ラベル・表示板の部分は無地か図形だけにする', 'どこにも文字・数字・記号・ロゴがない'],
    ['frame', '空の枠・吹き出し・名札・矢印がある', '空の枠・吹き出し・名札・矢印・○×などの飾りは描かない', '空の枠・吹き出し・飾りがない'],
    ['broken', '物の形が崩れている（部品の欠け・余分な部品・ありえないつながり）', '実物の形を思い浮かべ、部品の数とつながり方を1つずつ確かめてから描く。省略も創作もしない', '部品の欠け・余分な部品・ありえないつながりがない'],
    ['count', '数が指示と違う', '指示の数だけを描く。描いたあとに数を数えて確かめる', '物の数が指示どおり'],
    ['dir', '向き・左右・順番が指示と違う', '描く前に、指示の向き・左右・並び順を確かめる（左右は見る人から見た左右）', '向き・左右・並び順が指示どおり'],
    ['hand', '手・指が不自然', '手を描くときは、どの手も指を5本、自然な形で描く', 'どの手も指が5本で自然な形'],
    ['cut', '画面の端で切れている', '全体を画面の中に収め、まわりに余白をとる', 'どの物も画面の端で切れていない'],
    ['unclear', '何を伝える画像か分かりにくい', '指示の物を画面の中央に大きく描き、背景・小物を減らす', '指示の物が中央に大きく、はっきり見える'],
    ['style', '絵柄がほかとそろっていない（写真風・3D風・濃い色など）', 'やさしいフラットなイラスト、細めの線、陰影は控えめ、落ち着いた中間色、背景は白にする', '写真風・3D風になっていない'],
  ];
  var PMAP = {}; PROBS.forEach(function (p) { PMAP[p[0]] = p; });

  // ── 記事ごとにまとめる ──
  var groups = [{ id: 'guide', label: '使い方ページ', title: '', list: [] }];
  var byArt = { guide: groups[0] };
  D.articles.forEach(function (a) { var g = { id: a.id, label: a.label, title: a.title, draft: a.draft, list: [] }; byArt[a.id] = g; groups.push(g); });
  var unplaced = { id: '_none', label: 'どの記事にも置かれていないもの', title: '', list: [] };
  items.forEach(function (it) {
    var pl = it.places || [];
    if (!pl.length) unplaced.list.push({ it: it, p: null });
    pl.forEach(function (p) { (byArt[p.id] || unplaced).list.push({ it: it, p: p }); });
  });
  if (unplaced.list.length) groups.push(unplaced);
  var ORDER = { photo: 0, guide: 0, shot: 1, svg: 2, svgplan: 3 };

  var cards = []; // { it, el, g }
  groups.forEach(function (g) {
    if (!g.list.length) return;
    g.list.sort(function (x, y) { return ORDER[x.it.kind] - ORDER[y.it.kind]; });
    var sec = document.createElement('details'); sec.className = 'ag'; sec.open = true; sec.dataset.art = g.id;
    var n = function (f) { return g.list.filter(function (x) { return f(x.it); }).length; };
    var href = g.id === 'guide' ? base + 'guide/' : g.id === '_none' ? '' : base + 'articles/' + g.id + '/';
    sec.innerHTML = '<summary><b>' + esc(g.label) + '</b>' + (g.title ? '<span class="ag-t">' + esc(g.title) + '</span>' : '') +
      (g.draft ? '<span class="tag gray">下書き</span>' : '') +
      '<span class="ag-n">' + [['画像', function (i) { return GPT[i.kind] || i.kind === 'shot'; }], ['SVG図', function (i) { return i.kind === 'svg'; }], ['SVG候補', function (i) { return i.kind === 'svgplan'; }]]
        .map(function (c) { var k = n(c[1]); return k ? c[0] + ' ' + k : ''; }).filter(Boolean).join('・') + '</span>' +
      (href ? ' <a href="' + href + '" target="_blank" rel="noopener">記事を開く</a>' : '') + '</summary><div class="adm-grid"></div>';
    var grid = sec.querySelector('.adm-grid');
    g.list.forEach(function (x) { var el = card(x.it, x.p); grid.appendChild(el); cards.push({ it: x.it, el: el, g: g, sec: sec }); });
    g.sec = sec; box.appendChild(sec);
  });

  function card(it, p) {
    var c = document.createElement('article'); c.className = 'card-img k-' + it.kind + ' s-' + it.status; c.dataset.id = it.id;
    var thumb;
    if (it.kind === 'svg') thumb = '<div class="th th-svg">' + it.svg + '</div>';
    else if (it.file) thumb = '<a class="th" href="' + base + it.file + '" target="_blank" rel="noopener"><img loading="lazy" src="' + base + it.file + '" alt=""></a>';
    else thumb = '<div class="th th-none">' + (it.kind === 'svgplan' ? 'Claudeの図（候補）' : 'まだ画像がありません') + '</div>';
    var tags = '<span class="tag k">' + esc(D.kinds[it.kind]) + '</span><span class="tag st">' + STATUS[it.status] + '</span>' +
      (it.pri ? '<span class="tag pri' + it.pri + '">' + it.pri + '</span>' : '') + (it.steps ? '<span class="tag">' + it.steps + 'コマ</span>' : '') +
      ((it.places || []).length > 1 ? '<span class="tag">' + it.places.length + '記事で共用</span>' : '') +
      (it.log ? '<span class="tag green">差し替え ' + esc(it.log.date) + (it.log.n > 1 ? '（' + it.log.n + '回目）' : '') + '</span>' : '');
    var info = '';
    if (p && p.heading) info += '<p class="wh">場所：' + esc(p.heading) + (p.ok === false ? ' <span class="warn">⚠ 見出しが記事にない</span>' : '') + '</p>';
    if (p && p.caption) info += '<p class="cap">' + esc(plain(p.caption)) + '</p>';
    if (it.kind === 'svgplan') info += '<p class="cap">' + esc(plain(it.where || '')) + (it.memo ? '<br><b>メモ：</b>' + esc(it.memo) : '') + '</p>';
    else if (it.where && !p) info += '<p class="cap">' + esc(it.where) + '</p>';
    var probs = GPT[it.kind] ? '<details class="probs"' + ((S(it.id).probs || []).length ? ' open' : '') + '><summary>どこがおかしい？（選ぶと修正プロンプトに入ります）</summary>' +
      PROBS.map(function (q) { return '<label><input type="checkbox" value="' + q[0] + '"> ' + esc(q[1]) + '</label>'; }).join('') + '</details>' : '';
    c.innerHTML = thumb + '<div class="cb">' +
      '<label class="pick"><input type="checkbox"> <b>' + esc(it.id) + '</b></label>' +
      '<div class="tags">' + tags + '</div>' + info +
      (it.prompt ? '<details class="pr"><summary>今の指示文を見る</summary><p>' + esc(it.prompt).replace(/\n/g, '<br>') + '</p></details>' : '') + probs +
      '<textarea class="note" rows="2" placeholder="' + (it.kind === 'svgplan' ? '作るときの希望（なくてもOK）' : it.status === 'todo' ? '追加の希望（なくてもOK）' : 'ほかに気になる点（例：車輪の位置がおかしい）') + '"></textarea>' +
      '</div>';
    var cb = c.querySelector('.pick input'), note = c.querySelector('.note');
    cb.onchange = function () { S(it.id).on = cb.checked; save(); sync(it.id); };
    note.oninput = function () { var s = S(it.id); s.note = note.value; if (note.value && !s.on) s.on = true; save(); sync(it.id, note); };
    c.querySelectorAll('.probs input').forEach(function (inp) {
      inp.onchange = function () {
        var s = S(it.id), set = (s.probs || []).filter(function (v) { return v !== inp.value; });
        if (inp.checked) { set.push(inp.value); s.on = true; }
        s.probs = set; save(); sync(it.id);
      };
    });
    return c;
  }

  // 同じ画像が複数の記事に出るので、状態を全カードにそろえる
  function sync(id, except) {
    var s = st[id] || {};
    cards.forEach(function (x) {
      if (x.it.id !== id) return;
      x.el.classList.toggle('on', !!s.on);
      x.el.querySelector('.pick input').checked = !!s.on;
      var nt = x.el.querySelector('.note'); if (nt !== except) nt.value = s.note || '';
      x.el.querySelectorAll('.probs input').forEach(function (inp) { inp.checked = (s.probs || []).indexOf(inp.value) >= 0; });
    });
    count();
  }

  // ── 絞り込み ──
  var F = { show: document.getElementById('f-show'), art: document.getElementById('f-art'), q: document.getElementById('f-q'), checked: document.getElementById('f-checked') };
  var m = location.hash.match(/art=([\w-]+)/); if (m) F.art.value = m[1];
  function filter() {
    var sh = F.show.value, a = F.art.value, q = F.q.value.trim(), only = F.checked.checked, n = 0, seen = {};
    cards.forEach(function (x) {
      var it = x.it;
      var ok = (!sh || (sh === 'gpt' ? GPT[it.kind] : sh === 'todo' ? GPT[it.kind] && it.status === 'todo' : sh === 'used' ? it.status === 'used' && it.kind !== 'svg' : it.kind === sh)) &&
        (!a || x.g.id === a) && (!only || (st[it.id] && st[it.id].on)) &&
        (!q || (it.id + ' ' + (it.prompt || '') + ' ' + (it.where || '') + ' ' + x.el.textContent).indexOf(q) >= 0);
      x.el.hidden = !ok; if (ok && !seen[it.id]) { seen[it.id] = 1; n++; }
    });
    groups.forEach(function (g) { if (g.sec) g.sec.hidden = !g.sec.querySelector('.card-img:not([hidden])'); });
    document.getElementById('f-count').textContent = n + '件';
    count();
  }
  Object.keys(F).forEach(function (k) { F[k].addEventListener(k === 'q' ? 'input' : 'change', filter); });
  function picked() { var seen = {}; return items.filter(function (it) { if (seen[it.id] || !(st[it.id] && st[it.id].on)) return false; seen[it.id] = 1; return true; }); }
  function count() { document.getElementById('sel-n').textContent = picked().length + '件 選択中'; }
  items.forEach(function (it) { if (st[it.id]) sync(it.id); });
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
  function probsOf(it) { return ((st[it.id] && st[it.id].probs) || []).map(function (k) { return PMAP[k]; }).filter(Boolean); }
  function fileName(it) { return it.id + '.png'; }
  function where(it) { return (it.places || []).map(function (p) { return p.label + (p.heading ? '「' + p.heading + '」' : ''); }).join('、'); }

  document.getElementById('mk-gpt').onclick = function () {
    var sel = picked().filter(function (it) { return GPT[it.kind]; });
    if (!sel.length) { alert('ChatGPT で作る画像（記事の画像・使い方の絵）にチェックを入れてください。SVG図・候補は「Claudeへの合図」で頼みます。'); return; }
    var bySet = {};
    sel.forEach(function (it) { (bySet[it.set] = bySet[it.set] || []).push(it); });
    var out = [];
    Object.keys(bySet).forEach(function (set, si) {
      var list = bySet[set], folder = D.folders[set];
      if (si) out.push('\n\n');
      out.push('════════ ' + SETNAME[set] + 'の修正依頼（' + list.length + '枚）════════');
      out.push('（ここから下を、ChatGPTの新しい会話にそのまま貼ってください）');
      out.push('');
      out.push(D.rules[set]);
      out.push('');
      out.push('────────────────────────────');
      out.push('次の' + list.length + '枚を、1枚ずつ作り直してください（「新規」は初めて作る画像です）。作り直しの画像は、前に作った画像を添付するので、問題点を直してください。添付がないときは、指示から新しく作ってください。');
      out.push('どの画像も、上の「1枚ごとの確認」を行い、さらに各画像の「追加で確認すること」も確かめてください。満たせない画像は「できた」と言わず、最後の【作成結果の報告】の「作れなかった画像」に、守れなかった点を書いてください。');
      out.push('保存先（私が保存します）：' + folder);
      out.push('ファイル名は各画像の「画像名」と一字も違わないようにしてください。同じ名前で上書き保存します。');
      list.forEach(function (it, i) {
        var probs = probsOf(it), note = noteOf(it), remake = it.status !== 'todo';
        out.push('');
        out.push('■ ' + (i + 1) + '枚目　画像名：' + fileName(it) + '（' + (remake ? '作り直し・前の画像を添付' : '新規') + '）');
        out.push('保存先：' + folder + ' ＞ ' + fileName(it) + (remake ? '（上書き）' : ''));
        if (remake || probs.length || note) {
          if (probs.length || note) {
            out.push(remake ? '前の画像の問題点：' : '気をつけること（ほかの画像で起きた問題）：');
            probs.forEach(function (q) { out.push('・' + q[1]); });
            if (note) out.push('・' + note);
            if (probs.length) { out.push('直し方：'); probs.forEach(function (q) { out.push('・' + q[2]); }); }
          } else if (remake) out.push('前の画像の問題点：全体を見直し、指示と共通ルールのとおりに描き直してください。');
        }
        out.push('指示：');
        out.push(it.prompt);
        if (probs.length) { out.push('追加で確認すること：'); probs.forEach(function (q) { out.push('・' + q[3]); }); }
      });
      out.push('');
      out.push('全部終わったら（または途中で「報告して」と言ったら）、【作成結果の報告】を書いてください。');
    });
    show('ChatGPT に貼る修正プロンプト', '新しい会話に全部まとめて貼ってください（作り直しの画像は、前の画像も一緒に添付）。できた画像は書かれた保存先に同じ名前で上書きし、ChatGPT の【作成結果の報告】をコピーして「Claudeへの合図」と一緒に送ってください。', out.join('\n'));
  };

  document.getElementById('mk-claude').onclick = function () {
    var sel = picked();
    if (!sel.length) { alert('画像にチェックを入れてください'); return; }
    var gpt = sel.filter(function (it) { return GPT[it.kind]; }), fig = sel.filter(function (it) { return it.kind === 'svg' || it.kind === 'shot'; }), plan = sel.filter(function (it) { return it.kind === 'svgplan'; });
    var out = [];
    if (gpt.length) {
      out.push('ChatGPT で次の画像を作りました（作り直しました）。ドライブから取り込み、1枚ずつ崩れていないか確認してから、サイトの画像を差し替えてください。');
      var bySet = {};
      gpt.forEach(function (it) { (bySet[it.set] = bySet[it.set] || []).push(it); });
      Object.keys(bySet).forEach(function (set) {
        out.push('');
        out.push('■ ' + D.folders[set]);
        bySet[set].forEach(function (it) { out.push('・' + fileName(it) + (it.status === 'todo' ? '（新規）' : '（差し替え）') + '　置き場所：' + (where(it) || 'なし')); });
      });
      out.push('');
      out.push('【ChatGPT の作成結果の報告】');
      out.push('（ここに ChatGPT の報告を貼る）');
    }
    if (fig.length) {
      if (out.length) out.push('');
      out.push('次の図・スライドを直してください（Claude が作るもの）。');
      fig.forEach(function (it) { out.push('・' + it.id + '（' + D.kinds[it.kind] + '）　場所：' + (where(it) || 'なし') + '\n　直してほしい点：' + (noteOf(it) || '（見て判断してください）')); });
    }
    if (plan.length) {
      if (out.length) out.push('');
      out.push('次の図を SVG で作って、記事に置いてください（管理ページの「SVG図の候補」）。');
      plan.forEach(function (it) { out.push('・' + it.id + '　場所：' + (where(it) || 'なし') + (noteOf(it) ? '\n　希望：' + noteOf(it) : '')); });
    }
    show('Claude に送る合図', 'ChatGPT の画像はドライブに保存してから送ってください。ChatGPT の【作成結果の報告】も下の欄に貼ると、作れなかった画像の扱いも一緒に判断します。', out.join('\n'));
  };

  document.getElementById('sel-clear').onclick = function () {
    if (!confirm('チェック・問題点・メモをすべて外しますか？')) return;
    st = {}; save();
    items.forEach(function (it) { sync(it.id); });
    filter();
  };
})();
