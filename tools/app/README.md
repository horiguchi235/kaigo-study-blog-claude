# 過去問演習アプリ（public/app/）の作業メモ

## ファイル
| ファイル | 中身 |
|---|---|
| `public/app/app.js` | 画面（ホーム・問題・結果・成績・設定）。学習記録は端末の localStorage |
| `public/app/core.js` | 画面に関係しない処理：連問のまとめ方、合格判定（第38回の基準）、間隔反復、解説の分解、記録の点検と移行 |
| `public/app/sw.js` | オフライン用。**app.js・core.js・app.css を直したら `VERSION` を上げる** |
| `public/app/data/*.json` | 問題データ（index.json と科目ごとの s01〜s13） |
| `public/app/links.json` | アプリ → 記事のリンク表（`make_links.py` で作る） |
| `public/app/config.js` | 試験日・誤り報告フォーム・計測などの設定 |

## よく使うコマンド
```sh
node tools/app/test_core.cjs                         # core.js を本物のデータで確かめる（連問・合格判定・間隔反復など）
python3 tools/app/fix_data.py --check                # データの点検（書き換えない）
python3 tools/app/fix_data.py --note "変更の説明"     # データを直す。rev が上がり、設定画面の更新履歴に出る
python3 tools/app/make_links.py                      # 記事を直したら、アプリ→記事のリンク表を作り直す
python3 tools/app/compare_original.py 36 k_am_*_36.pdf k_pm_*_36.pdf > diff_36.tsv   # 原文PDFとの照合
```

## データの決まり
- 問題IDは変えない・使い回さない。どうしても変えるときは `index.json` の `idMap`（`{"旧ID":"新ID"}`）に書く。アプリが記録を付け替える。
- 問題文と選択肢は試験センターの原文のまま。図の説明など書き足すものは `figText` に分ける（`figSrc: "official"` は試験センター公表の文字情報）。
- 図がないと答えられない問題は `fix_data.py` の `FIG_REQUIRED` に入れる（出題から外れ、`index.excluded` に載る）。図を用意したら外して `figure` を付ける。
- 法改正の注記は `law_notes.tsv`、解説の手直しは `expl_patches.tsv` に書いて `fix_data.py` を実行する。
- 第34〜38回は `src/data/tests.json`（原文に合わせた過去問テスト）と照合して直す。第24〜33回は試験センターがPDFを公開していないため、`compare_original.py` で照合した一覧を人が見て直す。

## 記事からアプリへのリンク
- テーマ：`app/?t=T18&n=10&from=<記事ID>`
- 問題を指定：`app/?ids=K0019,K0065&title=…`
- そのほか：`?s=科目名`・`?part=A`・`?round=36`・`?filter=due`（今日の復習）・`?mock=mini|full|A|B|C`・`?menu=today`
- アプリから記事へは `articles/<記事ID>/#h=<見出し>`。`public/article.js` が見出しの文字で探して開く。
