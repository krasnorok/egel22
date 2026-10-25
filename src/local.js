// Всё, что у бота делает сервер, здесь считается в браузере.
// Задания берутся из /data/*.json, ответы проверяются по хэшу, прогресс хранится в localStorage.
// На сервер ничего не отправляется, поэтому сайт не обрабатывает персональные данные.

const KEY = "ege-progress-v1";
const XP_PER_TASK = 10;
const XP_PER_LEVEL = 100;
const DATA_V = document.querySelector('script[src*="app.js?v="]')?.getAttribute("src").match(/v=(\w+)/)?.[1] || "1";

const D = { index: null, main: {}, extra: {}, owner: null };

async function json(url) {
  const r = await fetch(`${url}?v=${DATA_V}`);
  if (!r.ok) throw Object.assign(new Error("Не удалось загрузить задания. Проверьте интернет."), { status: r.status });
  return r.json();
}
async function index() {
  if (!D.index) {
    D.index = await json("/data/index.json");
    D.owner = {};
    for (const x of D.index.numbers) for (const id of [...x.main, ...x.extra.map((e) => e[0])]) D.owner[id] = x.n;
  }
  return D.index;
}
async function mainFile(n) { return (D.main[n] ||= await json(`/data/main/${n}.json`)); }
async function extraFile(n) { return (D.extra[n] ||= await json(`/data/extra/${n}.json`)); }

// ---------- Прогресс ----------
function load() {
  try { return Object.assign({ solved: {}, tried: {}, answers: {}, last_n: null }, JSON.parse(localStorage.getItem(KEY) || "{}")); }
  catch (_) { return { solved: {}, tried: {}, answers: {}, last_n: null }; }
}
function save(st) { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (_) {} }
export function resetProgress() { try { localStorage.removeItem(KEY); } catch (_) {} }
export function progressCount() { return Object.keys(load().solved).length; }

const partsOf = (n, count) => (n === 19 && count === 3 ? [19, 20, 21] : [n]);

function statusOf(st, id, n, count) {
  const parts = partsOf(n, count);
  const done = parts.filter((p) => st.solved[`${id}:${p}`]).length;
  if (done === parts.length) return "solved";
  if (done || st.tried[id]) return "tried";
  return "new";
}

function numberInfo(st, x) {
  const ix = D.index;
  const main = x.main;
  const mainSolved = main.filter((id) => statusOf(st, id, x.n, ix.cards[id].parts) === "solved").length;
  return {
    n: x.n, title: x.title,
    main_total: main.length, main_solved: mainSolved, main_closed: mainSolved,
    extra_total: x.extra.length,
    extra_solved: x.extra.filter(([id, c]) => statusOf(st, id, x.n, c) === "solved").length,
    extra_unlocked: mainSolved === main.length,
  };
}

function idsOf(x, tier) { return tier === "extra" ? x.extra.map((e) => e[0]) : x.main; }
function countOf(x, tier, id) { return tier === "extra" ? x.extra.find((e) => e[0] === id)[1] : D.index.cards[id].parts; }

function nextOpen(st, x, tier, after = null) {
  const ids = idsOf(x, tier);
  const start = ids.includes(after) ? ids.indexOf(after) + 1 : 0;
  for (const id of [...ids.slice(start), ...ids.slice(0, start)]) {
    if (id !== after && statusOf(st, id, x.n, countOf(x, tier, id)) !== "solved") return id;
  }
  return null;
}

function card(st, id, n, c) {
  return { id, n, label: c.label, year: c.year, preview: c.preview, status: statusOf(st, id, n, c.parts),
           old_format: c.old_format, parts: c.parts };
}

function playStats(st) {
  const today = new Date().toLocaleDateString("sv");
  const days = new Set();
  let todayCount = 0;
  for (const stamp of Object.values(st.solved)) {
    const d = new Date(stamp).toLocaleDateString("sv");
    days.add(d);
    if (d === today) todayCount++;
  }
  let streak = 0;
  const day = new Date();
  if (!days.has(today)) day.setDate(day.getDate() - 1);
  while (days.has(day.toLocaleDateString("sv"))) { streak++; day.setDate(day.getDate() - 1); }
  const xp = Object.keys(st.solved).length * XP_PER_TASK;
  return { xp, level: Math.floor(xp / XP_PER_LEVEL) + 1, level_xp: xp % XP_PER_LEVEL, level_size: XP_PER_LEVEL,
           today: todayCount, streak, streak_today: days.has(today), xp_per_task: XP_PER_TASK };
}

// ---------- Проверка ответа: нормализация как при сборке (tools/bank.py) ----------
export function normalize(text) {
  return String(text).replace(/\r/g, "").split("\n")
    .map((ln) => ln.toLowerCase().replace(/(\d),(\d)/g, "$1.$2").replace(/[;\t]/g, " ").split(/\s+/).filter(Boolean).join(" "))
    .filter(Boolean).join("\n");
}
async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  if (crypto?.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return sha256Fallback(bytes);
}

// ---------- API ----------
const err = (msg, status = 404) => Object.assign(new Error(msg), { status });

export async function localApi(path, { method = "GET", body } = {}) {
  const ix = await index();
  const st = load();
  const url = new URL(path, "http://x");
  const p = url.pathname;
  let m;

  if (p === "/home") {
    const numbers = ix.numbers.map((x) => numberInfo(st, x));
    let next = null;
    const order = [...ix.numbers];
    const lastIdx = order.findIndex((x) => x.n === st.last_n);
    if (lastIdx > 0) order.unshift(...order.splice(lastIdx, 1));
    for (const x of order) {
      const id = nextOpen(st, x, "main");
      if (id) { next = card(st, id, x.n, ix.cards[id]); break; }
    }
    return {
      numbers, next, last_n: st.last_n,
      totals: { main_total: numbers.reduce((a, x) => a + x.main_total, 0), main_solved: numbers.reduce((a, x) => a + x.main_solved, 0) },
      play: playStats(st),
    };
  }

  if ((m = p.match(/^\/numbers\/(\d+)$/))) {
    const x = ix.numbers.find((y) => y.n === +m[1]);
    if (!x) throw err("нет такого номера");
    const tier = url.searchParams.get("tier") === "extra" ? "extra" : "main";
    const info = numberInfo(st, x);
    let tasks = [];
    if (tier === "main") tasks = x.main.map((id) => card(st, id, x.n, ix.cards[id]));
    else if (info.extra_unlocked) {
      const f = await extraFile(x.n);
      tasks = idsOf(x, "extra").map((id) => card(st, id, x.n, f.cards[id]));
    }
    return { ...info, tier, tasks, next: tasks.length ? nextOpen(st, x, tier) : null };
  }

  if ((m = p.match(/^\/tasks\/(\d+)$/))) {
    const id = +m[1];
    const n = D.owner[id];
    if (!n) throw err("задача не найдена");
    const x = ix.numbers.find((y) => y.n === n);
    const tier = x.main.includes(id) ? "main" : "extra";
    if (tier === "extra" && !numberInfo(st, x).extra_unlocked) throw err("Дополнительные задачи откроются, когда будут решены все официальные этого номера", 403);
    const f = tier === "main" ? await mainFile(n) : await extraFile(n);
    const t = tier === "main" ? f[id] : f.tasks[id];
    const c = tier === "main" ? ix.cards[id] : f.cards[id];
    st.last_n = n; save(st);
    const ids = idsOf(x, tier);
    return {
      id, n, title: x.title, tier, label: c.label, old_format: c.old_format, html: t.html, attribution: t.attribution,
      status: statusOf(st, id, n, c.parts), position: ids.indexOf(id) + 1, count: ids.length,
      parts: t.parts.map((q) => {
        const solved = Boolean(st.solved[`${id}:${q.ege_no}`]);
        return { ege_no: q.ege_no, rows: q.rows, cols: q.cols, keyboard: q.keyboard, solved, counted: solved,
                 answer: solved ? st.answers[`${id}:${q.ege_no}`] || null : null };
      }),
      next: nextOpen(st, x, tier, id),
    };
  }

  if ((m = p.match(/^\/tasks\/(\d+)\/check$/)) && method === "POST") {
    const id = +m[1];
    const n = D.owner[id];
    const x = ix.numbers.find((y) => y.n === n);
    const tier = x.main.includes(id) ? "main" : "extra";
    const f = tier === "main" ? await mainFile(n) : await extraFile(n);
    const t = tier === "main" ? f[id] : f.tasks[id];
    const results = {};
    const stamp = new Date().toISOString();
    for (const q of t.parts) {
      const raw = body?.parts?.[String(q.ege_no)] || "";
      if (!raw.trim()) continue;
      const norm = normalize(raw);
      const ok = (await sha256(`${id}:${q.ege_no}:${norm}`)) === q.hash;
      results[q.ege_no] = ok;
      st.tried[id] = 1;
      if (ok && !st.solved[`${id}:${q.ege_no}`]) {
        st.solved[`${id}:${q.ege_no}`] = stamp;
        st.answers[`${id}:${q.ege_no}`] = norm;
      }
    }
    save(st);
    const c = tier === "main" ? ix.cards[id] : f.cards[id];
    return { results, status: statusOf(st, id, n, c.parts),
             next: nextOpen(st, x, tier, id), number: numberInfo(st, x) };
  }

  if ((m = p.match(/^\/seen\/(\d+)$/))) { st.last_n = +m[1]; save(st); return { ok: true }; }
  throw err("Недоступно на этом сайте");
}

// ---------- SHA-256 на случай, если браузер не даёт crypto.subtle (страница не по https) ----------
function sha256Fallback(bytes) {
  const K = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb,
    0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f,
    0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const len = bytes.length;
  const total = ((len + 9 + 63) >> 6) << 6;
  const msg = new Uint8Array(total);
  msg.set(bytes);
  msg[len] = 0x80;
  const bits = len * 8;
  const dv = new DataView(msg.buffer);
  dv.setUint32(total - 4, bits >>> 0);
  dv.setUint32(total - 8, Math.floor(bits / 2 ** 32));
  const W = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < total; o += 64) {
    for (let i = 0; i < 16; i++) W[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  return [...H].map((x) => x.toString(16).padStart(8, "0")).join("");
}
