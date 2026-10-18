#!/usr/bin/env python3
"""管理ページ（/admin/、確認用ビルドだけに出る）のデータを作る。

  python3 tools/admin/make.py   →  src/data/admin.json

画像の一覧：
  - photo   … public/images/*.webp（ChatGPT画像）。指示文は prompts/photos.txt
  - guide   … public/images/guide/*.webp（使い方ページの絵）。指示文は prompts/guide.txt
  - shot    … public/images/guide/shot-*.webp（使い方ページの実画面スライド。Claude が撮り直す）
  - svg     … src/figures/*.json（Claude が作る図）
  - planned … prompts/figures.txt の依頼（記事の図 251枚）。画像ができて public/images/ に入ると「作成済み」
差し替えの記録は tools/admin/log.json（import.py が書く）。
"""
import glob, json, os, re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
P = lambda *a: os.path.join(ROOT, *a)
PR = lambda n: open(P('tools', 'admin', 'prompts', n), encoding='utf-8').read()


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
    heads, uses, cur = [], [], '（冒頭）'
    for line in text.split('\n'):
        m = re.match(r'^##\s+(.*)', line)
        if m:
            cur = m.group(1).strip(); heads.append(cur); continue
        for kind, name in re.findall(r'<(fig|photo) name="([\w-]+)"', line):
            uses.append({'kind': kind, 'name': name, 'heading': cur})
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
                out.append({'id': a['id'], 'label': a['label'], 'heading': u['heading']})
    return out

log = {}
if os.path.exists(P('tools', 'admin', 'log.json')):
    log = json.load(open(P('tools', 'admin', 'log.json'), encoding='utf-8'))

items = []

# ── ChatGPT画像（記事の写真風イラスト 24枚） ──
ph = PR('photos.txt')
ph_rules = section(ph, '■ 最初にChatGPTに貼る「共通ルール」', '■ 画像一覧').split('\n', 1)[1].strip()
for m in re.finditer(r'^\d+\.\s+([\w-]+)\.png\n((?:\s{3}.*\n?)+)', ph, re.M):
    name, blk = m.group(1), m.group(2)
    ins = re.search(r'指示：(.*)', blk)
    note = re.search(r'記事：(.*)', blk)
    f = P('public', 'images', name + '.webp')
    items.append({
        'id': name, 'kind': 'photo', 'set': 'photos', 'file': f'images/{name}.webp' if os.path.exists(f) else '',
        'prompt': f'画像名「{name}.png」、横長3:2（1536×1024）で作ってください。' + (ins.group(1).strip() if ins else ''),
        'where': note.group(1).strip() if note else '', 'places': placed('photo', name),
        'status': 'used' if placed('photo', name) else ('made' if os.path.exists(f) else 'todo'),
    })

# ── 使い方ページの絵（13枚） ──
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
        'where': '使い方ページ：' + (where.group(1).strip() if where else ''), 'places': [{'id': 'guide', 'label': '使い方ページ', 'heading': where.group(1).strip() if where else ''}],
        'status': 'used' if os.path.exists(f) else 'todo',
    })

# ── 使い方ページの実画面スライド（Claude が撮り直す） ──
for f in sorted(glob.glob(P('public', 'images', 'guide', 'shot-*.webp'))):
    n = os.path.basename(f)[:-5]
    items.append({'id': n, 'kind': 'shot', 'set': 'claude', 'file': f'images/guide/{n}.webp', 'prompt': '', 'where': '使い方ページのスライド（実際の画面）',
                  'places': [{'id': 'guide', 'label': '使い方ページ', 'heading': 'スライド'}], 'status': 'used'})

# ── Claude が作る図（SVG） ──
for f in sorted(glob.glob(P('src', 'figures', '*.json'))):
    n = os.path.basename(f)[:-5]
    d = json.load(open(f, encoding='utf-8'))
    svg = d['svg'] if 'svg' in d else ''.join(st['svg'] for st in d['steps'][:1])
    cap = d.get('caption') or d.get('note') or d.get('title', '')
    items.append({'id': n, 'kind': 'svg', 'set': 'claude', 'file': '', 'svg': svg, 'steps': len(d.get('steps', [])),
                  'prompt': '', 'where': re.sub(r'\*\*', '', cap)[:120], 'places': placed('fig', n),
                  'status': 'used' if placed('fig', n) else 'made'})

# ── 記事の図（依頼中 251枚） ──
fg = PR('figures.txt')
fg_rules = section(fg, '② 共通ルール（', '────────────────────────────\n③').split('\n', 2)[2].strip()
fg_people = section(fg, '③ 人物設定（', '────────────────────────────\n④').split('\n', 2)[2].strip()
fg_fix = section(fg, '⑦ うまくいかないときの直し方', '────────────────────────────\n⑧').split('\n', 2)[2].strip()
first16 = set(re.findall(r'([\w-]+__[\w-]+)\.png', section(fg, '④ まず作る', '⑤ 全画像の一覧')))
lst = {x['name'][:-4]: x for x in json.load(open(P('tools', 'admin', 'prompts', 'figures.json'), encoding='utf-8'))} if os.path.exists(P('tools', 'admin', 'prompts', 'figures.json')) else {}
for m in re.finditer(r'^No\.(\d+)【([AB])】\s+([\w-]+)\.png\s+(.*?)\n(.*?)(?=^No\.\d+【|^────)', fg, re.M | re.S):
    no, pri, name, size, blk = m.groups()
    ins = re.search(r'指示：(.*)', blk)
    ov = re.search(r'重ねる文字：(.*)', blk)
    pl = re.findall(r'・([\w-]+)「(.*?)」', blk.split('レビュー：')[0])
    f = P('public', 'images', name + '.webp')
    used = placed('photo', name)
    items.append({
        'id': name, 'kind': 'planned', 'set': 'figures', 'no': int(no), 'pri': pri, 'first': name in first16,
        'size': size.replace('［共用］', '').strip(), 'shared': '［共用］' in size,
        'file': f'images/{name}.webp' if os.path.exists(f) else '',
        'prompt': ins.group(1).strip() if ins else '', 'overlay': ov.group(1).strip() if ov else '',
        'where': '', 'places': [{'id': a, 'label': arts[a]['label'] if a in arts else a, 'heading': h} for a, h in pl],
        'status': 'used' if used else ('made' if os.path.exists(f) else 'todo'),
    })

for it in items:
    if it['id'] in log: it['log'] = log[it['id']]

# 見出しが記事に見つからない置き場所（記事を直したあとのずれ）
for it in items:
    for p in it['places']:
        a = arts.get(p['id'])
        if a and p.get('heading') and it['kind'] == 'planned':
            top = p['heading'].split('＞')[0].strip()
            p['ok'] = any(h.strip() == top for h in a['heads'])

out = {
    'rules': {
        'photos': ph_rules,
        'guide': gd_rules,
        'figures': fg_rules + '\n\n' + fg_people,
    },
    'fix': fg_fix,
    'items': items,
    'articles': [{k: v for k, v in a.items() if k != 'uses'} | {'figs': sum(1 for u in a['uses'] if u['kind'] == 'fig'), 'photos': sum(1 for u in a['uses'] if u['kind'] == 'photo'),
                  'planned': sum(1 for it in items if it['kind'] == 'planned' and it['status'] == 'todo' and any(p['id'] == a['id'] for p in it['places']))} for a in arts.values()],
    'todo': open(P('tools', 'admin', 'review-todo.md'), encoding='utf-8').read() if os.path.exists(P('tools', 'admin', 'review-todo.md')) else '',
}
json.dump(out, open(P('src', 'data', 'admin.json'), 'w', encoding='utf-8'), ensure_ascii=False)
from collections import Counter
print('items', len(items), Counter(i['kind'] for i in items), 'articles', len(arts))
