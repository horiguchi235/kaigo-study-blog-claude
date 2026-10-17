// 日本語では「**約40℃**に」「**左（健側）**の」のように、記号の直後で ** を閉じると
// Markdown の規則上 太字にならない。残った **…** を <strong> に直す remark プラグイン。
const RE = /\*\*([^*\n]+?)\*\*/g;

function fixChildren(node) {
  if (!node.children) return;
  const out = [];
  for (const c of node.children) {
    if (c.type === 'text' && RE.test(c.value)) {
      RE.lastIndex = 0;
      let last = 0, m;
      while ((m = RE.exec(c.value))) {
        if (m.index > last) out.push({ type: 'text', value: c.value.slice(last, m.index) });
        out.push({ type: 'strong', children: [{ type: 'text', value: m[1] }] });
        last = m.index + m[0].length;
      }
      if (last < c.value.length) out.push({ type: 'text', value: c.value.slice(last) });
      continue;
    }
    if (c.type === 'html' && !c.value.includes('<svg') && !c.value.trimStart().startsWith('<fig')) {
      c.value = c.value.replace(RE, '<strong>$1</strong>');
    }
    if (c.type !== 'code' && c.type !== 'inlineCode') fixChildren(c);
    out.push(c);
  }
  node.children = out;
}

export default function remarkCjkBold() {
  return (tree) => fixChildren(tree);
}
