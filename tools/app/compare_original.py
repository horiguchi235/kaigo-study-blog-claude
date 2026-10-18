"""過去問アプリのデータを、試験問題のPDF（原文）と照合して差分の一覧を作る。

  python3 tools/app/compare_original.py ROUND PDF_or_TXT [PDF_or_TXT ...] > diff_ROUND.tsv

  例：python3 tools/app/compare_original.py 36 ~/Downloads/k_am_0*_36.pdf ~/Downloads/k_pm_0*_36.pdf

- PDF は pdftotext（poppler）で文字にしてから照合します。テキストファイルを直接渡してもかまいません。
- 「問題 12」のような見出しで問題を区切り、選択肢の並びがいちばん近い問題を同じ問題とみなします。
- 出力（タブ区切り）：問題ID・回・試験の問題番号・項目（問題文／選択肢N）・似ている度合い・アプリの文・原文
  空白と改行の違いは無視します。似ている度合いが 1.00 の行は出しません。
- OCR したPDF（翔泳社などが公開している古い回）は読み取りの誤りを含むので、自動では直さず、
  一覧を見て人が判断してください。試験センター公表のPDF（第36回以降）は、そのまま原文として扱えます。
"""
import json, os, re, sys, glob, subprocess, unicodedata, difflib

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(ROOT, 'public', 'app', 'data')


def norm(s):
    s = unicodedata.normalize('NFKC', s or '')
    return re.sub(r'\s+', '', s)


def read_text(path):
    if path.lower().endswith('.pdf'):
        return subprocess.run(['pdftotext', '-layout', path, '-'], capture_output=True, text=True, check=True).stdout
    return open(path, encoding='utf-8').read()


def split_questions(text):
    """「問題 12」「問題12」で区切り、{番号: {stem, options}} を返す。"""
    text = unicodedata.normalize('NFKC', text)
    parts = re.split(r'\n\s*問題\s*(\d{1,3})\s*', '\n' + text)
    out = {}
    for i in range(1, len(parts) - 1, 2):
        no, body = int(parts[i]), parts[i + 1]
        # 選択肢は行頭の 1〜5
        m = list(re.finditer(r'(?m)^\s*([1-5])\s+(.+?)(?=\n\s*[1-5]\s+|\Z)', body, re.S))
        opts = {}
        for x in m:
            k = int(x.group(1))
            if k not in opts: opts[k] = x.group(2)
        stem = body[:m[0].start()] if m else body
        out[no] = {'stem': stem, 'options': [opts.get(k, '') for k in range(1, 6)]}
    return out


def main():
    if len(sys.argv) < 3:
        print(__doc__); sys.exit(1)
    rnd = int(sys.argv[1])
    pdf_q = {}
    for p in sys.argv[2:]:
        pdf_q.update(split_questions(read_text(p)))
    app = []
    for f in sorted(glob.glob(os.path.join(DATA, 's*.json'))):
        d = json.load(open(f, encoding='utf-8'))
        app += [q for q in d['questions'] if q.get('round') == rnd]
    print('\t'.join(['問題ID', '回', '問題番号', '項目', '似ている度合い', 'アプリ', '原文']))
    used = set()
    for q in app:
        key = norm(''.join(q['options']))
        best, score = None, 0
        for no, p in pdf_q.items():
            r = difflib.SequenceMatcher(None, key, norm(''.join(p['options']))).ratio()
            if r > score: best, score = no, r
        if best is None or score < 0.5:
            print('\t'.join([q['id'], str(rnd), '', '見つからない', '%.2f' % score, q['stem'][:60], '']))
            continue
        used.add(best)
        p = pdf_q[best]
        pairs = [('問題文', q['stem'], p['stem'])] + [('選択肢%d' % (i + 1), q['options'][i], p['options'][i]) for i in range(5)]
        for name, a, b in pairs:
            na, nb = norm(a), norm(b)
            if name == '問題文':  # PDF の問題文には前の問題の事例文や見出しが混じることがあるので、末尾で比べる
                nb = nb[-len(na):] if len(nb) > len(na) else nb
            r = difflib.SequenceMatcher(None, na, nb).ratio()
            if r < 1.0:
                print('\t'.join([q['id'], str(rnd), str(best), name, '%.2f' % r, a.replace('\n', '⏎'), b.strip().replace('\n', '⏎')]))
    for no in sorted(set(pdf_q) - used):
        print('\t'.join(['', str(rnd), str(no), 'アプリにない問題', '', '', pdf_q[no]['stem'].strip()[:80].replace('\n', '⏎')]))


if __name__ == '__main__':
    main()
