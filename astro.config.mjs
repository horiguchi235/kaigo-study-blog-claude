// @ts-check
import { defineConfig } from 'astro/config';
import remarkFigures from './src/plugins/figures.mjs';

// GitHub Pages（https://horiguchi235.github.io/kaigo-study-blog-claude/）で公開する設定。
// 独自ドメインを使う場合は site を変更し、base を削除する。
export default defineConfig({
  site: 'https://horiguchi235.github.io',
  // 確認用ビルドでは SITE_BASE で base を差し替える。
  base: process.env.SITE_BASE ?? '/kaigo-study-blog-claude',
  markdown: { remarkPlugins: [remarkFigures] },
});
