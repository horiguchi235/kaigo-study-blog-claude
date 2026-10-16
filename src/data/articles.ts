import { getCollection, type CollectionEntry } from 'astro:content';

export type Article = CollectionEntry<'articles'>;

// 本番ビルドでは draft: true の記事を除外する。npm run dev では下書きも表示する。
export async function getArticles(): Promise<Article[]> {
  const all = await getCollection('articles', ({ data }) => (import.meta.env.PROD ? !data.draft : true));
  return all.sort((a, b) => a.id.localeCompare(b.id));
}
