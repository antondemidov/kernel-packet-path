# CLAUDE.md

Context for continuing work on this project in Claude Code.

## What this is

A static site (Vite + TypeScript, no framework): an interactive simulation of a packet's path through the Linux network stack. The default and primary kernel is 7.3; a toggle switches to 5.10 (the kernel the paper describes).

UI is bilingual: English by default, Ukrainian via the EN/UA toggle (choice saved in localStorage). Every user-visible string must exist in both languages.

Four scenarios: egress, ingress, forward (each for TCP and UDP) and multicast (UDP only: joining a group, then receiving a datagram for it). Step data and step texts live in `src/steps.ts`, UI strings in `src/i18n.ts`, logic in `src/main.ts`. Static HTML text is filled via `data-i18n` / `data-i18n-html` / `data-i18n-aria` attributes.

URL hash: `#<mode>-<proto>-<step>[-v5]`, e.g. `#ingress-udp-8-v5` for 5.10 (old `-v7` links still open 7.3).

UI: no autoplay (removed on purpose: steps are too dense to read on a timer). Navigation is ← →, the step list, and the SVG path map (x = step, y = stack layer, diamonds = netfilter hooks, blue dots = changed in 7.x). Every `name()` in a step's `fn` links to its Elixir definition for the selected kernel. Paper and kernel-source links live in the header; the footer only links to github.com/antondemidov.

## Sources and accuracy rules

- Basis: A. Stephan, L. Wüstrich, "The Path of a Packet Through the Linux Kernel", TUM, 2024 (NET-2024-04-1_16).
- Kernel code to verify against: https://elixir.bootlin.com/linux/v5.10.8/source and https://elixir.bootlin.com/linux/v7.3/source
- Step text describes 7.3. If 5.10 differs, the step gets `k510: { fn?, d? }` with the 5.10 version, and `diff` explains the difference (blue "5.10 → 7.3" box, shown in both modes). Text without a `k510` override must be true for both kernels.
- Accuracy is the point of the site: every claim in a step must be checked against the source (both 5.10.8 and 7.3), not written from memory or copied from the paper.
- Where the paper disagrees with the code, the step text follows the code, and the `note` field explains the discrepancy (shown as "Correction" / "Уточнення").
- The forward scenario is not covered by the paper; it is built from `net/ipv4/ip_forward.c` and `ip_output.c`.

## Glossary (`src/glossary.ts`)

Terms in step texts (AF_INET, MTU, conntrack, NAPI…) get a dotted underline and a tooltip: a one-or-two sentence plain-language definition in both languages plus a "read more" link. Audience is wider than kernel developers, so links go to general explanations, not code: Wikipedia first (Ukrainian article only if it exists, from the English article's langlinks), docs.kernel.org when Wikipedia has nothing precise (sk_buff, NAPI, GRO/GSO, AF_XDP). Kernel function names are not glossary terms; they link to Elixir only from the step header.

- Each term is marked once per step (first occurrence across description and notes); matching is case-sensitive at word boundaries, never inside existing links.
- Before adding a link, verify it exists and is about exactly that term (redirects to a broader article don't count). Section anchors must exist too.

## Step model (`Step`)

- `l` — stack layer where the packet currently is (`app | socket | transport | ip | link | nic | wire`)
- `user` — data is in user space, no sk_buff yet; `raw` — raw frame in the RX ring
- `hdr` — (egress) headers built so far; `data` — where `skb->data` points
- `f` — which of `mac/network/transport_header` are set; `q` — active queue; `hook` — netfilter hook
- `br` + `brPick` — decision point and the usual outcome; each branch is `[label, short note, full description, next?]`. Picking a branch shows its description and changes what follows: `next` omitted = same following steps; `"end"` = the packet's path ends here (later steps fade, Next is disabled); `"out"` = continues in code the walkthrough doesn't cover; a `Mode` = switch to that scenario at the same step (matched by `fn`). Branch descriptions follow the same accuracy rule as step text.
- `note` — clarification
- `cmd` — commands to observe the step on a live system, attached in `buildSteps()` from `CMDS` (keyed by `fn`; the raw incoming frame uses `"wire-in"`). Read-only commands only. Counter names and tracepoints must exist in both 5.10 and 7.3 source, and commands should be run on a real Linux box before adding them.
- `t`, `d`, `note`, `br` labels are `Txt`: a plain string (same in both languages) or `{ en, uk }`
- `k510` — `{ fn?, d? }`: the 5.10 function line / description where it differs from 7.3; `diff` — what differs between 5.10 and 7.3

## Commands

- `npm run dev` — local dev server
- `npm run build` — type check + build into `dist/`
- `npm test` — data integrity tests (`src/data.test.ts`): both languages, well-formed HTML, branches and scenario switches, read-only commands, glossary
- `KERNEL_5_10=… KERNEL_7_3=… npx vitest run scripts/kernel-refs.test.ts` — every kernel function/constant named in the texts must exist in the 5.10.8 / 7.3 sources (skipped without the env vars; CI runs it before every deploy in `deploy.yml` with sparse checkouts of net/, include/, security/)

When changing step texts, re-audit the claims against the code, not memory: an independent claim-by-claim audit of all three scenarios found real errors (TIME_WAIT behaviour, STALE neighbour entries, UDP header placement, cgroup BPF on forwarded packets) that the name-existence test can't catch.

## Ideas for later

- IPv6 variant
- bridge/veth scenario (a Kubernetes pod's packet path)
- Markers for where eBPF/XDP/tc can hook in
