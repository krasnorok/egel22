// egel22.ru: официальные задания ЕГЭ по информатике. Статичный сайт без входа и без сервера.
// Задания лежат в /data/*.json, ответ проверяется в браузере (local.js), прогресс хранится в localStorage.

import { localApi, progressCount, resetProgress } from "./local.js?v=ba1c45f0";

const $view = document.getElementById("view");
const $bar = document.getElementById("sitebar");
const $dock = document.getElementById("dock");
const $dockBtn = document.getElementById("dockBtn");
const $viewer = document.getElementById("viewer");
const $toast = document.getElementById("toast");
const DESKTOP = matchMedia("(min-width: 960px)");

// ---------- Тема ----------
// По умолчанию как в системе; кнопка в шапке переключает и запоминает выбор в этом браузере
const darkMQ = matchMedia("(prefers-color-scheme: dark)");
let themePref = null;
try { themePref = localStorage.getItem("theme"); } catch (_) {}
const theme = () => themePref || (darkMQ.matches ? "dark" : "light");
function applyTheme() {
  document.documentElement.dataset.theme = theme();
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme() === "dark" ? "#0f0f10" : "#2b5491");
}
applyTheme();
darkMQ.addEventListener("change", () => { if (!themePref) { applyTheme(); render(); } });
function toggleTheme() {
  themePref = theme() === "dark" ? "light" : "dark";
  try { localStorage.setItem("theme", themePref); } catch (_) {}
  applyTheme();
  setBack(backTarget);
}

// ---------- Утилиты ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const SHORT = {
  1: "Графы и таблицы", 2: "Таблицы истинности", 3: "Базы данных", 4: "Кодирование, условие Фано",
  5: "Анализ алгоритмов", 6: "Исполнители и циклы", 7: "Графика и звук", 8: "Комбина­торика",
  9: "Электронные таблицы", 10: "IP-адреса и маски", 11: "Количество информации", 12: "Исполнители с ветвлениями",
  13: "Количество программ", 14: "Системы счисления", 15: "Истинность выражения", 16: "Рекурсия",
  17: "Делимость, файл", 18: "ДП в таблицах", 19: "Теория игр", 22: "Параллельные процессы",
  23: "Пути в графе", 24: "Символьные строки", 25: "Поиск делителей", 26: "Сортировка", 27: "Поток данных",
};
const nLabel = (n) => (Number(n) === 19 ? "19–21" : String(n));
function plural(n, forms) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}
const pointsWord = (n) => plural(n, ["задание", "задания", "заданий"]);
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
function toast(text) {
  $toast.textContent = text;
  $toast.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => ($toast.hidden = true), 2600);
}
function download(url, name) {
  const a = document.createElement("a");
  a.href = new URL(url, location.href).href; a.download = name; document.body.append(a); a.click(); a.remove();
}
const ICON = {
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/></svg>',
  open: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 6.8-1.2"/></svg>',
  file: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8z"/><path d="M14 3.5V8h4.5M12 11v6M9.5 14.5L12 17l2.5-2.5"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>',
  moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
};
const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const G = {
  flame: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.6 2.3c.4 3-1 4.6-2.5 6.2C8.7 10 7 11.7 7 14.6 7 18 9.3 21 12.5 21S18 18.4 18 15c0-2.4-1.2-4.1-2.4-5.4.1 1.6-.4 2.9-1.6 3.6.4-3.6-.4-7.6-1.4-10.9z"/><path fill="#ffd166" d="M12.7 12.2c.3 1.6-.5 2.4-1.3 3.2-.7.7-1.3 1.4-1.3 2.4 0 1.5 1.1 2.7 2.5 2.7s2.6-1.1 2.6-2.8c0-1.9-1.2-3.3-2.5-5.5z"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.5 2 4 13.5h6.5L9.5 22 20 9.5h-6.6z"/></svg>',
  star: '<svg class="star" viewBox="0 0 24 24" aria-hidden="true"><path fill="#ffc53d" stroke="#fff" stroke-width="1.6" stroke-linejoin="round" d="m12 2.6 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z"/></svg>',
};

// ---------- Кнопка «Проверить»: внизу экрана на телефоне, в карточке ответа на компьютере ----------
const main = {
  set(text, onClick, { disabled = false } = {}) {
    $dock.hidden = false;
    $dockBtn.textContent = text;
    $dockBtn.disabled = disabled;
    $dockBtn.onclick = onClick;
  },
  busy(on) { $dockBtn.disabled = on; },
  hide() { $dock.hidden = true; },
};

// ---------- Шапка ----------
let backTarget = null;
function setBack(target) {
  backTarget = target;
  const back = target ? `<a class="site-back" href="${target}" aria-label="Назад">${ICON.back}</a>` : "";
  $bar.innerHTML = `${back}<a class="site-brand" href="#/"><img src="/static/icons/icon-64.png" alt="" width="34" height="34"><span>ЕГЭ по информатике</span></a>
    <nav class="site-right"><a class="site-link" href="#/about">О сайте</a><button class="site-theme" type="button" id="themeBtn" aria-label="${theme() === "dark" ? "Светлая тема" : "Тёмная тема"}" title="${theme() === "dark" ? "Светлая тема" : "Тёмная тема"}">${theme() === "dark" ? ICON.sun : ICON.moon}</button></nav>`;
  document.getElementById("themeBtn").onclick = toggleTheme;
}
const go = (hash) => { location.hash = hash; };

// ---------- Данные: память экранов и предзагрузка ----------
const cache = new Map();
const inflight = new Map();
function fetchData(path, force = false) {
  if (!force && inflight.has(path)) return inflight.get(path);
  const p = localApi(path).then((d) => { cache.set(path, d); return d; }).finally(() => inflight.delete(path));
  inflight.set(path, p);
  return p;
}
function prefetch(path) {
  if (path && !cache.has(path) && !inflight.has(path)) fetchData(path).catch(() => {});
}
function pathFor(route) {
  if (route.view === "home") return "/home";
  if (route.view === "number") return `/numbers/${route.n}?tier=${route.tier}`;
  if (route.view === "task") return `/tasks/${route.id}`;
  return null;
}
const $loadbar = document.createElement("div");
$loadbar.className = "loadbar";
document.body.append($loadbar);
let loadTimer = 0;
function loading(on) {
  clearTimeout(loadTimer);
  if (on) loadTimer = setTimeout(() => $loadbar.classList.add("on"), 120);
  else $loadbar.classList.remove("on");
}
// Есть в памяти: рисуем сразу и тихо пересчитываем. Нет: старый экран остаётся, пока не пришли данные.
async function load(path, my, draw, { revalidate = true, skeleton = null } = {}) {
  const cached = cache.get(path);
  if (cached) {
    loading(false);
    draw(cached);
    applyScroll();
    if (!revalidate) return;
    try {
      const fresh = await fetchData(path, true);
      if (my === token && JSON.stringify(fresh) !== JSON.stringify(cached)) draw(fresh);
    } catch (_) { /* остаётся то, что было */ }
    return;
  }
  if (skeleton && !$view.children.length) $view.innerHTML = skeleton();
  loading(true);
  try {
    const d = await fetchData(path);
    if (my === token) { draw(d); applyScroll(); }
  } finally {
    loading(false);
  }
}
document.addEventListener("pointerdown", (e) => {
  const a = e.target.closest('a[href^="#/"]');
  if (a) prefetch(pathFor(parseRouteFrom(a.getAttribute("href").slice(1))));
}, { passive: true });

// ---------- Роутер ----------
let token = 0;
const scrollMem = {};
let currentRoute = "";
const parseRoute = () => parseRouteFrom(location.hash.replace(/^#/, "") || "/");
function parseRouteFrom(h) {
  let m;
  if ((m = h.match(/^\/n\/(\d+)(\/extra)?(?:\/p\/(\d+))?$/))) return { view: "number", n: +m[1], tier: m[2] ? "extra" : "main", page: m[3] ? +m[3] : null, key: h };
  if ((m = h.match(/^\/t\/(\d+)$/))) return { view: "task", id: +m[1], key: h };
  if (h === "/about") return { view: "about", key: h };
  return { view: "home", key: "/" };
}
async function render() {
  const route = parseRoute();
  const my = ++token;
  loading(false);
  document.body.classList.toggle("nested", route.view === "number" || route.view === "task");
  document.body.dataset.view = route.view;
  document.querySelectorAll(".win, .confetti").forEach((x) => x.remove());
  if ($dock.parentElement !== document.body) document.body.append($dock);
  if (route.view !== "task") main.hide();
  try {
    if (route.view === "home") await viewHome(my);
    else if (route.view === "number") await viewNumber(route, my);
    else if (route.view === "task") await viewTask(route, my);
    else viewAbout();
  } catch (e) {
    if (my === token) showError(e);
  }
}
window.addEventListener("hashchange", () => {
  scrollMem[currentRoute] = scrollY;
  const next = parseRoute();
  currentRoute = next.key;
  pendingScroll = next.view === "task" ? 0 : scrollMem[next.key] || 0;
  render();
});
let pendingScroll = null;
function applyScroll() {
  if (pendingScroll === null) return;
  const y = pendingScroll;
  pendingScroll = null;
  scrollTo({ top: y, behavior: "instant" });
}
function showError(e) {
  main.hide();
  $view.innerHTML = `
    <div class="head"><h1>Не загрузилось</h1></div>
    <div class="err"><p>${esc(e.message)}</p><button class="btn btn-ghost btn-small" type="button" id="retry">Повторить</button></div>`;
  document.getElementById("retry").addEventListener("click", render);
}

// ---------- Конфетти ----------
function confetti() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const box = document.createElement("div");
  box.className = "confetti";
  const colors = ["#3a8fd8", "#17305a", "#ffc53d", "#1fb371", "#2f9bf0", "#ff7a2f"];
  for (let i = 0; i < 70; i++) {
    const p = document.createElement("i");
    p.style.left = Math.random() * 100 + "%";
    p.style.background = colors[i % colors.length];
    p.style.setProperty("--dx", (Math.random() * 160 - 80) + "px");
    p.style.setProperty("--rot", (Math.random() * 720 - 360) + "deg");
    p.style.animationDuration = 1.4 + Math.random() * 1.2 + "s";
    p.style.animationDelay = Math.random() * 0.25 + "s";
    if (i % 3 === 0) p.style.borderRadius = "50%";
    box.append(p);
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 3200);
}

// ---------- Главная ----------
let lastN = null;  // номер, открытый последним: рамка на главной ставится сразу
function homeSkeleton() {
  const cells = Array.from({ length: 27 }, () => '<div class="cell"><span class="sk" style="width:26px;height:26px"></span><span class="sk" style="width:80%;height:12px;margin-top:10px"></span><div class="bar"></div></div>').join("");
  return `<div class="home"><div class="home-side">
    <div class="hud"><span class="pill"><span class="sk" style="width:60px;height:16px"></span></span></div>
    <div class="hero"><span class="sk" style="width:60%;height:26px;opacity:.3"></span><span class="sk" style="width:85%;height:16px;margin-top:12px;opacity:.3"></span><div class="level-bar" style="margin-top:28px"></div></div>
    <div class="card next" style="margin-top:16px"><span class="sk" style="width:40%;height:14px"></span><span class="sk" style="width:75%;height:22px;margin-top:12px"></span><span class="sk" style="width:100%;height:52px;margin-top:16px;border-radius:16px"></span></div>
    </div><div class="home-main"><section class="section"><div class="section-head"><h2>Карта экзамена</h2></div><div class="kim">${cells}</div></section></div></div>`;
}
async function viewHome(my) {
  setBack(null);
  await load("/home", my, (d) => {
    $view.innerHTML = homeHTML(d);
    if (d.next) { prefetch(`/tasks/${d.next.id}`); prefetch(`/numbers/${d.next.n}?tier=main`); }
  }, { skeleton: homeSkeleton });
}
function heroLine(d) {
  const g = d.play;
  if (!d.totals.main_solved) return `Начнём с первого задания? За каждое верное +${g.xp_per_task} опыта.`;
  if (g.today) return `Сегодня решено ${g.today} ${pointsWord(g.today)}. ${g.today >= 5 ? "Мощно!" : "Так держать!"}`;
  if (g.streak) return `Реши одно задание сегодня, чтобы не потерять серию в ${g.streak} ${plural(g.streak, ["день", "дня", "дней"])}.`;
  return "С возвращением! Одно задание, и серия снова пошла.";
}
const titleOf = (d, n) => d.numbers.find((x) => x.n === n)?.title || "";
function homeHTML(d) {
  const g = d.play;
  const next = d.next;
  const hereN = lastN ?? d.last_n ?? next?.n;
  const cells = [];
  for (const x of d.numbers) {
    const done = x.main_total > 0 && x.main_solved === x.main_total;
    const here = hereN === x.n && !done;
    for (const n of x.n === 19 ? [19, 20, 21] : [x.n]) {
      cells.push(`
        <a class="cell${done ? " done" : ""}${here ? " here" : ""}${here && n !== 20 && n !== 21 ? " badge" : ""}" href="#/n/${x.n}" aria-label="Задание ${n}: ${esc(x.title)}, решено ${x.main_solved} из ${x.main_total}">
          ${done ? G.star : ""}
          <span class="cell-top"><span class="cell-n">${n}</span><span class="cell-frac">${x.main_solved}/${x.main_total}</span></span>
          <span class="cell-title">${esc(SHORT[x.n] || x.title)}</span>
          <span class="bar"><i style="width:${pct(x.main_solved, x.main_total)}%"></i></span>
        </a>`);
    }
  }
  const nextBlock = next
    ? `<a class="card next" href="#/t/${next.id}">
         <div class="next-top"><span class="kicker">${next.status === "tried" ? "Продолжи, ты уже начал" : "Следующее задание"}</span><span class="chip">${esc(next.label)}</span></div>
         <h2>Задание ${nLabel(next.n)}. ${esc(SHORT[next.n] || titleOf(d, next.n))}</h2>
         <p class="preview">${esc(next.preview)}</p>
         <span class="btn btn-primary btn-block">Решать</span>
       </a>`
    : `<div class="card next"><h2>Все официальные задания решены!</h2><p class="preview">В каждом номере открылись дополнительные задачи.</p></div>`;
  return `<div class="home"><div class="home-side">
    <div class="hud"><span class="pill xp" title="Опыт">${G.bolt}${g.xp}<small>опыта</small></span></div>
    <div class="hero">
      <div class="hero-top">
        <div class="hero-text">
          <h1>Привет!</h1>
          <p>${esc(heroLine(d))}</p>
        </div>
        <div class="flame${g.streak ? "" : " off"}" title="Дней подряд">
          <span style="color:#ff9f43">${G.flame}</span><b>${g.streak}</b><span>${plural(g.streak, ["день", "дня", "дней"])}</span>
        </div>
      </div>
      <div class="level">
        <div class="level-top"><span>Уровень ${g.level}</span><span>${g.level_xp} / ${g.level_size}</span></div>
        <div class="level-bar"><i style="width:${pct(g.level_xp, g.level_size)}%"></i></div>
      </div>
    </div>
    <div style="margin-top:16px">${nextBlock}</div>
    </div><div class="home-main">
    <section class="section">
      <div class="section-head"><h2>Карта экзамена</h2><span class="meta">${d.totals.main_solved} из ${d.totals.main_total}</span></div>
      <div class="kim">${cells.join("")}</div>
    </section>
    </div></div>
`;
}

// ---------- Номер КИМ ----------
const PAGE = 40;
async function viewNumber(route, my) {
  const { n, tier } = route;
  setBack(tier === "extra" ? `#/n/${n}` : "#/");
  if (DESKTOP.matches) return viewSheet(route, my);
  await load(`/numbers/${n}?tier=${tier}`, my, (d) => {
    if (tier === "extra") renderExtra(d);
    else renderNumber(d, n);
    if (d.next) prefetch(`/tasks/${d.next}`);
  });
}
function renderNumber(d, n) {
  const left = d.main_total - d.main_closed;
  const cta = d.next
    ? `<a class="btn btn-primary btn-block" href="#/t/${d.next}" style="margin-top:16px">${d.main_solved ? "Продолжить" : "Решать по порядку"}</a>`
    : `<p class="sub" style="margin-top:14px;color:var(--green-dark);font-weight:600">Все официальные задачи номера решены!</p>`;
  $view.innerHTML = `
    <div class="n-head"><span class="n-badge">${nLabel(n)}</span><div><h1>${esc(SHORT[n] || d.title)}</h1>${(SHORT[n] || d.title) !== d.title ? `<p class="sub" style="margin-top:2px">${esc(d.title)}</p>` : ""}</div></div>
    <div class="n-layout">
      <div class="n-side">
        <div class="card">
          <div class="progress-line"><span><b class="num">${d.main_solved}</b> из ${d.main_total} решено</span><span>${pct(d.main_solved, d.main_total) | 0}%</span></div>
          <div class="bar big"><i style="width:${pct(d.main_solved, d.main_total)}%"></i></div>
          ${cta}
        </div>
        ${d.extra_total ? `
        <div class="card extra">
          <span class="ico">${d.extra_unlocked ? ICON.open : ICON.lock}</span>
          <div style="flex:1">
            <h3>Дополнительные задачи · ${d.extra_total}</h3>
            ${d.extra_unlocked
              ? `<p>Авторские задачи и задачи старого формата.</p>
                 <a class="btn btn-ghost btn-small btn-block" href="#/n/${n}/extra">Открыть</a>`
              : `<p>Откроются, когда решишь все официальные задачи номера. Осталось ${left}.</p>`}
          </div>
        </div>` : ""}
      </div>
      <section class="section n-list">
        <div class="section-head"><h2>Задачи по годам</h2><span class="meta">сначала новые</span></div>
        ${groupedHTML(d.tasks)}
      </section>
    </div>`;
}
function renderExtra(d) {
  const head = `<div class="n-head"><span class="n-badge">${nLabel(d.n)}</span><div><h1>Дополнительные</h1><p class="sub" style="margin-top:2px">${esc(SHORT[d.n] || d.title)}</p></div></div>`;
  if (!d.extra_unlocked) {
    $view.innerHTML = `${head}<div class="empty"><b>Пока закрыто</b>Реши все официальные задачи этого номера: осталось ${d.main_total - d.main_closed}.</div>`;
    return;
  }
  $view.innerHTML = `${head}
    <div class="n-layout">
      <div class="n-side">
        <div class="card">
          <div class="progress-line"><span><b class="num">${d.extra_solved}</b> из ${d.extra_total} решено</span></div>
          <div class="bar big"><i style="width:${pct(d.extra_solved, d.extra_total)}%"></i></div>
          ${d.next ? `<a class="btn btn-brand btn-block" href="#/t/${d.next}" style="margin-top:16px">Решать по порядку</a>` : ""}
        </div>
      </div>
      <section class="section n-list"><div class="section-head"><h2>Задачи</h2><span class="meta">сначала новые</span></div>${listHTML(d.tasks)}</section>
    </div>`;
  bindMore(d.tasks);
}
function rowHTML(t, short = false) {
  const mark = t.status === "solved" ? `<span class="mark solved" title="Решено">${CHECK}</span>`
    : t.status === "tried" ? '<span class="mark tried" title="Начато">…</span>'
    : '<span class="mark"></span>';
  return `<a class="row" href="#/t/${t.id}">
      <span class="row-main">
        <span class="row-top"><span class="label">${esc(short ? t.label.replace(/\s*\d{4}$/, "") : t.label)}</span>${t.old_format ? '<span class="chip grey">старый формат</span>' : ""}</span>
        <span class="preview">${esc(t.preview)}</span>
      </span>
      ${mark}
    </a>`;
}
function groupedHTML(tasks) {
  if (!tasks.length) return '<div class="empty">В этом номере пока нет официальных задач.</div>';
  const groups = [];
  for (const t of tasks) {
    const g = groups[groups.length - 1];
    if (g && g.year === t.year) g.items.push(t);
    else groups.push({ year: t.year, items: [t] });
  }
  return groups.map((g) => {
    const solved = g.items.filter((t) => t.status === "solved").length;
    return `<div class="year-head"><h3>${g.year || "Без года"}</h3><span class="chip${solved === g.items.length ? " gold" : ""}">${solved} / ${g.items.length}</span></div>
      <div class="list">${g.items.map((t) => rowHTML(t, true)).join("")}</div>`;
  }).join("");
}
function listHTML(tasks) {
  if (!tasks.length) return '<div class="empty">В этом номере пока нет задач.</div>';
  const more = tasks.length > PAGE ? `<button class="btn btn-ghost btn-small more" type="button" id="more">Показать ещё ${Math.min(PAGE, tasks.length - PAGE)}</button>` : "";
  return `<div class="list" id="list">${tasks.slice(0, PAGE).map((t) => rowHTML(t)).join("")}${more}</div>`;
}
function bindMore(tasks) {
  let shown = PAGE;
  const btn = document.getElementById("more");
  btn?.addEventListener("click", () => {
    btn.insertAdjacentHTML("beforebegin", tasks.slice(shown, shown + PAGE).map((t) => rowHTML(t)).join(""));
    shown += PAGE;
    const rest = tasks.length - shown;
    if (rest <= 0) btn.remove();
    else btn.textContent = `Показать ещё ${Math.min(PAGE, rest)}`;
  });
}

// ---------- Компьютер: страница из 10 задач с ответами ----------
const SHEET = 10;
const sheetHash = (n, tier, page) => `#/n/${n}${tier === "extra" ? "/extra" : ""}${page > 1 ? `/p/${page}` : ""}`;
let sheetFocus = null;   // задача, к которой прокрутить после перехода

async function openOnSheet(id, my) {
  const t = await fetchData(`/tasks/${id}`);
  if (my !== token) return;
  const d = await fetchData(`/numbers/${t.n}?tier=${t.tier}`);
  if (my !== token) return;
  const i = d.tasks.findIndex((x) => x.id === id);
  sheetFocus = id;
  location.replace(sheetHash(t.n, t.tier, Math.floor(Math.max(i, 0) / SHEET) + 1));
}

function pagerHTML(d, page, pages) {
  if (pages < 2) return "";
  const btns = [];
  for (let p = 1; p <= pages; p++) {
    const chunk = d.tasks.slice((p - 1) * SHEET, p * SHEET);
    const done = chunk.every((t) => t.status === "solved");
    const years = [...new Set(chunk.map((t) => t.year).filter(Boolean))];
    const title = years.length ? (years.length > 1 ? `${years[0]}–${years[years.length - 1]}` : String(years[0])) : `задачи ${(p - 1) * SHEET + 1}–${(p - 1) * SHEET + chunk.length}`;
    btns.push(`<a class="pg${p === page ? " on" : ""}${done ? " done" : ""}" href="${sheetHash(d.n, d.tier, p)}" title="${esc(title)}"${p === page ? ' aria-current="page"' : ""}>${p}</a>`);
  }
  const prev = page > 1 ? `<a class="pg wide" href="${sheetHash(d.n, d.tier, page - 1)}">← Назад</a>` : "";
  const next = page < pages ? `<a class="pg wide" href="${sheetHash(d.n, d.tier, page + 1)}">Дальше →</a>` : "";
  return `<nav class="pager" aria-label="Страницы">${prev}${btns.join("")}${next}</nav>`;
}

function sheetProgress(d) {
  const solved = d.tier === "extra" ? d.extra_solved : d.main_solved;
  const total = d.tier === "extra" ? d.extra_total : d.main_total;
  return `<div class="progress-line"><span><b class="num">${solved}</b> из ${total} решено</span><span>${pct(solved, total) | 0}%</span></div>
    <div class="bar big"><i style="width:${pct(solved, total)}%"></i></div>`;
}

async function viewSheet(route, my) {
  const { n, tier } = route;
  const path = `/numbers/${n}?tier=${tier}`;
  const d = cache.get(path) || await (async () => { loading(true); try { return await fetchData(path); } finally { loading(false); } })();
  if (my !== token) return;
  if (tier === "extra" && !d.extra_unlocked) { renderExtra(d); return; }
  const pages = Math.max(1, Math.ceil(d.tasks.length / SHEET));
  let page = route.page;
  if (!page) {
    const i = d.next ? d.tasks.findIndex((t) => t.id === d.next) : -1;
    page = i >= 0 ? Math.floor(i / SHEET) + 1 : 1;
  }
  page = Math.min(Math.max(1, page), pages);
  const ids = d.tasks.slice((page - 1) * SHEET, page * SHEET).map((t) => t.id);
  loading(true);
  let tasks;
  try { tasks = await Promise.all(ids.map((id) => fetchData(`/tasks/${id}`))); } finally { loading(false); }
  if (my !== token) return;
  if (ids.length) localApi(`/seen/${n}`, { method: "POST" }).catch(() => {});
  lastN = n;

  const title = tier === "extra" ? "Дополнительные" : esc(SHORT[n] || d.title);
  const sub = tier === "extra" ? esc(SHORT[n] || d.title) : (SHORT[n] || d.title) !== d.title ? esc(d.title) : "";
  const first = (page - 1) * SHEET;
  const extraCard = tier === "main" && d.extra_total ? `
    <div class="card extra sheet-extra">
      <span class="ico">${d.extra_unlocked ? ICON.open : ICON.lock}</span>
      <div style="flex:1">
        <h3>Дополнительные задачи · ${d.extra_total}</h3>
        ${d.extra_unlocked
          ? `<p>Авторские задачи и задачи старого формата.</p><a class="btn btn-ghost btn-small" href="#/n/${n}/extra">Открыть</a>`
          : `<p>Откроются, когда решишь все официальные задачи номера. Осталось ${d.main_total - d.main_closed}.</p>`}
      </div>
    </div>` : "";
  $view.innerHTML = `
    <div class="sheet-head">
      <div class="n-head"><span class="n-badge">${nLabel(n)}</span><div><h1>${title}</h1>${sub ? `<p class="sub" style="margin-top:2px">${sub}</p>` : ""}</div></div>
      <div class="card sheet-progress" id="sheetProgress">${sheetProgress(d)}</div>
    </div>
    ${pagerHTML(d, page, pages)}
    ${tasks.length ? "" : '<div class="empty">В этом номере пока нет задач.</div>'}
    <div class="sheet-list">
      ${tasks.map((t, k) => `
        <article class="card sheet-task${t.status === "solved" ? " solved" : ""}" id="task-${t.id}">
          <div class="sheet-main">
            <div class="task-meta"><span class="sheet-no">${first + k + 1}</span><span class="chip">${esc(t.label)}</span>${t.old_format ? '<span class="chip grey">старый формат</span>' : ""}<span class="pos">${esc(t.attribution)}</span></div>
            <div class="statement"></div>
            <div class="files" hidden></div>
          </div>
          <aside class="sheet-side">
            <section class="answer">${t.parts.map((p) => partHTML(p, t.parts.length > 1)).join("")}</section>
            <button class="btn btn-primary btn-block sheet-check" type="button">Проверить</button>
          </aside>
        </article>`).join("")}
    </div>
    ${pagerHTML(d, page, pages)}
    ${extraCard}`;

  tasks.forEach((t) => {
    const el = document.getElementById(`task-${t.id}`);
    fillStatement(t.html, el.querySelector(".statement"), el.querySelector(".files"));
    const btn = el.querySelector(".sheet-check");
    bindAnswer(t, el.querySelector(".answer"), {
      update(all, has) { btn.hidden = all; btn.disabled = !has; },
      busy(on) { btn.disabled = on; },
      onSubmit(fn) { btn.onclick = fn; },
      async solved(xp, all) {
        confetti();
        if (all) el.classList.add("solved");
        toast(`Верно! +${xp} опыта`);
        try {
          const fresh = await fetchData(path, true);
          const box = document.getElementById("sheetProgress");
          if (box) box.innerHTML = sheetProgress(fresh);
          document.querySelectorAll(".pager").forEach((nav) => nav.outerHTML = pagerHTML(fresh, page, pages));
        } catch (_) {}
        if (all) {
          const nextEl = [...document.querySelectorAll(".sheet-task:not(.solved)")].find((x) => x.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING);
          nextEl?.querySelector("input:not([disabled])")?.focus({ preventScroll: true });
        }
      },
    });
  });

  if (sheetFocus) {
    const el = document.getElementById(`task-${sheetFocus}`);
    sheetFocus = null;
    if (el) { el.scrollIntoView({ block: "start" }); scrollBy(0, -80); el.querySelector("input:not([disabled])")?.focus({ preventScroll: true }); pendingScroll = null; return; }
  }
  applyScroll();
}

// ---------- Задача ----------
async function viewTask(route, my) {
  if (DESKTOP.matches) return openOnSheet(route.id, my);
  const path = `/tasks/${route.id}`;
  const cached = cache.get(path);
  await load(path, my, (d) => { drawTask(d); if (d.next) prefetch(`/tasks/${d.next}`); }, { revalidate: false });
  (cached ? localApi(`/seen/${cached.n}`, { method: "POST" }) : Promise.resolve())
    .catch(() => {}).then(() => fetchData("/home", true)).catch(() => {});
}
function drawTask(d) {
  lastN = d.n;
  setBack(d.tier === "extra" ? `#/n/${d.n}/extra` : `#/n/${d.n}`);
  const multi = d.parts.length > 1;
  $view.innerHTML = `
    <div class="n-head">
      <span class="n-badge small">${nLabel(d.n)}</span>
      <div style="flex:1;min-width:0">
        <h2>${esc(SHORT[d.n] || d.title)}</h2>
        <div class="task-meta"><span class="chip">${esc(d.label)}</span>${d.old_format ? '<span class="chip grey">старый формат</span>' : ""}${d.tier === "extra" ? '<span class="chip gold">дополнительная</span>' : ""}<span class="pos">${d.position} / ${d.count}</span></div>
      </div>
    </div>
    <div class="task-grid">
      <div class="task-main">
        <article class="card statement" id="statement"></article>
        <div class="card" id="files" hidden></div>
      </div>
      <aside class="task-side">
        <section class="card" id="answer">
          ${d.parts.map((p) => partHTML(p, multi)).join("")}
        </section>
        <p class="source">${esc(d.attribution)}</p>
      </aside>
    </div>`;
  fillStatement(d.html, document.getElementById("statement"), document.getElementById("files"));
  bindAnswer(d, document.getElementById("answer"));
  if (DESKTOP.matches) {
    document.getElementById("answer").append($dock);
    document.querySelector("#answer input:not([disabled])")?.focus({ preventScroll: true });
  }
}
DESKTOP.addEventListener("change", () => { const v = parseRoute().view; if (v === "task" || v === "number") render(); });

function partHTML(p, multi) {
  const cells = p.rows * p.cols;
  const vals = p.solved && p.answer ? p.answer.split("\n").flatMap((r) => { const c = r.split(" "); while (c.length < p.cols) c.push(""); return c; }) : [];
  const inputs = Array.from({ length: cells }, (_, i) =>
    `<input type="text" inputmode="${p.keyboard === "numeric" ? "numeric" : "text"}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="${i === cells - 1 ? "done" : "next"}" aria-label="${cells > 1 ? `Строка ${Math.floor(i / p.cols) + 1}, столбец ${(i % p.cols) + 1}` : "Ответ"}" value="${esc(vals[i] || "")}"${p.solved ? " disabled" : ""}>`).join("");
  const label = multi ? `Задание ${p.ege_no}` : "Твой ответ";
  const hint = cells > 1 ? `${p.rows > 1 ? `${p.rows} ${plural(p.rows, ["строка", "строки", "строк"])}, ` : ""}${p.cols} ${plural(p.cols, ["число", "числа", "чисел"])} в строке` : "";
  return `<div class="part${p.solved ? " ok" : ""}" data-e="${p.ege_no}" data-cols="${p.cols}">
      <div class="part-label"><span>${label}</span><span class="hint">${hint}</span></div>
      <div class="grid-in${cells > 1 ? " multi" : ""}" style="grid-template-columns:repeat(${p.cols},minmax(0,1fr))">${inputs}</div>
      <div class="verdict${p.solved ? " ok" : ""}">${p.solved ? "Верно!" : ""}</div>
    </div>`;
}
function fillStatement(html, box, $files) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  tpl.content.querySelectorAll("script, style, iframe, object, embed").forEach((x) => x.remove());
  tpl.content.querySelectorAll("*").forEach((el) => {
    for (const a of [...el.attributes]) if (/^on/i.test(a.name)) el.removeAttribute(a.name);
  });
  tpl.content.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src") || "";
    if (src.startsWith("media/")) img.setAttribute("src", "/" + src);
    img.loading = "lazy";
    img.removeAttribute("align"); img.removeAttribute("hspace"); img.removeAttribute("vspace");
    img.style.float = ""; img.style.width = ""; img.style.height = "";
    img.alt = img.alt || "Рисунок к условию";
  });
  const files = [];
  tpl.content.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href");
    if (href.startsWith("media/files/")) {
      const url = "/" + href;
      const name = decodeURIComponent(href.split("/").pop());
      a.setAttribute("href", url);
      a.dataset.file = name;
      if (!files.some((f) => f.url === url)) files.push({ url, name, label: a.textContent.trim() });
    } else if (/^https?:/i.test(href)) {
      a.target = "_blank"; a.rel = "noopener";
    }
  });
  // Код на трёх языках: вкладки, Python открыт первым
  tpl.content.querySelectorAll("table.code").forEach((table) => {
    const heads = [...table.querySelectorAll("th")].map((th) => th.textContent.trim());
    const cells = [...table.querySelectorAll("td")];
    if (!heads.length || heads.length !== cells.length) return;
    const first = Math.max(0, heads.findIndex((h) => /python/i.test(h)));
    const wrap = document.createElement("div");
    wrap.className = "code";
    wrap.innerHTML = `<div class="code-tabs" role="tablist">${heads.map((h, i) => `<button type="button" role="tab" aria-selected="${i === first}" data-i="${i}">${esc(h)}</button>`).join("")}</div>` +
      cells.map((td, i) => `<pre data-i="${i}"${i === first ? "" : " hidden"}>${td.innerHTML.replace(/<br\s*\/?>/gi, "\n")}</pre>`).join("");
    table.replaceWith(wrap);
  });
  box.replaceChildren(tpl.content);
  box.addEventListener("click", (e) => {
    const tab = e.target.closest(".code-tabs button");
    if (tab) {
      const code = tab.closest(".code");
      code.querySelectorAll(".code-tabs button").forEach((b) => b.setAttribute("aria-selected", b === tab));
      code.querySelectorAll("pre").forEach((p) => (p.hidden = p.dataset.i !== tab.dataset.i));
      return;
    }
    const a = e.target.closest("a");
    if (a?.dataset.file) { e.preventDefault(); download(a.getAttribute("href"), a.dataset.file); return; }
    const img = e.target.closest("img");
    if (img) { $viewer.querySelector("img").src = img.src; $viewer.hidden = false; }
  });
  if (files.length) {
    $files.hidden = false;
    $files.innerHTML = files.map((f, i) => `
      <div class="file"><span class="ico">${ICON.file}</span><span class="name"><b>${esc(f.name)}</b><span>${esc(f.label && f.label !== f.name ? f.label : "файл к задаче")}</span></span>
      <button class="btn btn-ghost btn-small" type="button" data-i="${i}">Скачать</button></div>`).join("");
    $files.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-i]");
      if (b) { const f = files[+b.dataset.i]; download(f.url, f.name); }
    });
  }
}
$viewer.addEventListener("click", () => { $viewer.hidden = true; });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { $viewer.hidden = true; document.querySelector(".win")?.click(); } });

const WIN_WORDS = ["Отлично!", "Верно!", "Супер!", "Точно в цель!", "Красота!", "Так держать!"];
function showWin({ xp, nextId, backHash, partial }) {
  confetti();
  const box = document.createElement("div");
  box.className = "win";
  box.innerHTML = `
    <div class="win-card" role="dialog" aria-label="Верный ответ">
      <div class="win-badge">${CHECK}</div>
      <h2>${partial ? "Часть решена!" : WIN_WORDS[Math.floor(Math.random() * WIN_WORDS.length)]}</h2>
      ${xp ? `<div class="xp-burst">${G.bolt}+${xp} опыта</div>` : ""}
      <p>${partial ? "Осталось добить остальные вопросы задачи." : nextId ? "Идём дальше?" : "Задачи этого номера закончились."}</p>
      <div class="win-actions">
        <button class="btn btn-green btn-block" type="button" data-act="next">${partial ? "Продолжить" : nextId ? "Следующее задание" : "К списку задач"}</button>
      </div>
    </div>`;
  document.body.append(box);
  main.hide();
  box.querySelector("[data-act=next]").focus({ preventScroll: true });
  let after = () => {};
  box.addEventListener("click", (e) => {
    if (e.target === box) { box.remove(); after(); return; }
    if (e.target.closest("[data-act=next]")) {
      box.remove();
      if (partial) after();
      else go(nextId ? `#/t/${nextId}` : backHash);
    }
  });
  return (fn) => { after = fn; };
}

// sheet: задача внутри страницы из 10 задач, у неё своя кнопка проверки и нет окна победы
function bindAnswer(d, $answer, sheet = null) {
  const parts = [...$answer.querySelectorAll(".part")];
  const inputs = [...$answer.querySelectorAll("input")];
  const backHash = `#/n/${d.n}${d.tier === "extra" ? "/extra" : ""}`;
  const allSolved = () => parts.every((p) => p.classList.contains("ok"));
  const hasInput = () => parts.some((p) => !p.classList.contains("ok") && [...p.querySelectorAll("input")].some((i) => i.value.trim()));
  const valueOf = (p) => {
    const cols = +p.dataset.cols;
    const vals = [...p.querySelectorAll("input")].map((i) => i.value.trim());
    const rows = [];
    for (let i = 0; i < vals.length; i += cols) rows.push(vals.slice(i, i + cols).join(" ").trim());
    while (rows.length && !rows[rows.length - 1]) rows.pop();
    return rows.join("\n");
  };
  let busy = false;
  let nextId = d.next;
  const wrongCount = {};
  const OOPS = ["Не то. Перепроверь вычисления", "Мимо. Попробуй ещё раз", "Почти! Проверь условие внимательно", "Не сдаёмся, ещё попытка"];

  const refreshMain = () => {
    if (sheet) { sheet.update(allSolved(), hasInput()); return; }
    if (allSolved()) main.set(nextId ? "Следующее задание" : "К списку задач", () => go(nextId ? `#/t/${nextId}` : backHash));
    else main.set("Проверить", submit, { disabled: !hasInput() });
  };

  async function submit() {
    if (busy || !hasInput()) return;
    busy = true;
    const ctl = sheet || main;
    ctl.busy(true);
    const body = { parts: {} };
    for (const p of parts) if (!p.classList.contains("ok")) body.parts[p.dataset.e] = valueOf(p);
    try {
      const r = await localApi(`/tasks/${d.id}/check`, { method: "POST", body });
      nextId = r.next;
      let gained = 0, anyBad = false;
      for (const p of parts) {
        const ok = r.results[p.dataset.e];
        if (ok === undefined) continue;
        const v = p.querySelector(".verdict");
        p.classList.remove("bad");
        if (ok) {
          p.classList.add("ok");
          p.querySelectorAll("input").forEach((i) => (i.disabled = true));
          v.className = "verdict ok";
          v.textContent = "Верно!";
          gained += 10;
        } else {
          anyBad = true;
          void p.offsetWidth;
          p.classList.add("bad");
          wrongCount[p.dataset.e] = (wrongCount[p.dataset.e] || 0) + 1;
          v.className = "verdict bad";
          v.textContent = OOPS[(wrongCount[p.dataset.e] - 1) % OOPS.length];
        }
      }
      cache.delete(`/tasks/${d.id}`);
      fetchData("/home", true).catch(() => {});
      fetchData(`/numbers/${d.n}?tier=${d.tier}`, true).catch(() => {});
      if (r.next) prefetch(`/tasks/${r.next}`);
      if (sheet && gained) {
        sheet.solved(gained, allSolved());
      } else if (gained || allSolved()) {
        showWin({ xp: gained, nextId, backHash, partial: !allSolved() })(refreshMain);
        busy = false;
        ctl.busy(false);
        return;
      }
    } catch (e) {
      toast(e.message);
    } finally {
      busy = false;
      ctl.busy(false);
    }
    refreshMain();
  }
  if (sheet) sheet.onSubmit(submit);

  inputs.forEach((inp, i) => {
    inp.addEventListener("input", () => {
      inp.closest(".part").classList.remove("bad");
      refreshMain();
    });
    inp.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const nextInp = inputs.slice(i + 1).find((x) => !x.disabled);
      if (nextInp && !e.ctrlKey && (!sheet || $answer.contains(nextInp))) nextInp.focus();
      else { if (!DESKTOP.matches) inp.blur(); submit(); }
    });
    inp.addEventListener("paste", (e) => {
      const text = e.clipboardData?.getData("text") || "";
      const tokens = text.trim().split(/\s+/);
      const group = [...inp.closest(".grid-in").querySelectorAll("input")];
      if (group.length < 2 || tokens.length < 2) return;
      e.preventDefault();
      const start = group.indexOf(inp);
      tokens.forEach((t, k) => { if (group[start + k]) group[start + k].value = t; });
      refreshMain();
    });
  });
  refreshMain();
}

// ---------- О сайте ----------
function viewAbout() {
  setBack("#/");
  const n = progressCount();
  $view.innerHTML = `<div class="about-wrap"><h1>О сайте</h1>
    <div class="card about">
      <p>Официальные задания ЕГЭ по информатике по номерам, от новых к старым: основной ЕГЭ, досрочные и открытые варианты, демоверсии, апробации.</p>
      <p>Регистрации нет. Ответы проверяются прямо в браузере, решённые задания запоминаются в памяти этого браузера. На сервер ничего не отправляется, сайт не собирает персональные данные и не использует cookie.</p>
      <p>На другом устройстве или в другом браузере прогресс будет свой. Если очистить данные браузера, прогресс пропадёт.</p>
      <p>Все материалы взяты из открытых источников.</p>
      <p>Сайт сделал Красильников А.П.</p>
    </div>
    <section class="section">
      <div class="section-head"><h2>Ваш прогресс</h2><span class="meta">${n} ${pointsWord(n)}</span></div>
      <button class="btn btn-danger btn-block" type="button" id="pReset"${n ? "" : " disabled"}>Сбросить прогресс</button>
    </section></div>`;
  document.getElementById("pReset").addEventListener("click", () => {
    if (!window.confirm("Сбросить все решённые задания в этом браузере?")) return;
    resetProgress();
    cache.clear();
    go("#/");
  });
}

// ---------- Автообновление: вышла новая версия сайта, перезагружаемся один раз ----------
(async () => {
  try {
    const mine = (document.querySelector('script[src*="app.js?v="]')?.getAttribute("src").match(/v=(\w+)/) || [])[1];
    const html = await (await fetch("/?check=" + Date.now(), { cache: "no-store" })).text();
    const fresh = (html.match(/app\.js\?v=(\w+)/) || [])[1];
    if (mine && fresh && mine !== fresh && sessionStorage.getItem("reloadedFor") !== fresh) {
      sessionStorage.setItem("reloadedFor", fresh);
      location.replace(location.pathname + "?v=" + fresh + location.hash);
    }
  } catch (_) { /* без сети остаёмся на текущей версии */ }
})();

currentRoute = parseRoute().key;
setBack(null);
render();
