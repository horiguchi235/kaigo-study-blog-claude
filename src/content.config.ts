import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.string(), // 大分類（例："2 からだのしくみと生活支援"）
    theme: z.string(), // テーマ（例："T18 排泄"）
    article: z.string(), // テーマ内の記事名（例："排泄②"）
    subjects: z.array(z.string()), // 対応科目
    // 科目ごとの過去問数（科目別目次ページで使う）
    subject_questions: z.record(z.string(), z.number()).default({}),
    past_questions: z.number(),
    ronten: z.array(z.string()).default([]),
    // true の間は本番サイトに表示しない（npm run dev では表示される）
    draft: z.boolean().default(false),
  }),
});

// 記事の翻訳（EPA候補者向け）。id は "<言語>/<記事ID>"（例：en/songen-01-rinen）
const translations = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/translations' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
  }),
});

export const collections = { articles, translations };
