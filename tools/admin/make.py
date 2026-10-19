#!/usr/bin/env python3
"""管理ページ（/admin/、確認用ビルドだけに出る）のデータを作る。

  python3 tools/admin/make.py   →  src/data/admin.json

画像の一覧（管理ページでは記事ごとにまとめて表示する）：
  - photo   … 記事の画像（ChatGPT）。一覧と指示文は tools/admin/article_images.py。
              記事に <photo name="…"> を置き、public/images/<名前>.webp があれば「使用中」、なければ「ChatGPTで作成待ち」
  - svg     … src/figures/*.json（Claude が作る図）。記事に <fig name="…"> で置く
  - svgplan … Claude が SVG で作る候補（article_images.SVG_PLAN。置く場所と内容は prompts/figures.txt の旧依頼から）
  - guide   … public/images/guide/*.webp（使い方ページの絵、ChatGPT）。指示文は prompts/guide.txt
  - shot    … public/images/guide/shot-*.webp（使い方ページの実画面スライド。Claude が撮り直す）
差し替えの記録は tools/admin/log.json（import.py が書く）。
"""
import glob, json, os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
P = lambda *a: os.path.join(ROOT, *a)
PR = lambda n: open(P('tools', 'admin', 'prompts', n), encoding='utf-8').read()
sys.path.insert(0, os.path.dirname(__file__))
import article_images as AI


def section(text, start, end):
    a = text.index(start)
    b = text.index(end, a + len(start)) if end else len(text)
    return text[a:b].strip()


# ── 記事：タイトル・見出し・画像の使用箇所 ──
arts = {}
for f in sorted(glob.glob(P('src', 'content', 'articles', '*.md'))):
    aid = os.path.basename(f)[:-3]
    s = open(f, encoding='utf-8').read()
    fm = s.split('---', 2)[1]
    title = re.search(r'^title:\s*"?(.*?)"?\s*$', fm, re.M).group(1)
    label = re.search(r'^article:\s*"?(.*?)"?\s*$', fm, re.M).group(1)
    draft = bool(re.search(r'^draft:\s*true', fm, re.M))
    body = s.split('---', 2)[2]
    memo = body.find('<!--')
    text = body[:memo] if memo >= 0 else body
    heads, uses, h2, h3 = [], [], '（冒頭）', ''
    for line in text.split('\n'):
        m = re.match(r'^(##|###)\s+(.*)', line)
        if m:
            if m.group(1) == '##':
                h2, h3 = m.group(2).strip(), ''; heads.append(h2)
            else:
                h3 = m.group(2).strip()
            continue
        for kind, name in re.findall(r'<(fig|photo) name="([\w-]+)"', line):
            cap = re.search(r'caption="([^"]*)"', line)
            uses.append({'kind': kind, 'name': name, 'heading': h2 + (' ＞ ' + h3 if h3 else ''), 'caption': cap.group(1) if cap else ''})
    plain = re.sub(r'<[^>]+>|[#*|`>\-]', '', text)
    arts[aid] = {
        'id': aid, 'title': title, 'label': label, 'draft': draft, 'heads': heads, 'uses': uses,
        'chars': len(re.sub(r'\s', '', plain)),
        'quizzes': len(re.findall(r'<details class="quiz"', text)) + len(re.findall(r'<summary>✏️ 過去問を解いてみよう（第', text)),
        'past': int((re.search(r'^past_questions:\s*(\d+)', fm, re.M) or [0, 0])[1]),
    }


def placed(kind, name):
    out = []
    for a in arts.values():
        for u in a['uses']:
            if u['kind'] == kind and u['name'] == name:
                out.append({'id': a['id'], 'label': a['label'], 'heading': u['heading'], 'caption': u['caption']})
    return out


log = {}
if os.path.exists(P('tools', 'admin', 'log.json')):
    log = json.load(open(P('tools', 'admin', 'log.json'), encoding='utf-8'))

items = []

# ── 記事の画像（ChatGPT） ──
for it in AI.ITEMS:
    name = it[0]
    f = P('public', 'images', name + '.webp')
    pl = placed('photo', name)
    items.append({
        'id': name, 'kind': 'photo', 'set': 'photos', 'size': it[1],
        'file': f'images/{name}.webp' if os.path.exists(f) else '',
        'prompt': AI.item_prompt(it), 'places': pl,
        'status': ('used' if pl else 'made') if os.path.exists(f) else 'todo',
    })

# ── Claude が作る図（SVG） ──
for f in sorted(glob.glob(P('src', 'figures', '*.json'))):
    n = os.path.basename(f)[:-5]
    d = json.load(open(f, encoding='utf-8'))
    svg = d['svg'] if 'svg' in d else ''.join(st['svg'] for st in d['steps'][:1])
    cap = d.get('caption') or d.get('note') or d.get('title', '')
    items.append({'id': n, 'kind': 'svg', 'set': 'claude', 'file': '', 'svg': svg, 'steps': len(d.get('steps', [])),
                  'prompt': '', 'where': re.sub(r'\*\*', '', cap)[:120], 'places': placed('fig', n),
                  'status': 'used' if placed('fig', n) else 'made'})

# ── Claude が SVG で作る候補（旧「記事の図」依頼から、置く場所と入れる内容を引き継ぐ） ──
fg = PR('figures.txt')
for m in re.finditer(r'^No\.(\d+)【([AB])】\s+([\w-]+)\.png\s+(.*?)\n(.*?)(?=^No\.\d+【|^────)', fg, re.M | re.S):
    no, pri, name, size, blk = m.groups()
    if name not in AI.SVG_PLAN:
        continue
    ov = re.search(r'重ねる文字：(.*)', blk)
    pl = re.findall(r'・([\w-]+)「(.*?)」', blk.split('レビュー：')[0])
    items.append({
        'id': name, 'kind': 'svgplan', 'set': 'claude', 'pri': pri, 'file': '', 'prompt': '',
        'where': (ov.group(1).strip() if ov else ''), 'memo': AI.SVG_PLAN[name],
        'places': [{'id': a, 'label': arts[a]['label'] if a in arts else a, 'heading': h} for a, h in pl],
        'status': 'plan',
    })

# ── 使い方ページの絵（ChatGPT） ──
gd = PR('guide.txt')
gd_rules = section(gd, '■ 最初にChatGPTに貼る「共通ルール」', '────────────────────────────\n■ 画像一覧').split('\n', 1)[1].strip()
for m in re.finditer(r'^\s*\d+\.\s+(guide__[\w-]+)\.png\n((?:\s{3,}.*\n?)+)', gd, re.M):
    name, blk = m.group(1), m.group(2)
    ins = re.search(r'指示：(.*)', blk)
    where = re.search(r'使う場所：(.*)', blk)
    short = name.replace('guide__', '')
    f = P('public', 'images', 'guide', short + '.webp')
    size = '正方形 1:1（1024×1024）' if short.startswith(('type-', 'cycle-')) else '横長3:2（1536×1024）'
    items.append({
        'id': name, 'kind': 'guide', 'set': 'guide', 'file': f'images/guide/{short}.webp' if os.path.exists(f) else '',
        'prompt': f'画像名「{name}.png」、{size}で作ってください。' + (ins.group(1).strip() if ins else ''),
        'places': [{'id': 'guide', 'label': '使い方ページ', 'heading': where.group(1).strip() if where else ''}],
        'status': 'used' if os.path.exists(f) else 'todo',
    })

# ── 使い方ページの実画面スライド（Claude が撮り直す） ──
for f in sorted(glob.glob(P('public', 'images', 'guide', 'shot-*.webp'))):
    n = os.path.basename(f)[:-5]
    items.append({'id': n, 'kind': 'shot', 'set': 'claude', 'file': f'images/guide/{n}.webp', 'prompt': '',
                  'places': [{'id': 'guide', 'label': '使い方ページ', 'heading': 'スライド（実際の画面）'}], 'status': 'used'})

for it in items:
    if it['id'] in log: it['log'] = log[it['id']]

# 見出しが記事に見つからない置き場所（記事を直したあとのずれ）
for it in items:
    for p in it['places']:
        a = arts.get(p['id'])
        if a and p.get('heading') and it['kind'] == 'svgplan':
            top = p['heading'].split('＞')[0].strip()
            p['ok'] = any(h.strip() == top for h in a['heads'])


def count(aid, kind, status=None):
    return sum(1 for it in items if it['kind'] == kind and (status is None or it['status'] == status) and any(p['id'] == aid for p in it['places']))


out = {
    'rules': {'photos': AI.RULES, 'guide': gd_rules},
    'folders': {
        'photos': AI.FOLDER,
        'guide': 'マイドライブ ＞ 介護福祉士ブログ ＞ 画像_ChatGPT ＞ 使い方ページ',
    },
    'items': items,
    'articles': [{k: v for k, v in a.items() if k != 'uses'} | {
        'figs': count(a['id'], 'svg'), 'photos': count(a['id'], 'photo', 'used'),
        'planned': count(a['id'], 'photo', 'todo'), 'svgplan': count(a['id'], 'svgplan')} for a in arts.values()],
    'todo': open(P('tools', 'admin', 'review-todo.md'), encoding='utf-8').read() if os.path.exists(P('tools', 'admin', 'review-todo.md')) else '',
}
json.dump(out, open(P('src', 'data', 'admin.json'), 'w', encoding='utf-8'), ensure_ascii=False)
from collections import Counter
print('items', len(items), Counter(i['kind'] + ':' + i['status'] for i in items), 'articles', len(arts))
