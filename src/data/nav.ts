// サイト内の並び順（前の記事・次の記事、左の目次で使う）
import type { Article } from './articles';
import { categories, subjects, themeIdOf, levelOf, shortTitle, url } from './taxonomy';

export type NavItem = { id: string; title: string; article: string; href: string };

const item = (a: Article): NavItem => ({ id: a.id, title: shortTitle(a.data.title), article: a.data.article, href: url(`articles/${a.id}/`) });

// テーマ別目次（勉強順）
export function roadmap(articles: Article[]): Article[] {
  const out: Article[] = [];
  for (const c of categories) for (const t of c.themes) out.push(...articles.filter((a) => themeIdOf(a.data.theme) === t.id));
  return out;
}

// 「どこから来たか」ごとの並び。キー：'' = テーマ別、's-<科目slug>' = 科目別、'lv' = 重要度別
export function sequences(articles: Article[]) {
  const road = roadmap(articles);
  const seq: Record<string, { label: string; back: string; items: NavItem[] }> = {
    '': { label: 'テーマ別目次', back: url(''), items: road.map(item) },
    lv: {
      label: '重要度別の目次',
      back: url('level/'),
      items: [3, 2, 1].flatMap((lv) => road.filter((a) => levelOf(themeIdOf(a.data.theme)) === lv)).map(item),
    },
  };
  for (const s of subjects) {
    seq[`s-${s.slug}`] = { label: `${s.name}の目次`, back: url(`subjects/${s.slug}/`), items: road.filter((a) => a.data.subjects.includes(s.name)).map(item) };
  }
  return seq;
}
