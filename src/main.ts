import "./style.css";
import { annotate, SOURCE_LABEL, TERMS, termUrl } from "./glossary";
import { tr, UI, type Lang, type Txt, type UIKey } from "./i18n";
import { buildSteps, HOOKS, LAYER_NAMES, LAYER_ORDER, LAYER_SHORT, type Kernel, type Mode, type Proto, type Seg, type Step } from "./steps";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const SEGS: Seg[] = ["ETH", "IP", "L4", "PAY"];
const FIELDS = ["mac", "network", "transport"] as const;
const ELIXIR: Record<Kernel, string> = { "5.10": "v5.10.8", "7.3": "v7.3" };
// User-space calls in step titles; they have no kernel definition worth linking to
const NO_LINK = new Set(["read", "write"]);

const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

let lang: Lang = store.get("lang") === "uk" ? "uk" : "en";
let kernel: Kernel = "5.10";
let mode: Mode = "egress";
let proto: Proto = "tcp";
let steps: Step[] = buildSteps(mode, proto);
let i = 0;

const stack = $("stack");
const pkt = $("pkt");

const l4 = () => (proto === "tcp" ? "TCP" : "UDP");
const t = (x: Txt) => tr(x, lang);
const ui = (k: UIKey) => UI[k][lang];
const v7 = () => kernel === "7.3";
const rank = (s: Step) => LAYER_ORDER.indexOf(s.l);

/* ---------- URL: #egress-tcp, #forward-udp-7, #ingress-tcp-5-v7 … to share a scenario, step and kernel ---------- */
function readHash() {
  const m = location.hash.match(/^#(egress|ingress|forward)-(tcp|udp)(?:-(\d+))?(-v7)?$/);
  if (!m) return false;
  mode = m[1] as Mode;
  proto = m[2] as Proto;
  kernel = m[4] ? "7.3" : "5.10";
  steps = buildSteps(mode, proto);
  i = m[3] ? Math.min(steps.length - 1, Math.max(0, +m[3] - 1)) : 0;
  return true;
}
function writeHash() {
  const h = `#${mode}-${proto}-${i + 1}${v7() ? "-v7" : ""}`;
  if (location.hash !== h) history.replaceState(null, "", h);
}

/* ---------- Static UI text ---------- */
function applyLang() {
  document.documentElement.lang = lang;
  document.title = ui("title");
  document.querySelector('meta[name="description"]')?.setAttribute("content", ui("metaDesc"));
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => (el.textContent = ui(el.dataset.i18n as UIKey)));
  document.querySelectorAll<HTMLElement>("[data-i18n-html]").forEach((el) => (el.innerHTML = ui(el.dataset.i18nHtml as UIKey)));
  document.querySelectorAll<HTMLElement>("[data-i18n-aria]").forEach((el) => el.setAttribute("aria-label", ui(el.dataset.i18nAria as UIKey)));
}

/* ---------- Render ---------- */
const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;");

// Every `name()` in a step's function line links to its definition in the selected kernel
function fnHtml(fn: string) {
  const base = `https://elixir.bootlin.com/linux/${ELIXIR[kernel]}/A/ident/`;
  return esc(fn).replace(/\b([A-Za-z_][A-Za-z0-9_]*)\(\)/g, (m, name: string) =>
    NO_LINK.has(name) ? m : `<a href="${base}${name}" target="_blank" rel="noopener">${m}</a>`,
  );
}

function placePkt() {
  const row = stack.querySelector<HTMLElement>(`[data-l="${steps[i].l}"]`)!;
  pkt.style.top = `${row.offsetTop + row.offsetHeight / 2}px`;
}

function direction(): string {
  const cur = rank(steps[i]);
  const prev = i > 0 ? rank(steps[i - 1]) : cur;
  if (cur > prev) return "↓";
  if (cur < prev) return "↑";
  // No move between layers: show the direction the packet will move next
  for (let k = i + 1; k < steps.length; k++) {
    const r = rank(steps[k]);
    if (r !== cur) return r > cur ? "↓" : "↑";
  }
  return mode === "egress" ? "↓" : "↑";
}

function renderSkb(s: Step) {
  const box = $("skb");
  const state = $("skbstate");
  if (s.user) {
    state.textContent = ui(mode === "egress" ? "skbNone" : "skbFreed");
    box.innerHTML = `<div class="ubuf"><div class="blk">${ui("ubufBlk")}</div><span>${ui("ubufTxt")}</span></div>`;
    return;
  }
  const labels: Record<Seg, string> = { ETH: "Ethernet", IP: "IPv4", L4: l4(), PAY: ui("lgData") };
  const di = s.data ? SEGS.indexOf(s.data) : -1;
  let cells = `<div class="cell room">head</div>`;
  let ptr = `<div></div>`;
  SEGS.forEach((k, idx) => {
    let cls = "";
    if (!s.raw) {
      if (mode === "egress") cls = s.hdr?.includes(k) ? "" : "absent";
      else if (idx < di) cls = "stripped";
    }
    cells += `<div class="cell ${k} ${cls}">${cls === "absent" ? "—" : labels[k]}</div>`;
    ptr += `<div class="${!s.raw && idx === di ? "on" : ""}"></div>`;
  });
  cells += `<div class="cell room">tail</div>`;
  ptr += `<div></div>`;
  const f = s.f ?? [];
  const fields = s.raw
    ? ""
    : `<div class="fields">${FIELDS.map((n) => `<span class="fld ${f.includes(n) ? "set" : ""}">${n}_header</span>`).join("")}</div>`;
  state.textContent = ui(s.raw ? "skbRaw" : mode === "egress" ? "skbPush" : di === 0 ? "skbNewEth" : "skbPull");
  box.innerHTML = `<div class="skb-wrap"><div class="skb">${cells}</div>${s.raw ? "" : `<div class="ptr">${ptr}</div>`}</div>${fields}`;
}

function renderHooks(s: Step) {
  $("hooks").innerHTML = HOOKS.map((h) => {
    const cls = s.hook === h.id ? "now" : h.modes.includes(mode) ? "path" : "off";
    return `<div class="hk ${cls}"><b>${h.id}</b><span>${h.chain}</span></div>`;
  }).join("");
}

function render() {
  const s = steps[i];
  $("where").textContent = `${String(i + 1).padStart(2, "0")} · ${t(LAYER_NAMES[s.l])}`;
  $("fn").innerHTML = fnHtml(fnOf(s));
  $("title").textContent = t(s.t);
  // Each glossary term is marked once per step, across the description and both notes
  const used = new Set<number>();
  $("desc").innerHTML = annotate(t(s.d), used);

  const note = $("note");
  note.hidden = !s.note;
  note.innerHTML = s.note ? annotate(t(s.note), used) : "";

  const chg = $("v7");
  chg.hidden = !v7();
  chg.classList.toggle("none", !s.v7);
  chg.innerHTML = s.v7 && v7() ? annotate(t(s.v7.note), used) : ui("v7none");
  hideTip();

  const br = $("branches");
  br.hidden = !s.br;
  br.innerHTML = s.br
    ? s.br.map(([a, b], k) => `<span class="br ${k === s.brPick ? "pick" : ""}">${k === s.brPick ? "✓ " : ""}${t(a)} <span>· ${t(b)}</span></span>`).join("")
    : "";

  const visited = new Set(steps.map((x) => x.l));
  stack.querySelectorAll<HTMLElement>(".layer").forEach((r) => {
    r.classList.toggle("active", r.dataset.l === s.l);
    r.classList.toggle("skip", !visited.has(r.dataset.l as Step["l"]));
  });
  stack.querySelectorAll<HTMLElement>(".q").forEach((q) => q.classList.toggle("on", q.dataset.q === s.q));

  $("dir").textContent = direction();
  $("dot").textContent = s.user ? "data" : s.raw ? "frame" : ({ ETH: "ETH", IP: "IP", L4: l4(), PAY: "data" } as const)[s.data!];
  $("l4name").textContent = ui("layL4").replace("{l4}", l4());
  $("lgl4").textContent = l4();

  placePkt();
  renderSkb(s);
  renderHooks(s);

  $("counter").textContent = `${i + 1} / ${steps.length}`;
  $<HTMLButtonElement>("prev").disabled = i === 0;
  $<HTMLButtonElement>("next").disabled = i === steps.length - 1;
  renderMap();
  document.querySelectorAll<HTMLElement>("#steps button").forEach((el, k) => {
    el.classList.toggle("cur", k === i);
    el.classList.toggle("done", k < i);
  });
  writeHash();
}

const fnOf = (s: Step) => (v7() && s.v7?.fn) || s.fn;

/* Path map: x = step, y = stack layer. Shows the whole route at once; click a point to jump to it. */
function renderMap() {
  const n = steps.length;
  const LX = 64, SW = 50, RH = 24, TOP = 22;
  const W = LX + n * SW + 6, H = TOP + LAYER_ORDER.length * RH + 4;
  const x = (k: number) => LX + SW * k + SW / 2;
  const y = (s: Step) => TOP + RH * rank(s) + RH / 2;
  const visited = new Set(steps.map((s) => s.l));

  let g = "";
  LAYER_ORDER.forEach((l, r) => {
    const yy = TOP + RH * r + RH / 2;
    const label = l === "transport" ? l4() : t(LAYER_SHORT[l]);
    g += `<line class="row" x1="${LX}" x2="${W}" y1="${yy}" y2="${yy}"/><text class="rl ${visited.has(l) ? "" : "off"}" x="${LX - 8}" y="${yy + 3.5}">${label}</text>`;
  });
  // user/kernel and kernel/hardware boundaries
  for (const r of [1, 5]) g += `<line class="bnd" x1="0" x2="${W}" y1="${TOP + RH * r}" y2="${TOP + RH * r}"/>`;

  const pts = steps.map((s, k) => `${x(k)},${y(s)}`);
  g += `<polyline class="rest" points="${pts.join(" ")}"/><polyline class="done" points="${pts.slice(0, i + 1).join(" ")}"/>`;

  steps.forEach((s, k) => {
    const cx = x(k), cy = y(s);
    const cls = k === i ? "cur" : k < i ? "past" : "";
    const hook = s.hook && HOOKS.find((h) => h.id === s.hook);
    const tip = `${String(k + 1).padStart(2, "0")} · ${esc(fnOf(s))} — ${esc(t(s.t))}`;
    g += `<g class="pt ${cls} ${hook ? "hook" : ""}" data-k="${k}"><title>${tip}</title><rect class="hit" x="${cx - SW / 2}" y="${TOP}" width="${SW}" height="${H - TOP}"/>`;
    if (k === i) g += `<circle class="halo" cx="${cx}" cy="${cy}" r="13"/>`;
    g += hook
      ? `<path class="mk" d="M${cx} ${cy - 7}L${cx + 7} ${cy}L${cx} ${cy + 7}L${cx - 7} ${cy}Z"/><text class="hl" x="${cx}" y="${cy - 11}">${hook.short}</text>`
      : `<circle class="mk" cx="${cx}" cy="${cy}" r="${k === i ? 7 : 5}"/>`;
    if (v7() && s.v7) g += `<circle class="v7dot" cx="${cx + 7}" cy="${cy + 7}" r="3"/>`;
    g += `</g>`;
  });

  const map = $("map");
  map.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="min-width:${n * 34 + LX}px" role="img" aria-label="${ui("mapH")}">${g}</svg>`;
  map.querySelectorAll<SVGGElement>(".pt").forEach((el) => {
    el.onclick = () => {
      i = Number(el.dataset.k);
      render();
    };
  });
}

function renderList() {
  const list = $("steps");
  list.innerHTML = steps
    .map((s, k) => {
      const chg = v7() && s.v7;
      const title = t(s.t) + (chg ? ` · ${ui("v7mark")}` : "");
      return `<li><button data-k="${k}" class="${chg ? "chg" : ""}" title="${title}"><span class="f">${fnOf(s).replace(/</g, "&lt;")}</span></button></li>`;
    })
    .join("");
  list.querySelectorAll<HTMLButtonElement>("button").forEach((el) => {
    el.onclick = () => {
      i = Number(el.dataset.k);
      render();
    };
  });
}

function syncToggles() {
  document.querySelectorAll<HTMLElement>("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
  document.querySelectorAll<HTMLElement>("[data-proto]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.proto === proto)));
  document.querySelectorAll<HTMLElement>("[data-kernel]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.kernel === kernel)));
  document.querySelectorAll<HTMLElement>("[data-lang]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
  const ver = ELIXIR[kernel].slice(1);
  $("eyebrow").textContent = ui("eyebrow").replace("{k}", ver);
  $("sources").innerHTML = ui("sources").replace("{ver}", ver).replace("{url}", `https://elixir.bootlin.com/linux/${ELIXIR[kernel]}/source/net`);
}

function reset(keepIndex = false) {
  steps = buildSteps(mode, proto);
  if (!keepIndex) i = 0;
  syncToggles();
  renderList();
  render();
}

/* ---------- Glossary tooltip: hover or focus on desktop, tap on touch screens ---------- */
const tip = document.createElement("div");
tip.className = "tip";
tip.setAttribute("role", "tooltip");
tip.hidden = true;
document.body.append(tip);
let tipFor: HTMLElement | null = null;
let hideTimer: number | undefined;

function showTip(el: HTMLElement) {
  clearTimeout(hideTimer);
  if (tipFor === el && !tip.hidden) return;
  const k = Number(el.dataset.t);
  const term = TERMS[k];
  tip.innerHTML = `<b>${esc(el.textContent ?? "")}</b> ${esc(term.def[lang])} <a href="${termUrl(k, lang)}" target="_blank" rel="noopener">${SOURCE_LABEL[term.src][lang]} ↗</a>`;
  tip.hidden = false;
  tipFor = el;
  const r = el.getBoundingClientRect();
  const w = tip.offsetWidth;
  const left = Math.max(8, Math.min(r.left + window.scrollX, window.scrollX + document.documentElement.clientWidth - w - 8));
  const below = r.bottom + tip.offsetHeight + 12 < window.innerHeight;
  tip.style.left = `${left}px`;
  tip.style.top = `${below ? r.bottom + window.scrollY + 6 : r.top + window.scrollY - tip.offsetHeight - 6}px`;
}
function hideTip() {
  tip.hidden = true;
  tipFor = null;
}
const hideSoon = () => { hideTimer = window.setTimeout(hideTip, 200); };
const termOf = (e: Event) => (e.target as HTMLElement).closest<HTMLElement>(".term");

document.addEventListener("mouseover", (e) => { const el = termOf(e); if (el) showTip(el); });
document.addEventListener("mouseout", (e) => { if (termOf(e)) hideSoon(); });
document.addEventListener("focusin", (e) => { const el = termOf(e); if (el) showTip(el); });
document.addEventListener("focusout", (e) => { if (termOf(e) && !tip.contains(e.relatedTarget as Node)) hideSoon(); });
document.addEventListener("click", (e) => {
  const el = termOf(e);
  if (el) showTip(el);
  else if (!tip.contains(e.target as Node)) hideTip();
});
tip.addEventListener("mouseenter", () => clearTimeout(hideTimer));
tip.addEventListener("mouseleave", hideSoon);

/* ---------- Controls ---------- */
function go(d: number) {
  i = Math.max(0, Math.min(steps.length - 1, i + d));
  render();
}

document.querySelectorAll<HTMLElement>("[data-mode]").forEach((b) => {
  b.onclick = () => {
    mode = b.dataset.mode as Mode;
    reset();
  };
});
document.querySelectorAll<HTMLElement>("[data-proto]").forEach((b) => {
  b.onclick = () => {
    proto = b.dataset.proto as Proto;
    reset();
  };
});
document.querySelectorAll<HTMLElement>("[data-kernel]").forEach((b) => {
  b.onclick = () => {
    kernel = b.dataset.kernel as Kernel;
    reset(true);
  };
});
document.querySelectorAll<HTMLElement>("[data-lang]").forEach((b) => {
  b.onclick = () => {
    lang = b.dataset.lang as Lang;
    store.set("lang", lang);
    applyLang();
    reset(true);
  };
});
$("prev").onclick = () => go(-1);
$("next").onclick = () => go(1);

document.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (e.key === "Escape") return hideTip();
  if (e.key === "ArrowRight") go(1);
  else if (e.key === "ArrowLeft") go(-1);
});
window.addEventListener("resize", placePkt);
window.addEventListener("hashchange", () => { if (readHash()) reset(true); });
document.fonts?.ready.then(placePkt);

readHash();
applyLang();
reset(true);
