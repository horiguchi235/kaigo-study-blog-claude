"""過去問アプリのデータ（public/app/data）を点検・修正する。何度実行しても同じ結果になる。

  python3 tools/app/fix_data.py --note "変更の説明"   # 修正して public/app/data を書き換える（説明は更新履歴に出る）
  python3 tools/app/fix_data.py --check  # 書き換えずに結果だけ表示

やること
  1. 第34〜38回：src/data/tests.json（試験センター公表の原文に合わせたもの）と照合し、
     回のずれ・問題文・選択肢を原文に戻す。問題文に書き足していた図の説明は figText に分ける。
     tests.json にあってアプリにない問題（K1839 など）は追加する。
  2. 図がないと答えられない問題（FIG_REQUIRED）は出題データから外し、index.excluded に記録する。
  3. tools/app/law_notes.tsv の法改正の注記を lawStatus・lawNote として入れる。
  4. index.json の問題数・回・テーマ別の数・hash を作り直し、rev を上げて changelog に記録する。
"""
import json, os, re, sys, hashlib, datetime
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(ROOT, 'public', 'app', 'data')
TESTS = os.path.join(ROOT, 'src', 'data', 'tests.json')
HERE = os.path.dirname(os.path.abspath(__file__))
CHECK = '--check' in sys.argv

# 図がないと答えられない問題（図の画像を用意したら、ここから外して figure を付ける）
FIG_REQUIRED = {
    'K1073': '視覚障害者の歩行介助で握る部位（図）', 'K1140': '駅のホーム（図）', 'K1144': '皮膚の観察部位（図）',
    'K1197': 'ポータブルトイレの位置（図）', 'K1271': '目の周囲の清拭（図）', 'K0728': '図', 'K0958': '図',
    'K1739': 'お湯の温度を感じる部位（図）', 'K1745': 'トイレの手すりの位置（図）',
    'K1109': '換気のために開ける窓（図）', 'K1157': 'マークの意味（図）', 'K1190': '重心線の移動（図）',
}
# tests.json にない問題を足すときのテーマ（記事のテーマ）
ADD_THEMES = {'K1839': ['T21']}

def load(p): return json.load(open(p, encoding='utf-8'))
def dump(o): return json.dumps(o, ensure_ascii=False, separators=(',', ':'))

index = load(os.path.join(DATA, 'index.json'))
files = {m['file']: load(os.path.join(DATA, m['file'] + '.json')) for m in index['subjects']}
by_id = {}
for f, d in files.items():
    for q in d['questions']: by_id[q['id']] = (f, q)

tests = {}
for art, arr in load(TESTS).items():
    for t in arr: tests[t['id']] = dict(t, article=art)

report = []
excluded = {e['id']: e for e in index.get('excluded', [])}

# 1. 第34〜38回の照合
SUBJ_FILE = {m['name']: m['file'] for m in index['subjects']}
for tid, t in sorted(tests.items()):
    if tid not in by_id:
        if tid in excluded or tid in FIG_REQUIRED: continue
        f = SUBJ_FILE[t['sub']]
        e = re.sub(r'\*\*', '', t.get('e', ''))
        q = {'id': tid, 'round': t['kai'], 'exam': str(t['kai']), 'theme': '', 'themes': ADD_THEMES.get(tid, []), 'ronten': [],
             'type': '過去問', 'stem': t['q'], 'options': t['c'], 'keys': [t['a']],
             'explanation': '正解：%d．%s\n\n【学習ポイント】\n%s' % (t['a'], t['c'][t['a'] - 1], e)}
        files[f]['questions'].append(q); by_id[tid] = (f, q)
        report.append('%s 第%d回：アプリになかったので追加（%s）' % (tid, t['kai'], t['sub']))
        continue
    f, q = by_id[tid]
    if q.get('round') != t['kai']:
        report.append('%s 回のずれ：第%s回 → 第%d回' % (tid, q.get('round'), t['kai']))
        q['round'] = t['kai']; q['exam'] = str(t['kai'])
    if q['stem'] != t['q']:
        a, b = q['stem'], t['q']
        extra = ''
        if a.startswith(b):
            extra = a[len(b):].strip()
        elif a.replace('\n', '') == b.replace('\n', ''):
            extra = ''
        else:
            # 文中に書き足した説明（かっこ書き）を取り出す
            i = 0
            while i < min(len(a), len(b)) and a[i] == b[i]: i += 1
            j = 0
            while j < min(len(a), len(b)) - i and a[-1 - j] == b[-1 - j]: j += 1
            extra = a[i:len(a) - j].strip()
        q['stem'] = b
        if extra:
            body = re.sub(r'^【[^】]*】\s*', '', extra).strip('（）() ')
            if not body and '文字情報' in extra:
                body = '選択肢の図は、試験センターが公表した文字の情報で示しています。'
            official = '公式' in extra
            extra = body
            if extra:
                q['figText'] = extra
                if official: q['figSrc'] = 'official'
        report.append('%s 問題文を原文に戻した%s' % (tid, '（書き足しは figText に分けた：' + extra[:40] + '…）' if extra else '（改行の違い）'))
    if q['options'] != t['c']:
        report.append('%s 選択肢を原文に戻した' % tid)
        q['options'] = t['c']

# 1b. 問題文に書き足していた【図の文字補足】などは、原文と区別するため figText に分ける
for f, d in files.items():
    for q in d['questions']:
        m = re.search(r'\n*【(図の文字(?:補足|説明)|公式の図の文字説明)】\s*([\s\S]*)$', q['stem'])
        if m:
            q['stem'] = q['stem'][:m.start()].rstrip()
            q['figText'] = m.group(2).strip()
            if '公式' in m.group(1): q['figSrc'] = 'official'
            report.append('%s 問題文に書き足していた図の説明を figText に分けた' % q['id'])

# 2. 図が必要な問題
for qid, why in FIG_REQUIRED.items():
    if qid in by_id:
        f, q = by_id[qid]
        if q.get('figure'): continue
        files[f]['questions'] = [x for x in files[f]['questions'] if x['id'] != qid]
        excluded[qid] = {'id': qid, 'round': q.get('round'), 'subject': files[f]['subject'], 'reason': '図が必要（準備中）：' + why}
        del by_id[qid]
        report.append('%s 図が必要なので出題から外した' % qid)
    elif qid not in excluded:
        excluded[qid] = {'id': qid, 'reason': '図が必要（準備中）：' + why}

# 3. 法改正の注記
for line in open(os.path.join(HERE, 'law_notes.tsv'), encoding='utf-8'):
    if not line.strip() or line.startswith('#'): continue
    qid, status, note = line.rstrip('\n').split('\t')
    if qid in by_id:
        q = by_id[qid][1]
        if q.get('lawStatus') != status or q.get('lawNote') != note:
            q['lawStatus'] = status; q['lawNote'] = note
            report.append('%s 法改正の注記を付けた（%s）' % (qid, status))

# 3b. 解説の手直し（選択肢ごとの解説を置き換える）
for line in open(os.path.join(HERE, 'expl_patches.tsv'), encoding='utf-8'):
    if not line.strip() or line.startswith('#'): continue
    qid, no, text = line.rstrip('\n').split('\t')
    if qid not in by_id: continue
    q = by_id[qid][1]
    pat = re.compile(r'(【選択肢%s｜[^】]*】\n)([\s\S]*?)(?=\n\n【選択肢|\Z)' % no)
    m = pat.search(q['explanation'])
    if m and m.group(2).strip() != text:
        q['explanation'] = q['explanation'][:m.start(2)] + text + q['explanation'][m.end(2):]
        report.append('%s 選択肢%sの解説を直した' % (qid, no))

# 4. 並び（回→ID）と index の作り直し
for d in files.values():
    d['questions'].sort(key=lambda q: (q.get('round') or 0, q['id']))
theme_count = {}
for f, d in files.items():
    for q in d['questions']:
        for th in q.get('themes', []): theme_count[th] = theme_count.get(th, 0) + 1
changed = False
for m in index['subjects']:
    d = files[m['file']]
    text = dump(d)
    h = hashlib.md5(text.encode()).hexdigest()[:12]
    if h != m.get('hash'): changed = True
    m['hash'] = h; m['count'] = len(d['questions'])
    m['rounds'] = sorted({q['round'] for q in d['questions'] if q.get('round')})
    if not CHECK:
        open(os.path.join(DATA, m['file'] + '.json'), 'w', encoding='utf-8').write(text)
for t in index.get('themes', []): t['count'] = theme_count.get(t['id'], 0)
index['excluded'] = sorted(excluded.values(), key=lambda e: e['id'])
if changed and report:
    index['rev'] = int(index.get('rev', 0)) + 1
    log = index.get('changelog', [])
    log.insert(0, {'rev': index['rev'], 'date': datetime.date.today().isoformat(),
                   'text': (sys.argv[sys.argv.index('--note') + 1] if '--note' in sys.argv else 'データの点検・修正') + '（%d件）' % len(report)})
    index['changelog'] = log[:20]
    index['generatedAt'] = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).isoformat(timespec='seconds')
index['version'] = hashlib.md5(''.join(m['hash'] for m in index['subjects']).encode()).hexdigest()[:12]
if not CHECK:
    open(os.path.join(DATA, 'index.json'), 'w', encoding='utf-8').write(json.dumps(index, ensure_ascii=False))
    open(os.path.join(HERE, 'data_fix_report.md'), 'w', encoding='utf-8').write(
        '# 過去問アプリのデータ修正の記録\n\n' + '\n'.join('- ' + r for r in report) + '\n' if report else '# 過去問アプリのデータ修正の記録\n\n- 修正なし\n')
print('\n'.join(report) or '修正なし')
print('問題数', sum(m['count'] for m in index['subjects']), '／除外', len(index['excluded']), '／rev', index.get('rev'))
