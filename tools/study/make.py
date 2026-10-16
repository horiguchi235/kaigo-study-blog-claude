"""記事の表から「1問1答」と「暗記シート」のデータを作り、src/data/study.json に書き出す。
使い方：python3 tools/study/make.py   （記事を直したら実行し直す）

- 「○ | ×」の表            → ○×問題（×の行は「正しくは」として同じ行の○を解説に）
- 「選択肢の表現 | なぜ×」  → ×の問題（なぜ×を解説に）
- 「場面 | ○ 正解（| ×）」 → 答えを思い出すカード
- 「用語 | 意味」などの2列表 → 答えを思い出すカード
- 暗記シート：結論3行＋記事の表（太字をかくして覚える）
"""
import html
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[2]
ART = ROOT / "src" / "content" / "articles"
OUT = ROOT / "src" / "data" / "study.json"

ROUND = re.compile(r"[（(]第[\d・〜、,]+回[^）)]*[）)]")


def inline(s):
    """表のセルの markdown を簡単な HTML に"""
    s = html.escape(s.strip(), quote=False)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", s)
    s = s.replace("&lt;br&gt;", "<br>")
    return s


def plain(s):
    return re.sub(r"\*\*(.+?)\*\*", r"\1", s).strip()


def rounds(s):
    return "・".join(m.group(0).strip("（）()") for m in ROUND.finditer(s))


def strip_round(s):
    return ROUND.sub("", s).strip()


def empty(s):
    return plain(s) in ("", "—", "-", "－", "―")


def parse(md):
    fm, body = md.split("---", 2)[1:]
    meta = {}
    for k in ("title", "article", "category", "theme"):
        m = re.search(rf'^{k}: "?(.*?)"?$', fm, re.M)
        meta[k] = m.group(1) if m else ""
    meta["draft"] = bool(re.search(r"^draft: true", fm, re.M))
    # 編集メモ・解いてみようは除く
    body = re.sub(r"<!--.*?-->", "", body, flags=re.S)
    body = re.sub(r"<details>.*?</details>\s*</details>", "", body, flags=re.S)
    return meta, body.split("\n")


def build(path):
    meta, lines = parse(path.read_text())
    qa, sheet, concl = [], [], []
    sec = ""
    sub = ""
    i = 0
    while i < len(lines):
        l = lines[i]
        if l.startswith("## "):
            sec = re.sub(r"【.*?】", "", l[3:]).strip()
            sub = ""
        elif l.startswith("### "):
            sub = l[4:].strip()
        elif l.strip() == "**結論を3行で**":
            j = i + 1
            while j < len(lines) and (lines[j].strip() == "" or re.match(r"^\d\. ", lines[j])):
                if re.match(r"^\d\. ", lines[j]):
                    concl.append(inline(lines[j][3:]))
                j += 1
            i = j
            continue
        elif l.startswith("|") and i + 1 < len(lines) and re.match(r"^\|[-| :]+\|$", lines[i + 1]):
            hdr = [c.strip() for c in l.strip().strip("|").split("|")]
            rows = []
            j = i + 2
            while j < len(lines) and lines[j].startswith("|"):
                rows.append([c.strip() for c in lines[j].strip().strip("|").split("|")])
                j += 1
            i = j
            if hdr[0] == "科目":
                continue
            ctx = sub or sec
            title = "ひっかけパターン" if hdr[:2] == ["選択肢の表現", "なぜ×"] else ctx
            sheet.append({"h": inline(title), "head": [inline(h) for h in hdr], "rows": [[inline(c) for c in r] for r in rows]})
            qa.extend(questions(hdr, rows, sec, ctx))
            continue
        i += 1
    return meta, qa, sheet, concl


def questions(hdr, rows, sec, ctx):
    out = []
    n = len(hdr)
    h0 = plain(hdr[0])
    h1 = plain(hdr[1]) if n > 1 else ""
    tag = strip_round(re.sub(r"[①-⑳]\s*", "", ctx))
    # ○ | × の表
    if n == 2 and h0.startswith("○") and h1.startswith("×"):
        extra = h0.lstrip("○").strip()
        cls = extra if extra and extra not in ("正解", "正しい") else ""
        for r in rows:
            if len(r) < 2:
                continue
            o, x = r[0], r[1]
            src = rounds(o + x)
            if not empty(o):
                q = strip_round(o)
                out.append({"t": "ox", "q": inline(q) + (f"　…これは「{cls}」？" if cls else ""), "ans": "○", "exp": "", "sec": tag, "src": src})
            if not empty(x):
                q = strip_round(x)
                exp = "" if empty(o) else "正しくは：" + inline(strip_round(o))
                out.append({"t": "ox", "q": inline(q) + (f"　…これは「{cls}」？" if cls else ""), "ans": "×", "exp": exp, "sec": tag, "src": src})
        return out
    # ひっかけパターン
    if hdr[:2] == ["選択肢の表現", "なぜ×"]:
        for r in rows:
            if len(r) >= 2 and not empty(r[0]):
                out.append({"t": "ox", "q": inline(strip_round(r[0])), "ans": "×", "exp": inline(r[1]), "sec": "ひっかけパターン", "src": rounds(r[0])})
        return out
    # 場面 | ○ 正解（| ×）
    if n >= 2 and h1.startswith("○") and not h0.startswith("○") and h0:
        for r in rows:
            if len(r) < 2 or empty(r[0]) or empty(r[1]):
                continue
            ng = r[2] if n >= 3 and len(r) >= 3 and not empty(r[2]) else ""
            out.append({"t": "card", "q": inline(strip_round(r[0])), "a": inline(strip_round(r[1])),
                        "exp": ("× 選びがち：" + inline(ng)) if ng else "", "sec": tag, "src": rounds(r[0] + r[1])})
        return out
    # 回 | 事例 | 正解
    if n == 3 and h0 == "回" and ("正解" in plain(hdr[2])):
        for r in rows:
            if len(r) == 3 and not empty(r[1]):
                out.append({"t": "card", "q": inline(r[1]), "a": inline(r[2]), "exp": "", "sec": tag, "src": plain(r[0])})
        return out
    # 用語 | 意味 などの2列表
    if n == 2 and h0 and "○" not in h0 + h1 and "×" not in h0 + h1:
        for r in rows:
            if len(r) < 2 or empty(r[0]) or empty(r[1]):
                continue
            q = f"{inline(strip_round(r[0]))}　<small>（{html.escape(h1)}は？）</small>"
            out.append({"t": "card", "q": q, "a": inline(strip_round(r[1])), "exp": "", "sec": tag, "src": rounds(r[0] + r[1])})
        return out
    return out


def main():
    data = {}
    total = 0
    for p in sorted(ART.glob("*.md")):
        if p.stem.startswith("yomimono"):  # 読みもの記事は対象外
            continue
        meta, qa, sheet, concl = build(p)
        data[p.stem] = {**meta, "qa": qa, "sheet": sheet, "concl": concl}
        total += len(qa)
    OUT.write_text(json.dumps(data, ensure_ascii=False))
    print(f"{len(data)} articles, {total} questions")


if __name__ == "__main__":
    main()
