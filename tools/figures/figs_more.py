"""関連知識（過去問未出題だが重要）を説明するための図。すべてこのブログ用に新しく描いたもの。"""
from figlib import *

FIGS = {}


def fig(name):
    def deco(fn):
        FIGS[name] = fn
        return fn
    return deco


BLUE = "#4a7fc1"
BLUE_SOFT = "#e3edf8"
GREEN = "#4f9a6b"
GREEN_SOFT = "#e3f2e8"


def box(x, y, w, h, title, sub=None, fill=ACCENT_SOFT, stroke=ACCENT, tsize=15, ssize=12):
    o = rect(x, y, w, h, fill, stroke, 1.5, 8)
    if sub:
        o += text(x + w / 2, y + h / 2 - 10, title, tsize, INK, "middle", 700)
        o += text(x + w / 2, y + h / 2 + 13, sub, ssize, MUTED)
    else:
        o += text(x + w / 2, y + h / 2, title, tsize, INK, "middle", 700)
    return o


@fig("kyori")
def kyori():
    """対人距離（パーソナルスペース）の4区分"""
    W, H = 640, 300
    cx, cy = 160, 150
    rings = [(135, "#fff7ef"), (100, "#fdebd9"), (65, "#f9d6b6"), (30, "#f2b98b")]
    o = ""
    for r, col in rings:
        o += f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{col}" stroke="{ACCENT}" stroke-width="1.2"/>'
    o += f'<circle cx="{cx}" cy="{cy}" r="7" fill="{INK}"/>'
    for r, s in ((30, "密接"), (65, "個人"), (100, "社会"), (135, "公衆")):
        o += text(cx, cy - r + (14 if r > 30 else 12), s, 11, INK, "middle", 700)
    rows = [("密接距離", "〜約45cm", "家族など。身体介護で入る距離", "#f2b98b"),
            ("個人距離", "約45〜120cm", "親しい人との会話。相談はここ", "#f9d6b6"),
            ("社会距離", "約120〜360cm", "仕事上・初対面のやりとり", "#fdebd9"),
            ("公衆距離", "約360cm〜", "講演など一方向の伝達", "#fff7ef")]
    for i, (n, d, s, col) in enumerate(rows):
        y = 50 + i * 64
        o += rect(320, y - 18, 16, 36, col, ACCENT, 1, 3)
        o += text(346, y - 8, f"{n}（{d}）", 14, INK, "start", 700)
        o += text(346, y + 14, s, 12, MUTED, "start")
    return {"svg": svg(W, H, o, "対人距離は密接・個人・社会・公衆の4区分"),
            "caption": "人と人との距離感（ホールの分類）。介護では**身体に触れる場面ほど密接距離**に入るので、**声かけ・同意**をしてから近づくのが基本です。"}


@fig("nenkin")
def nenkin():
    """公的年金の「階建て」"""
    W, H = 640, 250
    o = ""
    base_y, h = 205, 58
    # 1階
    o += box(40, base_y - h, 560, h, "1階：国民年金（基礎年金）", "20〜59歳の全員が加入（第1号・第2号・第3号）", ACCENT_SOFT, ACCENT)
    # 2階
    o += box(250, base_y - 2 * h - 8, 350, h, "2階：厚生年金", "会社員・公務員（第2号）", BLUE_SOFT, BLUE)
    # 3階
    o += box(250, base_y - 3 * h - 16, 350, h - 6, "3階：企業年金・iDeCo など", None, GREEN_SOFT, GREEN, 14)
    o += box(40, base_y - 2 * h - 8, 200, h, "国民年金基金", "自営業など（第1号）", GREEN_SOFT, GREEN, 14, 11)
    o += text(140, base_y - 3 * h - 2, "第1号は2階の", 12, MUTED)
    o += text(140, base_y - 3 * h + 16, "厚生年金がない", 12, MUTED)
    o += text(320, 232, "老齢基礎年金は原則65歳から（受給資格期間10年以上）", 13, INK, "middle", 700)
    return {"svg": svg(W, H, o, "公的年金は1階が国民年金、2階が厚生年金、3階が企業年金など"),
            "caption": "公的年金は「**1階＝国民年金（全員）**」「**2階＝厚生年金（会社員・公務員）**」の2階建て。その上に任意の3階部分があります。"}


@fig("suibun")
def suibun():
    """1日の水分の出入り（成人のめやす）"""
    W, H = 640, 300
    o = ""
    L, top, scale = 80, 30, 0.17  # mL→px

    def stack(y, parts, title):
        s = text(L - 12, y + 22, title, 15, INK, "end", 700)
        x = L
        for v, n, col in parts:
            w = v * scale
            s += rect(x, y, w, 44, col, "#fff", 2, 4)
            s += text(x + w / 2, y + 15, n, 13, INK, "middle", 700)
            s += text(x + w / 2, y + 32, f"{v}mL", 12, INK)
            x += w
        s += text(x + 8, y + 22, "計 約2,500mL", 13, ACCENT, "start", 700)
        return s

    o += stack(top + 20, [(1200, "飲み水", "#f9d6b6"), (1000, "食べ物の水分", "#fdebd9"), (300, "代謝水", "#fff3e6")], "入る")
    o += stack(top + 120, [(1600, "尿・便", BLUE_SOFT), (900, "不感蒸泄", "#eef3f9")], "出る")
    o += text(320, 250, "不感蒸泄＝皮膚や呼吸から気づかないうちに出ていく水分（汗は含まない）", 12, MUTED)
    o += text(320, 274, "代謝水＝栄養素が体内で燃えるときにできる水", 12, MUTED)
    return {"svg": svg(W, H, o, "1日に入る水分と出る水分はどちらも約2500mL"),
            "caption": "成人の1日の水分の出入り（めやす）。**入る量と出る量はほぼ同じ約2,500mL**。高齢者は口渇を感じにくく、**こまめな水分補給**が脱水予防の基本です。"}


@fig("jiritsudo")
def jiritsudo():
    """障害高齢者の日常生活自立度（寝たきり度）"""
    W, H = 640, 320
    rows = [("J", "生活自立", "障害はあるが、ほぼ自立。ひとりで外出できる", "#fff3e6"),
            ("A", "準寝たきり", "家の中はおおむね自立。介助なしには外出しない", "#fde3c8"),
            ("B", "寝たきり", "家の中でも介助が必要。日中もベッド上中心だが座位は保てる", "#f9caa0"),
            ("C", "寝たきり", "1日中ベッドの上。排泄・食事・着替えに介助が必要", "#f2ad78")]
    o = ""
    for i, (k, n, s, col) in enumerate(rows):
        y = 20 + i * 72
        x = 30 + i * 22
        o += rect(x, y, 70, 58, col, ACCENT, 1.5, 8)
        o += text(x + 35, y + 22, k, 22, INK, "middle", 700)
        o += text(x + 35, y + 44, "ランク", 11, MUTED)
        o += text(x + 86, y + 18, n, 15, INK, "start", 700)
        o += text(x + 86, y + 42, s, 12, INK, "start")
    o += arrow(612, 30, 612, 290, 3)
    o += text(596, 160, "重", 14, ACCENT, "end", 700)
    return {"svg": svg(W, H, o, "障害高齢者の日常生活自立度はJ A B Cの順に重くなる"),
            "caption": "**障害高齢者の日常生活自立度（寝たきり度）**。J→A→B→Cの順に重くなります。「**外出できるか**（J／A）」「**座位が保てるか**（B／C）」が分かれ目。"}


@fig("nesshou")
def nesshou():
    """熱傷の深さ"""
    W, H = 640, 300
    o = ""
    layers = [(40, 40, "表皮", "#f8e1cf"), (80, 70, "真皮", "#f1c9ae"), (150, 80, "皮下組織", "#f6e6b8")]
    for y, h, n, col in layers:
        o += rect(40, y, 300, h, col, "#fff", 2, 0)
        o += text(56, y + h / 2, n, 14, INK, "start", 700)
    marks = [(150, 60, "Ⅰ度", "赤くなり、ひりひり痛む"),
             (215, 120, "Ⅱ度", "水ぶくれ（水疱）・強い痛み"),
             (280, 200, "Ⅲ度", "白や黒に変色・痛みを感じにくい")]
    for i, (x, depth, n, s) in enumerate(marks):
        o += line(x, 40, x, depth, ACCENT, 6)
        y = 70 + i * 70
        o += text(370, y - 10, n, 16, ACCENT, "start", 700)
        o += text(370, y + 14, s, 13, INK, "start")
    o += text(320, 270, "深くまで届くほど重い／狭くても高齢者は重症になりやすい", 12, MUTED)
    return {"svg": svg(W, H, o, "熱傷はⅠ度が表皮、Ⅱ度が真皮、Ⅲ度が皮下組織まで"),
            "caption": "熱傷（やけど）の深さ。**Ⅲ度は神経まで傷むので痛みが少ない**のがひっかけポイント。応急手当はまず**流水で冷やす**、服の上からかかった熱湯は**服を脱がさずその上から冷やす**、**水疱はつぶさない**。"}


@fig("kansen-keiro")
def kansen_keiro():
    """感染経路の3分類"""
    W, H = 640, 300
    cols = [("接触感染", "手や物を介してうつる", "疥癬・MRSA・ノロ（手→口）・腸管出血性大腸菌", ACCENT_SOFT, ACCENT),
            ("飛沫感染", "せきやくしゃみの粒\n（5μm以上）\n1〜2mで落ちる", "インフルエンザ・新型コロナ・風しん", BLUE_SOFT, BLUE),
            ("空気感染", "小さな粒（5μm未満）\nが空気中を\nただよう", "結核・麻しん・水痘", GREEN_SOFT, GREEN)]
    o = ""
    for i, (n, s, ex, fill, st) in enumerate(cols):
        x = 20 + i * 205
        o += rect(x, 30, 190, 240, fill, st, 1.5, 10)
        o += text(x + 95, 58, n, 18, INK, "middle", 700)
        for j, ln in enumerate(s.split("\n")):
            o += text(x + 95, 92 + j * 19, ln, 12, INK)
        o += line(x + 20, 150, x + 170, 150, st, 1)
        o += text(x + 95, 172, "例", 12, MUTED)
        words = ex.split("・")
        for j, wd in enumerate(words):
            o += text(x + 95, 196 + j * 20, wd, 13, INK, "middle", 700)
    return {"svg": svg(W, H, o, "感染経路は接触感染・飛沫感染・空気感染"),
            "caption": "感染経路の3分類。ノロウイルスや腸管出血性大腸菌は、手や食品を介して**口から入る（経口感染）**ので接触感染の対策が中心。**空気感染（結核・麻しん・水痘）だけは通常のマスクでは防ぎきれず、個室管理と換気**が基本。どの経路でも**1ケア1手洗い**が土台です。"}


@fig("kadai")
def kadai():
    """生活課題の「要因→顕在→潜在」"""
    W, H = 640, 260
    o = ""
    items = [("要因", "顕在的な課題の原因", "例：血管性認知症", "#fff3e6"),
             ("顕在的な課題", "いま現れている課題", "例：ひとりで外に出てしまう", "#fde3c8"),
             ("潜在的な課題", "放っておくと起こる課題", "例：交通事故にあう危険", "#f9caa0")]
    for i, (n, s, ex, col) in enumerate(items):
        x = 15 + i * 210
        o += rect(x, 40, 190, 150, col, ACCENT, 1.5, 10)
        o += text(x + 95, 72, n, 17, INK, "middle", 700)
        o += text(x + 95, 104, s, 12, MUTED)
        o += text(x + 95, 150, ex, 12, INK, "middle", 700)
        if i < 2:
            o += arrow(x + 192, 115, x + 208, 115, 3)
    o += text(320, 228, "アセスメントでは「潜在的な課題」まで見通して優先順位を決める", 13, INK, "middle", 700)
    return {"svg": svg(W, H, o, "生活課題は要因から顕在的課題、潜在的課題へとつながる"),
            "caption": "生活課題の見方。今の困りごと（**顕在的課題**）だけでなく、その**要因**と、放っておくと起こる**潜在的課題**までつなげて考えます。"}
