// 共有用の結果カード（1200×630 の PNG）: 物語の1ページ（出来事・名前の投票）と、人生のまとめ
//   見た目は画面と同じ「温かい紙・日記」（物語は明朝、操作はゴシック）。本人の顔は avatar.js の SVG を描く
//   書体は描く前に、描く文字を全部渡して読みこむ（Google Fonts の日本語は文字ごとに分かれていて、
//   渡さないと1枚目だけ一部の字が代わりの書体になる）
import { HASHTAG } from './config.js?v=0.1.1';
import { avatarSVG } from './avatar.js?v=0.1.1';

const W = 1200, H = 630;
const C = {
  paper: '#FBF6EC', paper2: '#F4ECDC', card: '#FFFDF8', ink: '#3B2F2A', ink2: '#6E5E54', ink3: '#9A8A7E',
  line: '#E4D8C4', line2: '#D3C3A8', accent: '#C8553D', accent2: '#A43F2B', soft: '#F6DED6', rebelLine: '#E9B7A9',
  fillOn: '#F5D5C8', fillRebel: '#F0CBBE', ok: '#3F7D5B', okSoft: '#E3F0E6', ngSoft: '#F3E1DC',
};
const MINCHO = '"Zen Old Mincho"', GOTHIC = '"Zen Kaku Gothic New"';
const SERIF = `${MINCHO}, "Hiragino Mincho ProN", "Yu Mincho", serif`;
const SANS = `${GOTHIC}, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", sans-serif`;
const SITE = '9qu1.com/min-i/';
// 文字を置く場所: 左の端・右の端・右の列の始まり（左の列は顔と名前）
const X0 = 84, X1 = 1116, COL = 344;
const FACE = { x: 194, y: 248, r: 88 };
// いつも描く文字（読みこみに足す）
const FIXED = `民意の人生（仮）代目#${HASHTAG}${SITE}0123456789%…・：→「」、。命名逆らった自分で決めた享年回の選択生まれで永眠歳`;

// app.js と同じ: 選択肢を「」でくくる
const kagi = (s) => (/^「[^「」]*」$/.test(s) ? s : `「${s.replace(/「/g, '『').replace(/」/g, '』')}」`);

// テスト用: いちばん最近のカードに描いた文字の場所（枠からはみ出していないかを見る）
let boxes = [];
export const cardBoxes = () => boxes.slice();

// ---------- 出来事・名前の投票のカード ----------

// e は物語の1場面（サーバーの entry）。who は本人（名字・名前・よみ・性別・何代目）
export async function entryCard(e, who = {}) {
  const isName = e.kind === 'name';
  const got = e.opts?.[e.got]?.l || '';
  const want = e.opts?.[e.want]?.l || '';
  const m = isName ? /^(.+?)（(.+)）$/.exec(got) : null;
  const baby = m ? m[1] : got;
  const sei = who.sei || '';
  const nm = who.name || `${sei}家の赤ちゃん`;
  const full = isName ? `${sei} ${baby}` : who.name ? `${sei} ${who.name}` : nm;
  const yomi = isName ? m?.[2] || '' : who.yomi || '';
  // 前置きと大きな文は、共有の文（app.js の shareTextOf）と同じ意味に
  const lead = isName ? `民意で${sei}家の赤ちゃんは`
    : e.rebel ? `民意は${kagi(want)}。でも${nm}（${e.age}）は`
    : e.auto ? `だれも決めてくれなかったので、${nm}（${e.age}）は自分で決めて`
    : e.kind === 'last' ? `${nm}（${e.age}）は民意で、`
    : `民意で、${nm}（${e.age}）は`;
  const big = isName ? baby : e.share || '';
  const when = isName ? '誕生' : `${e.age}歳の${e.season || ''}`;
  const title = isName ? '名前の投票' : e.title || '';
  const luck = e.luck === 'ok' ? 'うまくいった' : e.luck === 'ng' ? 'うまくいかなかった' : '';
  const count = `（${e.total}票${e.tie ? '・同数' : ''}）`;
  // 下の箱は画面の「民意：〇〇 67%（3票）」と同じ
  const rows = e.auto ? [{ pre: `だれも投票しなかった → ${isName ? '両親' : '本人'}が決めた` }, { pre: '', b: got }]
    : e.rebel ? [{ pre: '民意：', b: want, pct: e.pct, count }, { pre: '→ 本人が選んだのは：', b: got, red: true }]
    : [{ pre: e.kind === 'last' ? '最期の言葉：' : '民意：', b: got, pct: e.pct, count }];
  const style = e.auto ? 'auto' : e.rebel ? 'rebel' : 'on';
  const mark = isName ? { lines: ['命名'], color: C.accent }
    : e.rebel ? { lines: ['民意に', '逆らった'], color: C.accent }
    : e.auto ? { lines: ['自分で', '決めた'], color: C.ink2, dashed: true } : null;

  await loadGlyphs([lead, big, when, title, luck, full, yomi, 'と名づけられた', ...rows.flatMap((r) => [r.pre, r.b || '', r.count || ''])].join(''));
  const face = await faceCanvas({ age: isName ? 0 : e.age || 0, gender: who.gender, stats: { happy: 70, health: 80 } }, FACE.r * 2);

  return render(who.gen, (g) => {
    // 左: 顔と名前（はんこは顔の右上に）
    drawFace(g, face);
    putFit(g, full, FACE.x, 384, { sizes: [30, 27, 24, 21], font: SERIF, weight: 700, align: 'center', max: 236 });
    if (yomi) put(g, yomi, FACE.x, 414, { size: 18, color: C.ink3, align: 'center', max: 236 });
    if (mark) stamp(g, FACE.x + 80, FACE.y - 66, mark.lines.length > 1 ? 58 : 52, mark);

    // 右の上: いつ・何の場面か（画面の物語の見出しと同じ）
    const w = X1 - COL;
    let x = COL + put(g, when, COL, 168, { size: 28, weight: 700, color: C.accent2 }) + 18;
    const pw = luck ? pillWidth(g, luck, 19) : 0;
    x += put(g, title, x, 168, { size: 26, color: C.ink2, max: X1 - x - (luck ? pw + 14 : 0) }) + 14;
    if (luck) pill(g, luck, x, 168, { size: 19, fg: e.luck === 'ok' ? C.ok : C.accent2, bg: e.luck === 'ok' ? C.okSoft : C.ngSoft });

    // 右の下: 民意の結果
    const vTop = verdict(g, rows, style, 504);

    // 右の真ん中: 前置き＋大きく結果
    const top = 186, bottom = vTop - 16;
    if (isName) {
      // 名前は大きく1行（よみは右に小さく）→「と名づけられた」
      g.font = `400 28px ${SANS}`;
      const yw = yomi ? g.measureText(yomi).width + 22 : 0;
      // 下の箱が2行のときは、そのぶん小さく（前置きと「と名づけられた」の2行ぶんをあける）
      const tall = [112, 100, 88, 76, 64, 52].filter((s) => s * 1.18 <= bottom - top - 96);
      const size = fitSize(g, baby, w - yw, tall.length ? tall : [52], SERIF, 700);
      const lineH = size * 1.18;
      const blockH = 44 + 4 + lineH + 4 + 44;
      let y = top + Math.max(0, (bottom - top - blockH) / 2);
      put(g, lead, COL, y + 32, { size: 30, font: SERIF, color: C.ink2, max: w });
      y += 48;
      const bw = put(g, baby, COL, y + lineH / 2 + size * 0.38, { size, font: SERIF, weight: 700, max: w - yw });
      if (yomi) put(g, yomi, COL + bw + 22, y + lineH / 2 + size * 0.38, { size: 28, color: C.ink3, max: w - bw - 22 });
      y += lineH + 4;
      put(g, 'と名づけられた', COL, y + 32, { size: 30, font: SERIF, color: C.ink2 });
      return;
    }
    g.font = `400 30px ${SERIF}`;
    let leadSize = 30;
    let leadLines = wrap(g, lead, w);
    if (leadLines.length > 1) {
      leadSize = 27;
      g.font = `400 ${leadSize}px ${SERIF}`;
      leadLines = clampLines(g, wrap(g, lead, w), 2, w);
    }
    const leadLH = leadSize * 1.45;
    const leadH = leadLines.length * leadLH;
    const fit = fitLines(g, big, { font: SERIF, weight: 700, sizes: [80, 72, 64, 58, 52, 48, 44, 40, 37, 34], width: w, maxH: bottom - top - leadH - 8, maxLines: (s) => (s >= 44 ? 2 : 3), minOne: 48 });
    let y = top + Math.max(0, (bottom - top - leadH - 8 - fit.h) / 2);
    for (const ln of leadLines) { put(g, ln, COL, y + leadLH / 2 + leadSize * 0.38, { size: leadSize, font: SERIF, color: C.ink2 }); y += leadLH; }
    y += 8;
    for (const ln of fit.lines) { put(g, ln, COL, y + fit.lh / 2 + fit.size * 0.38, { size: fit.size, font: SERIF, weight: 700 }); y += fit.lh; }
  });
}

// ---------- 人生のまとめのカード ----------

// sm はサーバーの人生のまとめ（summarize の形）
export async function lifeCard(sm) {
  const full = `${sm.sei} ${sm.name || ''}`.trim();
  const yomi = sm.yomi || '';
  const epi = sm.epitaph ? `「${sm.epitaph}」` : '';
  const place = sm.pref ? `${sm.pref}生まれ` : '';
  const cause = sm.causeText ? `${sm.causeText}で永眠` : '';
  // 年表から3行: 名づけの行をのぞいて、はじめ・なかごろ・おわり（おわりはたいてい最期の言葉）
  const tl = (sm.timeline || []).filter((t, i) => !(i === 0 && /名づけ/.test(t.t)));
  const pick = tl.length <= 3 ? tl : [tl[0], tl[Math.floor((tl.length - 1) / 2)], tl[tl.length - 1]];
  const rows = pick.map((t) => ({ a: `${t.age}歳`, t: t.t || '' }));
  const stats = [`${sm.turns ?? 0}回の選択`, `民意に逆らった${sm.rebels ?? 0}回`];

  await loadGlyphs([full, yomi, epi, place, cause, '民意で生きた', ...stats, ...rows.flatMap((r) => [r.a, r.t])].join(''));
  const face = await faceCanvas({ age: sm.age || 0, gender: sm.gender, stats: sm.stats || {}, dead: true }, FACE.r * 2);

  return render(sm.gen, (g) => {
    // 左: 顔・はんこ（享年）・選択の数
    drawFace(g, face);
    stamp(g, FACE.x + 80, FACE.y - 70, 56, { lines: ['享年', String(sm.age ?? '')], color: C.accent, age: true });
    put(g, stats[0], FACE.x, 384, { size: 21, color: C.ink2, align: 'center', max: 236 });
    put(g, stats[1], FACE.x, 414, { size: 21, color: C.ink2, align: 'center', max: 236 });

    // 右: 生まれ・亡くなり方 → 民意で生きた → 名前 → ひとこと → 年表
    const w = X1 - COL;
    let x = COL;
    if (place) x += put(g, place, x, 168, { size: 28, weight: 700, color: C.accent2, max: w }) + 18;
    if (cause) put(g, cause, x, 168, { size: 26, color: C.ink2, max: X1 - x });
    put(g, '民意で生きた', COL, 222, { size: 30, font: SERIF, color: C.ink2 });
    g.font = `400 24px ${SANS}`;
    const yw = yomi ? g.measureText(yomi).width + 20 : 0;
    const size = fitSize(g, full, w - yw, [76, 68, 60, 52, 46], SERIF, 700);
    const nw = put(g, full, COL, 296, { size, font: SERIF, weight: 700, max: w - yw });
    if (yomi) put(g, yomi, COL + nw + 20, 296, { size: 24, color: C.ink3, max: w - nw - 20 });
    let y = 296;
    if (epi) {
      const es = fitSize(g, epi, w, [36, 33, 30, 27], SERIF, 700);
      y += 58;
      put(g, epi, COL - es * 0.5, y, { size: es, font: SERIF, weight: 700, color: C.accent2, max: w + es * 0.5 });
    }
    // 年表（入るぶんだけ）。左に細い線（画面の思い出の一文と同じ）
    const tlTop = y + 14;
    const fitRows = rows.filter((_, i) => tlTop + (i + 1) * 40 <= 506);
    if (fitRows.length) {
      g.fillStyle = C.line2;
      g.fillRect(COL, tlTop + 12, 3, fitRows.length * 40 - 4);
    }
    fitRows.forEach((r, i) => {
      const by = tlTop + (i + 1) * 40;
      put(g, r.a, COL + 76, by, { size: 22, weight: 700, color: C.accent2, align: 'right' });
      put(g, r.t, COL + 92, by, { size: 25, font: SERIF, max: w - 92 });
    });
  });
}

// ---------- 描く道具 ----------

function render(gen, draw) {
  boxes = [];
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d');
  g.textBaseline = 'alphabetic';
  // 紙と、日記の1枚（影つき）
  g.fillStyle = C.paper;
  g.fillRect(0, 0, W, H);
  g.save();
  g.shadowColor = 'rgba(80, 55, 30, .13)';
  g.shadowBlur = 26;
  g.shadowOffsetY = 8;
  g.fillStyle = C.card;
  round(g, 36, 34, W - 72, H - 68, 26);
  g.fill();
  g.restore();
  g.strokeStyle = C.line2;
  g.lineWidth = 2;
  round(g, 36, 34, W - 72, H - 68, 26);
  g.stroke();
  // 上: アプリの名前と何代目
  const w = put(g, '民意の人生', X0, 90, { size: 32, font: SERIF, weight: 700 });
  put(g, '（仮）', X0 + w + 2, 88, { size: 18, font: SERIF, weight: 700, color: C.ink3 });
  if (gen) put(g, `${gen}代目`, X1, 88, { size: 22, weight: 700, color: C.ink2, align: 'right' });
  g.strokeStyle = C.line;
  g.lineWidth = 2;
  g.setLineDash([8, 7]);
  g.beginPath(); g.moveTo(X0, 114); g.lineTo(X1, 114); g.stroke();
  g.setLineDash([]);
  // 下: ハッシュタグとサイト
  g.beginPath(); g.moveTo(X0, 522); g.lineTo(X1, 522); g.stroke();
  put(g, `#${HASHTAG}`, X0, 564, { size: 26, weight: 700, color: C.accent2 });
  put(g, SITE, X1, 564, { size: 24, weight: 700, color: C.ink3, align: 'right' });
  draw(g);
  return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('画像を作れませんでした'))), 'image/png'));
}

// 文字を1行描いて、場所を覚えておく（max を超えるときは「…」で切る）
function put(g, s, x, y, { size, font = SANS, weight = 400, color = C.ink, align = 'left', max = 0 }) {
  g.font = `${weight} ${size}px ${font}`;
  g.fillStyle = color;
  g.textAlign = align;
  if (max) s = ell(g, s, max);
  const w = g.measureText(s).width;
  g.fillText(s, x, y);
  const x0 = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  boxes.push({ s, x0, x1: x0 + w, y0: y - size * 0.88, y1: y + size * 0.16 });
  g.textAlign = 'left';
  return w;
}
// 入る大きさを選んでから描く
function putFit(g, s, x, y, o) {
  const size = fitSize(g, s, o.max, o.sizes, o.font || SANS, o.weight || 400);
  return put(g, s, x, y, { ...o, size });
}
function fitSize(g, s, max, sizes, font, weight) {
  for (const size of sizes) {
    g.font = `${weight} ${size}px ${font}`;
    if (g.measureText(s).width <= max) return size;
  }
  return sizes[sizes.length - 1];
}
function ell(g, s, max, force = false) {
  if (!force && g.measureText(s).width <= max) return s;
  const t = [...s];
  while (t.length && g.measureText(`${t.join('')}…`).width > max) t.pop();
  return `${t.join('')}…`;
}

// 折り返し: ことばの切れ目で（「じゃ / んけん」のように語の途中で切らない）。
// 行頭に「、。」」などを置かない・行末に「「」などを置かない。1語が1行より長いときだけ字で切る
const NO_START = '、。，．・：；？！?!ー…‥」』）］〉》】〕ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ';
const NO_END = '「『（［〈《【〔';
const SEG = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('ja', { granularity: 'word' }) : null;
function units(s) {
  const segs = SEG ? [...SEG.segment(s)].map((x) => x.segment) : [...s];
  const out = [];
  for (const t of segs) {
    const prev = out[out.length - 1];
    if (prev && (NO_START.includes(t[0]) || NO_END.includes(prev[prev.length - 1]))) out[out.length - 1] = prev + t;
    else out.push(t);
  }
  return out;
}
function wrap(g, s, width) {
  const out = [];
  let cur = '';
  for (const u of units(s)) {
    if (g.measureText(cur + u).width <= width) { cur += u; continue; }
    if (cur) out.push(cur);
    cur = u;
    // 1語でも入らないときは字で切る
    while (g.measureText(cur).width > width && [...cur].length > 1) {
      const cs = [...cur];
      let k = cs.length - 1;
      while (k > 1 && g.measureText(cs.slice(0, k).join('')).width > width) k--;
      while (k > 1 && NO_START.includes(cs[k])) k--;
      out.push(cs.slice(0, k).join(''));
      cur = cs.slice(k).join('');
    }
  }
  if (cur) out.push(cur);
  return out;
}
// n 行のまま、いちばん狭い幅で折り返す（「…と / 言った」のように最後の行だけ短くならないように）
function balance(g, s, width, n) {
  if (n < 2) return wrap(g, s, width);
  let lo = g.measureText(s).width / n, hi = width;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (wrap(g, s, mid).length <= n) hi = mid;
    else lo = mid;
  }
  return wrap(g, s, hi);
}
function clampLines(g, lines, n, width) {
  if (lines.length <= n) return lines;
  const keep = lines.slice(0, n);
  keep[n - 1] = ell(g, keep[n - 1], width, true);
  return keep;
}
// 行数の少ないほうから、大きい字から順に入るものを選ぶ（1行は minOne の大きさまで。
// 折り返すときは行の長さをそろえる。いちばん小さくても入らなければ「…」で切る）
function fitLines(g, s, { font, weight, sizes, width, maxH, maxLines, minOne = 0, lh = 1.32 }) {
  for (let n = 1; n <= 3; n++) {
    for (const size of sizes) {
      if (n === 1 && size < minOne) break;
      if (n > maxLines(size)) continue;
      g.font = `${weight} ${size}px ${font}`;
      const k = wrap(g, s, width).length;
      if (k <= n && k * size * lh <= maxH) return { size, lines: balance(g, s, width, k), lh: size * lh, h: k * size * lh };
    }
  }
  const size = sizes[sizes.length - 1];
  g.font = `${weight} ${size}px ${font}`;
  const n = Math.max(1, Math.min(maxLines(size), Math.floor(maxH / (size * lh))));
  const lines = clampLines(g, wrap(g, s, width), n, width);
  return { size, lines, lh: size * lh, h: lines.length * size * lh };
}

function round(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function pillWidth(g, s, size) {
  g.font = `700 ${size}px ${SANS}`;
  return g.measureText(s).width + 24;
}
function pill(g, s, x, y, { size, fg, bg }) {
  const w = pillWidth(g, s, size);
  g.fillStyle = bg;
  round(g, x, y - size - 6, w, size + 14, 8);
  g.fill();
  put(g, s, x + 12, y - 1, { size, weight: 700, color: fg });
  return w;
}

// 民意の結果の箱（画面の選択肢のボタンのように、票の割合だけ色を塗る）。上の端を返す
function verdict(g, rows, style, bottom) {
  const x0 = COL, x1 = X1, w = x1 - x0;
  // 字の大きさ: 1行に入らなければ小さく
  let size = 26;
  for (const s of [26, 24, 22]) {
    size = s;
    if (rows.every((r) => rowWidth(g, r, s) <= w - 40)) break;
  }
  const rh = size + 16, pad = 14;
  const h = rows.length * rh + pad * 2 - 4;
  const top = bottom - h;
  round(g, x0, top, w, h, 16);
  g.fillStyle = style === 'rebel' ? C.soft : C.paper;
  g.fill();
  const r0 = rows[0];
  if (r0.pct != null) {
    g.save();
    round(g, x0, top, w, h, 16);
    g.clip();
    g.fillStyle = style === 'rebel' ? C.fillRebel : C.fillOn;
    g.fillRect(x0, top, (w * Math.max(0, Math.min(100, r0.pct))) / 100, rows.length > 1 ? pad + rh : h);
    g.restore();
  }
  g.lineWidth = style === 'on' ? 3 : 2;
  g.strokeStyle = style === 'on' ? C.accent : style === 'rebel' ? C.rebelLine : C.line2;
  if (style === 'auto') g.setLineDash([10, 7]);
  round(g, x0, top, w, h, 16);
  g.stroke();
  g.setLineDash([]);
  boxes.push({ s: '[民意の箱]', x0, x1, y0: top, y1: top + h });
  rows.forEach((r, i) => {
    const y = top + pad + rh * i + rh / 2 + size * 0.36;
    let x = x0 + 20;
    let right = x1 - 20;
    if (r.pct != null) {
      right -= put(g, r.count, right, y, { size: size - 4, color: C.ink2, align: 'right' }) + 2;
      right -= put(g, `${r.pct}%`, right, y, { size: size + 2, weight: 700, color: C.accent2, align: 'right' }) + 16;
    }
    if (r.pre) x += put(g, r.pre, x, y, { size, color: C.ink2, max: right - x });
    if (r.b) put(g, r.b, x, y, { size, weight: 700, color: r.red ? C.accent2 : C.ink, max: right - x });
  });
  return top;
}
function rowWidth(g, r, size) {
  let w = 0;
  g.font = `400 ${size}px ${SANS}`;
  w += g.measureText(r.pre || '').width;
  if (r.count) w += g.measureText(r.count).width * ((size - 4) / size) + 18;
  g.font = `700 ${size}px ${SANS}`;
  w += g.measureText(r.b || '').width;
  if (r.pct != null) w += g.measureText(`${r.pct}%`).width * ((size + 2) / size);
  return w;
}

// 紙に押したはんこ（命名・民意に逆らった・自分で決めた・享年）
function stamp(g, cx, cy, r, { lines, color, dashed = false, age = false }) {
  g.save();
  g.translate(cx, cy);
  g.rotate(-0.18);
  g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2);
  g.fillStyle = 'rgba(255, 253, 248, .9)';
  g.fill();
  g.strokeStyle = color;
  g.lineWidth = 5;
  if (dashed) g.setLineDash([10, 7]);
  g.beginPath(); g.arc(0, 0, r - 3, 0, Math.PI * 2); g.stroke();
  g.setLineDash([]);
  if (!dashed) { g.lineWidth = 2; g.beginPath(); g.arc(0, 0, r - 11, 0, Math.PI * 2); g.stroke(); }
  g.fillStyle = color;
  g.textAlign = 'center';
  const inner = (r - 15) * 2;
  if (age) {
    // 享年は数字を大きく
    g.font = `700 19px ${SANS}`;
    g.fillText(lines[0], 0, -14);
    const s = fitSize(g, lines[1], inner * 0.9, [42, 36, 30], SANS, 700);
    g.font = `700 ${s}px ${SANS}`;
    g.fillText(lines[1], 0, 26);
  } else if (lines.length === 1) {
    const s = fitSize(g, lines[0], inner, [34, 30, 26], SERIF, 700);
    g.font = `700 ${s}px ${SERIF}`;
    g.fillText(lines[0], 0, s * 0.36);
  } else {
    const s = Math.min(...lines.map((t) => fitSize(g, t, inner, [24, 22, 20, 18, 16], SERIF, 700)));
    g.font = `700 ${s}px ${SERIF}`;
    lines.forEach((t, i) => g.fillText(t, 0, (i - (lines.length - 1) / 2) * s * 1.2 + s * 0.36));
  }
  g.restore();
  boxes.push({ s: lines.join(''), x0: cx - r, x1: cx + r, y0: cy - r, y1: cy + r });
}

// 顔（名札と同じ、白とうすい線の二重の縁）
function drawFace(g, face) {
  const { x, y, r } = FACE;
  g.beginPath(); g.arc(x, y, r + 6, 0, Math.PI * 2); g.fillStyle = C.line2; g.fill();
  g.beginPath(); g.arc(x, y, r + 4, 0, Math.PI * 2); g.fillStyle = C.card; g.fill();
  if (face) g.drawImage(face, x - r, y - r, r * 2, r * 2);
  else { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = C.paper2; g.fill(); }
}
// 顔の SVG を別のキャンバスに描く（描けない・汚れたキャンバスになる環境では、顔なしで描く）
async function faceCanvas(opts, size) {
  try {
    const svg = avatarSVG(opts).replace('<svg ', `<svg width="${size}" height="${size}" `);
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = size;
    cv.height = size;
    const g = cv.getContext('2d');
    g.drawImage(img, 0, 0, size, size);
    g.getImageData(0, 0, 1, 1); // 汚れていたら、ここで投げる
    return cv;
  } catch {
    return null;
  }
}

// 描く文字を全部渡して、使う太さ・書体ごとに読みこむ
async function loadGlyphs(text) {
  if (!document.fonts?.load) return;
  const s = [...new Set(text + FIXED)].join('');
  try {
    await Promise.all([`400 30px ${MINCHO}`, `700 30px ${MINCHO}`, `400 30px ${GOTHIC}`, `700 30px ${GOTHIC}`].map((f) => document.fonts.load(f, s)));
  } catch {}
}
