# 記事の画像の見直し（2026-10-19）

## 1. これまでの結果
ChatGPT に頼んだ「記事の図」251枚を、Claude が2回確認した結果です。

| 結果 | 枚数 |
|---|---|
| 1回目で作り直し | 139 |
| 1回目はOK → 厳しい再確認で不合格 | 83 |
| 合格 | 29（12%） |

合格した29枚の中にも、「ひもときシート」のように指示どおりでも何を伝えたいか分からない絵（キャラクターが頭を抱える・カードを調べる…）がありました。「指示どおりに描けたか」と「学習者に伝わるか」は別でした。

## 2. 何が作れなかったか（不合格222枚の理由、重複あり）

| 理由 | 枚数 | 割合 |
|---|---|---|
| 要点の動作・姿勢・状態が描けていない | 104 | 46% |
| 空の箱・吹き出し・カードだけで、文字なしでは意味が分からない | 83 | 37% |
| 左右・向き・順番・位置の誤り（麻痺側、車いすの後ろ向き、矢印の向きなど） | 70 | 31% |
| 指示にない人物（ほぼメインキャラクター）の描き足し | 63 | 28% |
| 人物設定（服装・年齢・性別）の違い | 49 | 22% |
| 数量・比率・長さ・高さが不正確（55:45、2倍の長さなど） | 33 | 14% |
| 物の構造の破綻（車いすの後輪がない、管のつながりがおかしい） | 29 | 13% |
| 表情・雰囲気が場面に合わない（看取りで笑顔など） | 23 | 10% |
| 体の露出 | 9 | 4% |

### 指示の種類ごとの合格率

| 指示の種類 | 枚数 | 合格 | 合格率 |
|---|---|---|---|
| フローチャート・判定図 | 19 | 0 | 0% |
| 体の中・断面図 | 27 | 1 | 3% |
| 概念図（円・段・軸・ピラミッド） | 43 | 3 | 6% |
| コマ割りの場面 | 28 | 2 | 7% |
| 比較・分類図（箱・カード） | 21 | 2 | 9% |
| 人物のいる1場面 | 78 | 14 | 17% |
| グラフ | 21 | 4 | 19% |
| 年表 | 5 | 1 | 20% |
| 真上から見た配置図 | 9 | 2 | 22% |

## 3. 原因の見立て
1. **キャラクターの参照画像を毎回添付していた**：キャラクターを指示していない152枚の不合格のうち75枚に、メインキャラクターが描き足されていました。添付するとChatGPTは「この子を描く」と受け取ります。
2. **文字のない図解**：流れ・比較・分類の図は、ラベルが本体です。文字を抜くと「空の箱」になり、文字を入れると誤字のおそれがあります。
3. **正確さが要点の絵**：左右・向き・順番・数量・比率は、ChatGPT が自分で確かめられず、毎回ずれます。学習用の図では、ここがずれると誤って覚える原因になります。
4. **人物を何人も同じ見た目で描くこと**：服装・年齢の一貫性は保てませんでした。
5. **複雑な構造物・体の中**：車いす・断面図・臓器のつながりは部品が欠けやすい。

## 4. ChatGPT に頼めること・頼めないこと
- **頼める**：道具・設備・環境の「実物の形」を見せる絵（人物なし・文字なし）。数が少なく（5つ以内）、左右や順番が答えにならないもの。合格した例：配膳、廃棄物容器の色、手洗いの洗い残し、装具、人口ピラミッドの3つの形。
- **頼めない**：文字やラベルが必要な図、流れ・判定・比較・グラフ・年表、左右・向き・順番・数量が要点の絵、体の中の断面、何人もの人物が出る場面、気持ちや考え方を絵で表すもの。

## 5. これからの方針
記事の画像は次の3つに分けました（旧依頼の251枚＋写真風27枚＝278枠）。

| 分け方 | 枠 | 中身 |
|---|---|---|
| ChatGPT の画像 | 31 | 道具・設備・環境の形（人物なし・文字なし・参照画像なし）。依頼文は tools/admin/prompts/article-images.txt |
| Claude の図（SVG）の候補 | 128 | 文字・矢印・順番・左右・数量が要点の図。文字入りで正確に作れる。必要なものから管理ページで頼む |
| 画像なし | 119 | 文章・表で足りるもの、気持ち・態度の場面、ChatGPT でもSVGでも正確に描きにくいもの |

- 使い方ページ以外の記事の画像（ChatGPT で作ったもの）は、サイトからすべて削除しました。Claude が作った SVG の図（27枚）は残しています。
- 記事には ChatGPT の画像 31 枚の置き場所（`<photo>`）だけを残し、画像が届くまでは何も表示しません（画像を public/images/ に入れると自動で表示）。
- 崩れた画像を使うくらいなら画像なしにする、を原則にします。ChatGPT が作れなかった画像は、その枠を「画像なし」に移します。

## 6. 一覧
### ChatGPT の画像（31）
idou-03__kurumaisu、idou-02__tsue、idou-02__hokouki、idou-02__sliding-board、idou-03__hakujo-tenji、idou-03__eki-home、nyuyoku-02__lift、nyuyoku-02__shower-chair、nyuyoku-02__bathboard、nyuyoku-02__kelly-pad、sumai-01__bed、suimin-02__mattress、sumai-01__jutaku-kaishu、haisetsu-03__portable-toilet、haisetsu-03__nyouki、haisetsu-04__stoma、nyuyoku-04__jijogu-koui、nyuyoku-04__kutsu、shokuji-02__jijogu-shokuji、shokuji-01__koukuu-care、shokuji-01__gishi、shokuji-03__irou-type、iryoucare-02__kyuuin、iryoucare-03__keikan、shougai-01__tankashi-sougu、shougai-01__kansetsu-hogo、shougaicomm-01__ishisotsuu-yougu、shougaicomm-02__hochouki、kenriyougo-02__kousoku-yougu、ninchishocare-02__kankyou、anzen-02__tearai

### Claude の図（SVG）の候補（128）
anzen-01__heinrich、anzen-01__keikai-level、anzen-02__biohazard、byouki-01__chikunyou、byouki-01__kusuri-kikikata、byouki-02__kyoushin-kouso、byouki-02__shinbousaidou、chiikifukushi-01__needs-2jiku、communication-02__johari、communication-03__pdca、haisetsu-01__bristol、haisetsu-02__nyouryou、haisetsu-03__inbu-senjou、haisetsu-03__portable-haichi、hattatsu-01__hattatsu-riron、hattatsu-01__nyuuyouji、hattatsu-01__scammon、hattatsu-02__nanchou、hattatsu-02__yobiryoku、hikaku-01__65sai、hikaku-02__safety-net、hikaku-03__chiikiikou、hikaku-05__dochira、hikaku-07__center-2jiku、hikaku-08__sumai-2jiku、hikaku-09__kujou-fufuku、hikaku-10__2kaidate、houritsu-01__nenpyou、houritsu-02__doui-flow、icf-01__icidh-icf、icf-02__frail、idou-01__juushinsen、idou-01__shiji-kiteimen、idou-01__torque、idou-02__katamahi-ichi、idou-02__tsue-erabikata、idou-02__tsue-nagasa、idou-03__kurumaisu-4koma、idou-03__yuudou、iryoucare-01__bls、iryoucare-01__kahler、iryoucare-02__cannula、iryoucare-02__kyuuin-han-i、iryoucare-03__keikan-shurui、jinkou-01__kakukazoku、jinkou-01__koureikaritsu、jinkou-01__shintou、jinkou-02__formal-informal、jinkou-02__kaigosha、jinkou-02__pyramid、kaigohoken-01__juushochi、kaigohoken-01__nintei-flow、kaigohoken-01__zaigen、kaigohoken-02__unit、kaigohoken-03__chiiki-houkatsu、kaigohoken-03__chiiki-shien-jigyou、kaigohoken-03__jijo-gojo、kaigokatei-01__kaigokatei-en、kaigokatei-03__hyouka-bunki、kaigokatei-04__jirei-marker、karada-01__shiya、karada-02__junkan-8、karada-02__ketsueki、kenriyougo-01__handan-monosashi、kenriyougo-01__nichiji-flow、kenriyougo-02__gyakutai-tsuhou、kenriyougo-02__kousoku-3youken、kenriyougo-03__cooling-off、kenriyougo-03__houritsu-tsunagari、kiroku-01__buntai、kiroku-01__teisei、kokoro-01__kioku、kokoro-01__maslow、kokoro-02__chinou、kokoro-02__nijuu-katei、mitori-01__cheyne-stokes、mitori-01__kubler-ross、mitori-01__shino-zengo、mitori-02__grief-obi、mitori-02__total-pain、ninchisho-01__chuukaku-bpsd、ninchisho-01__kentoushiki、ninchisho-01__senmou、ninchisho-02__shinkou-graph、ninchisho-03__jiritsudo-ninchi、ninchisho-03__mci、ninchisho-03__scale、ninchishocare-01__himotoki、ninchishocare-03__kazoku-juyou、ninchishocare-04__nenpyou、ninchishocare-04__shoki-shuuchuu、ninchishocare-04__supporter、ninchishocare-04__taikou、ninchishocare-04__yobou-imi、nyuyoku-01__hanshinyoku、nyuyoku-01__ketsuatsu-nyuyoku、nyuyoku-02__seishiki-houkou、nyuyoku-03__kansouhada、nyuyoku-03__tsume、nyuyoku-04__maeawase、shakaihoshou-01__hoken-bunki、shakaihoshou-01__kyuufu-zaigen、shakaihoshou-01__nenrei-monosashi、shakaihoshou-02__sochi-keiyaku、shokuji-02__enge-5ki、shokuji-03__haizen、shougai-01__mahi-4、shougai-01__sekizui、shougai-02__als、shougai-02__hansoku-mushi、shougai-02__hoehn-yahr、shougaicomm-02__yubitenji、shougaifukushi-01__kyuufu-tree、shougaifukushi-01__riyou-flow、shougaishien-01__ueda-5、songen-01__rinen-4、songen-02__ecomap-genogram、songen-03__tokikata-flow、suimin-01__sleep-graph、suimin-01__tainai-dokei、sumai-01__kaidan、sumai-01__tobira、sumai-02__kakei、sumai-03__sentaku-hyouji、team-01__caremanagement、team-02__kaigo-kyuugyou、team-02__sankyuu-ikukyuu、yomimono-02__part-goukaku

### 画像なし（119）
karada-01__jiritsu-shinkei、icf-02__haiyou、shokuji-01__gishi-chakudatsu、shokuji-01__koukuu-shisei、shokuji-02__shokuji-shisei、haisetsu-01__haiben-shisei、haisetsu-02__shikkin-4type、haisetsu-03__omutsu、haisetsu-03__kaishu-taiyo-hanbai、haisetsu-04__kanchou-sokugai、nyuyoku-01__sayou-3、nyuyoku-02__yokusou-deiri、nyuyoku-03__tsume-ijou、suimin-01__shougai-flow、suimin-02__bedmaking、sumai-01__sunpou、sumai-01__mark、sumai-02__shokuchuudoku、sumai-03__souji-bouchuu、kokoro-02__reichard、hattatsu-02__rouka-henka、byouki-01__zayaku、byouki-02__teikettou-flow、byouki-03__o-kyaku、byouki-03__kanketsusei-hakkou、ninchisho-01__monowasure、ninchisho-02__naoru-ninchisho、ninchishocare-01__humanitude、ninchishocare-02__3step、ninchishocare-03__shoukibo、ninchishocare-03__soudansaki、shougai-02__parkinson、shougai-03__asd-ekard、shougai-03__tougou-shicchou、shougai-03__life-stage、shougaishien-02__soudan-shien、team-02__youtsuu、communication-01__3messages、communication-02__biestek、communication-03__teni、shougaicomm-01__shitsugo-kairo、shougaicomm-02__mourou、kiroku-01__kyakkan-shukan、kiroku-02__houkoku-junban、kaigokatei-01__s-o、kaigokatei-02__mokuhyou-kaidan、kaigokatei-02__yuusen、shakaihoshou-02__rekishi、kaigohoken-02__service-5、shougaifukushi-01__idou-4、shougaifukushi-02__seishinka-nyuuin、anzen-01__kiken-bamen、anzen-02__outobutsu、iryoucare-01__kyoukotsu-appaku、iryoucare-02__kyuuin-tejun、iryoucare-02__drainage、iryoucare-03__keikan-tejun、iryoucare-03__trouble、hikaku-01__taiouhyou、songen-01__jiritsu-4、songen-01__ud-7、songen-02__mimamori、houritsu-01__gimu、karada-01__naibunpi、karada-02__choke-sign、icf-01__igaku-shakai、icf-02__rihabiri-shokushu、idou-02__okiagari、idou-02__tachiagari、shokuji-03__dassui-sign、haisetsu-01__haiben-shikumi、haisetsu-01__benpi-4type、haisetsu-02__kotsubanteikin、haisetsu-02__kinousei-kankyou、nyuyoku-04__nemamano-kigae、suimin-02__seikatsu-timeline、suimin-02__shinshitsu、sumai-01__kaishu-madori、sumai-03__hyouhakuzai、kokoro-01__tekiou-kisei、hattatsu-01__shikakuteki-dangai、hattatsu-01__hozon、byouki-02__shinfuzen-kiza、ninchishocare-01__person-centred、ninchishocare-01__ro-kaisou、shougai-01__zakotsu、shougai-03__asd-koekake、shougaishien-01__juyou-hikaku、team-01__soudan-houshajou、team-01__ojt、team-02__stress-check、communication-01__kiku-shisei、communication-02__shitsumon、communication-03__ikou-chousei、shougaicomm-01__shitsugo-card、shougaicomm-03__outou-maru-batsu、shougaicomm-03__tissue、kiroku-02__kujou-houkoku、kiroku-02__brainstorming、kaigokatei-04__schedule、shakaihoshou-02__barrierfree-ud、jinkou-02__kazoku-yougo、kaigohoken-02__shitei、kaigohoken-03__chiiki-care-kaigi、chiikifukushi-01__seikatsuhogo-flow、chiikifukushi-01__genri-gensoku、chiikifukushi-01__fujo-8、chiikifukushi-02__houjin-npo、chiikifukushi-02__renkei-3、anzen-02__senjou-shoudoku、anzen-02__standard、hikaku-04__jiritsu-4、hikaku-07__soudansaki、communication-01__mesen、communication-01__ichi、index__hero、idou-03__silvercar、sumai-02__kayu、sumai-03__shiminuki
