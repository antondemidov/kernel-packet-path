// Integrity checks for the step data, glossary and UI strings. Kernel facts themselves are checked by
// scripts/verify-kernel-refs.mjs against real kernel sources.

import { describe, expect, it } from "vitest";
import { annotate, TERMS, termUrl } from "./glossary";
import { UI, type Lang, type Txt } from "./i18n";
import { buildSteps, CMDS, type Mode, type Proto, type Step } from "./steps";

const MODES: Mode[] = ["egress", "ingress", "forward"];
const PROTOS: Proto[] = ["tcp", "udp"];
const LANGS: Lang[] = ["en", "uk"];
const scenarios = MODES.flatMap((m) => PROTOS.map((p) => ({ m, p, steps: buildSteps(m, p) })));
const label = (m: Mode, p: Proto, i: number, s: Step) => `${m}-${p}-${i + 1} ${s.fn}`;

const texts = (x: Txt | undefined): string[] => (x === undefined ? [] : typeof x === "string" ? [x] : LANGS.map((l) => x[l]));

/** Every HTML fragment a step can render, in both languages */
function stepHtml(s: Step): string[] {
  return [
    ...texts(s.d),
    ...texts(s.note),
    ...texts(s.v7?.note),
    ...(s.br ?? []).flatMap(([a, b, info]) => [...texts(a), ...texts(b), ...texts(info)]),
  ];
}

/** Open/close tags must nest; only void tags may stay open */
function unbalanced(html: string): string | undefined {
  const stack: string[] = [];
  for (const m of html.matchAll(/<\/?([a-z0-9]+)[^>]*>/g)) {
    const tag = m[1];
    if (tag === "br") continue;
    if (m[0].startsWith("</")) {
      if (stack.pop() !== tag) return `unexpected </${tag}>`;
    } else stack.push(tag);
  }
  return stack.length ? `unclosed <${stack.join("><")}>` : undefined;
}

describe("scenarios", () => {
  it("every scenario has steps and a valid layer on each", () => {
    for (const { steps } of scenarios) {
      expect(steps.length).toBeGreaterThan(5);
      for (const s of steps) expect(["app", "socket", "transport", "ip", "link", "nic", "wire"]).toContain(s.l);
    }
  });

  it("all texts exist in both languages and are not empty", () => {
    for (const { m, p, steps } of scenarios)
      steps.forEach((s, i) => {
        for (const x of [s.t, s.d, s.note, s.v7?.note])
          if (x !== undefined && typeof x !== "string")
            for (const l of LANGS) expect(x[l].trim(), `${label(m, p, i, s)} [${l}]`).not.toBe("");
      });
  });

  it("HTML in step texts is well-formed", () => {
    for (const { m, p, steps } of scenarios)
      steps.forEach((s, i) => {
        for (const html of stepHtml(s)) expect(unbalanced(html), `${label(m, p, i, s)}: ${html.slice(0, 80)}`).toBeUndefined();
      });
  });

  it("egress builds headers up, ingress strips them, and data points at an existing segment", () => {
    for (const { m, p, steps } of scenarios)
      steps.forEach((s, i) => {
        if (s.user || s.raw) return;
        expect(s.data, label(m, p, i, s)).toBeDefined();
        if (m === "egress") expect(s.hdr, label(m, p, i, s)).toContain(s.data);
      });
  });
});

describe("branches", () => {
  it("the usual branch index is valid and every other branch has a description", () => {
    for (const { m, p, steps } of scenarios)
      steps.forEach((s, i) => {
        if (!s.br) return;
        expect(s.brPick, label(m, p, i, s)).toBeGreaterThanOrEqual(0);
        expect(s.brPick!, label(m, p, i, s)).toBeLessThan(s.br.length);
        s.br.forEach(([, , info], k) => {
          if (k !== s.brPick) expect(info, `${label(m, p, i, s)} branch ${k}`).toBeDefined();
        });
      });
  });

  it("a branch that switches scenario lands on the same step there", () => {
    for (const { m, p, steps } of scenarios)
      steps.forEach((s, i) => {
        for (const [, , , next] of s.br ?? []) {
          if (!next || next === "end" || next === "out") continue;
          const target = buildSteps(next, p);
          const j = target.findIndex((x) => x.fn === s.fn);
          expect(j, `${label(m, p, i, s)} → ${next}`).toBeGreaterThanOrEqual(0);
          // the target scenario must take that branch as its usual one, so the reader sees a consistent step
          expect(target[j].br?.[target[j].brPick!][3], `${label(m, p, i, s)} → ${next}`).toBe(next);
        }
      });
  });

  it("the usual branch never ends the path", () => {
    for (const { m, p, steps } of scenarios)
      steps.forEach((s, i) => {
        if (!s.br) return;
        expect(["end", "out"], label(m, p, i, s)).not.toContain(s.br[s.brPick!][3]);
      });
  });
});

describe("live-system commands", () => {
  it("every step has at least one command", () => {
    for (const { m, p, steps } of scenarios)
      steps.forEach((s, i) => expect(s.cmd?.length ?? 0, label(m, p, i, s)).toBeGreaterThan(0));
  });

  it("commands only read state", () => {
    const changing = /\b(rm|kill|reboot|shutdown|modprobe|insmod|rmmod)\b|\bsysctl\s+-w\b|\s-[ADIFRNXZ]\b|\b(add|del|delete|flush|set|change|replace|append|insert)\b|\s>\s|\btee\b/;
    for (const [key, list] of Object.entries(CMDS))
      for (const [cmd] of list) expect(cmd, `${key}: ${cmd}`).not.toMatch(changing);
  });

  it("every command has a description in both languages", () => {
    for (const [key, list] of Object.entries(CMDS))
      for (const [cmd, what] of list) for (const l of LANGS) expect(what[l].trim(), `${key}: ${cmd} [${l}]`).not.toBe("");
  });
});

describe("glossary", () => {
  it("every term has both definitions and an https link", () => {
    TERMS.forEach((term, k) => {
      for (const l of LANGS) {
        expect(term.def[l].trim(), `${term.re[0]} [${l}]`).not.toBe("");
        expect(termUrl(k, l), term.re[0]).toMatch(/^https:\/\//);
      }
    });
  });

  it("Ukrainian links point to Ukrainian Wikipedia only when the term has its own uk article", () => {
    TERMS.forEach((term, k) => {
      const uk = termUrl(k, "uk");
      if (uk.includes("uk.wikipedia.org")) expect(typeof term.url, term.re[0]).toBe("object");
    });
  });

  it("annotating step texts keeps the HTML well-formed and marks each term at most once", () => {
    for (const { steps } of scenarios)
      for (const s of steps)
        for (const html of stepHtml(s)) {
          const used = new Set<number>();
          const out = annotate(html, used);
          expect(unbalanced(out), out.slice(0, 120)).toBeUndefined();
          const marked = [...out.matchAll(/data-t="(\d+)"/g)].map((x) => x[1]);
          expect(new Set(marked).size, out.slice(0, 120)).toBe(marked.length);
        }
  });

  it("never marks a term inside a link", () => {
    const out = annotate('<a href="#">MTU</a> MTU', new Set());
    expect(out).toBe('<a href="#">MTU</a> <span class="term" tabindex="0" data-t="' + TERMS.findIndex((t) => t.re.includes("MTU")) + '">MTU</span>');
  });

  it("respects word boundaries (no NAT inside SNAT, no XDP inside AF_XDP)", () => {
    const nat = TERMS.findIndex((t) => t.re.includes("NAT"));
    const xdp = TERMS.findIndex((t) => t.re.includes("XDP"));
    expect(annotate("SNAT", new Set())).toContain(`data-t="${nat}">SNAT<`);
    expect(annotate("AF_XDP", new Set())).not.toContain(`data-t="${xdp}"`);
  });
});

describe("UI strings", () => {
  it("every UI string exists in both languages with the same placeholders", () => {
    for (const [key, tx] of Object.entries(UI)) {
      const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((x) => x[1]).sort().join();
      expect(tx.uk.trim(), key).not.toBe("");
      expect(ph(tx.uk), key).toBe(ph(tx.en));
    }
  });
});
