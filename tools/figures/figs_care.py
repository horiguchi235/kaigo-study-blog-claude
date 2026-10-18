"""介助の図：体位・体位変換・移乗・杖歩行・着脱"""
from figlib import *
from top import *

FIGS = {}


def fig(name):
    def deco(fn):
        FIGS[name] = fn
        return fn
    return deco


# ───────── 横から見たベッド ─────────
def bed_side(x, y, w=230, back=0, knee=0, legs=True, h=16):
    """横から見たベッド。y=マットレス上面。back=背上げ角度（度）。頭側が左。"""
    o = ""
    if legs:
        o += rect(x + 6, y + h, 10, 46, BED_LINE, "none", 0, rx=3) + rect(x + w - 16, y + h, 10, 46, BED_LINE, "none", 0, rx=3)
        o += rect(x - 4, y - 30, 10, 92, BED_LINE, "none", 0, rx=3)  # ヘッドボード
    if back:
        import math
        L = 95
        a = math.radians(back)
        x2, y2 = x + 4 + L, y
        tip = (x2 - math.cos(a) * L, y - math.sin(a) * L)
        o += poly([(x2, y), (x2, y + h), (x + 4, y + h), tip], "#fffaf2", BED_LINE, 2)
        o += rect(x2, y, w - L - 4, h, "#fffaf2", BED_LINE, 2, rx=4)
        o += line(tip[0], tip[1], x2, y, ACCENT, 1.2, dash="4 3")
    else:
        o += rect(x + 4, y, w - 4, h, "#fffaf2", BED_LINE, 2, rx=4)
    return o


def floor(x1, x2, y):
    return line(x1, y, x2, y, LINE, 3)


@fig("taii-ne")
def taii_ne():
    W, H = 640, 300
    o = ""
    names = [("仰臥位", "あお向け"), ("側臥位", "横向き（右下なら右側臥位）"), ("腹臥位", "うつぶせ")]
    for i, (n, sub) in enumerate(names):
        cx = 20 + i * 210
        o += bed_top(cx, 40, 190, 120)
        if i == 0:
            o += supine_top(cx + 22, 100, s=0.72)
        elif i == 1:
            o += side_top(cx + 20, 98, curl=True, s=0.72)
        else:
            o += prone_top(cx + 26, 100, s=0.72)
        o += text(cx + 95, 196, n, 20, INK, "middle", 700)
        o += text(cx + 95, 224, sub, 13, MUTED)
    o += text(W / 2, 270, "※ ベッドを真上から見た図（頭が左）", 13, MUTED)
    return {"svg": svg(W, H, o, "寝た姿勢の名前：仰臥位・側臥位・腹臥位"),
            "caption": "寝た姿勢の名前。**側臥位は下になる側の名前**で呼びます（右が下なら右側臥位）。"}


@fig("taii-oki")
def taii_oki():
    W, H = 660, 560
    o = ""
    # 1段目：長座位・端座位・起座位
    # 長座位
    x, y = 20, 150
    o += bed_side(x, y, 190)
    o += Person((x + 70, y - 6), face=1, torso=178, arm_n=(25, 75), arm_f=(30, 80), leg_n=(90, 90), leg_f=(90, 90), foot_n=180, foot_f=180, scale=0.95).draw()
    o += text(x + 95, y + 92, "長座位", 19, INK, "middle", 700)
    o += text(x + 95, y + 116, "脚を前に伸ばして座る", 13, MUTED)
    # 端座位
    x = 240
    o += bed_side(x, y, 150)
    o += floor(x - 10, x + 200, y + 62)
    o += Person((x + 120, y - 6), face=1, torso=180, arm_n=(8, 20), arm_f=(10, 25), leg_n=(90, 0), leg_f=(92, 2), foot_n=90, foot_f=90, scale=0.95).draw()
    o += text(x + 95, y + 92, "端座位", 19, INK, "middle", 700)
    o += text(x + 95, y + 116, "ベッドの端に座り足を床に", 13, MUTED)
    # 起座位
    x = 440
    o += bed_side(x, y, 200)
    o += rect(x + 120, y - 62, 80, 8, "#d8c3ab", "none", 0, rx=3)  # オーバーベッドテーブル
    o += rect(x + 186, y - 54, 6, 50, "#d8c3ab", "none", 0, rx=2)
    o += rect(x + 118, y - 82, 62, 20, "#fff", BED_LINE, 1.5, rx=9)  # 枕
    o += Person((x + 70, y - 6), face=1, torso=145, head=130, arm_n=(110, 90), arm_f=(115, 95), leg_n=(90, 90), leg_f=(90, 90), foot_n=180, foot_f=180, scale=0.95).draw()
    o += text(x + 100, y + 92, "起座位", 19, INK, "middle", 700)
    o += text(x + 100, y + 116, "テーブルの枕にもたれる", 13, MUTED)
    # 2段目：ファーラー位・セミファーラー位・仰臥位（比較）
    y = 420
    x = 20
    o += bed_side(x, y, 290, back=45)
    o += Person((x + 104, y - 6), face=1, torso=225, head=215, arm_n=(60, 100), arm_f=(60, 100), leg_n=(84, 96), leg_f=(84, 96), foot_n=180, foot_f=180, scale=0.95).draw()
    o += text(x + 60, y - 84, "45°前後", 15, ACCENT, "middle", 700)
    o += text(x + 145, y + 92, "ファーラー位（半座位）", 19, INK, "middle", 700)
    o += text(x + 145, y + 116, "上半身を約45度起こす", 13, MUTED)
    x = 350
    o += bed_side(x, y, 290, back=25)
    o += Person((x + 104, y - 6), face=1, torso=245, head=240, arm_n=(70, 95), arm_f=(70, 95), leg_n=(88, 92), leg_f=(88, 92), foot_n=180, foot_f=180, scale=0.95).draw()
    o += text(x + 70, y - 52, "15〜30°", 15, ACCENT, "middle", 700)
    o += text(x + 145, y + 92, "セミファーラー位", 19, INK, "middle", 700)
    o += text(x + 145, y + 116, "上半身を約15〜30度起こす", 13, MUTED)
    return {"svg": svg(W, H, o, "起きた姿勢の名前：長座位・端座位・起座位・ファーラー位・セミファーラー位"),
            "caption": "起きた姿勢の名前（横から見た図）。**起座位**は呼吸が苦しいときに楽な姿勢、**ファーラー位**は食事や会話のときによく使います。"}


# ───────── 体位変換（仰臥位→側臥位）ステップ ─────────
@fig("step-taiihenkan")
def step_taiihenkan():
    W, H = 520, 330
    BX, BY, BW, BH = 60, 40, 400, 170

    def base(pillow_y=125, cg=None):
        o = bed_top(BX, BY, BW, BH, pillow=(BX + 40, pillow_y))
        o += text(BX + BW / 2, BY + BH + 108, "↓ 介護者がいる側（＝向く側）", 13, MUTED)
        return o

    steps = []
    # 1
    o = base(pillow_y=148)
    o += supine_top(BX + 42, 110, s=1.0)
    o += caregiver_top(250, 250, reach=[(212, 222), (288, 222)])
    o += arrow(BX + 40, 92, BX + 40, 140, 3)
    o += label(BX + 112, 66, "枕を向く側に寄せる", 13, ACCENT)
    steps.append({"svg": svg(W, H, o, "体位変換1：説明して同意を得て、向く側に立ち、枕を向く側に寄せる"),
                  "caption": "**目的を説明して同意**を得る。介護者は**向く側**に立ち、**枕を向く側に寄せて**おく。"})
    # 2
    o = base(pillow_y=148)
    o += supine_top(BX + 42, 112, knees=True, cross=True, s=1.0)
    o += caregiver_top(250, 250, reach=[(212, 222), (288, 222)])
    o += label(BX + 70, 26, "腕を胸の上で組む", 13, ACCENT)
    o += label(BX + 270, 26, "両膝を高く立てる", 13, ACCENT)
    o += line(BX + 80, 36, BX + 92, 104, ACCENT, 1.5) + line(BX + 250, 36, BX + 205, 96, ACCENT, 1.5)
    steps.append({"svg": svg(W, H, o, "体位変換2：腕を胸の上で組み、両膝を高く立てる"),
                  "caption": "**腕を胸の上で組み、両膝を高く立てる**。体を小さくまとめると、少ない力で回せる。"})
    # 3
    o = base(pillow_y=148)
    o += supine_top(BX + 42, 112, knees=True, cross=True, s=1.0)
    o += caregiver_top(250, 250, reach=[(BX + 80, 132), (BX + 202, 128)])
    o += num(BX + 232, 92, 1) + num(BX + 108, 84, 2)
    o += curve_arrow(BX + 215, 96, BX + 250, 140, BX + 228, 180, 3)
    o += curve_arrow(BX + 92, 92, BX + 128, 138, BX + 104, 178, 3)
    o += label(BX + 330, 92, "①膝 → ②肩の順に", 14, ACCENT)
    o += label(BX + 330, 116, "手前に倒す", 14, ACCENT)
    steps.append({"svg": svg(W, H, o, "体位変換3：膝を先に、次に肩を手前に倒す"),
                  "caption": "**膝 → 肩の順**に手前へ倒す。膝を先に倒すと腰がついて回る（**てこの原理**）。肩と膝を**同時に**倒すのは×。"})
    # 4
    o = base(pillow_y=148)
    o += side_top(BX + 52, 132, curl=True, s=1.0)
    o += rect(BX + 150, 76, 70, 22, "#fff", BED_LINE, 1.5, rx=10)  # 背中のクッション
    o += caregiver_top(250, 250, reach=[(212, 222), (288, 222)])
    o += label(BX + 186, 62, "背中にクッション", 13, ACCENT)
    o += label(BX + 310, 120, "腰を引いて「く」の字", 13, ACCENT)
    o += label(BX + 70, 196, "下側の肩を前へ", 13, ACCENT)
    steps.append({"svg": svg(W, H, o, "体位変換4：腰を引いて安定させ、下側の肩を引き出す"),
                  "caption": "**腰を後ろに引いて「く」の字**にすると安定。**下側の肩を前に引き出して**圧迫を防ぎ、クッションで姿勢を保つ。"})
    return {"title": "仰臥位 → 側臥位の体位変換", "steps": steps,
            "note": "上から見た図。片麻痺の人は原則として**健側を下**にした側臥位にします（患側を下にすると圧迫・痛みの原因に）。"}


# ───────── 片麻痺の人の移乗（ベッド → 車いす）右片麻痺の例 ─────────
@fig("step-ijou")
def step_ijou():
    W, H = 520, 320
    steps = []

    def topbase():
        o = rect(40, 30, 150, 260, BED, BED_LINE, 2, rx=10) + rect(46, 36, 138, 248, "#fffaf2", BED_LINE, 1, rx=8)
        o += text(115, 300, "ベッド（上から）", 12, MUTED)
        return o
    # 1 配置
    o = topbase()
    o += seated_top(172, 190, rot=-90, aff="R")
    o += wheelchair_top(240, 92, rot=-25, brake=True, foot_up=True)
    o += label(415, 60, "健側（左）に置く", 13, ACCENT)
    o += label(415, 86, "ベッドに対して20〜30°", 13, ACCENT)
    o += label(415, 112, "ブレーキをかけ", 13, ACCENT)
    o += label(415, 138, "フットサポートを上げる", 13, ACCENT)
    o += label(172, 236, "右片麻痺の人", 12, MUTED, weight=400)
    steps.append({"svg": svg(W, H, o, "移乗1：車いすを健側にベッドに対して20〜30度で置き、ブレーキをかける"),
                  "caption": "移乗の**目的を説明して同意**を得てから準備。車いすは**健側**に、ベッドに対して**20〜30度**で置き、**ブレーキ**をかけて**フットサポートを上げる**。"})

    # 2 浅く座る（横から：手前が患側＝右）
    o = bed_side(30, 170, 170)
    o += floor(10, 510, 232)
    o += Person((178, 164), face=1, torso=180, arm_n=(10, 30), arm_f=(15, 40), leg_n=(90, 0), leg_f=(96, 350), foot_n=90, foot_f=90, aff="near").draw()
    o += Person((355, 152), face=-1, torso=175, arm_n=(40, 60), arm_f=(30, 50), leg_n=(5, 0), leg_f=(355, 0), role="cg").draw()
    o += label(110, 40, "ベッドに浅く座る", 14, ACCENT)
    o += label(110, 66, "健側の足を少し引く", 14, ACCENT)
    o += label(355, 40, "介護者は患側に", 14, ACCENT)
    o += label(210, 290, "横から見た図（手前の灰色の手足が患側）", 12, MUTED, weight=400)
    steps.append({"svg": svg(W, H, o, "移乗2：ベッドに浅く座り、健側の足を少し引く"),
                  "caption": "ベッドに**浅く**座り直し、**健側の足を少し後ろに引く**。介護者は**患側**に立つ（健側に立つのは×）。"})

    # 3 前かがみで立ち上がる
    o = bed_side(30, 170, 170)
    o += floor(10, 510, 232)
    o += Person((200, 140), face=1, torso=128, head=118, arm_n=(60, 40), arm_f=(70, 50), leg_n=(55, 340), leg_f=(60, 345), foot_n=90, foot_f=90, aff="near").draw()
    o += Person((345, 152), face=-1, torso=150, head=140, arm_n=(38, 20), arm_f=(55, 35), leg_n=(5, 0), leg_f=(345, 0), role="cg").draw()
    o += curve_arrow(160, 70, 190, 40, 245, 52, 3)
    o += label(120, 52, "おじぎをするように", 14, ACCENT)
    o += label(120, 78, "前かがみで立つ", 14, ACCENT)
    o += label(440, 236, "患側の膝に手を当て", 14, ACCENT)
    o += label(440, 262, "膝折れを防ぐ", 14, ACCENT)
    steps.append({"svg": svg(W, H, o, "移乗3：前かがみになって立ち上がり、介護者は患側の膝を支える"),
                  "caption": "**前かがみ（おじぎ）**になってお尻を浮かせ、立ち上がる。介護者は**患側の膝**に手を当てて**膝折れ**を防ぐ。真上に持ち上げるのは×。"})

    # 4 回って座る（上から）
    o = topbase()
    o += wheelchair_top(240, 92, rot=-25, brake=True, foot_up=True)
    o += seated_top(240, 92, rot=-25, aff="R")
    o += curve_arrow(190, 210, 300, 210, 285, 140, 3, dash="6 4")
    o += label(415, 200, "健側の足を軸に回る", 13, ACCENT)
    o += label(415, 60, "深く座り直す", 13, ACCENT)
    o += label(415, 86, "フットサポートを下ろす", 13, ACCENT)
    steps.append({"svg": svg(W, H, o, "移乗4：健側の足を軸に回って車いすに座り、深く座り直す"),
                  "caption": "**健側の足を軸に**体の向きを変えて車いすに座る。**深く座り直し**、足をフットサポートにのせる。"})
    return {"title": "片麻痺の人のベッド → 車いすの移乗（右片麻痺の例）", "steps": steps,
            "note": "左片麻痺なら左右が逆になります。**車いすは健側、介護者は患側**が基本です。"}


# ───────── 杖歩行（3動作歩行）右片麻痺の例 ─────────
@fig("step-tsue")
def step_tsue():
    W, H = 420, 300
    y0, y1 = 220, 140   # 最初の位置と一歩先
    LX, RX, CX = 230, 190, 280  # 左足・右足・杖（杖は健側の左手）
    steps = []

    def scene(cane, rfoot, lfoot, moving, title):
        o = rect(20, 20, 380, 260, "#faf6f0", "none", 0, rx=10)
        o += line(40, 70, 40, 250, LINE, 2) + text(40, 56, "進む方向 ↑", 12, MUTED, "start")
        # 前の位置を薄く
        o += footprint(RX, y0, "R", "none", outline=LINE) + footprint(LX, y0, "L", "none", outline=LINE)
        o += circle(CX, y0 - 20, 7, "none", LINE, 1.5)
        o += footprint(RX, rfoot, "R", PT_AFF if moving != "R" else PT_AFF_DARK, label_s="右")
        o += footprint(LX, lfoot, "L", PT if moving != "L" else PT_DARK, label_s="左")
        o += cane_tip(CX, cane, 8, INK if moving != "C" else ACCENT)
        o += text(RX, rfoot + 40, "患側", 12, MUTED) if rfoot == y0 or True else ""
        o += text(LX, lfoot + 40, "健側", 12, MUTED)
        o += text(CX + 10, cane - 18, "杖", 13, INK, "start", 700)
        o += label(330, 250, title, 15, ACCENT)
        return o
    steps.append({"svg": svg(W, H, scene(y0 - 20, y0, y0, None, "スタート"), "3動作歩行：スタート"),
                  "caption": "杖は**健側の手**で持つ（右片麻痺なら左手）。両足をそろえて立つ。"})
    o = scene(y1 - 20, y0, y0, "C", "① 杖")
    o += arrow(CX, y0 - 34, CX, y1 - 6, 3)
    steps.append({"svg": svg(W, H, o, "3動作歩行1：杖を前に出す"), "caption": "**① 杖**を前に出す。"})
    o = scene(y1 - 20, y1, y0, "R", "② 患側の足")
    o += arrow(RX, y0 - 30, RX, y1 + 30, 3) if False else arrow(RX - 30, y0 - 10, RX - 30, y1 + 10, 3)
    steps.append({"svg": svg(W, H, o, "3動作歩行2：患側の足を出す"), "caption": "**② 患側の足**（右足）を杖の位置まで出す。"})
    o = scene(y1 - 20, y1, y1, "L", "③ 健側の足")
    o += arrow(LX + 30, y0 - 10, LX + 30, y1 + 10, 3)
    steps.append({"svg": svg(W, H, o, "3動作歩行3：健側の足をそろえる"), "caption": "**③ 健側の足**（左足）を出してそろえる。これをくり返す。"})
    return {"title": "杖の3動作歩行（右片麻痺の例・上から見た足あと）", "steps": steps,
            "note": "3動作歩行は「**杖 → 患側 → 健側**」。慣れてきたら**2動作歩行**（杖と患側を同時 → 健側）。"}


# ───────── 階段の上り下り ─────────
@fig("kaidan")
def kaidan():
    W, H = 640, 330
    o = ""

    def stairs(x, y, up=True):
        # 3段の階段（横から）。up=Trueで右上がり
        pts = []
        sx = 1 if up else -1
        x0 = x if up else x + 270
        pts = [(x0, y)]
        cx, cy = x0, y
        for i in range(3):
            cx += sx * 70; pts.append((cx, cy)); cy -= 36; pts.append((cx, cy))
        cx += sx * 60; pts.append((cx, cy)); pts.append((cx, y))
        return poly(pts, "#efe4d6", BED_LINE, 2)

    def shoe(x, y, col, num_, aff=False):
        return (f'<path d="M{x - 16},{y} L{x - 16},{y - 12} Q{x - 10},{y - 18} {x},{y - 14} L{x + 14},{y - 8} Q{x + 18},{y - 4} {x + 16},{y} z" fill="{col}"/>'
                + num(x, y - 34, num_))

    # 上り（右上がり）
    o += text(160, 30, "上るとき", 20, INK, "middle", 700)
    o += stairs(25, 250, True)
    o += line(150, 214, 150, 160, INK, 4) + circle(150, 214, 4, INK) + num(150, 140, 1)
    o += shoe(118, 214, PT, 2) + shoe(56, 250, PT_AFF, 3)
    o += text(160, 282, "① 杖 → ② 健側 → ③ 患側", 15, ACCENT, "middle", 700)
    o += text(160, 306, "介護者は患側の後ろ（下の段）", 13, MUTED)
    # 下り（右下がり）
    o += text(480, 30, "下りるとき", 20, INK, "middle", 700)
    o += stairs(345, 250, False)
    o += line(528, 214, 528, 160, INK, 4) + circle(528, 214, 4, INK) + num(528, 140, 1)
    o += shoe(500, 214, PT_AFF, 2) + shoe(436, 178, PT, 3)
    o += text(480, 282, "① 杖 → ② 患側 → ③ 健側", 15, ACCENT, "middle", 700)
    o += text(480, 306, "介護者は患側の前（下の段）", 13, MUTED)
    o += circle(26, 56, 6, PT) + text(36, 56, "健側の足", 12, INK, "start") + circle(116, 56, 6, PT_AFF) + text(126, 56, "患側の足", 12, INK, "start")
    return {"svg": svg(W, H, o, "階段は上りが杖・健側・患側、下りが杖・患側・健側の順"),
            "caption": "覚え方は「**上りは健側（よい足）から、下りは患側から**」。介護者はどちらも**患側の、下の段**にいて転落を防ぎます。"}


# ───────── 脱健着患（前あきの上着）右片麻痺の例 ─────────
@fig("step-dakken")
def step_dakken():
    W, H = 440, 300
    CX, CY = 220, 165
    steps = []

    def base(l_on, r_on, t1, t2):
        o = upper_front(CX, CY, l_on=l_on, r_on=r_on)
        o += text(CX - 95, 40, "患側（右）", 13, MUTED) + text(CX + 95, 40, "健側（左）", 13, MUTED)
        o += label(CX, 262, t1, 16, ACCENT)
        if t2:
            o += label(CX, 288, t2, 13, INK, weight=400)
        return o
    o = base(False, True, "脱ぐ① 健側から", "左肩を下げて、左袖から腕を抜く")
    o += arrow(CX + 72, CY - 10, CX + 120, CY + 30, 3)
    steps.append({"svg": svg(W, H, o, "脱ぐときは健側から"), "caption": "**脱ぐときは健側から**。健側（左）の肩を下げて、**左袖から**腕を抜く。"})
    o = base(False, False, "脱ぐ② 最後に患側", "患側の腕は動かさず、袖を引いて抜く")
    o += arrow(CX - 72, CY - 10, CX - 120, CY + 30, 3)
    steps.append({"svg": svg(W, H, o, "脱ぐときは最後に患側"), "caption": "最後に**患側（右）**。腕を無理に曲げず、**袖のほうを動かして**ゆっくり抜く。"})
    o = base(False, True, "着る① 患側から", "右袖を肩までしっかり通す")
    o += arrow(CX - 120, CY + 70, CX - 70, CY - 30, 3)
    steps.append({"svg": svg(W, H, o, "着るときは患側から、肩まで通す"), "caption": "**着るときは患側から**。**右袖を肩までしっかり**通す（肘までだと途中で抜けやすい）。"})
    o = base(True, True, "着る② 最後に健側", "背中から回して左袖を通す")
    o += arrow(CX + 120, CY + 70, CX + 70, CY - 30, 3)
    steps.append({"svg": svg(W, H, o, "着るときは最後に健側"), "caption": "上着を**背中から回して**、最後に**健側（左）**の袖を通す。"})
    return {"title": "脱健着患（前あきの上着・右片麻痺の例）", "steps": steps,
            "note": "正面から見た図なので、本人の**右（患側）は画面の左**です。「脱健着患（だっけんちゃっかん）」＝**脱ぐのは健側から、着るのは患側から**。"}
