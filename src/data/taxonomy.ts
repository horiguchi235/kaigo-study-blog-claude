// ブログ全体の分類。スプレッドシート「介護福祉士_論点整理」の大分類・テーマ案と同じ内容。
// テーマ名・所属を変えたらここも合わせて更新する。

export type Theme = { id: string; name: string; questions: number };
export type Category = { no: number; name: string; lead: string; themes: Theme[] };

export const categories: Category[] = [
  {
    no: 1,
    name: '介護の土台（理念・倫理・権利）',
    lead: 'すべての科目の考え方の土台。最初に読む。',
    themes: [
      { id: 'T01', name: '尊厳・自立支援・介護の理念', questions: 97 },
      { id: 'T02', name: '権利擁護・虐待・成年後見・差別解消', questions: 41 },
      { id: 'T03', name: '介護福祉士の法律・倫理・個人情報', questions: 26 },
    ],
  },
  {
    no: 2,
    name: 'からだのしくみと生活支援',
    lead: '「しくみ」と「介助」をセットで。全体の約3割を占める最大の範囲。',
    themes: [
      { id: 'T15', name: 'ICF・リハビリ・廃用症候群', questions: 34 },
      { id: 'T16', name: '移動・移乗・からだの動き', questions: 71 },
      { id: 'T17', name: '食事・嚥下・栄養・口腔ケア', questions: 84 },
      { id: 'T18', name: '排泄', questions: 60 },
      { id: 'T19', name: '入浴・清潔・身じたく・皮膚', questions: 85 },
      { id: 'T20', name: '睡眠・休息', questions: 47 },
      { id: 'T21', name: '家事・住環境・福祉用具', questions: 57 },
      { id: 'T22', name: '終末期・看取り', questions: 43 },
      { id: 'T24', name: 'からだのしくみ基礎（神経・循環・感覚）', questions: 28 },
    ],
  },
  {
    no: 3,
    name: '高齢者・認知症・障害の理解',
    lead: '「どんな人を支えるのか」を理解する。病気→支援→制度のつながりの出発点。',
    themes: [
      { id: 'T23', name: 'こころのしくみ・高齢期の心理', questions: 46 },
      { id: 'T25', name: '発達と老化', questions: 36 },
      { id: 'T26', name: '高齢者に多い病気・服薬', questions: 52 },
      { id: 'T27', name: '認知症の原因疾患・症状', questions: 83 },
      { id: 'T28', name: '認知症ケア・家族支援・施策', questions: 66 },
      { id: 'T29', name: '障害の種類と特性', questions: 61 },
      { id: 'T30', name: '障害受容・家族支援・地域生活', questions: 46 },
    ],
  },
  {
    no: 4,
    name: '人と関わる技術（コミュニケーション・介護過程）',
    lead: '知識を実際の支援に結びつける技術。事例問題に強くなる。',
    themes: [
      { id: 'T09', name: 'チームケア・連携・職員の健康管理', questions: 38 },
      { id: 'T11', name: 'コミュニケーションの基本・自己覚知', questions: 92 },
      { id: 'T12', name: '障害・疾患別のコミュニケーション', questions: 23 },
      { id: 'T13', name: '記録・報告・会議', questions: 29 },
      { id: 'T14', name: '介護過程', questions: 119 },
    ],
  },
  {
    no: 5,
    name: '制度（社会保障・介護保険・障害福祉）',
    lead: '支援を支える制度。病気や支援の知識とつなげると覚えやすい。',
    themes: [
      { id: 'T04', name: '社会保障・社会福祉の基礎', questions: 39 },
      { id: 'T05', name: '人口・家族・統計', questions: 37 },
      { id: 'T06', name: '介護保険制度・地域包括ケア', questions: 64 },
      { id: 'T07', name: '障害者総合支援法・障害福祉制度', questions: 42 },
      { id: 'T08', name: '生活保護・地域福祉・その他の制度', questions: 36 },
    ],
  },
  {
    no: 6,
    name: '医療と安全（仕上げ）',
    lead: '最後に固める得点源。',
    themes: [
      { id: 'T10', name: '安全管理・感染対策・防災', questions: 31 },
      { id: 'T31', name: '医療的ケア（喀痰吸引・経管栄養）', questions: 48 },
    ],
  },
];

export type Subject = { slug: string; name: string; group: string; questions: number };

// 科目（総合問題を除く12科目）。questions は過去15年（第24〜38回）の出題数。
export const subjects: Subject[] = [
  { slug: 'ningen-songen', name: '人間の尊厳と自立', group: '人間と社会', questions: 30 },
  { slug: 'ningen-kankei', name: '人間関係とコミュニケーション', group: '人間と社会', questions: 38 },
  { slug: 'shakai', name: '社会の理解', group: '人間と社会', questions: 180 },
  { slug: 'kaigo-kihon', name: '介護の基本', group: '介護', questions: 179 },
  { slug: 'communication', name: 'コミュニケーション技術', group: '介護', questions: 112 },
  { slug: 'seikatsu-shien', name: '生活支援技術', group: '介護', questions: 357 },
  { slug: 'kaigo-katei', name: '介護過程', group: '介護', questions: 119 },
  { slug: 'kokoro-karada', name: 'こころとからだのしくみ', group: 'こころとからだのしくみ', questions: 178 },
  { slug: 'hattatsu-roka', name: '発達と老化の理解', group: 'こころとからだのしくみ', questions: 119 },
  { slug: 'ninchisho', name: '認知症の理解', group: 'こころとからだのしくみ', questions: 150 },
  { slug: 'shogai', name: '障害の理解', group: 'こころとからだのしくみ', questions: 149 },
  { slug: 'iryoteki-care', name: '医療的ケア', group: '医療的ケア', questions: 50 },
];

export const subjectByName = (name: string) => subjects.find((s) => s.name === name);
export const themeIdOf = (theme: string) => theme.split(' ')[0];

export const url = (path = '') =>
  `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
