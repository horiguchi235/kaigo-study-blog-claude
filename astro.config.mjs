// @ts-check
import { defineConfig } from 'astro/config';

// GitHub Pages（https://horiguchi235.github.io/kaigo-study-blog-claude/）で公開する設定。
// 独自ドメインを使う場合は site を変更し、base を削除する。
export default defineConfig({
  site: 'https://horiguchi235.github.io',
  base: '/kaigo-study-blog-claude',
});
