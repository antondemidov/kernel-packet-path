# CLAUDE.md

Context for continuing work on this project in Claude Code.

## What this is

A static site (Vite + TypeScript, no framework): an interactive simulation of a packet's path through the Linux network stack. Base kernel is 5.10; a toggle shows what changed in 7.x (checked against v7.3).

UI is bilingual: English by default, Ukrainian via the EN/UA toggle (choice saved in localStorage). Every user-visible string must exist in both languages.

Three scenarios: egress, ingress, forward; each for TCP and UDP. Step data and step texts live in `src/steps.ts`, UI strings in `src/i18n.ts`, logic in `src/main.ts`. Static HTML text is filled via `data-i18n` / `data-i18n-html` / `data-i18n-aria` attributes.

URL hash: `#<mode>-<proto>-<step>[-v7]`, e.g. `#ingress-udp-8-v7`.

UI: no autoplay (removed on purpose: steps are too dense to read on a timer). Navigation is ← →, the step list, and the SVG path map (x = step, y = stack layer, diamonds = netfilter hooks, blue dots = changed in 7.x). Every `name()` in a step's `fn` links to its Elixir definition for the selected kernel. Paper and kernel-source links live in the header; the footer only links to github.com/antondemidov.

## Sources and accuracy rules

- Basis: A. Stephan, L. Wüstrich, "The Path of a Packet Through the Linux Kernel", TUM, 2024 (NET-2024-04-1_16).
- Kernel code to verify against: https://elixir.bootlin.com/linux/v5.10.8/source and https://elixir.bootlin.com/linux/v7.3/source
- Step text describes 5.10. Differences in 7.x go into the step's `v7` field (shown as a blue "Linux 7.x" box only in 7.3 mode); verify each against the 7.3 source, don't write from memory.
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
- `br` + `brPick` — branch point and the chosen option; each branch is `[label, short note, explanation, go?]`. Clicking a branch shows the explanation; `go: { mode, fn }` adds a button that opens the scenario taking that branch (looked up by `fn`, so step numbers can change). Explanations follow the same accuracy rule as step text.
- `note` — clarification
- `t`, `d`, `note`, `br` labels are `Txt`: a plain string (same in both languages) or `{ en, uk }`
- `v7` — `{ fn?, note }`: optional renamed function and what changed in Linux 7.x

## Commands

- `npm run dev` — local dev server
- `npm run build` — type check + build into `dist/`

## Ideas for later

- IPv6 variant
- bridge/veth scenario (a Kubernetes pod's packet path)
- Markers for where eBPF/XDP/tc can hook in
