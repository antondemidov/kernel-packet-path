# Шлях пакета в ядрі Linux

Інтерактивна покрокова симуляція того, як TCP/UDP-пакет проходить мережевий стек Linux 5.10:

- **Відправка (egress):** `write()` → сокет → TCP/UDP → IP + netfilter → neighbour/ARP → qdisc → TX ring → лінія
- **Прийом (ingress):** лінія → RX ring → NAPI → `netif_receive_skb()` → IP + netfilter → TCP/UDP → сокет → `read()`
- **Пересилання (forward):** пакет проходить хост як роутер: PREROUTING → FORWARD → POSTROUTING

На кожному кроці видно функцію ядра, пояснення, стан `sk_buff` (які заголовки є, куди вказує `data`, які `*_header` виставлені), черги й активний хук netfilter.

Основа — стаття A. Stephan, L. Wüstrich, [«The Path of a Packet Through the Linux Kernel»](https://www.net.in.tum.de/fileadmin/TUM/NET/NET-2024-04-1/NET-2024-04-1_16.pdf) (TUM, 2024). Там, де стаття спрощує чи розходиться з кодом 5.10, на сторінці є блок «Уточнення».

Інтерфейс англійською за замовчуванням, з перемикачем EN/UA. Перемикач Linux 5.10 / 7.3 показує, що змінилося на кожному кроці в сучасних ядрах (звірено з v7.3).

Посилання на конкретний крок: `#egress-tcp-5`, `#ingress-udp-1`, `#forward-tcp-7`; з приміткою 7.x — `#ingress-udp-8-v7`.

## Запуск

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # статичний сайт у dist/
```

## Публікація

**GitHub Pages.** Створи репозиторій, запуш у `main`, у Settings → Pages обери Source: *GitHub Actions*. Workflow `.github/workflows/deploy.yml` збере й опублікує сайт.

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
| `src/main.ts` | Рендер, анімація, керування, роутинг через hash |
| `src/style.css` | Стилі, світла й темна теми |
| `index.html` | Розмітка сторінки |
