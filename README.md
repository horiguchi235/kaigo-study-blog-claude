# 介護福祉士 過去問でつなぐ合格ノート

介護福祉士国家試験の過去問（第24〜38回）を分析し、科目横断のテーマ別に解説するブログです。[Astro](https://astro.build/) で作り、GitHub Pages で公開しています。

## 記事の追加・公開

1. `src/content/articles/` に Markdown ファイルを置く（ファイル名がURLになる。例：`haisetsu-01-benpi.md` → `/articles/haisetsu-01-benpi/`）
2. 先頭のメタ情報（frontmatter）を書く。項目は既存の記事と同じ
3. 内容を確認できるまでは `draft: true`。公開してよくなったら `draft: false` に変える
4. `main` ブランチに push すると、数分で自動的に公開される

`draft: true` の記事は本番サイトに出ません。`npm run dev` で手元で見るときは表示されます。

## 分類の更新

大分類・テーマ・科目の一覧は `src/data/taxonomy.ts` にあります。スプレッドシート「介護福祉士_論点整理」の分類を変えたら、ここも合わせて更新してください。

## 手元で動かす場合

```bash
npm install
npm run dev     # http://localhost:4321/kaigo-study-blog-claude/ で確認
npm run build   # dist/ に公開用ファイルを生成
```

## 初回だけ必要な設定

GitHub のリポジトリで **Settings → Pages → Build and deployment → Source** を **GitHub Actions** にする。
