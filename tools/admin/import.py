#!/usr/bin/env python3
"""ChatGPT で作った画像（PNG）をサイト用の webp にして置き、差し替えの記録を残す。

  python3 tools/admin/import.py <PNGのあるフォルダ または ファイル…>

  guide__xxx.png  → public/images/guide/xxx.webp（使い方ページ）
  それ以外        → public/images/<名前>.webp（記事の写真・図）
記録：tools/admin/log.json（{名前: {date, n}}）。最後に make.py を実行して管理ページのデータを作り直す。
"""
import datetime, glob, json, os, subprocess, sys
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
LOG = os.path.join(ROOT, 'tools', 'admin', 'log.json')
WIDTH = {'hero': 1200, 'ai-analysis': 1000, 'schedule': 1200, 'tips': 1100}

files = []
for a in sys.argv[1:]:
    files += sorted(glob.glob(os.path.join(a, '*.png'))) if os.path.isdir(a) else [a]
if not files:
    sys.exit(__doc__)
log = json.load(open(LOG, encoding='utf-8')) if os.path.exists(LOG) else {}
today = datetime.date.today().isoformat()
for f in files:
    name = os.path.basename(f)[:-4]
    im = Image.open(f).convert('RGB')
    if name.startswith('guide__'):
        short = name[len('guide__'):]
        out = os.path.join(ROOT, 'public', 'images', 'guide', short + '.webp')
        w = WIDTH.get(short, 520 if im.width == im.height else 1200)
    else:
        out = os.path.join(ROOT, 'public', 'images', name + '.webp')
        w = 800 if im.width == im.height else 1200
    if im.width > w:
        im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    old = os.path.exists(out)
    im.save(out, 'WEBP', quality=82)
    e = log.get(name, {'n': 0}); e['n'] += 1; e['date'] = today; log[name] = e
    print(('差し替え' if old else '新規'), name, '→', os.path.relpath(out, ROOT), im.size)
json.dump(log, open(LOG, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'admin', 'make.py')], check=True)
