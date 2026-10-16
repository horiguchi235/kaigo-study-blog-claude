// 1問1答・暗記シートのデータ（tools/study/make.py で記事から自動生成）
import data from './study.json';

export type QA = { t: 'ox' | 'card'; q: string; a?: string; ans?: '○' | '×'; exp: string; sec: string; src: string };
export type SheetTable = { h: string; head: string[]; rows: string[][] };
export type Study = { title: string; article: string; qa: QA[]; sheet: SheetTable[]; concl: string[] };

const all = data as unknown as Record<string, Study>;
export const studyOf = (id: string): Study | undefined => all[id];
