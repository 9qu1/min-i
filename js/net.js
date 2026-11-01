// 通信: 場面の変化も票も WebSocket（票には返事 ack が来る。来なければ押しなおせるように戻す）
//   切れにくくする仕組み（クニトリの net.js と同じ流儀・恒久ルールの一式を WebSocket 向けにしたもの）
//   ・切れたら 0.5秒から倍に、最大60秒でつなぎなおし、hello で「最後に受け取った番号」を伝えて抜けたぶんだけもらう
//   ・番号が飛んだら（抜けがあったら）すぐ hello で取りなおす
//   ・画面に戻った / focus / online で hello。5秒なにも届かなければ張りなおす（凍った接続）
//   ・12秒ごとに ping。30秒なにも届かなければ張りなおす。画面がうしろのあいだは ping しない（サーバーは「見ていない」とみなす）
//   ・切断が1.5秒続いたら帯を出す（すぐ戻る切断ではちらつかせない）
//   ・送るのは emit()（send という名前はボタンの変数とぶつかりやすいので使わない）
import { VERSION } from './version.js?v=0.1.1';
import { WS_URL, API_ORIGIN } from './config.js?v=0.1.1';

export class Net {
  constructor(h) {
    this.h = h;
    this.seq = -1;
    this.gen = 0;
    this.cid = Net.deviceId();
    this.ws = null;
    this.lastRx = 0;
    this.retry = 0;
    this.downSince = 0;
    this.resyncing = false;
    this.reqId = 0;
    this.waiting = new Map(); // 返事待ちの票（id → { resolve, timer }）
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.wake(); });
    window.addEventListener('focus', () => this.wake());
    window.addEventListener('online', () => this.wake());
    setInterval(() => this.heartbeat(), 12000);
  }

  // 1端末1票のしるし（この端末のブラウザに残す）
  static deviceId() {
    let id = null;
    try { id = localStorage.getItem('mj-cid'); } catch {}
    if (!id || !/^[A-Za-z0-9_-]{16,48}$/.test(id)) {
      const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      id = Array.from(crypto.getRandomValues(new Uint8Array(24)), (x) => chars[x % chars.length]).join('');
      try { localStorage.setItem('mj-cid', id); } catch {}
    }
    return id;
  }

  connect() {
    clearTimeout(this.rt);
    if (this.ws && this.ws.readyState <= 1) return;
    let ws;
    try {
      ws = new WebSocket(WS_URL);
    } catch {
      this.lost(null);
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.retry = 0;
      this.lastRx = Date.now();
      this.hello();
    };
    ws.onmessage = (e) => {
      if (this.ws !== ws) return;
      this.lastRx = Date.now();
      this.onMessage(e.data);
    };
    ws.onclose = ws.onerror = () => this.lost(ws);
  }

  lost(ws) {
    if (ws && this.ws !== ws) return;
    this.ws = null;
    this.down();
    this.failWaiting('📡 通信が切れました。つながってから、もう一度押してね');
    clearTimeout(this.rt);
    // 画面がうしろのあいだはつなぎなおさない（前に戻ったときの wake でつなぐ）
    if (document.hidden) return;
    const wait = Math.min(60000, 500 * 2 ** Math.min(this.retry++, 7)) * (0.8 + Math.random() * 0.4);
    this.rt = setTimeout(() => this.connect(), wait);
  }

  // 凍った接続を捨てて張りなおす
  reopen() {
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onclose = ws.onerror = ws.onmessage = null;
      try { ws.close(); } catch {}
    }
    this.down();
    this.failWaiting('📡 通信が切れました。つながってから、もう一度押してね');
    this.connect();
  }

  down() {
    if (this.downSince) return;
    this.downSince = Date.now();
    clearTimeout(this.bandT);
    this.bandT = setTimeout(() => this.h.onStatus('down'), 1500);
  }

  up() {
    if (!this.downSince) return;
    clearTimeout(this.bandT);
    const shown = Date.now() - this.downSince >= 1500;
    this.downSince = 0;
    this.h.onStatus(shown ? 'back' : 'up');
  }

  get connected() {
    return this.ws?.readyState === 1;
  }

  // 送る（つながっていなければ送らずに false）
  emit(o) {
    if (this.ws?.readyState !== 1) return false;
    try { this.ws.send(JSON.stringify(o)); return true; } catch { return false; }
  }

  hello() {
    this.resyncing = true;
    this.emit({ t: 'hello', v: VERSION, cid: this.cid, seq: this.seq, gen: this.gen });
  }

  // 画面に戻ったとき
  wake() {
    if (!this.ws || this.ws.readyState > 1) { this.retry = 0; this.connect(); return; }
    if (this.ws.readyState !== 1) return;
    const t0 = Date.now();
    this.hello();
    clearTimeout(this.wd);
    this.wd = setTimeout(() => { if (this.lastRx < t0) this.reopen(); }, 5000);
  }

  heartbeat() {
    if (document.hidden) return;
    if (!this.ws || this.ws.readyState > 1) { this.connect(); return; }
    if (this.ws.readyState !== 1) return;
    if (Date.now() - this.lastRx > 30000) { this.reopen(); return; }
    this.emit({ t: 'ping' });
  }

  // 票を送って返事を待つ（6秒で返事がなければ失敗として、押しなおせるようにする）
  vote(turn, c) {
    return new Promise((resolve) => {
      const id = ++this.reqId;
      if (!this.emit({ t: 'vote', id, turn, c })) {
        resolve({ ok: false, err: '📡 つながってから、もう一度押してね', net: true });
        return;
      }
      const timer = setTimeout(() => {
        this.waiting.delete(id);
        resolve({ ok: false, err: '📡 票が届きませんでした。もう一度押してね', net: true });
      }, 6000);
      this.waiting.set(id, { resolve, timer });
    });
  }

  failWaiting(err) {
    for (const [id, w] of this.waiting) {
      clearTimeout(w.timer);
      w.resolve({ ok: false, err, net: true });
      this.waiting.delete(id);
    }
  }

  onMessage(data) {
    let m;
    try { m = JSON.parse(data); } catch { return; }
    if (!m || typeof m !== 'object') return;
    switch (m.t) {
      case 'pong':
        return;
      case 'reload':
        this.h.onReload(m.v);
        return;
      case 'snap':
        this.seq = m.seq;
        this.gen = m.gen;
        this.resyncing = false;
        this.up();
        this.h.onSnap(m);
        return;
      case 'ok':
        this.resyncing = false;
        this.up();
        this.h.onOk(m);
        return;
      case 'd':
        if (m.seq <= this.seq) return;
        if (m.seq !== this.seq + 1) {
          if (!this.resyncing) this.hello(); // 抜けがある → 取りなおす
          return;
        }
        this.seq = m.seq;
        this.gen = m.gen;
        this.h.onDiff(m);
        return;
      case 'tally':
        this.h.onTally(m);
        return;
      case 'my':
        this.h.onMy(m);
        return;
      case 'ack': {
        const w = this.waiting.get(m.id);
        if (!w) return;
        clearTimeout(w.timer);
        this.waiting.delete(m.id);
        w.resolve(m);
        return;
      }
      default:
    }
  }
}

// 歴代の人生を読む（GET。8秒で返事がなければ失敗）
export async function getJSON(path) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(API_ORIGIN + path, { signal: ctl.signal });
    let j = {};
    try { j = await res.json(); } catch {}
    if (!res.ok) return { error: j.error || `うまくいきませんでした（${res.status}）` };
    return j;
  } catch {
    return { error: '📡 読みこめませんでした。もう一度ためしてね', net: true };
  } finally {
    clearTimeout(timer);
  }
}
