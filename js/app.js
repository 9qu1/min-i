// 民意の人生の画面
import { VERSION } from './version.js?v=0.1.0';
import { Net, getJSON } from './net.js?v=0.1.0';
import { PAGE_URL, HASHTAG } from './config.js?v=0.1.0';
import { avatarSVG } from './avatar.js?v=0.1.0';

// ---------- 小さな道具 ----------

const $ = (s) => document.querySelector(s);
// 選択肢を「」でくくる（最期の言葉のように、まるごと「」つきのものは そのまま・中の「」は『』に）
const kagi = (s) => (/^「[^「」]*」$/.test(s) ? s : `「${s.replace(/「/g, '『').replace(/」/g, '』')}」`);
function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'disabled' || k === 'hidden') e[k] = !!v;
    else e.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : String(c));
  return e;
}
const LS = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
const IS_MOBILE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const STAT_NAMES = { health: '健康', money: 'お金', happy: '幸せ', bond: 'つながり' };

// ---------- 状態 ----------

const S = {
  ready: false,
  gen: 0,
  phase: 'vote',
  turn: 0,
  head: null,
  log: [],
  scene: null,
  summary: null,
  deadline: 0,
  skew: 0,
  turnMs: 30000,
  tally: null,
  viewers: 0,
  my: null, // いまの場面で自分が入れた票（選択肢の番号）
  busy: false,
  avaKey: '',
};

// ---------- 知らせ・帯 ----------

let toastT = 0;
function toast(msg, ms = 2800) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.hidden = true; }, ms);
}

let bandT = 0;
function band(st) {
  const b = $('#netband');
  clearTimeout(bandT);
  if (st === 'down') {
    b.className = '';
    b.textContent = '📡 通信が切れました。つなぎ直し中…';
    b.hidden = false;
  } else if (st === 'back') {
    b.className = 'back';
    b.textContent = 'つながりました！';
    b.hidden = false;
    bandT = setTimeout(() => { b.hidden = true; }, 2000);
  } else {
    b.hidden = true;
  }
}

// ---------- 上の名札 ----------

function displayName(h = S.head) {
  if (!h) return '';
  return h.name ? h.name : `${h.sei}家の赤ちゃん`;
}

function renderHead() {
  const h = S.head;
  if (!h) return;
  const key = `${h.gender}:${Math.min(h.age, 120)}:${h.stats.happy >= 60 ? 2 : h.stats.happy >= 35 ? 1 : 0}:${h.stats.health < 30 ? 1 : 0}:${h.dead ? 1 : 0}`;
  if (key !== S.avaKey) {
    S.avaKey = key;
    $('#ava').innerHTML = avatarSVG({ age: h.age, gender: h.gender, stats: h.stats, dead: h.dead });
  }
  $('#h-name').textContent = h.name ? `${h.sei} ${h.name}` : `${h.sei}家の赤ちゃん`;
  $('#h-yomi').textContent = h.yomi || '';
  $('#h-age').textContent = `${h.age}歳`;
  $('#h-stage').textContent = h.dead ? '永眠' : h.stage;
  $('#h-gen').textContent = `${h.gen}代目`;
  for (const b of document.querySelectorAll('#h-bars .bar')) {
    const v = h.stats[b.dataset.k] ?? 0;
    b.querySelector('i').style.width = `${Math.max(2, Math.min(100, v))}%`;
    b.classList.toggle('low', v < 20);
    b.title = `${STAT_NAMES[b.dataset.k]} ${v}`;
  }
  const chips = [];
  for (const w of h.words || []) chips.push(el('span', { class: 'chip', text: w }));
  if (h.rebels) chips.push(el('span', { class: 'chip rebel', text: `民意に逆らった ${h.rebels}回` }));
  if (h.job) chips.push(el('span', { class: 'chip', text: h.job }));
  if (h.marriages >= 2) chips.push(el('span', { class: 'chip', text: `結婚 ${h.marriages}回` }));
  const key2 = chips.map((c) => c.textContent).join('|');
  const box = $('#h-chips');
  if (box.dataset.key !== key2) {
    box.dataset.key = key2;
    box.replaceChildren(...chips);
  }
  document.title = h.name ? `${h.sei}${h.name}（${h.age}）｜民意の人生（仮）` : '民意の人生（仮）｜みんなの多数決で、ひとりの一生を決める';
}

function renderViewers() {
  $('#h-viewers').textContent = String(S.viewers || 0);
}

// ---------- 共有 ----------

function shareTextOf(e) {
  const nm = displayName();
  const want = e.opts?.[e.want]?.l || '';
  if (e.kind === 'name') return `民意で${S.head?.sei || ''}家の赤ちゃんは${e.share} #${HASHTAG}`;
  if (e.rebel) return `民意は${kagi(want)}。でも${nm}（${e.age}）は${e.share} #${HASHTAG}`;
  if (e.auto) return `だれも決めてくれなかったので、${nm}（${e.age}）は自分で決めて${e.share} #${HASHTAG}`;
  if (e.kind === 'last') return `${nm}（${e.age}）は民意で、${e.share} #${HASHTAG}`;
  return `民意で${nm}（${e.age}）は${e.share} #${HASHTAG}`;
}

function xUrl(text) {
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(PAGE_URL)}`;
}

// X の投稿画面は、スクリプトで開かずに「人が押したリンク」で開く（iPhone でアプリに渡すため）
function shareTools(text) {
  const x = el('a', { href: xUrl(text), class: 'share-x', rel: 'noopener' }, 'Xに投稿');
  if (!IS_MOBILE) x.target = '_blank';
  const more = el('button', {
    class: 'share-more', type: 'button',
    onclick: async () => {
      if (navigator.share) {
        try { await navigator.share({ text, url: PAGE_URL }); } catch {}
        return;
      }
      try {
        await navigator.clipboard.writeText(`${text} ${PAGE_URL}`);
        toast('共有の文をコピーしました');
      } catch {
        toast('コピーできませんでした');
      }
    },
  }, '共有');
  return el('div', { class: 'tools' }, x, more);
}

// ---------- 物語 ----------

function whenText(x) {
  if (x.kind === 'name') return '誕生';
  return `${x.age}歳の${x.season || ''}`;
}

function verdictEl(e) {
  const got = e.opts[e.got]?.l || '';
  const want = e.opts[e.want]?.l || '';
  const pct = el('span', { class: 'pct', text: `${e.pct}%` });
  const n = `（${e.total}票${e.tie ? '・同数' : ''}）`;
  if (e.auto) {
    return el('div', { class: 'verdict auto' }, e.kind === 'name' ? 'だれも投票しなかった → 両親が決めた：' : 'だれも投票しなかった → 本人が決めた：', el('b', { text: got }));
  }
  if (e.rebel) {
    return el('div', { class: 'verdict rebel' }, '民意：', el('b', { text: want }), ' ', pct, n, el('br'), '→ でも本人は：', el('b', { text: got }));
  }
  return el('div', { class: 'verdict' }, e.kind === 'last' ? '最期の言葉：' : '民意：', el('b', { text: got }), ' ', pct, n);
}

function entryEl(e) {
  const when = el('div', { class: 'when' }, el('span', { class: 'age', text: whenText(e) }), el('span', { class: 'ttl', text: e.title || '' }));
  if (e.luck) when.append(el('span', { class: `luck ${e.luck}`, text: e.luck === 'ok' ? 'うまくいった' : 'うまくいかなかった' }));
  return el('article', { class: 'entry', 'data-k': String(e.k) },
    when,
    e.echo ? el('p', { class: 'echo', text: e.echo }) : null,
    el('p', { class: 'scene', text: e.text }),
    verdictEl(e),
    e.pre ? el('p', { class: e.rebel ? 'pre rebel' : 'pre', text: e.pre }) : null,
    el('p', { class: 'res', text: e.res }),
    e.share ? shareTools(shareTextOf(e)) : null,
  );
}

function nowEl(sc) {
  return el('article', { class: 'entry now', id: 'now' },
    el('div', { class: 'when' }, el('span', { class: 'now-tag', text: 'いま' }), el('span', { class: 'age', text: whenText(sc) }), el('span', { class: 'ttl', text: sc.title || '' })),
    sc.echo ? el('p', { class: 'echo', text: sc.echo }) : null,
    el('p', { class: 'scene', text: sc.text }),
  );
}

function listEl(items) {
  return el('ul', {}, items.map((x) => el('li', {}, x)));
}

function summaryEl(sm, { share = true } = {}) {
  const full = `${sm.sei} ${sm.name || ''}`;
  const kids = [
    el('h3', { text: `${full}（${sm.yomi || ''}）` }),
    el('div', { class: 'meta', text: `${sm.gen}代目・${sm.pref}生まれ・享年${sm.age}（${sm.causeText}）` }),
    el('div', { class: 'epi', text: `「${sm.epitaph}」` }),
    el('div', { class: 'titles' }, (sm.titles || []).slice(1).concat(sm.words?.length ? [`${sm.words.join('・')}人`] : []).map((t) => el('span', { text: t }))),
    el('div', { class: 'num' },
      el('div', {}, el('b', { text: String(sm.turns) }), el('small', { text: '回の選択' })),
      el('div', {}, el('b', { text: String(sm.rebels) }), el('small', { text: '回 民意に逆らった' })),
      el('div', {}, el('b', { text: String(sm.votesTotal) }), el('small', { text: '票が入った' })),
    ),
  ];
  if (sm.lastWords) kids.push(el('h4', { text: '最期の言葉' }), el('p', { text: sm.lastWords }));
  if (sm.highlights?.length) kids.push(el('h4', { text: '名場面' }), listEl(sm.highlights.map((h) => `${h.age}歳 ${h.title ? `【${h.title}】` : ''}${h.text}`)));
  if (sm.picks?.length) {
    kids.push(el('h4', { text: '主な選択と民意' }), listEl(sm.picks.map((p) => {
      if (p.auto) return `${p.age}歳 ${p.title}：${kagi(p.label)}（本人が決めた）`;
      if (p.rebel) return `${p.age}歳 ${p.title}：民意は${kagi(p.wanted)}${p.pct}% → 本人は${kagi(p.label)}`;
      return `${p.age}歳 ${p.title}：${kagi(p.label)}${p.pct}%（${p.total}票）`;
    })));
  }
  if (sm.timeline?.length) kids.push(el('h4', { text: '年表' }), el('ul', { class: 'tl' }, sm.timeline.map((t) => el('li', {}, el('span', { class: 'a', text: `${t.age}歳` }), el('span', {}, el('span', { class: 't', text: t.t }), el('small', { text: t.d || '' }))))));
  if (sm.cast?.length) kids.push(el('h4', { text: '登場人物' }), castList(sm.cast));
  if (share) kids.push(shareTools(`民意で生きた${sm.sei}${sm.name || ''}、享年${sm.age}。「${sm.epitaph}」 #${HASHTAG}`));
  return el('article', { class: 'summary', id: share ? 'summary' : null }, ...kids);
}

function castList(cast) {
  return el('ul', { class: 'cast' }, cast.map((c) => {
    const st = c.quiet ? '便りがとだえた' : c.alive ? (c.pet ? `${c.age}歳` : `${c.age}歳`) : `${c.diedAt ?? ''}歳のとき亡くなった`;
    return el('li', { class: c.alive ? '' : 'gone' },
      el('div', {}, el('span', { class: 'n', text: c.name }), ' ', el('span', { class: 'w', text: [c.word, ...(c.also || [])].join('・') })),
      el('div', { class: 'st', text: st }),
      el('div', { class: 'w', style: 'grid-column:1/-1', text: `${c.trait || ''}${c.trait ? (c.pet ? '子' : '人') : ''}${c.met ? `・${c.met}歳で${c.pet ? '家に来た' : '出会った'}` : ''}`.replace(/^・/, '') }),
      el('div', { class: 'rel', title: `関係の深さ ${c.rel}` }, el('i', { style: `width:${c.rel}%` })),
    );
  }));
}

// 物語は、いちばん下を見ている人にだけ自動でついていく（上を読み返している人は動かさない）
const story = () => $('#story');
let stick = true;
let autoTop = -1; // 自動で動かした先（その位置のスクロールは人の操作として数えない）
function nearBottom() {
  const s = story();
  return s.scrollHeight - s.scrollTop - s.clientHeight < 160;
}
function toBottom() {
  const s = story();
  s.scrollTop = s.scrollHeight;
  autoTop = s.scrollTop;
  stick = true;
  $('#jump').hidden = true;
}
function afterAdd(force = false) {
  if (stick || force) requestAnimationFrame(() => toBottom());
  else {
    const j = $('#jump');
    j.hidden = false;
    j.style.bottom = `${$('#vote').offsetHeight + 10}px`;
  }
}

function renderStory() {
  const kids = S.log.map(entryEl);
  if (S.phase === 'summary' && S.summary) kids.push(summaryEl(S.summary));
  else if (S.scene) kids.push(nowEl(S.scene));
  story().replaceChildren(...kids);
}

// ---------- 下の投票 ----------

function remainMs() {
  return S.deadline - (Date.now() + S.skew);
}

function renderVote() {
  const box = $('#v-choices');
  const note = $('#v-note');
  if (S.phase === 'summary') {
    if (box.dataset.turn !== `sum${S.gen}`) {
      box.dataset.turn = `sum${S.gen}`;
      box.replaceChildren(el('div', { class: 'wait' }, `${displayName()}の人生が終わりました。`, el('br'), '次の代が生まれるまで ', el('b', { id: 'v-wait', text: '--' }), ' 秒'));
    }
    $('#v-when').textContent = '人生のまとめ';
    $('#v-timer').hidden = true;
    note.textContent = 'まとめは「歴代の人生」にも残ります';
    return;
  }
  $('#v-timer').hidden = false;
  const sc = S.scene;
  if (!sc) return;
  $('#v-when').textContent = sc.kind === 'name' ? '名前を決める' : sc.kind === 'last' ? '最期の言葉' : `${sc.age}歳の${sc.season}・${sc.title}`;
  if (box.dataset.turn !== String(S.turn)) {
    // 場面が変わったときだけボタンを作りなおす（だれかの出入りや票の動きでは作りなおさない）
    box.dataset.turn = String(S.turn);
    box.replaceChildren(...sc.choices.map((c, i) => el('button', {
      class: 'choice', type: 'button', 'data-i': String(i),
      onclick: () => castVote(i),
    }, el('span', { class: 'fill' }), el('span', { class: 'lbl', text: c.label }), el('span', { class: 'pct', text: '0%' }), el('span', { class: 'mine', text: 'あなたの票' }))));
  }
  note.textContent = '押すと投票。締め切りまで何度でも変えられます';
  renderTally();
  renderMine();
}

function renderTally() {
  const t = S.tally;
  const btns = document.querySelectorAll('#v-choices .choice');
  if (!t || t.turn !== S.turn) {
    btns.forEach((b) => { b.querySelector('.fill').style.width = '0%'; b.querySelector('.pct').textContent = '0%'; });
    return;
  }
  btns.forEach((b, i) => {
    const n = t.n[i] || 0;
    const p = t.total ? Math.round((n / t.total) * 100) : 0;
    b.querySelector('.fill').style.width = `${p}%`;
    b.querySelector('.pct').textContent = `${p}%`;
    b.title = `${n}票`;
  });
}

function renderMine() {
  document.querySelectorAll('#v-choices .choice').forEach((b, i) => {
    b.classList.toggle('on', S.my === i && !S.busy);
    b.disabled = S.busy;
  });
}

async function castVote(i) {
  if (S.busy || S.phase !== 'vote' || !S.scene) return;
  if (S.my === i) return;
  if (!net.connected) {
    toast('📡 つながってから、もう一度押してね');
    return;
  }
  const turn = S.turn;
  S.busy = true;
  const btn = document.querySelector(`#v-choices .choice[data-i="${i}"]`);
  btn?.classList.add('busy');
  btn?.querySelector('.mine') && (btn.querySelector('.mine').textContent = '送信中…');
  renderMine();
  const r = await net.vote(turn, i);
  // 返事が来てからボタンを戻す
  S.busy = false;
  btn?.classList.remove('busy');
  if (btn?.querySelector('.mine')) btn.querySelector('.mine').textContent = 'あなたの票';
  if (turn !== S.turn) { renderVote(); return; }
  if (r.ok) S.my = r.c;
  else toast(r.err || 'うまくいきませんでした');
  renderMine();
}

// 残り時間（0.25秒ごと）
setInterval(() => {
  const ms = remainMs();
  const sec = Math.max(0, Math.ceil(ms / 1000));
  if (S.phase === 'summary') {
    const w = $('#v-wait');
    if (w) w.textContent = String(sec);
    $('#v-sec').textContent = String(sec);
    $('#v-prog').style.width = '100%';
    return;
  }
  $('#v-sec').textContent = S.deadline ? String(sec) : '--';
  $('#v-timer').classList.toggle('hurry', sec <= 5);
  $('#v-prog').style.width = `${Math.max(0, Math.min(100, (ms / S.turnMs) * 100))}%`;
}, 250);

// ---------- 通信から届いたもの ----------

function setClock(m) {
  if (typeof m.now === 'number') S.skew = m.now - Date.now();
  if (typeof m.deadline === 'number') S.deadline = m.deadline;
  if (typeof m.turnMs === 'number') S.turnMs = m.turnMs;
}

function onSnap(m) {
  S.gen = m.gen;
  S.phase = m.phase;
  S.turn = m.turn;
  S.head = m.head;
  S.log = m.log || [];
  S.scene = m.scene;
  S.summary = m.summary;
  S.tally = m.tally;
  S.viewers = m.viewers;
  if (S.busy === false && m.turn !== S.myTurn) S.my = null;
  S.myTurn = m.turn;
  setClock(m);
  renderHead();
  renderViewers();
  renderStory();
  renderVote();
  if (!S.ready) {
    S.ready = true;
    afterAdd(true);
  } else afterAdd();
}

function onOk(m) {
  setClock(m);
  if (m.tally) S.tally = m.tally;
  if (typeof m.viewers === 'number') S.viewers = m.viewers;
  renderViewers();
  renderTally();
}

function onDiff(m) {
  setClock(m);
  if (m.born) {
    S.log = [];
    S.summary = null;
    S.gen = m.gen;
  }
  const nowNode = $('#now');
  if (m.entry) {
    S.log.push(m.entry);
    const node = entryEl(m.entry);
    if (nowNode) nowNode.replaceWith(node);
    else story().append(node);
  } else if (nowNode) nowNode.remove();
  S.head = m.head || S.head;
  S.phase = m.phase || S.phase;
  S.turn = m.turn;
  S.scene = m.scene;
  S.tally = null;
  S.my = null;
  S.myTurn = m.turn;
  if (m.summary) S.summary = m.summary;
  if (m.born) renderStory();
  else if (S.phase === 'summary' && S.summary) story().append(summaryEl(S.summary));
  else if (S.scene) story().append(nowEl(S.scene));
  renderHead();
  renderVote();
  afterAdd(m.born);
}

function onTally(m) {
  if (m.turn === S.turn) {
    S.tally = m;
    renderTally();
  }
  if (typeof m.viewers === 'number') {
    S.viewers = m.viewers;
    renderViewers();
  }
}

function onMy(m) {
  if (m.turn !== S.turn || S.busy) return;
  S.my = m.c;
  renderMine();
}

const net = new Net({
  onStatus: band,
  onReload: () => location.reload(),
  onSnap, onOk, onDiff, onTally, onMy,
});

// ---------- 重ねる画面 ----------

function openSheet(kind, arg) {
  const body = $('#sheet-body');
  const title = $('#sheet-title');
  $('#sheet').hidden = false;
  $('#sheet').dataset.kind = kind;
  if (kind === 'timeline') {
    title.textContent = `${displayName()}の年表`;
    const items = S.log.map((e) => el('li', { class: `${e.big >= 3 ? 'big' : ''} ${e.rebel ? 'rebel' : ''}` },
      el('span', { class: 'a', text: e.kind === 'name' ? '0歳' : `${e.age}歳` }),
      el('span', {}, el('span', { class: 't', text: e.title || '' }), el('small', { text: `${e.rebel ? '民意に逆らって ' : ''}${e.share || ''}` }))));
    body.replaceChildren(items.length ? el('ul', { class: 'tl' }, items) : el('p', { class: 'empty', text: 'まだ何も起きていません' }));
  } else if (kind === 'cast') {
    title.textContent = '登場人物';
    const cast = S.head?.cast || [];
    body.replaceChildren(cast.length ? castList(cast) : el('p', { class: 'empty', text: 'まだだれもいません' }));
  } else if (kind === 'history') {
    title.textContent = '歴代の人生';
    body.replaceChildren(el('p', { class: 'empty', text: '読みこみ中…' }));
    loadHistory(arg);
  } else if (kind === 'life') {
    title.textContent = `${arg}代目の人生`;
    body.replaceChildren(el('p', { class: 'empty', text: '読みこみ中…' }));
    loadLife(arg);
  } else {
    title.textContent = '民意の人生とは';
    body.replaceChildren(aboutEl());
  }
  body.scrollTop = 0;
}

function closeSheet() {
  $('#sheet').hidden = true;
  if (new URLSearchParams(location.search).has('life')) history.replaceState(null, '', location.pathname);
}

async function loadHistory(before) {
  const body = $('#sheet-body');
  const j = await getJSON(`/api/lives${before ? `?before=${before}` : ''}`);
  if ($('#sheet').dataset.kind !== 'history') return;
  if (j.error) { body.replaceChildren(el('p', { class: 'empty', text: j.error })); return; }
  if (!j.lives.length) {
    body.replaceChildren(el('p', { class: 'empty', text: `まだ亡くなった人はいません。いまは${j.current}代目の人生です。` }));
    return;
  }
  const list = el('ul', { class: 'lives' }, j.lives.map((l) => el('li', {}, el('button', { type: 'button', onclick: () => openSheet('life', l.gen) },
    el('span', { class: 'n', text: `${l.gen}代目　${l.sei}${l.name || ''}` }),
    el('span', { class: 'e', text: `「${l.epitaph}」` }),
    el('span', { class: 'm', text: `${l.pref}生まれ・享年${l.age}（${l.causeText}）・民意に逆らった${l.rebels}回` })))));
  const more = j.lives.length >= 20 ? el('button', { class: 'btn', type: 'button', onclick: () => loadHistory(j.lives[j.lives.length - 1].gen) }, 'もっと前の人生') : null;
  body.replaceChildren(list, more);
}

async function loadLife(gen) {
  const body = $('#sheet-body');
  const j = await getJSON(`/api/life?gen=${encodeURIComponent(gen)}`);
  if ($('#sheet').dataset.kind !== 'life') return;
  if (j.error) { body.replaceChildren(el('p', { class: 'empty', text: j.error })); return; }
  const sm = j.life;
  body.replaceChildren(
    el('button', { class: 'btn', type: 'button', onclick: () => openSheet('history') }, '← 歴代の人生'),
    el('div', { style: 'height:10px' }),
    summaryEl(sm, { share: false }),
    shareToolsLife(sm),
  );
}

function shareToolsLife(sm) {
  const t = shareTools(`民意で生きた${sm.sei}${sm.name || ''}、享年${sm.age}。「${sm.epitaph}」 #${HASHTAG}`);
  // 歴代の人生は、その人のまとめへのリンクで共有する
  const url = `${PAGE_URL}?life=${sm.gen}`;
  const x = t.querySelector('.share-x');
  x.href = `https://x.com/intent/post?text=${encodeURIComponent(`民意で生きた${sm.sei}${sm.name || ''}、享年${sm.age}。「${sm.epitaph}」 #${HASHTAG}`)}&url=${encodeURIComponent(url)}`;
  return t;
}

function aboutEl() {
  return el('div', { class: 'about' },
    el('p', { text: '日本中の人が、ひとりの人生を多数決で決めるゲームです。' }),
    el('h3', { text: '遊び方' }),
    el('p', { text: '下に出ている選択肢を押すと投票できます。締め切り（30秒）までは何度でも変えられます。いちばん票の多い選択が、その人の人生になります。' }),
    el('p', { text: '最初の投票は名前。そのあと、給食、初恋、受験、仕事、結婚、介護、孫……と、人生が続いていきます。' }),
    el('h3', { text: 'その人は、生きている' }),
    el('p', { text: 'その人には性格があり、選択で少しずつ変わります。性格とあまりにぶつかる選択が勝つと、まれに本人が民意に逆らうことがあります。告白や受験は、運しだいでうまくいかないこともあります。だれも投票しないときは、本人が自分で決めます。' }),
    el('h3', { text: '人生の終わり' }),
    el('p', { text: '老いや病気で亡くなると、最後の投票は「最期の言葉」。人生のまとめが「歴代の人生」に残り、少しして次の代が生まれます。孫がいれば、その子孫として生まれることもあります。' }),
    el('p', { text: 'だれも見ていないあいだ、人生は止まって待っています。' }),
    el('p', {}, el('button', { class: 'btn main', type: 'button', onclick: closeSheet }, '人生を見に行く')),
    el('p', { class: 'empty', text: `版 ${VERSION}（試作）` }),
  );
}

document.querySelectorAll('#menu button').forEach((b) => b.addEventListener('click', () => openSheet(b.dataset.sheet)));
$('#sheet-close').addEventListener('click', closeSheet);
$('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') closeSheet(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });
$('#jump').addEventListener('click', () => toBottom());
story().addEventListener('scroll', () => {
  // 自動で下へ動かしたときのスクロールは数えない（人が動かしたときだけ、ついていくかを決めなおす）
  if (Math.abs(story().scrollTop - autoTop) < 4) return;
  stick = nearBottom();
  if (stick) $('#jump').hidden = true;
}, { passive: true });

// はじめての人には遊び方。?life=N なら、その人生のまとめ
const q = new URLSearchParams(location.search);
if (/^\d+$/.test(q.get('life') || '')) openSheet('life', Number(q.get('life')));
else if (!LS.get('mj-about')) {
  LS.set('mj-about', '1');
  openSheet('about');
}

net.connect();

// テストと、困ったときに見る用
window.mj = { S, net, renderStory, renderVote, openSheet };
