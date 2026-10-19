#!/usr/bin/env python3
"""過去問1問ごとに「読み直す記事と見出し」を決めて public/qmap.json に書く。
  python3 tools/qmap/make.py
決め方：
 1. 記事の中にその過去問（data-qid）があれば、その記事・その見出し
 2. なければ、記事末テストの記事（tests.json）またはテーマ（T01…）の記事の中で、
    問題文の問い＋正解の選択肢＋解説の要点と、文字の重なりがいちばん多い見出し
出力：{"arts": {記事ID: 短い題名}, "q": {問題ID: [記事ID, 見出し, 確かさ(2=記事の中にある,1=推定,0=弱い)]}}
"""
import glob, json, os, re
from collections import Counter
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ART = os.path.join(ROOT, 'src', 'content', 'articles')

def plain(t):
    t = re.sub(r'<!--.*?-->', '', t, flags=re.S)
    t = re.sub(r'<[^>]+>', '', t)
    return re.sub(r'[*_`|#>\-\s　]', '', t)

arts, sections, title, themes = {}, {}, {}, {}
embedded = {}
for f in sorted(glob.glob(os.path.join(ART, '*.md'))):
    aid = os.path.basename(f)[:-3]
    s = open(f, encoding='utf-8').read()
    fm = s.split('---', 2)[1]
    m = re.search(r'^title: "(.*?)"', fm, re.M); title[aid] = (m.group(1) if m else aid).split('｜')[0]
    m = re.search(r'^theme: "(T\d\d)', fm, re.M)
    if m: themes.setdefault(m.group(1), []).append(aid)
    body = s.split('---', 2)[2]
    body = re.sub(r'<!--.*?-->', '', body, flags=re.S)
    secs, h2, cur, buf = [], '', '', []
    def flush():
        if cur: secs.append((cur, ''.join(buf)))
    for line in body.split('\n'):
        mh = re.match(r'^(#{2,3}) (.+)$', line)
        if mh:
            flush(); buf = []
            name = mh.group(2).strip()
            if mh.group(1) == '##': h2 = name; cur = name
            else: cur = name
            if re.match(r'^(つながる知識|ひっかけパターン集|出典)', h2) and mh.group(1) == '##': cur = ''
            continue
        q = re.search(r'data-qid="(K\d+)"', line)
        if q and cur: embedded.setdefault(q.group(1), (aid, cur))
        buf.append(line)
    flush()
    sections[aid] = [(n, plain(t)) for n, t in secs]

def grams(t):
    t = plain(t)
    return Counter(t[i:i + 2] for i in range(len(t) - 1))

tests = json.load(open(os.path.join(ROOT, 'src', 'data', 'tests.json'), encoding='utf-8'))
test_art = {q['id']: a for a, qs in tests.items() for q in qs}
allq = []
for f in sorted(glob.glob(os.path.join(ROOT, 'public', 'app', 'data', 's*.json'))):
    allq += json.load(open(f, encoding='utf-8'))['questions']
sec_grams = {aid: [(n, grams(t), len(t)) for n, t in secs] for aid, secs in sections.items()}

out = {}
for q in allq:
    qid = q['id']
    if qid in embedded:
        out[qid] = [embedded[qid][0], embedded[qid][1], 2]; continue
    cands = [test_art[qid]] if qid in test_art else []
    for t in q.get('themes', []): cands += [a for a in themes.get(t, []) if a not in cands]
    if not cands: continue
    last = q['stem'].strip().split('\n')[-1]
    right = ''.join(q['options'][k - 1] for k in q.get('keys', []) if 0 < k <= len(q['options']))
    ex = q.get('explanation', '')
    m = re.search(r'【知識のまとめ】(.*?)(【|$)', ex, re.S)
    text = last + right * 2 + (m.group(1)[:400] if m else '')
    g = grams(text)
    best = None
    for aid in cands:
        bonus = 1.15 if aid == (test_art.get(qid)) else 1.0
        for n, sg, ln in sec_grams[aid]:
            if ln < 30: continue
            sc = sum(min(c, sg[k]) for k, c in g.items()) / (sum(g.values()) or 1) * bonus
            if not best or sc > best[0]: best = (sc, aid, n)
    if best:
        out[qid] = [best[1], best[2], 1 if best[0] >= 0.35 else 0]
res = {'arts': title, 'q': out}
json.dump(res, open(os.path.join(ROOT, 'public', 'qmap.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
c = Counter(v[2] for v in out.values())
print('qmap:', len(out), '問', '記事の中にある', c[2], '推定', c[1], '弱い', c[0])
