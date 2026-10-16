"""ブログ用SVG図の部品。python3 tools/figures/make.py で src/figures/*.json を作り直す。

人物は「関節の位置を角度で決める」棒人間＋太線（カプセル）で描く。
角度：0=下、90=前（向いている方向）、180=上、270=後ろ。
"""
import math

# 色（サイトのオレンジ系に合わせる）
INK = "#3a2f28"       # 文字・線
MUTED = "#7a6a5e"
ACCENT = "#c25a17"    # 矢印・強調
ACCENT_SOFT = "#fdeedf"
LINE = "#e6d3bf"
SKIN = "#f3d2b8"
SKIN_DARK = "#e2b897"
PT = "#7fa7cf"        # 利用者の服（青系）
PT_DARK = "#5f88b3"
PT_AFF = "#c9c4be"    # 患側（麻痺側）
PT_AFF_DARK = "#aaa39b"
CG = "#ef9a55"        # 介護者の服（オレンジ）
CG_DARK = "#d9792f"
HAIR_PT = "#d9d4cf"   # 高齢者の髪
HAIR_CG = "#5a4436"
BED = "#f6ead9"
BED_LINE = "#c9b29a"
FONT = "'Noto Sans JP','Hiragino Sans',sans-serif"
FS = 1.18  # スマホで読めるよう文字を少し大きめに


def f(v):
    return f"{v:.1f}".rstrip("0").rstrip(".")


def svg(w, h, body, label):
    return (
        f'<svg viewBox="0 0 {w} {h}" role="img" aria-label="{label}" '
        f'xmlns="http://www.w3.org/2000/svg" font-family="{FONT}">'
        f'<defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">'
        f'<path d="M0,0 L10,5 L0,10 z" fill="{ACCENT}"/></marker></defs>{body}</svg>'
    )


def text(x, y, s, size=15, color=INK, anchor="middle", weight=400, bg=False):
    size = size * FS
    t = (f'<text x="{f(x)}" y="{f(y)}" font-size="{size}" fill="{color}" text-anchor="{anchor}" '
         f'font-weight="{weight}" dominant-baseline="middle">{s}</text>')
    if bg:
        # 文字の後ろに白い下地（線と重なっても読めるように）
        w = len(s) * size * 0.98 + 8
        x0 = x - w / 2 if anchor == "middle" else (x - 4 if anchor == "start" else x - w + 4)
        t = f'<rect x="{f(x0)}" y="{f(y - size * 0.72)}" width="{f(w)}" height="{f(size * 1.44)}" rx="4" fill="#fff" opacity="0.92"/>' + t
    return t


def label(x, y, s, size=14, color=INK, anchor="middle", weight=700):
    return text(x, y, s, size, color, anchor, weight, bg=True)


def line(x1, y1, x2, y2, color=INK, w=1.5, dash=None, arrow=False, cap="round"):
    d = f' stroke-dasharray="{dash}"' if dash else ""
    a = ' marker-end="url(#ah)"' if arrow else ""
    return f'<line x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}" stroke="{color}" stroke-width="{w}" stroke-linecap="{cap}"{d}{a}/>'


def arrow(x1, y1, x2, y2, w=3, color=ACCENT):
    return line(x1, y1, x2, y2, color, w, arrow=True)


def curve_arrow(x1, y1, cx, cy, x2, y2, w=3, color=ACCENT, dash=None):
    d = f' stroke-dasharray="{dash}"' if dash else ""
    return f'<path d="M{f(x1)},{f(y1)} Q{f(cx)},{f(cy)} {f(x2)},{f(y2)}" fill="none" stroke="{color}" stroke-width="{w}" stroke-linecap="round" marker-end="url(#ah)"{d}/>'


def leader(x1, y1, x2, y2, s, anchor="start", size=13, color=INK, dot=True):
    """図の一点(x1,y1)から引き出し線を伸ばして(x2,y2)に文字"""
    o = line(x1, y1, x2, y2, MUTED, 1)
    if dot:
        o += f'<circle cx="{f(x1)}" cy="{f(y1)}" r="2.6" fill="{INK}"/>'
    dx = 4 if anchor == "start" else (-4 if anchor == "end" else 0)
    o += text(x2 + dx, y2, s, size, color, anchor, 700)
    return o


def rect(x, y, w, h, fill="#fff", stroke=INK, sw=1.5, rx=6, extra=""):
    return f'<rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" {extra}/>'


def circle(x, y, r, fill, stroke="none", sw=1.5):
    return f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'


def poly(pts, fill, stroke="none", sw=1.5, close=True, extra=""):
    p = " ".join(f"{f(x)},{f(y)}" for x, y in pts)
    tag = "polygon" if close else "polyline"
    return f'<{tag} points="{p}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round" {extra}/>'


def cap(p1, p2, w, color):
    return line(p1[0], p1[1], p2[0], p2[1], color, w)


def badge(x, y, s, fill=ACCENT, color="#fff", size=14):
    w = len(s) * size * FS + 18
    return (f'<rect x="{f(x - w / 2)}" y="{f(y - size)}" width="{f(w)}" height="{f(size * 2)}" rx="{f(size)}" fill="{fill}"/>'
            + text(x, y + 1, s, size, color, "middle", 700))


def num(x, y, n, r=11, fill=ACCENT):
    return circle(x, y, r, fill) + text(x, y + 1, str(n), r * 1.25, "#fff", "middle", 700)


# ───────── 側面から見た人物 ─────────
LEN = dict(torso=58, neck=7, head=13, uarm=30, farm=27, thigh=42, shin=40, foot=15)


class Person:
    """側面図の人物。hip を基準に各部の角度を指定して描く。
    face=1 で右向き、-1 で左向き。aff='near'/'far' で手前/奥の手足を患側（灰色）にする。"""

    def __init__(self, hip, face=1, torso=180, head=None, arm_n=(10, 40), arm_f=(10, 40),
                 leg_n=(0, 0), leg_f=(0, 0), foot_n=90, foot_f=90, role="pt", aff=None, scale=1.0,
                 hair=None):
        self.hip = hip
        self.face = face
        self.torso = torso
        self.head = torso if head is None else head
        self.arm_n, self.arm_f = arm_n, arm_f
        self.leg_n, self.leg_f = leg_n, leg_f
        self.foot_n, self.foot_f = foot_n, foot_f
        self.role = role
        self.aff = aff
        self.s = scale
        self.hair = hair

    def pt(self, p, ang, ln):
        a = math.radians(ang)
        return (p[0] + math.sin(a) * ln * self.s * self.face, p[1] + math.cos(a) * ln * self.s)

    def joints(self):
        j = {"hip": self.hip}
        j["sh"] = self.pt(self.hip, self.torso, LEN["torso"])
        j["neck"] = self.pt(j["sh"], self.head, LEN["neck"])
        j["head"] = self.pt(j["neck"], self.head, LEN["head"] * 0.95)
        for side, arm, leg, foot in (("n", self.arm_n, self.leg_n, self.foot_n), ("f", self.arm_f, self.leg_f, self.foot_f)):
            j["el" + side] = self.pt(j["sh"], arm[0], LEN["uarm"])
            j["ha" + side] = self.pt(j["el" + side], arm[1], LEN["farm"])
            j["kn" + side] = self.pt(self.hip, leg[0], LEN["thigh"])
            j["an" + side] = self.pt(j["kn" + side], leg[1], LEN["shin"])
            j["to" + side] = self.pt(j["an" + side], foot, LEN["foot"])
        return j

    def colors(self, side):
        if self.role == "cg":
            cloth, dark, pants = CG, CG_DARK, "#8a6f5c"
        else:
            cloth, dark, pants = PT, PT_DARK, "#6f7f99"
        affected = self.aff == ("near" if side == "n" else "far")
        if affected:
            return PT_AFF, PT_AFF_DARK, PT_AFF
        if side == "f":
            return dark, dark, "#58657c" if self.role == "pt" else "#6f5848"
        return cloth, dark, pants

    def draw(self):
        j = self.joints()
        s = self.s
        o = ""
        # 奥の手足 → 胴 → 頭 → 手前の手足
        for side in ("f",):
            o += self.limbs(j, side)
        cloth, dark, pants = self.colors("body")
        o += cap(j["hip"], j["sh"], 26 * s, cloth)
        o += cap(j["sh"], j["neck"], 9 * s, SKIN)
        o += circle(j["head"][0], j["head"][1], LEN["head"] * s, SKIN, SKIN_DARK, 1)
        hair = self.hair or (HAIR_PT if self.role == "pt" else HAIR_CG)
        # 髪：頭の後ろ上側を半円で
        hx, hy = j["head"]
        back = math.radians(self.head + 180)
        o += (f'<path d="M{f(hx + math.sin(math.radians(self.head + 90)) * 13 * s * self.face)},{f(hy + math.cos(math.radians(self.head + 90)) * 13 * s)} '
              f'A{f(13 * s)},{f(13 * s)} 0 0,{1 if self.face > 0 else 0} {f(hx - math.sin(math.radians(self.head + 90)) * 13 * s * self.face)},{f(hy - math.cos(math.radians(self.head + 90)) * 13 * s)}" '
              f'fill="{hair}"/>')
        o += self.limbs(j, "n")
        return o

    def limbs(self, j, side):
        cloth, dark, pants = self.colors(side)
        s = self.s
        o = ""
        o += cap(j["hip"], j["kn" + side], 17 * s, pants)
        o += cap(j["kn" + side], j["an" + side], 14 * s, pants)
        o += cap(j["an" + side], j["to" + side], 9 * s, "#6b5a4e" if self.aff != ("near" if side == "n" else "far") else PT_AFF_DARK)
        o += cap(j["sh"], j["el" + side], 12 * s, cloth)
        o += cap(j["el" + side], j["ha" + side], 10 * s, cloth)
        o += circle(j["ha" + side][0], j["ha" + side][1], 5.5 * s, SKIN, SKIN_DARK, 1)
        return o


# ───────── 上から見た人物（体位変換用） ─────────
def top_supine(cx, cy, s=1.0, aff=None):
    """仰臥位を上から（頭が左）。膝を立てた状態は knees=True で別関数"""
    o = ""
    o += f'<ellipse cx="{f(cx - 70 * s)}" cy="{f(cy)}" rx="{f(15 * s)}" ry="{f(14 * s)}" fill="{SKIN}" stroke="{SKIN_DARK}"/>'
    o += rect(cx - 55 * s, cy - 25 * s, 70 * s, 50 * s, PT, "none", 0, rx=14 * s)
    return o


def footprint(x, y, side="L", color=PT, rot=0, s=1.0, outline=None, label_s=None):
    """足あと（上から見た足）。side=L/R。つま先が上向き。"""
    sx = -1 if side == "L" else 1
    pts = [(0, -26), (7 * sx, -22), (10 * sx, -10), (9 * sx, 6), (6 * sx, 18), (0, 22), (-6 * sx, 18), (-8 * sx, 4), (-7 * sx, -12), (-4 * sx, -22)]
    pts = [(x + px * s, y + py * s) for px, py in pts]
    st = outline or "none"
    o = poly(pts, color, st, 1.5, extra=f'transform="rotate({rot} {f(x)} {f(y)})"')
    if label_s:
        o += text(x, y + 2, label_s, 12, "#fff", "middle", 700)
    return o


def cane_tip(x, y, r=8, fill=INK):
    return circle(x, y, r, fill)
