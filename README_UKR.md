# Шлях пакета в ядрі Linux

**Сайт:** [packetpath.fyi](https://packetpath.fyi) · [живий приклад на справжньому хості](https://packetpath.fyi/example.html) · [English](README.md)

Інтерактивна покрокова симуляція того, як TCP/UDP-пакет проходить мережевий стек Linux:

- **Відправка (egress):** `write()` → сокет → TCP/UDP → IP + netfilter → neighbour/ARP → qdisc → TX ring → лінія
- **Прийом (ingress):** лінія → RX ring → NAPI → `netif_receive_skb()` → IP + netfilter → TCP/UDP → сокет → `read()`
- **Пересилання (forward):** пакет проходить хост як роутер: PREROUTING → FORWARD → POSTROUTING
- **Multicast** (з кроку маршрутизації в Прийомі): член групи отримує копію в кожен сокет-член; multicast-роутер шукає групу в кеші, перевіряє вхідний інтерфейс і розсилає копії
- **Контейнери** (з `netif_receive_skb()` у Прийомі): Linux bridge пересилає кадр через veth-пару в контейнер, а BPF-програма tc перенаправляє його одразу в простір імен контейнера (`bpf_redirect_peer`, як у Cilium)

На кожному кроці видно функцію ядра, пояснення, стан `sk_buff` (які заголовки є, куди вказує `data`, які `*_header` виставлені), активну чергу й хук netfilter. Карта шляху показує весь маршрут через рівні стеку одразу.

Основа — стаття A. Stephan, L. Wüstrich, [«The Path of a Packet Through the Linux Kernel»](https://www.net.in.tum.de/fileadmin/TUM/NET/NET-2024-04-1/NET-2024-04-1_16.pdf) (TUM, 2024). Кожен крок звірено з кодом ядра ([5.10.8](https://elixir.bootlin.com/linux/v5.10.8/source/net) і [7.3](https://elixir.bootlin.com/linux/v7.3/source/net)):

- сірі блоки **«Уточнення»** — місця, де стаття спрощує або розходиться з кодом;
- симуляція за замовчуванням показує **Linux 7.3**; можна перемкнутися на **5.10**, яке описує стаття, а сині блоки показують, чим вони відрізняються;
- кожна назва функції веде до її визначення на Elixir для обраної версії.

Інтерфейс англійською за замовчуванням, з перемикачем на українську.

Посилання на конкретний крок: `#egress-tcp-5`, `#ingress-udp-1`, `#forward-tcp-7`; для Linux 5.10 — `#ingress-udp-8-v5`.

## Запуск

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # статичний сайт у dist/
```

## Публікація

**GitHub Pages.** Пуш у `main` запускає `.github/workflows/deploy.yml`, який збирає й публікує сайт (Settings → Pages → Source: *GitHub Actions*). Кастомний домен береться з `public/CNAME`.

**Cloudflare Pages / Netlify / Vercel.** Build command `npm run build`, output directory `dist`.

**Docker / Kubernetes.**

```bash
docker build -t kernel-packet-path .
docker run -p 8080:8080 kernel-packet-path
```

## Структура

| Файл | Що там |
|---|---|
| `src/steps.ts` | Усі сценарії й тексти кроків (EN + UK, примітки 7.x). Щоб виправити чи додати крок, редагуй тут. |
| `src/i18n.ts` | Рядки інтерфейсу англійською й українською |
| `src/main.ts` | Рендер, карта шляху, керування, роутинг через hash |
| `src/style.css` | Стилі, світла й темна теми |
| `index.html` | Розмітка сторінки |

## Як допомогти

Знайшли крок, що не збігається з кодом ядра? Відкрийте issue з посиланням на рядок в Elixir.
