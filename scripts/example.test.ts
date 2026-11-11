// Checks the live-trace page (example.html): both languages present, and every link into the simulation
// points at a step that exists. Lives in scripts/ because it reads a file with Node.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildSteps, type Mode, type Proto } from "../src/steps";

describe("live example page", () => {
  const html = readFileSync(new URL("../example.html", import.meta.url), "utf8");

  it("has every text in both languages", () => {
    const count = (l: string) => html.split(`<span class="${l}">`).length - 1;
    expect(count("en")).toBeGreaterThan(10);
    expect(count("uk")).toBe(count("en"));
  });

  it("links only to steps that exist", () => {
    for (const [, m, p, n] of html.matchAll(/href="\.\/#(\w+)-(tcp|udp)-(\d+)"/g)) {
      const steps = buildSteps(m as Mode, p as Proto);
      expect(Number(n), `#${m}-${p}-${n}`).toBeLessThanOrEqual(steps.length);
    }
  });
});
