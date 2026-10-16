"""上から見た人物（ベッド上の体位変換など）。頭が左、足が右。"""
from figlib import *


def _cap(x1, y1, x2, y2, w, c):
    return line(x1, y1, x2, y2, c, w)


def bed_top(x, y, w=300, h=130, pillow=None):
    """上から見たベッド。pillow=(px,py)で枕の位置"""
    o = rect(x, y, w, h, BED, BED_LINE, 2, rx=10)
    o += rect(x + 6, y + 6, w - 12, h - 12, "#fffaf2", BED_LINE, 1, rx=8)
    if pillow:
        o += rect(pillow[0] - 22, pillow[1] - 30, 44, 60, "#fff", BED_LINE, 1.5, rx=12)
    return o


def supine_top(x0, cy, knees=False, cross=False, aff=None, s=1.0):
    """仰臥位を上から。x0=頭の中心。aff='near'で下側（手前）の手足を患側色に"""
    def c(side, base):
        return PT_AFF if aff == side else base
    o = ""
    # 脚
    for side, dy in (("far", -12), ("near", 12)):
        col = c(side, "#6f7f99")
        if knees:
            o += _cap(x0 + 110 * s, cy + dy * s, x0 + 160 * s, cy + dy * 1.1 * s, 18 * s, col)
            o += _cap(x0 + 160 * s, cy + dy * 1.1 * s, x0 + 172 * s, cy + dy * 1.4 * s, 14 * s, col)
            o += circle(x0 + 160 * s, cy + dy * 1.1 * s, 9 * s, col, "#fff", 1.5)
        else:
            o += _cap(x0 + 110 * s, cy + dy * s, x0 + 200 * s, cy + dy * 1.25 * s, 16 * s, col)
            o += _cap(x0 + 200 * s, cy + dy * 1.25 * s, x0 + 210 * s, cy + dy * 1.35 * s, 10 * s, "#6b5a4e")
    # 胴
    o += poly([(x0 + 22 * s, cy - 30 * s), (x0 + 110 * s, cy - 22 * s), (x0 + 118 * s, cy), (x0 + 110 * s, cy + 22 * s), (x0 + 22 * s, cy + 30 * s), (x0 + 16 * s, cy)], PT)
    # 腕
    for side, sg in (("far", -1), ("near", 1)):
        col = c(side, PT_DARK)
        sx, sy = x0 + 28 * s, cy + sg * 27 * s
        if cross:
            ex, ey = x0 + 60 * s, cy + sg * 22 * s
            hx, hy = x0 + 50 * s, cy - sg * 10 * s
        else:
            ex, ey = x0 + 70 * s, cy + sg * 36 * s
            hx, hy = x0 + 108 * s, cy + sg * 36 * s
        o += _cap(sx, sy, ex, ey, 12 * s, col) + _cap(ex, ey, hx, hy, 10 * s, col)
        o += circle(hx, hy, 6 * s, SKIN, SKIN_DARK, 1)
    # 頭
    o += f'<ellipse cx="{f(x0)}" cy="{f(cy)}" rx="{f(17 * s)}" ry="{f(15 * s)}" fill="{SKIN}" stroke="{SKIN_DARK}"/>'
    o += f'<path d="M{f(x0 - 15 * s)},{f(cy - 9 * s)} Q{f(x0 - 20 * s)},{f(cy)} {f(x0 - 15 * s)},{f(cy + 9 * s)} Q{f(x0 - 4 * s)},{f(cy)} {f(x0 - 15 * s)},{f(cy - 9 * s)}" fill="{HAIR_PT}"/>'
    return o


def side_top(x0, cy, curl=True, aff=None, s=1.0, front=1):
    """側臥位を上から（＝横顔が見える）。front=1で体の前が下（手前）向き。curl=Trueで「く」の字"""
    # 上から見た側臥位：頭が左。体の前（腹側）が front 方向（下=+y）
    # Person の角度は face=-1 で左向き。ここでは座標を回転させて使う
    hip = (x0 + 100 * s, cy)
    o = ""
    def P(ang, base, ln):
        # 0=手前(+y)、90=右(足側)、180=奥、270=左(頭側)
        a = math.radians(ang)
        return (base[0] + math.sin(a) * ln * s, base[1] + math.cos(a) * ln * s * front)
    sh = P(272, hip, 82)
    neck = P(275, sh, 8)
    head = P(276, neck, 15)
    kn_u = P(32 if curl else 88, hip, 44)
    an_u = P(100 if curl else 92, kn_u, 42)
    kn_l = P(72 if curl else 92, hip, 44)
    an_l = P(96 if curl else 93, kn_l, 42)
    lower = PT_AFF if aff == "lower" else "#58657c"
    upper = PT_AFF if aff == "upper" else "#6f7f99"
    # 下側の脚 → 胴 → 上側の脚
    o += _cap(*hip, *kn_l, 17 * s, lower) + _cap(*kn_l, *an_l, 14 * s, lower)
    o += _cap(*hip, *sh, 30 * s, PT)
    # 下側の腕（前に出す）
    el_l = P(330, sh, 26)
    ha_l = P(20, el_l, 24)
    o += _cap(*sh, *el_l, 12 * s, PT_AFF if aff == "lower" else PT_DARK) + _cap(*el_l, *ha_l, 10 * s, PT_AFF if aff == "lower" else PT_DARK)
    o += circle(*ha_l, 5.5 * s, SKIN, SKIN_DARK, 1)
    o += _cap(*sh, *neck, 9 * s, SKIN)
    o += circle(*head, 14 * s, SKIN, SKIN_DARK, 1)
    hx, hy = head
    o += f'<path d="M{f(hx + 4 * s)},{f(hy - front * 14 * s)} A{f(14 * s)},{f(14 * s)} 0 0,{0 if front > 0 else 1} {f(hx - 6 * s)},{f(hy + front * 12 * s)} L{f(hx - 12 * s)},{f(hy)} z" fill="{HAIR_PT}"/>'
    o += _cap(*hip, *kn_u, 17 * s, upper) + _cap(*kn_u, *an_u, 14 * s, upper)
    # 上側の腕
    el_u = P(20, sh, 28)
    ha_u = P(70, el_u, 24)
    o += _cap(*sh, *el_u, 12 * s, PT_AFF if aff == "upper" else PT) + _cap(*el_u, *ha_u, 10 * s, PT_AFF if aff == "upper" else PT)
    o += circle(*ha_u, 5.5 * s, SKIN, SKIN_DARK, 1)
    return o


def prone_top(x0, cy, s=1.0):
    o = ""
    for dy in (-12, 12):
        o += _cap(x0 + 110 * s, cy + dy * s, x0 + 200 * s, cy + dy * 1.25 * s, 16 * s, "#6f7f99")
        o += _cap(x0 + 200 * s, cy + dy * 1.25 * s, x0 + 212 * s, cy + dy * 1.25 * s, 9 * s, "#6b5a4e")
    o += poly([(x0 + 22 * s, cy - 30 * s), (x0 + 110 * s, cy - 22 * s), (x0 + 118 * s, cy), (x0 + 110 * s, cy + 22 * s), (x0 + 22 * s, cy + 30 * s), (x0 + 16 * s, cy)], PT_DARK)
    for sg in (-1, 1):
        o += _cap(x0 + 28 * s, cy + sg * 27 * s, x0 + 5 * s, cy + sg * 44 * s, 12 * s, PT_DARK)
        o += _cap(x0 + 5 * s, cy + sg * 44 * s, x0 - 22 * s, cy + sg * 34 * s, 10 * s, PT_DARK)
        o += circle(x0 - 22 * s, cy + sg * 34 * s, 6 * s, SKIN, SKIN_DARK, 1)
    # 顔を横に向けている（後頭部が見える）
    o += f'<ellipse cx="{f(x0)}" cy="{f(cy)}" rx="{f(17 * s)}" ry="{f(15 * s)}" fill="{HAIR_PT}" stroke="{SKIN_DARK}"/>'
    o += f'<ellipse cx="{f(x0 - 2 * s)}" cy="{f(cy + 11 * s)}" rx="{f(9 * s)}" ry="{f(5 * s)}" fill="{SKIN}"/>'
    return o


def caregiver_top(x, y, reach=None, s=1.0, face_up=True):
    """上から見た介護者（体の正面が上=ベッド側）。reach=[(hx,hy),(hx,hy)] で両手の位置"""
    o = ""
    shl, shr = (x - 26 * s, y), (x + 26 * s, y)
    if reach is None:
        reach = [(x - 30 * s, y - 30 * s), (x + 30 * s, y - 30 * s)]
    for sh, h in ((shl, reach[0]), (shr, reach[1])):
        mx, my = (sh[0] + h[0]) / 2 + (sh[0] - x) * 0.25, (sh[1] + h[1]) / 2 + 6 * s
        o += _cap(*sh, mx, my, 12 * s, CG_DARK) + _cap(mx, my, *h, 10 * s, CG_DARK)
        o += circle(*h, 6 * s, SKIN, SKIN_DARK, 1)
    o += f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(32 * s)}" ry="{f(15 * s)}" fill="{CG}"/>'
    o += circle(x, y + 2 * s, 13 * s, HAIR_CG)
    return o


def _g(x, y, rot, body):
    return f'<g transform="translate({f(x)} {f(y)}) rotate({f(rot)})">{body}</g>'


def seated_top(x, y, rot=0, aff=None, s=1.0):
    """上から見た座っている人。rot=0で体の前が下(+y)。aff='L'/'R'で本人の左右の患側（灰色）"""
    def col(side, base):
        return PT_AFF if aff == side else base
    # 本人の右は、前が+yのとき画面の-x側
    o = ""
    for side, sx in (("R", -1), ("L", 1)):
        o += line(sx * 10 * s, 4 * s, sx * 11 * s, 44 * s, col(side, "#6f7f99"), 16 * s)
        o += f'<ellipse cx="{f(sx * 11 * s)}" cy="{f(52 * s)}" rx="{f(6 * s)}" ry="{f(9 * s)}" fill="#6b5a4e"/>'
    o += f'<ellipse cx="0" cy="0" rx="{f(28 * s)}" ry="{f(13 * s)}" fill="{PT}"/>'
    for side, sx in (("R", -1), ("L", 1)):
        o += line(sx * 25 * s, 0, sx * 24 * s, 28 * s, col(side, PT_DARK), 11 * s)
        o += circle(sx * 24 * s, 30 * s, 5.5 * s, SKIN, SKIN_DARK, 1)
    o += circle(0, -2 * s, 13 * s, HAIR_PT, SKIN_DARK, 1)
    o += f'<ellipse cx="0" cy="{f(8 * s)}" rx="{f(7 * s)}" ry="{f(4 * s)}" fill="{SKIN}"/>'
    return _g(x, y, rot, o)


def wheelchair_top(x, y, rot=0, s=1.0, brake=True, foot_up=True):
    """上から見た車いす。rot=0で前が下(+y)"""
    o = ""
    o += rect(-24 * s, -22 * s, 48 * s, 46 * s, "#e9e2da", "#8d8178", 1.5, rx=4)
    o += line(-26 * s, -24 * s, 26 * s, -24 * s, "#8d8178", 6 * s)
    for sx in (-1, 1):
        o += rect(sx * 30 * s - 4 * s, -34 * s, 8 * s, 58 * s, "#5b524b", "none", 0, rx=3)
        o += circle(sx * 22 * s, 40 * s, 4.5 * s, "#5b524b")
        if foot_up:
            o += line(sx * 12 * s, 30 * s, sx * 12 * s, 38 * s, "#8d8178", 3 * s)
        else:
            o += rect(sx * 12 * s - 8 * s, 34 * s, 16 * s, 8 * s, "#8d8178", "none", 0, rx=2)
        if brake:
            o += line(sx * 34 * s, 4 * s, sx * 38 * s, -4 * s, ACCENT, 3 * s)
    return _g(x, y, rot, o)


def upper_front(cx, cy, l_on=True, r_on=True, shirt=True, aff="R", s=1.0, hang=None):
    """正面から見た上半身と前あきの上着。l_on/r_on=本人の左/右の袖が通っているか。
    本人の右＝画面の左。hang='L'/'R'で、脱いだ上着がその側の腕に残っている"""
    SH = "#9cc9a8"; SH_D = "#78ad87"
    o = ""
    # 胴（肌着）
    o += poly([(cx - 42 * s, cy - 48 * s), (cx + 42 * s, cy - 48 * s), (cx + 36 * s, cy + 50 * s), (cx - 36 * s, cy + 50 * s)], "#f4f1ec", "#d8d0c6", 1)
    # 腕（肌着の袖は短く、腕は肌）
    for side, sx in (("R", -1), ("L", 1)):
        col = PT_AFF if side == aff else SKIN
        sh = (cx + sx * 46 * s, cy - 42 * s)
        el = (cx + sx * 60 * s, cy + 8 * s)
        ha = (cx + sx * 62 * s, cy + 54 * s)
        o += line(*sh, *el, col, 15 * s) + line(*el, *ha, col, 13 * s)
        o += circle(*ha, 7 * s, col if side == aff else SKIN, SKIN_DARK, 1)
    # 上着
    if shirt:
        for side, sx, on in (("R", -1, r_on), ("L", 1, l_on)):
            if on:
                o += poly([(cx + sx * 2 * s, cy - 50 * s), (cx + sx * 46 * s, cy - 48 * s), (cx + sx * 40 * s, cy + 56 * s), (cx + sx * 4 * s, cy + 56 * s)], SH, SH_D, 1.2)
                o += line(cx + sx * 46 * s, cy - 42 * s, cx + sx * 60 * s, cy + 8 * s, SH, 20 * s)
                o += line(cx + sx * 60 * s, cy + 8 * s, cx + sx * 62 * s, cy + 42 * s, SH, 18 * s)
            elif hang == side:
                pass
        # 脱いだ側の身ごろ：背中側に垂れ下がる
        for side, sx, on in (("R", -1, r_on), ("L", 1, l_on)):
            if not on and (r_on or l_on):
                o += poly([(cx + sx * 4 * s, cy - 50 * s), (cx + sx * 28 * s, cy - 30 * s), (cx + sx * 34 * s, cy + 62 * s), (cx + sx * 12 * s, cy + 66 * s)], SH_D, "none", 0, extra='opacity="0.55"')
    # 首・頭
    o += line(cx, cy - 52 * s, cx, cy - 62 * s, SKIN, 14 * s)
    o += circle(cx, cy - 80 * s, 20 * s, SKIN, SKIN_DARK, 1)
    o += f'<path d="M{f(cx - 20 * s)},{f(cy - 82 * s)} A{f(20 * s)},{f(20 * s)} 0 0,1 {f(cx + 20 * s)},{f(cy - 82 * s)} Q{f(cx)},{f(cy - 92 * s)} {f(cx - 20 * s)},{f(cy - 82 * s)}" fill="{HAIR_PT}"/>'
    return o
