import { getCollection, type CollectionEntry } from 'astro:content';

export type Article = CollectionEntry<'articles'>;

// 本番ビルドでは draft: true の記事を除外する。npm run dev と確認用ビルド（PUBLIC_SHOW_DRAFTS=1）では下書きも表示する。
export async function getArticles(): Promise<Article[]> {
  const all = await getCollection('articles', ({ data }) => (import.meta.env.PROD && !import.meta.env.PUBLIC_SHOW_DRAFTS ? !data.draft : true));
  return all.sort((a, b) => a.id.localeCompare(b.id));
}
