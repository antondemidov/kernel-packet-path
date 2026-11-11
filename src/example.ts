// The live-trace page: static bilingual text (.en / .uk spans), only the language toggle is dynamic.
import "./style.css";

const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

function apply(lang: string) {
  document.documentElement.lang = lang;
  document.querySelectorAll<HTMLElement>("[data-lang]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
}

apply(store.get("lang") === "uk" ? "uk" : "en");
document.querySelectorAll<HTMLElement>("[data-lang]").forEach((b) =>
  b.addEventListener("click", () => {
    store.set("lang", b.dataset.lang!);
    apply(b.dataset.lang!);
  }),
);
