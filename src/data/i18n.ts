// 言語切り替え（EPA介護福祉士候補者向け）。
// 記事本文の翻訳は src/content/translations/<言語>/<記事ID>.md に置く。
export type Lang = 'en' | 'id' | 'fil' | 'vi';

export const LANGS: { code: Lang; label: string; htmlLang: string }[] = [
  { code: 'en', label: 'English', htmlLang: 'en' },
  { code: 'id', label: 'Bahasa Indonesia', htmlLang: 'id' },
  { code: 'fil', label: 'Filipino', htmlLang: 'fil' },
  { code: 'vi', label: 'Tiếng Việt', htmlLang: 'vi' },
];

type UI = {
  nav: Record<string, string>;
  toc: string;
  note: string;
  prev: string;
  next: string;
  up: string;
  openAll: string;
  closeAll: string;
  tapHint: string;
  quizOpen: string;
  quizSolve: string;
  answer: string;
  close: string;
  notTranslated: string;
  original: string;
};

export const UI: Record<Lang, UI> = {
  en: {
    nav: { guide: 'How to use', theme: 'By theme', subject: 'By subject', level: 'By importance', ichimon: 'Quick quiz', anki: 'Memory sheets', hikaku: 'Comparisons', moshi: 'Mini mock exam', mame: 'Exam info' },
    toc: 'Contents',
    note: 'This page is a translation for EPA care worker candidates. The national exam is written in Japanese, so key exam terms are shown in Japanese with their reading, like “pressure ulcer (褥瘡／じょくそう)”.',
    prev: '← Previous', next: 'Next →', up: 'Back to contents',
    openAll: 'Open all', closeAll: 'Close all', tapHint: '📖 Tap a heading to open it',
    quizOpen: '▼ Tap to choose a question', quizSolve: '▼ Solve', answer: 'Show answer', close: '▲ Close',
    notTranslated: 'This page is not translated yet. It is shown in Japanese.',
    original: 'Japanese original',
  },
  id: {
    nav: { guide: 'Cara pakai', theme: 'Per tema', subject: 'Per mata ujian', level: 'Per prioritas', ichimon: 'Kuis singkat', anki: 'Lembar hafalan', hikaku: 'Perbandingan', moshi: 'Ujian mini', mame: 'Info ujian' },
    toc: 'Daftar isi',
    note: 'Halaman ini adalah terjemahan untuk kandidat kaigofukushishi (EPA). Ujian nasional ditulis dalam bahasa Jepang, jadi istilah penting ditampilkan dalam bahasa Jepang beserta cara bacanya, misalnya “luka tekan (褥瘡／じょくそう)”.',
    prev: '← Sebelumnya', next: 'Berikutnya →', up: 'Kembali ke daftar isi',
    openAll: 'Buka semua', closeAll: 'Tutup semua', tapHint: '📖 Ketuk judul untuk membukanya',
    quizOpen: '▼ Ketuk untuk memilih soal', quizSolve: '▼ Kerjakan', answer: 'Lihat jawaban', close: '▲ Tutup',
    notTranslated: 'Halaman ini belum diterjemahkan. Ditampilkan dalam bahasa Jepang.',
    original: 'Versi asli (Jepang)',
  },
  fil: {
    nav: { guide: 'Paano gamitin', theme: 'Ayon sa tema', subject: 'Ayon sa asignatura', level: 'Ayon sa halaga', ichimon: 'Mabilis na quiz', anki: 'Pang-memorya', hikaku: 'Paghahambing', moshi: 'Mini mock exam', mame: 'Impormasyon sa exam' },
    toc: 'Nilalaman',
    note: 'Ang pahinang ito ay salin para sa mga EPA care worker candidate. Nakasulat sa wikang Hapon ang pambansang exam, kaya ang mahahalagang termino ay nakasulat sa Hapon kasama ang basa nito, halimbawa “pressure ulcer (褥瘡／じょくそう)”.',
    prev: '← Nakaraan', next: 'Susunod →', up: 'Bumalik sa nilalaman',
    openAll: 'Buksan lahat', closeAll: 'Isara lahat', tapHint: '📖 I-tap ang heading para buksan',
    quizOpen: '▼ I-tap para pumili ng tanong', quizSolve: '▼ Sagutan', answer: 'Ipakita ang sagot', close: '▲ Isara',
    notTranslated: 'Hindi pa naisasalin ang pahinang ito. Ipinapakita ito sa wikang Hapon.',
    original: 'Orihinal (Hapon)',
  },
  vi: {
    nav: { guide: 'Cách sử dụng', theme: 'Theo chủ đề', subject: 'Theo môn', level: 'Theo mức độ quan trọng', ichimon: 'Hỏi nhanh', anki: 'Bảng ghi nhớ', hikaku: 'So sánh', moshi: 'Thi thử mini', mame: 'Thông tin kỳ thi' },
    toc: 'Mục lục',
    note: 'Trang này là bản dịch dành cho ứng viên hộ lý EPA. Kỳ thi quốc gia được viết bằng tiếng Nhật, nên các thuật ngữ quan trọng được ghi bằng tiếng Nhật kèm cách đọc, ví dụ “loét do tì đè (褥瘡／じょくそう)”.',
    prev: '← Bài trước', next: 'Bài sau →', up: 'Về mục lục',
    openAll: 'Mở tất cả', closeAll: 'Đóng tất cả', tapHint: '📖 Chạm vào tiêu đề để mở',
    quizOpen: '▼ Chạm để chọn câu hỏi', quizSolve: '▼ Làm bài', answer: 'Xem đáp án', close: '▲ Đóng',
    notTranslated: 'Trang này chưa được dịch. Đang hiển thị bằng tiếng Nhật.',
    original: 'Bản gốc (tiếng Nhật)',
  },
};

// 言語切り替えのメニュー（ja＝日本語、ruby＝ふりがな付き）
export const LANG_MENU = [
  { code: 'ja', label: '日本語' },
  { code: 'ruby', label: 'にほんご（ふりがな）' },
  ...LANGS.map((l) => ({ code: l.code, label: l.label })),
];
