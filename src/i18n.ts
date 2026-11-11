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
    en: "A step-by-step simulation based on A. Stephan, L. Wüstrich, <a href=\"https://www.net.in.tum.de/fileadmin/TUM/NET/NET-2024-04-1/NET-2024-04-1_16.pdf\" target=\"_blank\" rel=\"noopener\">“The Path of a Packet Through the Linux Kernel”</a> (TUM, 2024). Pick a direction and protocol, then step with ← →. Click any point on the path map to jump to it.",
    uk: "Покрокова симуляція за статтею A. Stephan, L. Wüstrich, <a href=\"https://www.net.in.tum.de/fileadmin/TUM/NET/NET-2024-04-1/NET-2024-04-1_16.pdf\" target=\"_blank\" rel=\"noopener\">«The Path of a Packet Through the Linux Kernel»</a> (TUM, 2024). Обери напрям і протокол, гортай кроки стрілками ← →. Клік по точці на карті шляху переносить до кроку.",
  },
  sources: {
    en: "Every step is checked against the kernel source: <a href=\"{url}\" target=\"_blank\" rel=\"noopener\">Linux {ver} on Elixir</a>; function names link to their definitions. Grey “Correction” boxes mark where the paper simplifies or disagrees with the code; blue “Linux 7.x” boxes show what changed in 7.3. The “Forward” scenario isn’t in the paper and is built from the code.",
    uk: "Кожен крок звірено з кодом ядра: <a href=\"{url}\" target=\"_blank\" rel=\"noopener\">Linux {ver} на Elixir</a>; назви функцій ведуть до їхніх визначень. Сірі блоки «Уточнення» — де стаття спрощує або розходиться з кодом; сині «Linux 7.x» — що змінилося в 7.3. Сценарію «Пересилання» в статті нема, він зібраний за кодом.",
  },
  direction: { en: "Direction", uk: "Напрям" },
  protocol: { en: "Protocol", uk: "Протокол" },
  kernel: { en: "Kernel version", uk: "Версія ядра" },
  language: { en: "Language", uk: "Мова" },
  egress: { en: "Send", uk: "Відправка" },
  ingress: { en: "Receive", uk: "Прийом" },
  forward: { en: "Forward", uk: "Пересилання" },
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

  v7none: { en: "No notable changes in Linux 7.x for this step.", uk: "У Linux 7.x цей крок суттєво не змінився." },
  v7mark: { en: "changed in 7.x", uk: "змінено в 7.x" },

} satisfies Record<string, Tx>;

export type UIKey = keyof typeof UI;
