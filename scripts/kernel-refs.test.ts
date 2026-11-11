// Checks that every kernel function and constant named in the step texts exists in the kernel sources:
// base texts against 5.10, "Linux 7.x" notes against 7.3. Needs kernel checkouts (net/, include/, security/):
//   KERNEL_5_10=/path/to/linux-5.10.8 KERNEL_7_3=/path/to/linux-7.3 npx vitest run scripts/kernel-refs.test.ts
// Without them the test is skipped; CI runs it in .github/workflows/verify-kernel.yml.

import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import type { Txt } from "../src/i18n";
import { buildSteps, type Mode, type Proto, type Step } from "../src/steps";

const K510 = process.env.KERNEL_5_10;
const K73 = process.env.KERNEL_7_3;
const DIRS = ["net", "include", "security"];

// Names in the texts that are not kernel symbols: user-space calls and tools
const NOT_KERNEL = new Set(["write", "read", "send", "sendto", "recv", "recvfrom", "connect", "accept", "sendfile"]);
// Wrong names used by the paper; they may appear only inside "Correction" notes, which quote them to correct them
const PAPER_NAMES = new Set(["tcp_ipv4_recv", "udp_rcvmsg"]);

/** All identifiers that appear in the tree as `name(` (functions, function-like macros) and as words */
function symbols(root: string) {
  const grep = (re: string) =>
    execFileSync("grep", ["-rhoE", re, ...DIRS.map((d) => `${root}/${d}`)], { maxBuffer: 1 << 30 }).toString();
  return {
    calls: new Set(grep("[A-Za-z_][A-Za-z0-9_]*\\(").split("\n").map((s) => s.slice(0, -1))),
    words: new Set(grep("\\b[A-Z][A-Z0-9_]*_[A-Z0-9_]+\\b").split("\n")),
  };
}

const plain = (x: Txt | undefined) => (x === undefined ? "" : typeof x === "string" ? x : x.en);
const codeOf = (html: string) => [...html.matchAll(/<code>([^<]*)<\/code>/g)].map((m) => m[1]);
const funcs = (s: string) => [...s.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\(\)/g)].map((m) => m[1]).filter((n) => !NOT_KERNEL.has(n));
// Constants like NF_INET_FORWARD or TCP_TIME_WAIT: upper case with an underscore, alone in a <code>
const consts = (html: string) => codeOf(html).filter((c) => /^[A-Z][A-Z0-9_]*_[A-Z0-9_]+$/.test(c));

const all: Step[] = (["egress", "ingress", "forward"] as Mode[]).flatMap((m) => (["tcp", "udp"] as Proto[]).flatMap((p) => buildSteps(m, p)));

function refs(pick: (s: Step) => string[]) {
  const f = new Set<string>();
  const c = new Set<string>();
  for (const s of all)
    for (const html of pick(s)) {
      funcs(html).forEach((n) => f.add(n));
      consts(html).forEach((n) => c.add(n));
    }
  return { f: [...f].sort(), c: [...c].sort() };
}

const base = refs((s) => [s.fn, plain(s.d), plain(s.note), ...(s.br ?? []).flatMap(([a, , info]) => [plain(a), plain(info)])]);
const v7 = refs((s) => (s.v7 ? [s.v7.fn ?? "", plain(s.v7.note)] : []));

describe.skipIf(!K510 || !K73)("kernel references", () => {
  const old = K510 ? symbols(K510) : undefined;
  const cur = K73 ? symbols(K73) : undefined;

  it("functions in step texts exist in 5.10", () => {
    expect(base.f.filter((n) => !old!.calls.has(n) && !PAPER_NAMES.has(n))).toEqual([]);
  });
  it("the paper's wrong names appear only in Correction notes", () => {
    for (const s of all) {
      const outside = [s.fn, plain(s.d), ...(s.br ?? []).map(([, , info]) => plain(info))].flatMap(funcs);
      expect(outside.filter((n) => PAPER_NAMES.has(n)), s.fn).toEqual([]);
      if (s.note && funcs(plain(s.note)).some((n) => PAPER_NAMES.has(n))) expect(plain(s.note), s.fn).toMatch(/^<b>Correction\.<\/b>/);
    }
  });
  it("constants in step texts exist in 5.10", () => {
    expect(base.c.filter((n) => !old!.words.has(n))).toEqual([]);
  });
  it("names in Linux 7.x notes exist in 7.3 (or in 5.10 when the note says they were removed)", () => {
    expect(v7.f.filter((n) => !cur!.calls.has(n) && !old!.calls.has(n))).toEqual([]);
    expect(v7.c.filter((n) => !cur!.words.has(n))).toEqual([]);
  });
});
