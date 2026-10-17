// ビルド後の dist/**/*.html の漢字にルビ（ふりがな）を付ける。
// 使い方：node tools/ruby/ruby.mjs [dist]
// ・<ruby>漢字<rt data-r="かんじ"></rt></ruby> の形で入れる。読みは CSS（html.ruby のとき）で表示するので、
//   ルビを切っているときは見た目も検索結果も変わらない。
// ・読みは kuromoji（形態素解析）。まちがえやすい語は tools/ruby/yomi.tsv で上書きする。
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const kuromoji = require('kuromoji');
const dicPath = path.join(path.dirname(require.resolve('kuromoji')), '..', 'dict');

const KANJI = /[一-鿿㐀-䶿々〆]/;
const KANJI_RUN = /[一-鿿㐀-䶿々〆]+/g;
const hira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// 上書き辞書
const yomi = new Map();
for (const line of fs.readFileSync(path.join(here, 'yomi.tsv'), 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const [k, v] = line.split('\t');
  if (k && v) yomi.set(k.trim(), v.trim());
}

// 数字のあとの助数詞（「65歳」「2年」など）
const COUNTER = { 年: 'ねん', 歳: 'さい', 人: 'にん', 回: 'かい', 分: 'ふん', 問: 'もん', 日: 'にち', 月: 'がつ', 時: 'じ', 度: 'ど',
  割: 'わり', 枚: 'まい', 本: 'ほん', 杯: 'はい', 秒: 'びょう', 点: 'てん', 階: 'かい', 個: 'こ', 件: 'けん', 名: 'めい', 倍: 'ばい', 週: 'しゅう', 号: 'ごう', 級: 'きゅう', 位: 'い', 条: 'じょう', 項: 'こう', 床: 'しょう', 段: 'だん', 歩: 'ほ', 台: 'だい', 錠: 'じょう', 種: 'しゅ' };
const DIGIT = /[0-9０-９〇一二三四五六七八九十百千万]$/;

// 長い語の中でも使う2文字語
const INNER2 = new Set('誤嚥 嚥下 口腔 褥瘡 健側 患側 清拭 拘縮 頸部 頸髄 加齢 浮腫 傾眠 足浴 失認 失行 黄斑 耳介 耳管 耳垢 鼻腔 胸腔 腹腔 眼圧 舌骨 嘔気 頻尿 頻脈 導尿 蓄尿 尿閉 乏尿 飛沫 誤薬 誤飲 白杖 洗身 線毛 外転 内転 底屈 背屈 前屈 後屈 内反 腹圧 寡動 振戦 胸髄 腰髄 骨髄 殿部 肋間 筋群 頬骨 尺骨 橈骨 硝子 扁桃 経鼻 留置 腹臥 臥位 臍帯'.split(' '));
const rb = (base, r) => `<ruby>${base}<rt data-r="${esc(r)}"></rt></ruby>`;

// 1語（surface と読み）を、送りがなを除いて漢字部分だけにルビを付けた HTML にする
function align(surface, reading) {
  const parts = surface.match(/[一-鿿㐀-䶿々〆]+|[^一-鿿㐀-䶿々〆]+/g);
  const re = new RegExp('^' + parts.map((p) => (KANJI.test(p) ? '(.+?)' : hira(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('') + '$');
  const m = hira(reading).match(re);
  if (!m) return KANJI.test(surface) && !/[^一-鿿㐀-䶿々〆]/.test(surface) ? rb(surface, hira(reading)) : surface;
  let i = 1;
  return parts.map((p) => (KANJI.test(p) ? rb(p, m[i++]) : p)).join('');
}

let tokenizer;
function annotateText(s) {
  if (!KANJI.test(s)) return s;
  // 上書き辞書にある漢字の連続は先に決める。残りは kuromoji で
  let out = '';
  let last = 0;
  const pieces = [];
  for (const m of s.matchAll(KANJI_RUN)) {
    const run = m[0];
    if (yomi.has(run)) {
      pieces.push([last, m.index, null]);
      pieces.push([m.index, m.index + run.length, yomi.get(run)]);
      last = m.index + run.length;
      continue;
    }
    // 長い漢字の連続の中にある、まちがえやすい語（3文字以上か、医療の2文字語）を先に決める
    for (let i = 0; i < run.length; ) {
      let hit = '';
      for (let L = Math.min(run.length - i, 24); L >= 2; L--) {
        const w = run.substr(i, L);
        if (yomi.has(w) && (L >= 3 || INNER2.has(w))) { hit = w; break; }
      }
      if (hit) {
        const at = m.index + i;
        pieces.push([last, at, null]);
        pieces.push([at, at + hit.length, yomi.get(hit)]);
        last = at + hit.length;
        i += hit.length;
      } else i++;
    }
  }
  pieces.push([last, s.length, null]);
  for (const [a, b, r] of pieces) {
    const t = s.slice(a, b);
    if (!t) continue;
    if (r) { out += rb(t, r); continue; }
    if (!KANJI.test(t)) { out += t; continue; }
    const toks = tokenizer.tokenize(t);
    let pos = 0;
    for (const k of toks) {
      const surf = k.surface_form;
      const before = (a + pos > 0 ? s.slice(0, a + pos) : '');
      pos += surf.length;
      const after = s.slice(a + pos, a + pos + 3);
      if (!KANJI.test(surf)) { out += surf; continue; }
      if (surf.length === 1 && COUNTER[surf] && DIGIT.test(before)) { out += rb(surf, COUNTER[surf]); continue; }
      if (k.word_type === 'UNKNOWN' || !k.reading || k.reading === '*') { out += surf; continue; }
      if (k.pos_detail_1 === '固有名詞' && k.pos_detail_2 === '人名') { out += surf; continue; }
      let r = k.reading;
      if (surf === '筋' && r === 'スジ') r = 'キン';
      if (surf === '盲') r = 'モウ';
      if (surf === '申' && r === 'サル') r = 'モウ';
      if (surf === '骨' && /[\u30A0-\u30FF]$/.test(before)) r = 'コツ';
      if (surf === '球' && /[\u30A0-\u30FF]$/.test(before)) r = 'キュウ';
      if (surf === '抑' && after.startsWith('うつ')) r = 'ヨク';
      if (surf === '正' && after.startsWith('し')) r = 'タダ';
      if (surf === '床') r = after.startsWith('ずれ') ? 'トコ' : (r === 'トコ' ? 'ユカ' : r);
      if (surf === '後' && r === 'ノチ') r = 'アト';
      const FIX = { 柵: 'サク', 米: 'コメ', 甲: 'コウ', 責: 'セキ', 罰: 'バツ', 臍: 'ヘソ' };
      if (FIX[surf]) r = FIX[surf];
      out += align(surf, r);
    }
  }
  return out;
}

const SKIP = new Set(['script', 'style', 'svg', 'code', 'pre', 'textarea', 'title', 'rt', 'rp', 'ruby', 'head', 'noscript', 'option', 'math']);
function annotateHtml(html) {
  const bodyAt = html.indexOf('<body');
  if (bodyAt < 0) return html;
  const head = html.slice(0, bodyAt);
  const parts = html.slice(bodyAt).split(/(<!--[\s\S]*?-->|<[^>]+>)/);
  let skip = 0;
  const stack = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (!p) continue;
    if (p.startsWith('<')) {
      if (p.startsWith('<!--')) continue;
      const m = p.match(/^<(\/?)([a-zA-Z][\w-]*)/);
      if (!m) continue;
      const name = m[2].toLowerCase();
      const closing = m[1] === '/';
      const selfClose = /\/>$/.test(p);
      // data-noruby の付いた要素の中は付けない
      if (!closing && !selfClose && (SKIP.has(name) || /\sdata-noruby\b/.test(p))) { stack.push(name); skip++; }
      else if (closing && stack.length && stack[stack.length - 1] === name) { stack.pop(); skip--; }
      continue;
    }
    if (skip === 0) parts[i] = annotateText(p);
  }
  return head + parts.join('');
}

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (f.endsWith('.html')) out.push(p);
  }
  return out;
}

const dist = process.argv[2] || 'dist';
kuromoji.builder({ dicPath }).build((err, t) => {
  if (err) throw err;
  tokenizer = t;
  const files = walk(dist);
  const t0 = Date.now();
  for (const f of files) fs.writeFileSync(f, annotateHtml(fs.readFileSync(f, 'utf8')));
  console.log(`ruby: ${files.length} files in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
});
