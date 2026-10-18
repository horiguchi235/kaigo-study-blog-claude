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
    s = s.replace("&lt;strong&gt;", "<strong>").replace("&lt;/strong&gt;", "</strong>")
    s = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", s)
    s = s.replace("&lt;br&gt;", "<br>")
    return s


def plain(s):
    return re.sub(r"\*\*(.+?)\*\*|</?strong>", lambda m: m.group(1) or "", s).strip()


def rounds(s):
    return "・".join(m.group(0).strip("（）()") for m in ROUND.finditer(s))


def strip_round(s):
    return ROUND.sub("", s).strip()


def empty(s):
    return plain(s) in ("", "—", "-", "－", "―")


def strip_quiz(body):
    """「過去問を解いてみよう」の<details>（入れ子あり）を外側ごと取り除く"""
    out, i = [], 0
    tag = re.compile(r"<details\b[^>]*>|</details>")
    while True:
        m = re.search(r"<details\b[^>]*>\s*<summary>[^<]*過去問", body[i:])
        if not m:
            out.append(body[i:]); break
        start = i + m.start()
        out.append(body[i:start])
        depth, j = 0, start
        for t in tag.finditer(body, start):
            depth += -1 if t.group().startswith("</") else 1
            if depth == 0:
                j = t.end(); break
        i = j
    return "".join(out)


def parse(md):
    fm, body = md.split("---", 2)[1:]
    meta = {}
    for k in ("title", "article", "category", "theme"):
        m = re.search(rf'^{k}: "?(.*?)"?$', fm, re.M)
        meta[k] = m.group(1) if m else ""
    meta["draft"] = bool(re.search(r"^draft: true", fm, re.M))
    # 編集メモ・解いてみようは除く
    body = re.sub(r"<!--.*?-->", "", body, flags=re.S)
    body = strip_quiz(body)
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
        elif l.strip() in ("**結論を3行で**", "**この記事のポイント**"):
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
            term, ans = inline(strip_round(r[0])), inline(strip_round(r[1]))
            item = {"t": "card", "q": term, "a": ans,
                    "exp": ("× 選びがち：" + inline(ng)) if ng else "", "sec": tag, "src": rounds(r[0] + r[1])}
            # 用語の行（場面ではない）は「〜とは？」と、逆向き（説明 → 用語）も作る
            TERM = ("年", "年代", "病気", "職種", "サービス", "器官", "部位", "損傷レベル", "障害", "商法", "考え方・ツール", "けが", "柱",
                    "感覚", "臓器", "段階", "用語", "制度", "法律", "人物", "機関", "施設", "症状", "疾患", "技法", "理論", "道具", "用具", "言葉", "感染症", "薬")
            if h0 in TERM and len(plain(term)) <= 30 and len(plain(ans)) >= 8:
                item["q"] = f"{term}　<small>（{'できごとは？' if h0 in ('年', '年代') else 'とは？'}）</small>"
                item["rq"] = f"{ans}　<small>（{html.escape(h0 if h0.endswith('？') else h0 + 'は？')}）</small>"
                item["ra"] = term
            out.append(item)
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
            person = "人物" in h0 or h0 in ("人", "人名", "提唱者", "人物・国")
            ask = lambda h: h if h.endswith("？") else f"{h}は？"
            hint = "何をした人？" if person and h1 in ("キーワード", "業績", "内容", "ポイント") else ask(h1)
            q = f"{inline(strip_round(r[0]))}　<small>（{html.escape(hint)}）</small>"
            term, ans = inline(strip_round(r[0])), inline(strip_round(r[1]))
            item = {"t": "card", "q": q, "a": ans, "exp": "", "sec": tag, "src": rounds(r[0] + r[1])}
            # 逆向き（説明 → 用語・人物）。用語が短いときだけ
            NOREV = ("場面", "様子", "ポイント", "項目", "対象外の例", "困りごと", "困っていること", "原因", "体の変化", "しくみ", "誰への虐待？", "分け方")
            if len(plain(term)) <= 30 and len(plain(ans)) >= 8 and h0 not in NOREV:
                item["rq"] = f"{ans}　<small>（{'誰？' if person else html.escape(ask(h0))}）</small>"
                item["ra"] = term
            out.append(item)
        return out
    return out


OX = ROOT / "tools" / "study" / "ox"


def apply_ox(aid, qa):
    """○×問題を、意味が分かる文に書き直したもの（tools/study/ox/<記事ID>.json）に差し替える。
    キー＝今の問題文（タグなし）＋"|"＋答え。値が null の問題は出さない。表を直してキーが変わったものは元の文のまま。"""
    f = OX / f"{aid}.json"
    if not f.exists():
        return qa
    m = json.loads(f.read_text())
    out = []
    for q in qa:
        if q["t"] == "ox":
            k = re.sub(r"<[^>]+>", "", q["q"]).strip() + "|" + q["ans"]
            if k in m:
                v = m[k]
                if v is None:
                    continue
                q = {**q, "q": html.escape(v.get("q") or "", quote=False) or q["q"], "exp": html.escape(v.get("exp") or "", quote=False), "fixed": 1}
        out.append(q)
    return out


def main():
    data = {}
    total = 0
    for p in sorted(ART.glob("*.md")):
        if p.stem.startswith("yomimono"):  # 読みもの記事は対象外
            continue
        meta, qa, sheet, concl = build(p)
        qa = apply_ox(p.stem, qa)
        data[p.stem] = {**meta, "qa": qa, "sheet": sheet, "concl": concl}
        total += len(qa)
    OUT.write_text(json.dumps(data, ensure_ascii=False))
    print(f"{len(data)} articles, {total} questions")


if __name__ == "__main__":
    main()
