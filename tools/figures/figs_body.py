"""からだのしくみの図"""
from figlib import *

FIGS = {}


def fig(name):
    def deco(fn):
        FIGS[name] = fn
        return fn
    return deco


def box(x, y, w, h, title, sub=None, fill="#fff", stroke=INK, tsize=16, color=INK):
    o = rect(x, y, w, h, fill, stroke, 1.5, rx=8)
    if sub:
        o += text(x + w / 2, y + h / 2 - 10, title, tsize, color, "middle", 700)
        o += text(x + w / 2, y + h / 2 + 12, sub, 12, MUTED)
    else:
        o += text(x + w / 2, y + h / 2 + 1, title, tsize, color, "middle", 700)
    return o


def dbl(x1, y1, x2, y2, color=MUTED, w=2):
    return (f'<line x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}" stroke="{color}" stroke-width="{w}" '
            f'marker-start="url(#ah)" marker-end="url(#ah)"/>')


@fig("icf")
def icf():
    W, H = 620, 330
    o = ""
    o += box(210, 20, 200, 52, "健康状態", "病気・けが・加齢", ACCENT_SOFT, ACCENT)
    o += rect(14, 104, 592, 82, "none", LINE, 1.5, rx=10, extra='stroke-dasharray="5 4"')
    o += text(30, 98, "生活機能", 13, ACCENT, "start", 700)
    o += box(26, 116, 170, 58, "心身機能・身体構造", "体や心の働き", "#fff", INK, 15)
    o += box(225, 116, 170, 58, "活動", "生活の行為", "#fff", INK, 17)
    o += box(424, 116, 170, 58, "参加", "社会での役割", "#fff", INK, 17)
    o += dbl(198, 145, 223, 145) + dbl(397, 145, 422, 145)
    o += dbl(310, 74, 310, 114)
    o += rect(14, 222, 592, 82, "none", LINE, 1.5, rx=10, extra='stroke-dasharray="5 4"')
    o += text(30, 316, "背景因子", 13, ACCENT, "start", 700)
    o += box(80, 234, 200, 58, "環境因子", "人・物・建物・制度", "#fff", INK, 17)
    o += box(340, 234, 200, 58, "個人因子", "年齢・経歴・性格", "#fff", INK, 17)
    o += dbl(180, 188, 180, 232) + dbl(440, 188, 440, 232)
    return {"svg": svg(W, H, o, "ICFの構成要素：健康状態、生活機能（心身機能・身体構造、活動、参加）、背景因子（環境因子、個人因子）が相互に影響する"),
            "caption": "ICFは、すべての要素が**矢印で双方向に影響し合う**モデル。**背景因子＝環境因子＋個人因子**です。"}


@fig("nou")
def nou():
    W, H = 640, 400
    outline = ("M110,190 C108,82 210,40 310,42 C430,44 512,100 506,182 C503,232 480,258 440,260 "
               "C410,262 390,250 368,252 L250,262 C205,268 158,262 128,240 C114,228 110,210 110,190 Z")
    o = f'<defs><clipPath id="brainclip"><path d="{outline}"/></clipPath></defs>'
    # 小脳・脳幹（大脳の後ろに）
    o += f'<path d="M330,240 C336,290 340,320 346,370 L384,370 C376,320 372,290 372,240 Z" fill="#e7c3b4" stroke="#b98d7d" stroke-width="1.5"/>'
    o += f'<ellipse cx="430" cy="276" rx="66" ry="36" fill="#f3df95" stroke="#c9ab4e" stroke-width="1.5"/>'
    for i in range(4):
        o += f'<path d="M{372 + i * 4},{262 + i * 9} Q430,{250 + i * 12} {492 - i * 4},{262 + i * 9}" fill="none" stroke="#c9ab4e" stroke-width="1"/>'
    lobes = [
        ("#f8c9a3", "90,20 280,20 258,172 205,192 90,222"),
        ("#a9d8bd", "280,20 420,20 410,140 345,160 258,172"),
        ("#a7c9ea", "130,222 205,192 345,160 398,215 398,310 100,310"),
        ("#d9bdea", "420,20 530,20 530,310 398,310 398,215 345,160 410,140"),
    ]
    o += '<g clip-path="url(#brainclip)">'
    for col, pts in lobes:
        o += f'<polygon points="{pts}" fill="{col}"/>'
    o += '</g>'
    o += f'<path d="{outline}" fill="none" stroke="{INK}" stroke-width="2"/>'
    o += f'<path d="M160,212 C220,196 300,170 352,162" fill="none" stroke="{INK}" stroke-width="1.6"/>'  # 外側溝
    o += f'<path d="M300,44 C292,90 272,130 260,172" fill="none" stroke="{INK}" stroke-width="1.6"/>'  # 中心溝
    o += text(180, 120, "前頭葉", 19, INK, "middle", 700)
    o += text(338, 96, "頭頂葉", 19, INK, "middle", 700)
    o += text(260, 228, "側頭葉", 19, INK, "middle", 700)
    o += text(452, 170, "後頭葉", 19, INK, "middle", 700)
    o += text(430, 290, "小脳", 15, INK, "middle", 700)
    o += text(358, 384, "脳幹（延髄）", 13, INK, "middle", 700)
    # 働き
    o += label(150, 150, "運動・意欲・話す（ブローカ）", 12, ACCENT)
    o += label(340, 124, "皮膚の感覚", 12, ACCENT)
    o += label(250, 252, "聞く・言葉の理解", 12, ACCENT)
    o += label(452, 196, "見る（視覚）", 12, ACCENT)
    o += label(520, 326, "体のバランス", 12, ACCENT)
    o += label(470, 370, "呼吸・心臓の中枢", 12, ACCENT)
    o += text(110, 30, "← 顔側（前）", 13, MUTED, "start")
    return {"svg": svg(W, H, o, "大脳の機能局在：前頭葉は運動、頭頂葉は皮膚感覚、側頭葉は聴覚、後頭葉は視覚。小脳は平衡、延髄は呼吸の中枢"),
            "caption": "左から見た脳。**前頭葉＝運動・ブローカ野、頭頂葉＝皮膚感覚、側頭葉＝聴覚・ウェルニッケ野、後頭葉＝視覚**。脳の内側にある**海馬＝記憶、扁桃体＝情動**も一緒に覚えましょう。"}


@fig("shinzou")
def shinzou():
    W, H = 620, 470
    RED, BLUE = "#d9534f", "#4a7fc1"
    o = ""
    o += box(220, 18, 180, 54, "肺", "ガス交換", "#fbecec", "#c98a8a", 18)
    o += box(220, 398, 180, 54, "全身", "酸素を届ける", "#fbecec", "#c98a8a", 18)
    # 心臓 4室（正面から見た図：本人の右心＝画面の左）
    o += rect(150, 170, 150, 160, "#e3ecf7", BLUE, 2, rx=18)
    o += rect(320, 170, 150, 160, "#f9e1e0", RED, 2, rx=18)
    o += line(150, 245, 300, 245, BLUE, 2) + line(320, 245, 470, 245, RED, 2)
    o += text(225, 208, "右心房", 16, INK, "middle", 700) + text(225, 288, "右心室", 16, INK, "middle", 700)
    o += text(395, 208, "左心房", 16, INK, "middle", 700) + text(395, 288, "左心室", 16, INK, "middle", 700)
    o += text(225, 312, "静脈血", 12, BLUE) + text(395, 312, "動脈血", 12, RED)
    # 肺循環
    o += f'<path d="M240,300 C110,300 110,60 218,52" fill="none" stroke="{BLUE}" stroke-width="4" marker-end="url(#ah)"/>'
    o += f'<path d="M402,52 C520,60 470,180 420,200" fill="none" stroke="{RED}" stroke-width="4" marker-end="url(#ah)"/>'
    o += label(96, 150, "肺動脈", 16, BLUE)
    o += label(96, 174, "（静脈血）", 13, BLUE)
    o += label(520, 120, "肺静脈", 16, RED)
    o += label(520, 144, "（動脈血）", 13, RED)
    # 体循環
    o += f'<path d="M420,316 C520,330 470,420 404,424" fill="none" stroke="{RED}" stroke-width="4" marker-end="url(#ah)"/>'
    o += f'<path d="M218,424 C120,410 110,240 196,206" fill="none" stroke="{BLUE}" stroke-width="4" marker-end="url(#ah)"/>'
    o += label(532, 380, "大動脈", 16, RED)
    o += label(92, 340, "大静脈", 16, BLUE)
    o += arrow(225, 226, 225, 266, 2.5, BLUE) + arrow(395, 226, 395, 266, 2.5, RED)
    o += badge(310, 120, "肺動脈には静脈血！", ACCENT, "#fff", 14)
    return {"svg": svg(W, H, o, "血液の流れ：右心室から肺動脈（静脈血）で肺へ、肺静脈（動脈血）で左心房、左心室から大動脈で全身へ、大静脈で右心房へ戻る"),
            "caption": "正面から見た心臓なので、本人の**右心は画面の左**。青＝静脈血（酸素が少ない）、赤＝動脈血（酸素が多い）。名前は「動脈・静脈」でも、**肺動脈には静脈血、肺静脈には動脈血**が流れます。"}


@fig("enge")
def enge():
    W, H = 640, 430
    o = '<g transform="translate(30 0)">'
    # 顔の輪郭（左向き）
    o += (f'<path d="M330,30 C230,26 170,50 150,90 C140,108 128,118 120,132 C116,140 126,146 136,148 '
          f'C132,160 134,168 142,172 C136,182 140,192 150,196 C150,214 160,224 190,226 C210,228 224,236 228,260 '
          f'L232,410 L360,410 L356,300 C370,240 400,200 400,140 C400,80 380,34 330,30 Z" fill="#fbe7d8" stroke="{SKIN_DARK}" stroke-width="2"/>')
    # 鼻腔
    o += f'<path d="M150,104 C190,96 250,98 300,104 L300,128 C250,126 200,126 156,124 Z" fill="#fff" stroke="{BED_LINE}" stroke-width="1.5"/>'
    # 口腔
    o += f'<path d="M150,150 C190,140 250,140 290,146 L296,184 C250,192 190,194 152,184 Z" fill="#fff" stroke="{BED_LINE}" stroke-width="1.5"/>'
    # 舌
    o += f'<path d="M160,184 C180,160 240,152 278,166 C292,174 298,190 294,206 C250,210 200,206 160,196 Z" fill="#f0a7a0" stroke="#d37f78" stroke-width="1.5"/>'
    # 硬口蓋・軟口蓋
    o += line(156, 136, 268, 136, "#b9a08a", 6)
    o += f'<path d="M268,136 C286,138 298,148 300,164" fill="none" stroke="{ACCENT}" stroke-width="7" stroke-linecap="round"/>'
    # 咽頭（縦の通り道）
    o += f'<path d="M300,104 L330,104 C334,180 334,230 330,262 L300,262 C302,220 302,160 300,104 Z" fill="#fff" stroke="{BED_LINE}" stroke-width="1.5"/>'
    # 気管（前）と食道（後ろ）
    o += f'<path d="M272,262 L304,262 L306,410 L274,410 Z" fill="#e3ecf7" stroke="#7d9cc4" stroke-width="1.5"/>'
    for yy in range(280, 410, 18):
        o += line(276, yy, 304, yy, "#a9bfdc", 3)
    o += f'<path d="M310,262 L334,262 L338,410 L314,410 Z" fill="#f6e3cf" stroke="#c9a37f" stroke-width="1.5"/>'
    # 喉頭蓋
    o += f'<path d="M300,246 C290,236 280,230 272,232" fill="none" stroke="{ACCENT}" stroke-width="7" stroke-linecap="round"/>'
    # 食塊の流れ
    o += circle(250, 176, 9, "#9d6b3f")
    o += f'<path d="M262,176 C300,180 318,200 318,240 L322,330" fill="none" stroke="#9d6b3f" stroke-width="3" stroke-dasharray="6 5" marker-end="url(#ah)"/>'
    # ラベル
    o += leader(220, 112, 110, 60, "鼻腔", "end")
    o += leader(292, 150, 420, 92, "軟口蓋", "start", 14, ACCENT)
    o += text(424, 114, "鼻への道をふさぐ", 12, ACCENT, "start")
    o += leader(200, 196, 100, 236, "舌", "end")
    o += text(96, 258, "食塊を奥へ送る", 12, INK, "end")
    o += leader(316, 200, 420, 180, "咽頭", "start")
    o += leader(282, 236, 420, 236, "喉頭蓋", "start", 14, ACCENT)
    o += text(424, 258, "気管にふたをする", 12, ACCENT, "start")
    o += leader(290, 340, 190, 330, "気管（前）", "end")
    o += leader(326, 360, 420, 350, "食道（後ろ）", "start")
    o += leader(250, 176, 190, 290, "食塊", "end")
    o += "</g>"
    return {"svg": svg(W, H, o, "飲み込むしくみ：軟口蓋が鼻への道を、喉頭蓋が気管への道をふさぎ、食塊は食道へ送られる"),
            "caption": "横から見た口とのどの断面（左が顔）。飲み込む瞬間（**咽頭期**）に、**軟口蓋**が鼻への道を、**喉頭蓋**が気管への道をふさぎます。**気管は前、食道は後ろ**にあるので、ここがうまく閉じないと**誤嚥**になります。"}


@fig("kinniku")
def kinniku():
    W, H = 640, 520
    p = Person((300, 270), face=1, torso=178, head=180, arm_n=(28, 18), arm_f=(30, 20), leg_n=(2, 358), leg_f=(358, 2), scale=2.1)
    j = p.joints()
    o = p.draw()

    def on(a, b, t, off, rx, ry, col, dash=False):
        """線分a→bの t 位置に、off（体の前＋/後ろ−）だけずらした楕円"""
        ax, ay = a; bx, by = b
        x, y = ax + (bx - ax) * t, ay + (by - ay) * t
        ln = math.hypot(bx - ax, by - ay)
        nx, ny = (by - ay) / ln, -(bx - ax) / ln  # 法線
        if nx < 0:
            nx, ny = -nx, -ny
        x += nx * off; y += ny * off
        ang = math.degrees(math.atan2(by - ay, bx - ax))
        d = ' stroke-dasharray="4 3"' if dash else ""
        return (x, y), f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(rx)}" ry="{f(ry)}" transform="rotate({f(ang)} {f(x)} {f(y)})" fill="{col}" stroke="#a5452a" stroke-width="1.5" opacity="0.9"{d}/>'
    AG = "#f08a6c"   # 抗重力筋
    MU = "#f7c0a8"
    items = [
        (j["sh"], j["eln"], 0.18, 0, 14, 12, MU, "三角筋", "腕を横に上げる", "front", False),
        (j["sh"], j["eln"], 0.55, 8, 20, 7, MU, "上腕二頭筋", "肘を曲げる", "front", False),
        (j["sh"], j["eln"], 0.55, -8, 20, 7, MU, "上腕三頭筋", "肘を伸ばす", "back", False),
        (j["hip"], j["sh"], 0.08, 14, 14, 9, MU, "腸腰筋", "股関節を曲げる", "front", True),
        (j["hip"], j["kn" + "n"], 0.05, -14, 16, 14, AG, "大殿筋 ★", "股関節を伸ばす", "back", False),
        (j["hip"], j["knn"], 0.5, 12, 30, 9, AG, "大腿四頭筋 ★", "膝を伸ばす", "front", False),
        (j["hip"], j["knn"], 0.5, -12, 30, 9, MU, "大腿二頭筋（ハムストリングス）", "膝を曲げる", "back", False),
        (j["knn"], j["ann"], 0.35, -11, 24, 9, AG, "下腿三頭筋 ★", "足首を下に（底屈）", "back", False),
        (j["knn"], j["ann"], 0.4, 9, 24, 5, MU, "前脛骨筋", "足首を上に（背屈）", "front", False),
    ]
    fy = {"front": 70, "back": 70}
    for a, b, t, off, rx, ry, col, name, act, side, dash in items:
        (x, y), e = on(a, b, t, off, rx, ry, col, dash)
        o += e
        ty = fy[side]
        fy[side] += 50
        tx = 400 if side == "front" else 230
        anchor = "start" if side == "front" else "end"
        o += line(x, y, tx, ty, MUTED, 1) + circle(x, y, 2.5, INK)
        dx = 4 if anchor == "start" else -4
        o += text(tx + dx, ty - 8, name, 14, INK, anchor, 700)
        o += text(tx + dx, ty + 11, act, 12, ACCENT, anchor, 700)
    o += text(W / 2, 505, "★ ＝ 抗重力筋（立った姿勢を保つ筋肉）　点線 ＝ 体の奥にある筋肉", 12, MUTED)
    o += text(560, 30, "体の前 →", 13, MUTED) + text(80, 30, "← 背中側", 13, MUTED)
    return {"svg": svg(W, H, o, "関節を動かす主な筋肉：上腕二頭筋は肘を曲げ、上腕三頭筋は伸ばす。大腿四頭筋は膝を伸ばし、ハムストリングスは曲げる"),
            "caption": "右を向いて立った人を横から見た図。**曲げる筋肉と伸ばす筋肉はペア**で、反対側にあります。**大腿四頭筋・大殿筋・下腿三頭筋**は立つための**抗重力筋**。"}


@fig("jokusou")
def jokusou():
    W, H = 640, 250
    o = rect(40, 150, 560, 22, "#fffaf2", BED_LINE, 2, rx=6)
    p = Person((300, 118), face=-1, torso=90, head=92, arm_n=(272, 270), arm_f=(272, 270), leg_n=(270, 270), leg_f=(268, 268), foot_n=180, foot_f=180, scale=2.3)
    o += p.draw()
    j = p.joints()
    pts = [(j["head"][0], "後頭部"), (j["sh"][0] + 22, "肩甲骨部"), (j["eln"][0], "肘"), (j["hip"][0], "仙骨部"), (j["ann"][0], "踵（かかと）")]
    for i, (x, n) in enumerate(pts):
        big = n == "仙骨部"
        y = 150
        o += circle(x, y, 12 if big else 8, "#d9534f", "#fff", 2)
        o += text(x, 200 + (0 if i % 2 == 0 else 24), n, 15 if big else 13, "#b3412e" if big else INK, "middle", 700)
        o += line(x, y + 12, x, 186 + (0 if i % 2 == 0 else 24), "#d9534f", 1)
    sx = j["hip"][0]
    o += badge(sx, 40, "いちばん多いのは仙骨部", ACCENT, "#fff", 14)
    return {"svg": svg(W, H, o, "仰臥位で褥瘡ができやすい部位：後頭部、肩甲骨部、肘、仙骨部、踵。最も多いのは仙骨部"),
            "caption": "仰臥位で**骨が出っ張って体重がかかる所**が好発部位。側臥位では**耳・肩・腰の横（大転子部）・膝の外側・くるぶし**、座位では**坐骨部**に注意します。"}


@fig("me")
def me():
    W, H = 600, 320
    o = ""
    cx, cy, r = 300, 160, 110
    o += circle(cx, cy, r, "#fff", INK, 2.5)
    o += circle(cx, cy, r - 8, "none", "#d9534f", 3)  # 網膜（内側）
    o += f'<path d="M{cx - r + 4},{cy - 52} C{cx - r - 40},{cy - 30} {cx - r - 40},{cy + 30} {cx - r + 4},{cy + 52}" fill="#e8f3fb" stroke="{INK}" stroke-width="2"/>'  # 角膜
    o += line(cx - r + 14, cy - 60, cx - r + 14, cy - 26, "#6b8fb8", 6) + line(cx - r + 14, cy + 26, cx - r + 14, cy + 60, "#6b8fb8", 6)  # 虹彩
    o += f'<ellipse cx="{cx - r + 34}" cy="{cy}" rx="18" ry="40" fill="#f6e7b6" stroke="#c9ab4e" stroke-width="2"/>'  # 水晶体
    o += f'<path d="M{cx + r - 4},{cy - 14} L{cx + r + 90},{cy - 18} L{cx + r + 90},{cy + 18} L{cx + r - 4},{cy + 14} Z" fill="#f3d2b8" stroke="{SKIN_DARK}" stroke-width="1.5"/>'  # 視神経
    o += leader(cx - r - 26, cy + 10, 60, 270, "角膜", "middle")
    o += leader(cx - r + 34, cy + 30, 190, 290, "水晶体（白内障で濁る）", "middle", 13, ACCENT)
    o += leader(cx + 10, cy + 20, 330, 290, "硝子体", "middle")
    o += leader(cx + 72, cy - 74, 470, 40, "網膜（光を感じる）", "start")
    o += leader(cx + r + 50, cy, 500, 220, "視神経", "start")
    o += text(cx - r - 30, 30, "光 →", 14, MUTED)
    return {"svg": svg(W, H, o, "眼の構造：角膜、水晶体、硝子体、網膜、視神経。白内障は水晶体が濁る"),
            "caption": "横から見た眼。光は**角膜 → 水晶体 → 硝子体 → 網膜**と進みます。**白内障＝水晶体の濁り**、**緑内障＝眼圧で視神経が傷み視野が欠ける**、**加齢黄斑変性＝網膜の中心が傷む**。"}


@fig("mimi")
def mimi():
    W, H = 620, 300
    o = ""
    o += rect(20, 40, 180, 200, "#faf6f0", "none", 0, rx=10) + rect(210, 40, 140, 200, "#f5efe6", "none", 0, rx=10) + rect(360, 40, 240, 200, "#faf6f0", "none", 0, rx=10)
    o += text(110, 62, "外耳", 16, INK, "middle", 700) + text(280, 62, "中耳", 16, INK, "middle", 700) + text(480, 62, "内耳", 16, INK, "middle", 700)
    o += f'<path d="M40,110 C30,150 40,200 70,210 C80,180 70,150 90,140 L200,140 L200,166 L90,166 C80,180 90,210 70,215" fill="#f3d2b8" stroke="{SKIN_DARK}" stroke-width="2"/>'
    o += line(206, 118, 206, 188, ACCENT, 5)  # 鼓膜
    o += circle(228, 140, 9, "#e9d9b8", "#b59a62", 2) + circle(256, 128, 8, "#e9d9b8", "#b59a62", 2) + circle(286, 140, 7, "#e9d9b8", "#b59a62", 2)
    o += line(228, 140, 256, 128, "#b59a62", 4) + line(256, 128, 286, 140, "#b59a62", 4) + line(286, 140, 360, 146, "#b59a62", 4)
    # 蝸牛（うずまき）
    o += f'<path d="M470,190 m-46,0 a46,46 0 1,0 92,0 a40,40 0 1,0 -80,0 a30,30 0 1,0 60,0 a20,20 0 1,0 -40,0 a10,10 0 1,0 20,0" fill="none" stroke="#7d9cc4" stroke-width="7"/>'
    o += f'<path d="M380,110 C390,70 440,70 446,110 M400,110 C420,80 470,86 470,120 M420,122 C450,96 500,108 490,140" fill="none" stroke="#a7c9ea" stroke-width="6"/>'
    o += label(206, 210, "鼓膜", 13, ACCENT)
    o += label(258, 96, "耳小骨", 13, ACCENT)
    o += text(280, 262, "ツチ骨・キヌタ骨・アブミ骨", 12, INK, "middle", 700)
    o += label(470, 262, "蝸牛：音を感じる", 12, INK)
    o += label(560, 90, "三半規管：平衡", 12, INK)
    o += label(110, 262, "外耳道：音の通り道", 12, INK)
    return {"svg": svg(W, H, o, "耳の構造：外耳、中耳（鼓膜と耳小骨）、内耳（蝸牛と三半規管）"),
            "caption": "音は**外耳道 → 鼓膜 → 耳小骨（中耳）→ 蝸牛（内耳）**と伝わります。**伝音性難聴＝外耳・中耳**の障害、**感音性難聴（老人性難聴）＝内耳より奥**の障害です。"}


@fig("kaigohoken")
def kaigohoken():
    W, H = 640, 400
    o = ""
    o += box(220, 20, 200, 64, "保険者", "市町村・特別区", ACCENT_SOFT, ACCENT, 18)
    o += box(20, 250, 200, 80, "被保険者", "第1号 65歳以上 / 第2号 40〜64歳", "#fff", INK, 18)
    o += box(420, 250, 200, 80, "サービス事業者", "施設・居宅・地域密着型", "#fff", INK, 17)
    o += box(450, 120, 170, 54, "国保連", "請求の審査・支払", "#fff", MUTED, 15)
    o += arrow(110, 248, 220, 76, 2.5) + label(132, 150, "① 保険料", 13, ACCENT)
    o += arrow(150, 248, 250, 88, 2.5) + label(232, 186, "② 認定の申請", 13, ACCENT)
    o += arrow(280, 88, 190, 248, 2.5, MUTED) + label(220, 226, "③ 要介護認定", 13, MUTED)
    o += arrow(222, 278, 418, 278, 2.5) + label(320, 262, "④ 利用料（1〜3割）", 13, ACCENT)
    o += arrow(418, 306, 222, 306, 2.5, MUTED) + label(320, 322, "⑤ サービス", 13, MUTED)
    o += arrow(500, 248, 500, 178, 2.5) + label(462, 212, "⑥ 請求", 13, ACCENT)
    o += arrow(560, 178, 560, 248, 2.5, MUTED) + label(598, 212, "⑦ 支払", 13, MUTED)
    o += text(596, 232, "（7〜9割）", 11, MUTED)
    o += dbl(422, 66, 470, 118) + text(500, 84, "審査・支払", 12, MUTED, "start")
    o += text(W / 2, 372, "財源：保険料 50％ ＋ 公費 50％（国・都道府県・市町村）", 14, INK, "middle", 700)
    return {"svg": svg(W, H, o, "介護保険のしくみ：被保険者が保険料を払い、認定を受けてサービスを使い、1から3割を負担。残りは国保連を通じて保険者から事業者へ支払われる"),
            "caption": "利用者は**1〜3割**を事業者に払い、残りは事業者が**国保連**に請求して保険者から支払われます。財源は**保険料と公費が半分ずつ**。"}
