"""傾向分析記事のグラフ（数値は過去問1,838問を集計した結果を直接書いている）"""
from figlib import *

FIGS = {}


def fig(name):
    def deco(fn):
        FIGS[name] = fn
        return fn
    return deco


BAR = ACCENT
SUB = "#4a7fc1"
GRID = "#efe3d6"
ROUNDS = list(range(24, 39))


def vbar(x, base, w, h, col):
    """角を丸めたのは上端だけ（4px）、下は基線に揃える"""
    r = min(4, w / 2, h)
    return (f'<path d="M{f(x)},{f(base)} L{f(x)},{f(base - h + r)} Q{f(x)},{f(base - h)} {f(x + r)},{f(base - h)} '
            f'L{f(x + w - r)},{f(base - h)} Q{f(x + w)},{f(base - h)} {f(x + w)},{f(base - h + r)} L{f(x + w)},{f(base)} Z" fill="{col}"/>')


@fig("chart-jirei")
def chart_jirei():
    pct = [23.3, 22.5, 26.1, 24.4, 24.6, 25.6, 26.8, 27.2, 30.6, 28.2, 31.2, 31.2, 34.4, 27.4, 32.8]
    W, H = 640, 300
    L, R, T, B = 50, 20, 30, 250
    o = ""
    for v in (0, 10, 20, 30, 40):
        y = B - (B - T) * v / 40
        o += line(L, y, W - R, y, GRID, 1) + text(L - 8, y, f"{v}%", 12, MUTED, "end")
    n = len(pct); slot = (W - L - R) / n; bw = slot - 8
    for i, v in enumerate(pct):
        x = L + i * slot + 4
        h = (B - T) * v / 40
        o += vbar(x, B, bw, h, BAR if i in (0, n - 1, 12) else "#e9a77c")
        if i in (0, n - 1, 12):
            o += text(x + bw / 2, B - h - 12, f"{v:.0f}%", 13, INK, "middle", 700)
        o += text(x + bw / 2, B + 16, f"{ROUNDS[i]}", 12, MUTED)
    o += line(L, B, W - R, B, MUTED, 1.5)
    o += text(W - R, B + 36, "回", 12, MUTED, "end")
    return {"svg": svg(W, H, o, "事例問題の割合は第24回の23％から第38回は33％に増えている"),
            "caption": "各回の問題のうち「〇〇さん（〇歳）」で始まる**事例問題の割合**。第24回の約**23％**から、第38回は約**33％**に。3問に1問は事例です。"}


@fig("chart-hyougen")
def chart_hyougen():
    tadashii = [38, 47, 36, 28, 25, 22, 17, 19, 16, 14, 14, 7, 13, 13, 6]
    tekisetsu = [36, 47, 45, 66, 72, 73, 65, 76, 84, 81, 92, 102, 94, 82, 99]
    W, H = 640, 320
    L, R, T, B = 50, 150, 30, 260
    o = ""
    for v in (0, 25, 50, 75, 100):
        y = B - (B - T) * v / 110
        o += line(L, y, W - R, y, GRID, 1) + text(L - 8, y, f"{v}", 12, MUTED, "end")
    n = len(ROUNDS); step = (W - L - R) / (n - 1)
    def pts(arr):
        return [(L + i * step, B - (B - T) * v / 110) for i, v in enumerate(arr)]
    for arr, col, name in ((tekisetsu, BAR, "最も適切なもの"), (tadashii, SUB, "正しいもの")):
        p = pts(arr)
        o += poly(p, "none", col, 2.5, close=False)
        for x, y in p:
            o += circle(x, y, 4, col, "#fff", 1.5)
        o += text(p[-1][0] + 10, p[-1][1], name, 13, INK, "start", 700)
        o += text(p[-1][0] + 10, p[-1][1] + 18, f"{arr[-1]}問", 12, MUTED, "start")
    for i, r in enumerate(ROUNDS):
        o += text(L + i * step, B + 16, f"{r}", 12, MUTED)
    o += line(L, B, W - R, B, MUTED, 1.5)
    return {"svg": svg(W, H, o, "問われ方の変化：「最も適切なもの」は36問から99問に増え、「正しいもの」は38問から6問に減った"),
            "caption": "1回あたりの**問われ方**の変化（問題数）。知識の正誤を問う「正しいもの」が減り、場面での判断を問う「**最も適切なもの**」が大半になりました。"}


@fig("chart-seikai")
def chart_seikai():
    cnt = [351, 360, 379, 381, 366]
    tot = sum(cnt)
    W, H = 560, 260
    L, R, T, B = 40, 20, 40, 200
    o = ""
    for v in (0, 10, 20):
        y = B - (B - T) * v / 25
        o += line(L, y, W - R, y, GRID, 1) + text(L - 8, y, f"{v}%", 12, MUTED, "end")
    slot = (W - L - R) / 5; bw = slot * 0.56
    for i, c in enumerate(cnt):
        p = c / tot * 100
        x = L + i * slot + (slot - bw) / 2
        h = (B - T) * p / 25
        o += vbar(x, B, bw, h, BAR)
        o += text(x + bw / 2, B - h - 14, f"{p:.1f}%", 13, INK, "middle", 700)
        o += text(x + bw / 2, B + 18, f"{i + 1}番", 13, INK, "middle", 700)
        o += text(x + bw / 2, B + 38, f"{c}問", 11, MUTED)
    o += line(L, B, W - R, B, MUTED, 1.5)
    return {"svg": svg(W, H, o, "正解の番号はほぼ均等で、1番から5番まですべて19〜21％"),
            "caption": "正解の番号（全1,837問）。どれも**19〜21％**でほぼ均等。「迷ったら3番」のような法則はありません。"}


@fig("chart-kamoku")
def chart_kamoku():
    data = [("生活支援技術", 357), ("社会の理解", 180), ("介護の基本", 179), ("こころとからだのしくみ", 178), ("総合問題", 177),
            ("認知症の理解", 150), ("障害の理解", 149), ("発達と老化の理解", 119), ("介護過程", 119), ("コミュニケーション技術", 112),
            ("医療的ケア", 50), ("人間関係とコミュニケーション", 38), ("人間の尊厳と自立", 30)]
    W, H = 660, 30 + 28 * len(data) + 20
    L, R = 250, 70
    o = ""
    mx = 360
    for i, (name, v) in enumerate(data):
        y = 26 + i * 28
        w = (W - L - R) * v / mx
        o += text(L - 10, y + 10, name, 13, INK, "end")
        o += f'<path d="M{L},{y} L{f(L + w - 4)},{y} Q{f(L + w)},{y} {f(L + w)},{y + 4} L{f(L + w)},{y + 16} Q{f(L + w)},{y + 20} {f(L + w - 4)},{y + 20} L{L},{y + 20} Z" fill="{BAR if i == 0 else "#e9a77c"}"/>'
        o += text(L + w + 8, y + 10, f"{v}問", 12, INK if i == 0 else MUTED, "start", 700 if i == 0 else 400)
    o += line(L, 20, L, H - 16, MUTED, 1.5)
    return {"svg": svg(W, H, o, "科目別の出題数：生活支援技術が357問で最も多い"),
            "caption": "第24〜38回の科目別の出題数。**生活支援技術**がほかの科目の約2倍で、全体の約2割を占めます。"}
