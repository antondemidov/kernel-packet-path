// UI strings in both languages. Step texts live next to their data in steps.ts.

export type Lang = "en" | "uk";
export type Tx = Record<Lang, string>;
/** Localized text; a plain string is the same in every language (function names, constants) */
export type Txt = string | Tx;

export const tr = (x: Txt, lang: Lang): string => (typeof x === "string" ? x : x[lang]);

export const UI = {
  title: { en: "A Packet’s Path Through the Linux Kernel", uk: "Шлях пакета в ядрі Linux" },
  metaDesc: {
    en: "Interactive step-by-step simulation of how a TCP/UDP packet moves through the Linux network stack: send, receive and forward, with sk_buff state and netfilter hooks.",
    uk: "Інтерактивна покрокова симуляція: як TCP/UDP-пакет проходить мережевий стек Linux — відправка, прийом і пересилання, зі станом sk_buff і хуками netfilter.",
  },
  eyebrow: { en: "Linux {k} · TCP/IPv4 and UDP/IPv4", uk: "Linux {k} · TCP/IPv4 і UDP/IPv4" },
  lede: {
    en: "How a packet moves through the Linux network stack, step by step. Based on A. Stephan, L. Wüstrich, <a href=\"https://www.net.in.tum.de/fileadmin/TUM/NET/NET-2024-04-1/NET-2024-04-1_16.pdf\" target=\"_blank\" rel=\"noopener\">“The Path of a Packet Through the Linux Kernel”</a> (TUM, 2024).",
    uk: "Як пакет проходить мережевий стек Linux, крок за кроком. За статтею A. Stephan, L. Wüstrich, <a href=\"https://www.net.in.tum.de/fileadmin/TUM/NET/NET-2024-04-1/NET-2024-04-1_16.pdf\" target=\"_blank\" rel=\"noopener\">«The Path of a Packet Through the Linux Kernel»</a> (TUM, 2024).",
  },
  sources: {
    en: "Checked against the <a href=\"{url}\" target=\"_blank\" rel=\"noopener\">Linux {ver} source</a>. Where the kernel makes a decision, pick another outcome to see where the packet goes.",
    uk: "Звірено з <a href=\"{url}\" target=\"_blank\" rel=\"noopener\">кодом Linux {ver}</a>. Там, де ядро ухвалює рішення, обери інший варіант і подивись, куди піде пакет.",
  },
  direction: { en: "Direction", uk: "Напрям" },
  protocol: { en: "Protocol", uk: "Протокол" },
  kernel: { en: "Kernel version", uk: "Версія ядра" },
  language: { en: "Language", uk: "Мова" },
  egress: { en: "Send", uk: "Відправка" },
  ingress: { en: "Receive", uk: "Прийом" },
  forward: { en: "Forward", uk: "Пересилання" },
  tcpNoMc: { en: "Multicast works over UDP only", uk: "Multicast працює лише через UDP" },
  prev: { en: "← Back", uk: "← Назад" },
  next: { en: "Next →", uk: "Далі →" },
  prevAria: { en: "Previous step", uk: "Попередній крок" },
  nextAria: { en: "Next step", uk: "Наступний крок" },

  layApp: { en: "Application", uk: "Застосунок" },
  layAppSub: { en: "user space · your process", uk: "user space · твій процес" },
  bndSyscall: { en: "system call · user / kernel boundary", uk: "системний виклик · межа user / kernel" },
  laySock: { en: "Socket (AF_INET)", uk: "Сокет (AF_INET)" },
  laySockSub: { en: "struct sock, LSM", uk: "struct sock, LSM" },
  layL4: { en: "Transport · {l4}", uk: "Транспорт · {l4}" },
  layL4Sub: { en: "segments, ports, connection state", uk: "сегменти, порти, стан з’єднання" },
  layIpSub: { en: "routing, FIB, hooks, fragmentation", uk: "маршрутизація, FIB, хуки, фрагментація" },
  layDev: { en: "Network device", uk: "Мережевий пристрій" },
  layDevSub: { en: "neighbour/ARP, qdisc, driver", uk: "neighbour/ARP, qdisc, драйвер" },
  bndDma: { en: "DMA · kernel / hardware boundary", uk: "DMA · межа ядро / залізо" },
  layNicSub: { en: "network card", uk: "мережева карта" },
  layWire: { en: "Wire", uk: "Лінія" },
  layWireSub: { en: "cable / radio", uk: "кабель / радіо" },

  skbH: { en: "What’s in the sk_buff right now", uk: "Що в цей момент у sk_buff" },
  hooksH: { en: "Netfilter hooks", uk: "Хуки netfilter" },
  hooksSub: { en: "iptables / nftables chains", uk: "ланцюжки iptables / nftables" },
  mapH: { en: "Path map", uk: "Карта шляху" },
  mapSub: { en: "steps → · stack layers ↕", uk: "кроки → · рівні стеку ↕" },
  stepsH: { en: "All steps on this path", uk: "Усі кроки цього шляху" },
  lgData: { en: "data", uk: "дані" },
  lgAbsent: { en: "not built yet", uk: "ще не збудовано" },
  lgStripped: { en: "stripped (data moved)", uk: "знято (data зсунуто)" },

  skbNone: { en: "no sk_buff yet", uk: "sk_buff ще нема" },
  skbFreed: { en: "sk_buff already freed", uk: "sk_buff уже звільнено" },
  ubufBlk: { en: "application data", uk: "дані застосунку" },
  ubufTxt: { en: "sits in the process buffer in user space", uk: "лежать у буфері процесу в user space" },
  skbRaw: { en: "raw frame in RX ring · no sk_buff yet", uk: "сирий кадр у RX ring · sk_buff ще нема" },
  skbPush: { en: "headers are pushed in front", uk: "заголовки додаються спереду" },
  skbNewEth: { en: "new Ethernet header pushed in front", uk: "новий Ethernet-заголовок додано спереду" },
  skbPull: { en: "headers stripped by moving data", uk: "заголовки знімаються зсувом data" },

  brHead: { en: "What can happen here", uk: "Що може статися тут" },
  brHint: { en: "pick an option to see where the packet goes", uk: "обери варіант, щоб побачити, куди піде пакет" },
  pathSame: { en: "→ After this, the packet continues along the same steps.", uk: "→ Після цього пакет іде далі тими самими кроками." },
  pathEnd: { en: "✕ The packet’s path ends here. Pick another option above to continue.", uk: "✕ Тут шлях пакета закінчується. Обери інший варіант вище, щоб іти далі." },
  pathOut: { en: "↗ From here the packet continues in code this walkthrough doesn’t cover. Pick another option above to continue.", uk: "↗ Далі пакет іде кодом, який ця симуляція не розбирає. Обери інший варіант вище, щоб іти далі." },
  cmdH: { en: "Try it on a live system", uk: "Подивитися на живій системі" },
  cmdHint: { en: "replace eth0, 1.1.1.1 and <PID> with your own; most commands need root", uk: "підстав свої eth0, 1.1.1.1 і <PID>; більшості команд потрібен root" },
  cmdCopy: { en: "Copy", uk: "Копіювати" },
  cmdCopied: { en: "Copied", uk: "Скопійовано" },
  diffNone: { en: "No notable difference between 5.10 and 7.3 in this step.", uk: "Між 5.10 і 7.3 цей крок суттєво не відрізняється." },
  diffMark: { en: "differs between 5.10 and 7.3", uk: "відрізняється між 5.10 і 7.3" },

} satisfies Record<string, Tx>;

export type UIKey = keyof typeof UI;
