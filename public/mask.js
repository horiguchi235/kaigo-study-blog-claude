// 暗記モードで「かくす太字」を選ぶ。
// 何を聞かれているか分かるように、見出し語・表の行見出し・長すぎる語は残し、
// 1つの文（箇条書き1行・表の1マス）でかくすのは最大3つ、文字数の半分までにする。
(function () {
  var SKIP = 'th, h1, h2, h3, h4, h5, summary, figcaption, .fig, .freq, .badges, .breadcrumb, .study-links, .art-nav';
  var LABEL_NEXT = /^\s*[：:＝=（(→]/;
  function blockOf(el) { return el.closest('li, p, td, dd, blockquote') || el.parentElement; }
  function textLen(s) { return (s || '').replace(/\s+/g, '').length; }
  function isLeadLabel(s, block) {
    // ブロックの先頭にある太字で、すぐ後ろが「：」「＝」「（」などなら、それは問いの見出し語
    var prev = s.previousSibling;
    while (prev && prev.nodeType === 3 && !prev.textContent.trim()) prev = prev.previousSibling;
    var first = !prev || (prev.nodeType === 3 && /^[\s・\-]*$/.test(prev.textContent));
    if (!first) return false;
    var next = s.nextSibling;
    return !!(next && next.nodeType === 3 && LABEL_NEXT.test(next.textContent));
  }
  function rowLabel(s) {
    var td = s.closest('td'); if (!td) return false;
    var tr = td.parentElement;
    if (!tr || tr.children.length < 2 || tr.children[0] !== td) return false;
    // 「○ 正解」「答え」などの列は、1列目でも答えなのでかくす
    var th = td.closest('table').querySelector('thead th');
    return !(th && /[○◯〇]|正解|正しい|答え/.test(th.textContent));
  }
  window.kaigoMask = function (root) {
    var blocks = new Map();
    root.querySelectorAll('strong').forEach(function (s) {
      s.classList.remove('m');
      if (s.closest(SKIP)) return;
      var n = textLen(s.textContent);
      if (n === 0 || n > 24) return;
      if (rowLabel(s)) return;
      var b = blockOf(s);
      if (isLeadLabel(s, b)) return;
      if (!blocks.has(b)) blocks.set(b, []);
      blocks.get(b).push(s);
    });
    blocks.forEach(function (list, b) {
      var total = textLen(b.textContent);
      // 短いもの（数字・用語）からかくす。最大3つ、ブロックの文字数の半分まで
      var sorted = list.slice().sort(function (x, y) { return textLen(x.textContent) - textLen(y.textContent); });
      var used = 0, count = 0;
      sorted.forEach(function (s) {
        var n = textLen(s.textContent);
        if (count >= 3 || used + n > total * 0.5) return;
        s.classList.add('m'); used += n; count++;
      });
    });
  };
})();
