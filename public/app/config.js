// 過去問演習（ブログに組み込んだ版）の設定
window.KAIGO_CONFIG = {
  dataUrl: '',            // 空 → 同じフォルダの data/ の JSON を読む（GAS から配るときは …/exec の URL）
  blogUrl: '../',         // 「ブログ」ボタンと記事リンクの戻り先
  examDate: '2027-01-31', // 次の試験日（残り日数・今日のメニューの計算に使う）
  reportFormUrl: '',      // 誤り報告の Google フォーム（事前入力 URL。{id}{round}{subject}{rev}{app}{order} を置き換える）。空なら内容をコピーして送る形
  goatcounter: '',        // Cookie を使わない計測（例 'https://xxxx.goatcounter.com/count'）。空なら何も送らない
  privacyUrl: '',         // ブログのプライバシーポリシーのページ（あれば）
};
