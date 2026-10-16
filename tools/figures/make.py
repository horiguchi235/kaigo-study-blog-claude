"""SVG図を作って src/figures/<name>.json に書き出す。
使い方：python3 tools/figures/make.py
記事では <fig name="<name>"> と1行書くと、その場所に図が入る。"""
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from figlib import *  # noqa
from top import *  # noqa
import figs_body  # noqa
import figs_care  # noqa

OUT = pathlib.Path(__file__).resolve().parents[2] / "src" / "figures"
OUT.mkdir(parents=True, exist_ok=True)

ALL = {}
for mod in (figs_body, figs_care):
    ALL.update(mod.FIGS)

only = sys.argv[1:]
for name, fn in ALL.items():
    if only and name not in only:
        continue
    d = fn()
    (OUT / f"{name}.json").write_text(json.dumps(d, ensure_ascii=False))
    print("wrote", name)
