// 記事中の <fig name="xxx"> を src/figures/xxx.json の図（SVG）に置き換える remark プラグイン。
// json が { svg, caption } なら1枚の図、{ title, steps: [{ svg, caption }] } ならステップ式の図になる。
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve('src/figures');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// 記事中の **太字** を <strong> に（キャプション用）
const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

function render(name, cap) {
  const file = path.join(dir, `${name}.json`);
  if (!fs.existsSync(file)) throw new Error(`figure not found: ${name}`);
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (d.steps) {
    const steps = d.steps
      .map((s, i) => `<div class="fstep" data-i="${i}"><div class="fstep-no">STEP ${i + 1} / ${d.steps.length}</div>${s.svg}<p class="fstep-cap">${inline(s.caption)}</p></div>`)
      .join('');
    return `<figure class="fig steps" aria-label="${esc(d.title)}"><div class="steps-title">▶ ${esc(d.title)}</div><div class="steps-body">${steps}</div>${d.note ? `<figcaption>${inline(d.note)}</figcaption>` : ''}</figure>`;
  }
  return `<figure class="fig">${d.svg}<figcaption>${inline(cap ?? d.caption)}</figcaption></figure>`;
}

function walk(node) {
  if (!node.children) return;
  node.children = node.children.map((c) => {
    if (c.type === 'html') {
      // caption="..." を付けると図の説明文を差し替える（翻訳ページ用）
      const m = c.value.trim().match(/^<fig name="([\w-]+)"(?:\s+caption="([^"]*)")?\s*\/?>$/);
      if (m) return { type: 'html', value: render(m[1], m[2]) };
      const ph = c.value.trim().match(/^<photo name="([\w-]+)" caption="([^"]*)"\s*\/?>$/);
      if (ph) {
        const base = (process.env.SITE_BASE ?? '/kaigo-study-blog-claude').replace(/\/$/, '');
        const cap = ph[2].replace(/<\/?strong>/g, '**');
        return { type: 'html', value: `<figure class="fig photo"><img src="${base}/images/${ph[1]}.webp" alt="${esc(cap.replace(/\*\*/g, ''))}" loading="lazy" width="1200" height="800"><figcaption>${inline(cap)}</figcaption></figure>` };
      }
    }
    walk(c);
    return c;
  });
}

export default function remarkFigures() {
  return (tree) => walk(tree);
}
