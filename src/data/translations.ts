import { getCollection, type CollectionEntry } from 'astro:content';
import type { Lang } from './i18n';

export type Translation = CollectionEntry<'translations'>;

// 翻訳の一覧。key = 記事ID、値 = その記事の言語ごとの翻訳
export async function getTranslations(): Promise<Map<string, Map<Lang, Translation>>> {
  const all = await getCollection('translations');
  const map = new Map<string, Map<Lang, Translation>>();
  for (const t of all) {
    const [lang, slug] = t.id.split('/') as [Lang, string];
    if (!map.has(slug)) map.set(slug, new Map());
    map.get(slug)!.set(lang, t);
  }
  return map;
}
