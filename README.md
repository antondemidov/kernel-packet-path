# A Packet's Path Through the Linux Kernel

**Live:** [packetpath.fyi](https://packetpath.fyi) · [a live trace on a real host](https://packetpath.fyi/example.html) · [FAQ](https://packetpath.fyi/faq.html) · [Українською](README_UKR.md)

An interactive, step-by-step simulation of how a TCP/UDP packet moves through the Linux network stack:

- **Send (egress):** `write()` → socket → TCP/UDP → IP + netfilter → neighbour/ARP → qdisc → TX ring → wire
- **Receive (ingress):** wire → RX ring → NAPI → `netif_receive_skb()` → IP + netfilter → TCP/UDP → socket → `read()`
- **Forward:** the packet crosses the host as a router: PREROUTING → FORWARD → POSTROUTING
- **Multicast** (from the routing decision in Receive): a group member gets a copy on every member socket; a multicast router looks the group up in its cache, checks the arrival interface and sends copies out
- **Containers** (from `netif_receive_skb()` in Receive): a Linux bridge forwarding a frame through a veth pair into a container, and a tc BPF program redirecting it straight into the container's namespace (`bpf_redirect_peer`, as Cilium does)

Each step shows the kernel function, an explanation, the `sk_buff` state (which headers exist, where `data` points, which `*_header` fields are set), the active queue and netfilter hook. A path map shows the whole route across the stack layers at once.

Based on A. Stephan, L. Wüstrich, ["The Path of a Packet Through the Linux Kernel"](https://www.net.in.tum.de/fileadmin/TUM/NET/NET-2024-04-1/NET-2024-04-1_16.pdf) (TUM, 2024). Every step is checked against the kernel source ([5.10.8](https://elixir.bootlin.com/linux/v5.10.8/source/net) and [7.3](https://elixir.bootlin.com/linux/v7.3/source/net)):

- grey **Correction** boxes mark where the paper simplifies or disagrees with the code;
- the walkthrough follows **Linux 7.3** by default; switch to **5.10**, the kernel the paper describes, and blue boxes show what differs;
- every function name links to its definition on Elixir for the selected kernel.

The UI is in English, with a Ukrainian toggle.

Link to a specific step: `#egress-tcp-5`, `#ingress-udp-1`, `#forward-tcp-7`; on Linux 5.10: `#ingress-udp-8-v5`.

## Run locally

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # static site in dist/
```

## Deploy

**GitHub Pages.** Pushing to `main` runs `.github/workflows/deploy.yml`, which builds and publishes the site (Settings → Pages → Source: *GitHub Actions*). The custom domain comes from `public/CNAME`.

**Cloudflare Pages / Netlify / Vercel.** Build command `npm run build`, output directory `dist`.

**Docker / Kubernetes.**

```bash
docker build -t kernel-packet-path .
docker run -p 8080:8080 kernel-packet-path
```

## Structure

| File | What's inside |
|---|---|
| `src/steps.ts` | All scenarios and step texts (EN + UK, 7.x notes). Edit here to fix or add a step. |
| `src/i18n.ts` | UI strings in English and Ukrainian |
| `src/main.ts` | Rendering, path map, controls, hash routing |
| `src/style.css` | Styles, light and dark themes |
| `index.html` | Page markup |

## Contributing

Found a step that doesn't match the kernel? Open an issue with a link to the line on Elixir.
