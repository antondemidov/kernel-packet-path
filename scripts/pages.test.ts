// Checks the static pages (example.html, faq.html): both languages present, and every link into the
// simulation or to a section of another page points at something that exists. Lives in scripts/ because it reads files with Node.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildSteps, type Mode, type Proto } from "../src/steps";

const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

describe.each(["example.html", "faq.html"])("%s", (file) => {
  const html = read(file);

  it("has every text in both languages", () => {
    const count = (l: string) => html.split(`<span class="${l}">`).length - 1;
    expect(count("en")).toBeGreaterThan(10);
    expect(count("uk")).toBe(count("en"));
  });

  it("has no Latin letters inside Ukrainian words", () => {
    expect(html.match(/[а-яієїґ'’][a-z]+[а-яієїґ]|[а-яієїґ][a-z]+[а-яієїґ'’]/gi) ?? []).toEqual([]);
  });

  it("links only to steps that exist", () => {
    for (const [, m, p, n] of html.matchAll(/href="\.\/#(\w+)-(tcp|udp)-(\d+)"/g)) {
      const steps = buildSteps(m as Mode, p as Proto);
      expect(Number(n), `#${m}-${p}-${n}`).toBeLessThanOrEqual(steps.length);
    }
  });

  it("links only to sections that exist", () => {
    for (const [, page, id] of html.matchAll(/href="(\w+\.html)#([\w-]+)"/g))
      expect(read(page), `${page}#${id}`).toContain(`id="${id}"`);
  });
});
