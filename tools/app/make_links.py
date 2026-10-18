"""過去問アプリ → ブログ記事 のリンク表（public/app/links.json）を作る。記事を直したら再実行する。

  python3 tools/app/make_links.py

- themes：テーマID → そのテーマの記事（記事ID・タイトル）の一覧
- ronten：論点ID → 記事ID・論点名・記事の中でいちばん近い「① …」の見出し
  アプリは articles/<記事ID>/#h=<見出し> にリンクし、記事側（public/article.js）がその見出しを開く。
"""
import json, os, re, glob
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
freq = json.load(open(os.path.join(ROOT, 'src/data/freq.json'), encoding='utf-8'))['articles']

def bigrams(s):
    s = re.sub(r'[\s・、（）()〔〕「」①-⑳]', '', s)
    return {s[i:i + 2] for i in range(len(s) - 1)} or {s}

out = {'themes': {}, 'ronten': {}, 'articles': {}}
for f in sorted(glob.glob(os.path.join(ROOT, 'src/content/articles/*.md'))):
    slug = os.path.basename(f)[:-3]
    text = open(f, encoding='utf-8').read()
    fm = text.split('---')[1]
    g = lambda k: (re.search(r'^%s:\s*"?([^"\n]*)"?' % k, fm, re.M) or [None, ''])[1]
    theme = g('theme').split(' ')[0]
    if not re.match(r'^T\d\d$', theme):
        continue
    out['articles'][slug] = {'title': g('title'), 'label': g('article'), 'theme': theme}
    out['themes'].setdefault(theme, []).append(slug)
    heads = re.findall(r'^## ([①-⑳].*?)\s*$', text, re.M)
    for r in freq.get(slug, {}).get('ronten', []):
        best, score = '', 0
        for h in heads:
            a, b = bigrams(r['name']), bigrams(h)
            sc = len(a & b) / max(1, len(a | b))
            if sc > score: best, score = h, sc
        out['ronten'][r['id']] = {'a': slug, 'name': r['name'], 'h': best if score >= 0.15 else ''}
path = os.path.join(ROOT, 'public/app/links.json')
open(path, 'w', encoding='utf-8').write(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
miss = [k for k, v in out['ronten'].items() if not v['h']]
print('記事', len(out['articles']), '／論点', len(out['ronten']), '／見出しが決まらない論点', len(miss), miss[:10])
