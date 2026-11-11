// Scenario data. Each step is one moment on the packet's path.
// Source: A. Stephan, L. Wüstrich, "The Path of a Packet Through the Linux Kernel", TUM 2024,
// corrected against Linux 5.10 (elixir.bootlin.com/linux/v5.10.8). `v7` notes are checked against v7.3.

import type { Tx, Txt } from "./i18n";

export type Mode = "egress" | "ingress" | "forward";
export type Proto = "tcp" | "udp";
export type Kernel = "5.10" | "7.3";
export type Layer = "app" | "socket" | "transport" | "ip" | "link" | "nic" | "wire";
export type Seg = "ETH" | "IP" | "L4" | "PAY";
export type Field = "mac" | "network" | "transport";
export type Queue = "wq" | "rq" | "qdisc" | "txring" | "rxring";
export type Hook = "PRE_ROUTING" | "LOCAL_IN" | "FORWARD" | "LOCAL_OUT" | "POST_ROUTING";

/**
 * What happens to the rest of the path if the packet takes a branch:
 * omitted — the following steps stay the same; "end" — the packet's path ends here (dropped or consumed);
 * "out" — it continues in code this walkthrough doesn't cover; a Mode — it continues as that scenario.
 */
export type BranchNext = "end" | "out" | Mode;

export interface Step {
  l: Layer;
  fn: string;
  t: Txt;
  d: Txt;
  /** Data is (still / again) in the process buffer, no sk_buff */
  user?: boolean;
  /** Raw frame in the RX ring, sk_buff not allocated yet */
  raw?: boolean;
  /** egress: headers built so far */
  hdr?: Seg[];
  /** Segment skb->data points to */
  data?: Seg;
  f?: Field[];
  q?: Queue;
  hook?: Hook;
  /** Branch: label, short note, full description shown when the reader picks it, what happens next */
  br?: [Txt, Txt, Txt?, BranchNext?][];
  brPick?: number;
  note?: Txt;
  /** Commands to observe this step on a live system: [command, what it shows] */
  cmd?: [string, Tx][];
  /** What differs in Linux 7.x: optional new function name and an explanation */
  v7?: { fn?: string; note: Txt };
}

export const LAYER_NAMES: Record<Layer, Txt> = {
  app: { en: "Application · user space", uk: "Застосунок · user space" },
  socket: { en: "Socket", uk: "Сокет" },
  transport: { en: "Transport layer", uk: "Транспортний рівень" },
  ip: { en: "IP layer", uk: "IP-рівень" },
  link: { en: "Network device / driver", uk: "Мережевий пристрій / драйвер" },
  nic: { en: "Network card", uk: "Мережева карта" },
  wire: { en: "Wire", uk: "Лінія" },
};

/** Short row labels for the path map; the transport row is labelled with the protocol at render time */
export const LAYER_SHORT: Record<Layer, Txt> = {
  app: { en: "App", uk: "Застос." },
  socket: { en: "Socket", uk: "Сокет" },
  transport: "L4",
  ip: "IP",
  link: { en: "Device", uk: "Пристрій" },
  nic: "NIC",
  wire: { en: "Wire", uk: "Лінія" },
};

export const LAYER_ORDER: Layer[] = ["app", "socket", "transport", "ip", "link", "nic", "wire"];

export const HOOKS: { id: Hook; chain: string; short: string; modes: Mode[] }[] = [
  { id: "PRE_ROUTING", chain: "PREROUTING", short: "PRE", modes: ["ingress", "forward"] },
  { id: "LOCAL_IN", chain: "INPUT", short: "IN", modes: ["ingress"] },
  { id: "FORWARD", chain: "FORWARD", short: "FWD", modes: ["forward"] },
  { id: "LOCAL_OUT", chain: "OUTPUT", short: "OUT", modes: ["egress"] },
  { id: "POST_ROUTING", chain: "POSTROUTING", short: "POST", modes: ["egress", "forward"] },
];

const ALL: Seg[] = ["ETH", "IP", "L4", "PAY"];
const L3: Seg[] = ["IP", "L4", "PAY"];
const F_ALL: Field[] = ["transport", "network", "mac"];
const F_NT: Field[] = ["transport", "network"];

const V7_XTABLES: Txt = {
  en: "<b>Linux 7.x.</b> The hooks are the same, but legacy <code>iptables</code> (x_tables) is now a separate optional config, <code>NETFILTER_XTABLES_LEGACY</code>. Modern distros use nftables or <code>iptables-nft</code>, which sit on the same hooks.",
  uk: "<b>Linux 7.x.</b> Хуки ті самі, але legacy <code>iptables</code> (x_tables) тепер окрема необов’язкова опція, <code>NETFILTER_XTABLES_LEGACY</code>. Сучасні дистрибутиви використовують nftables або <code>iptables-nft</code>, що сидять на тих самих хуках.",
};

/* ---------------- EGRESS ---------------- */

const E_APP: Step[] = [
  {
    l: "app", fn: "write(fd, buf, len)", user: true,
    t: { en: "The application hands data to the kernel", uk: "Застосунок віддає дані ядру" },
    d: {
      en: "<p>It all starts with an <code>AF_INET</code> socket. The application calls <code>write()</code> (or <code>send()</code>/<code>sendto()</code>) with a file descriptor. To the kernel a socket is just a file: the UNIX “everything is a file” principle.</p><p>So far the data sits in your process’s buffer. There is no <code>sk_buff</code> yet.</p>",
      uk: "<p>Усе починається із сокета домену <code>AF_INET</code>. Застосунок викликає <code>write()</code> (або <code>send()</code>/<code>sendto()</code>) з файловим дескриптором. Для ядра сокет — просто файл: принцип UNIX «все є файлом».</p><p>Поки що дані лежать у буфері твого процесу. Жодного <code>sk_buff</code> ще немає.</p>",
    },
  },
  {
    l: "socket", fn: "sock_sendmsg()", user: true,
    t: { en: "Socket: who is sending, and is it allowed", uk: "Сокет: хто відправляє і чи можна" },
    d: {
      en: "<p>For a socket, <code>write()</code> goes through <code>sock_write_iter()</code> (and <code>send()</code>/<code>sendto()</code> through <code>__sys_sendto()</code>) into <code>sock_sendmsg()</code>, which works with the <code>struct socket</code> behind the descriptor.</p><p>First the call passes Linux Security Modules (<code>security_socket_sendmsg()</code>, e.g. SELinux), which may deny sending. Then the <code>INDIRECT_CALL_INET</code> macro calls <code>inet_sendmsg()</code> (or <code>inet6_sendmsg()</code>), and that calls the protocol through <code>sk->sk_prot->sendmsg</code>: <code>tcp_sendmsg()</code> or <code>udp_sendmsg()</code>.</p>",
      uk: "<p>Для сокета <code>write()</code> іде через <code>sock_write_iter()</code> (а <code>send()</code>/<code>sendto()</code> — через <code>__sys_sendto()</code>) у <code>sock_sendmsg()</code>, яка працює зі <code>struct socket</code> за дескриптором.</p><p>Спершу виклик проходить Linux Security Modules (<code>security_socket_sendmsg()</code>, наприклад SELinux), які можуть заборонити відправку. Потім макрос <code>INDIRECT_CALL_INET</code> викликає <code>inet_sendmsg()</code> (або <code>inet6_sendmsg()</code>), а та — протокол через <code>sk->sk_prot->sendmsg</code>: <code>tcp_sendmsg()</code> чи <code>udp_sendmsg()</code>.</p>",
    },
    note: {
      en: "<b>Correction.</b> No control message with the process’s PID/UID/GID is attached on the IPv4 path. Passing credentials as control messages (<code>__scm_send()</code>, <code>SCM_CREDENTIALS</code>) is a feature of AF_UNIX and netlink sockets, not of TCP/UDP.",
      uk: "<b>Уточнення.</b> На шляху IPv4 жодного керуючого повідомлення з PID/UID/GID процесу не додається. Передача облікових даних керуючими повідомленнями (<code>__scm_send()</code>, <code>SCM_CREDENTIALS</code>) — це можливість сокетів AF_UNIX і netlink, а не TCP/UDP.",
    },
  },
];

const E_TCP: Step[] = [
  {
    l: "transport", fn: "tcp_sendmsg()", hdr: ["PAY"], data: "PAY", q: "wq",
    t: { en: "TCP slices data into segments", uk: "TCP нарізає дані на сегменти" },
    d: {
      en: "<p>First it waits for the connection to be established (three-way handshake). Then it allocates <code>sk_buff</code>s for segments and puts them on the <b>socket write queue</b>, respecting the MSS.</p><p>Data is appended to the last buffer on the queue (<code>tcp_write_queue_tail()</code>) while it is below the size goal: into the linear area with <code>skb_add_data_nocache()</code> if there is room, otherwise into page fragments with <code>skb_copy_to_page_nocache()</code>. Only when the last buffer is full is a new <code>sk_buff</code> allocated (<code>sk_stream_alloc_skb()</code>).</p>",
      uk: "<p>Спочатку чекає, поки з’єднання встановиться (тристоронній handshake). Потім виділяє <code>sk_buff</code> під сегменти й ставить їх у <b>socket write queue</b>, дотримуючись MSS.</p><p>Дані дописуються в останній буфер черги (<code>tcp_write_queue_tail()</code>), поки він не досяг цільового розміру: у лінійну частину через <code>skb_add_data_nocache()</code>, якщо там є місце, інакше в сторінкові фрагменти через <code>skb_copy_to_page_nocache()</code>. Лише коли останній буфер заповнений, виділяється новий <code>sk_buff</code> (<code>sk_stream_alloc_skb()</code>).</p>",
    },
    v7: {
      note: {
        en: "<b>Linux 7.x.</b> <code>tcp_sendmsg_locked()</code> no longer copies into the skb’s linear area with <code>skb_add_data_nocache()</code>: payload always goes into page fragments (<code>skb_copy_to_page_nocache()</code>), and new skbs come from <code>tcp_stream_alloc_skb()</code>. The old <code>sendpage()</code> interface is gone; <code>sendfile()</code> and splice pass pages through <code>MSG_SPLICE_PAGES</code>.",
        uk: "<b>Linux 7.x.</b> <code>tcp_sendmsg_locked()</code> більше не копіює в лінійну частину skb через <code>skb_add_data_nocache()</code>: дані завжди йдуть у сторінкові фрагменти (<code>skb_copy_to_page_nocache()</code>), а нові skb створює <code>tcp_stream_alloc_skb()</code>. Старого інтерфейсу <code>sendpage()</code> нема; <code>sendfile()</code> і splice передають сторінки через <code>MSG_SPLICE_PAGES</code>.",
      },
    },
  },
  {
    l: "transport", fn: "tcp_write_xmit()", hdr: ["PAY"], data: "PAY", q: "wq",
    t: { en: "Can we send right now?", uk: "Чи можна відправляти прямо зараз" },
    d: {
      en: "<p>For each segment at the head of the write queue the kernel checks the congestion window (<code>tcp_cwnd_test()</code>), the receiver’s window (<code>tcp_snd_wnd_test()</code>), Nagle’s algorithm, pacing and TCP Small Queues. If any of them says no, data stays on the queue.</p><p>A sent segment moves to the retransmit queue and the retransmission timer is armed (<code>tcp_rearm_rto()</code>). If the ACK doesn’t arrive in time, the segment is sent again.</p>",
      uk: "<p>Для кожного сегмента на початку write queue ядро перевіряє вікно перевантаження (<code>tcp_cwnd_test()</code>), вікно отримувача (<code>tcp_snd_wnd_test()</code>), алгоритм Нейгла, pacing і TCP Small Queues. Якщо щось не дозволяє, дані лишаються в черзі.</p><p>Відправлений сегмент переходить у чергу ретрансмісії, і виставляється таймер (<code>tcp_rearm_rto()</code>). Якщо ACK не прийде вчасно, сегмент піде повторно.</p>",
    },
  },
  {
    l: "transport", fn: "tcp_transmit_skb()", hdr: ["L4", "PAY"], data: "L4", f: ["transport"],
    t: { en: "The TCP header is built", uk: "Будується TCP-заголовок" },
    d: {
      en: "<p>The segment is taken from the write queue and a TCP header is pushed in front of the data: ports, sequence/ack, flags, window. <code>transport_header</code> points to its start.</p><p>Then the packet goes to the network layer through the socket’s <code>queue_xmit</code>, i.e. <code>ip_queue_xmit()</code>.</p>",
      uk: "<p>Сегмент береться із write queue, перед даними додається TCP-заголовок: порти, sequence/ack, прапори, вікно. Поле <code>transport_header</code> вказує на його початок.</p><p>Далі пакет іде на мережевий рівень через функцію сокета <code>queue_xmit</code>, тобто <code>ip_queue_xmit()</code>.</p>",
    },
    note: {
      en: "<b>Correction.</b> The paper builds the TCP header in <code>tcp_sendmsg()</code>. In 5.10 the header is built by <code>__tcp_transmit_skb()</code>, and the skb is cloned first: the original is kept on the retransmit queue until it is ACKed. A clone is a second <code>sk_buff</code> that points to the same data, so the payload isn’t copied: one copy goes down to the card, the other waits in case it has to be resent.",
      uk: "<b>Уточнення.</b> Стаття описує побудову TCP-заголовка в <code>tcp_sendmsg()</code>. У коді 5.10 заголовок формує <code>__tcp_transmit_skb()</code>, і перед цим skb клонується: оригінал лишається в черзі ретрансмісії, доки не прийде ACK. Клон — це другий <code>sk_buff</code>, що вказує на ті самі дані, тож самі дані не копіюються: одна копія йде до карти, друга чекає на випадок повторної відправки.",
    },
  },
  {
    l: "ip", fn: "__ip_queue_xmit()", hdr: L3, data: "IP", f: F_NT,
    t: { en: "Routing and the IP header", uk: "Маршрутизація і IP-заголовок" },
    br: [
      ["skb->_skb_refdst", { en: "route already in skb", uk: "маршрут уже в skb" },
        { en: "<p>In this case the route is already attached to the <code>sk_buff</code>: whoever built the packet looked it up beforehand (the kernel code itself names SCTP as an example). <code>__ip_queue_xmit()</code> skips every lookup and goes straight to building the IP header.</p><p>For an ordinary TCP connection this branch is rare: the route is normally taken from the socket instead.</p>", uk: "<p>У цьому випадку маршрут уже прикріплений до <code>sk_buff</code>: той, хто збирав пакет, знайшов його заздалегідь (у коді ядра як приклад названо SCTP). <code>__ip_queue_xmit()</code> пропускає будь-який пошук і одразу будує IP-заголовок.</p><p>Для звичайного TCP-з’єднання ця гілка рідкісна: маршрут зазвичай береться із сокета.</p>" }],
      [{ en: "sk (socket)", uk: "sk (сокет)" }, { en: "cached in the connected socket", uk: "збережений у з’єднаному сокеті" },
        { en: "An established TCP socket caches its route. While it is still valid, the kernel reuses it without a lookup. This is the usual case.", uk: "Встановлений TCP-сокет кешує свій маршрут. Поки він дійсний, ядро бере його без пошуку. Це звичайний випадок." }],
      ["FIB", { en: "forwarding table", uk: "таблиця пересилання" },
        { en: "<p>In this case the socket has no usable route: the connection is new, or the cached route became invalid (for example, the routing table changed). The kernel does a full lookup with <code>ip_route_output_ports()</code>, which goes through the routing rules and tables, the FIB.</p><p>The result is cached in the socket with <code>sk_setup_caps()</code>, so the next segments of this connection take the faster branch through <code>sk</code>.</p>", uk: "<p>У цьому випадку в сокеті нема придатного маршруту: з’єднання нове, або закешований маршрут став недійсним (наприклад, змінилася таблиця маршрутизації). Ядро робить повний пошук через <code>ip_route_output_ports()</code>, який проходить правилами й таблицями маршрутизації, тобто FIB.</p><p>Результат кешується в сокеті через <code>sk_setup_caps()</code>, тож наступні сегменти цього з’єднання підуть швидшою гілкою через <code>sk</code>.</p>" }],
      ["EHOSTUNREACH", { en: "no route → stop", uk: "маршруту нема → стоп" },
        { en: "<p>In this case there is no route to the destination at all, or the matching route is explicitly marked as unreachable. The packet is dropped, the <code>OutNoRoutes</code> counter grows (<code>nstat -az IpOutNoRoutes</code>), and IP returns “No route to host” to TCP.</p><p>The data is still queued in TCP, so it will try again later; if a route never appears, TCP eventually gives up and the application gets an error.</p>", uk: "<p>У цьому випадку маршруту до одержувача нема взагалі, або відповідний маршрут явно позначений як недосяжний. Пакет відкидається, зростає лічильник <code>OutNoRoutes</code> (<code>nstat -az IpOutNoRoutes</code>), а IP повертає TCP помилку «No route to host».</p><p>Дані лишаються в черзі TCP, тож він спробує ще раз пізніше; якщо маршрут так і не з’явиться, TCP зрештою здасться, і застосунок отримає помилку.</p>" }, "end"],
    ],
    brPick: 1,
    d: {
      en: "<p>The kernel looks for a route to the destination in order: first in the <code>sk_buff</code> itself, then in the socket (an established TCP connection almost always has it cached), then in the FIB, which the kernel builds from the routing table.</p><p>No route means a “host unreachable” error and processing stops. Otherwise the IP header is built and <code>network_header</code> points to it.</p>",
      uk: "<p>Ядро шукає маршрут до одержувача по черзі: спершу в самому <code>sk_buff</code>, потім у сокеті (у встановленого TCP-з’єднання він майже завжди вже є), потім у FIB, яку ядро будує з таблиці маршрутизації.</p><p>Маршруту нема — помилка «host unreachable», обробка зупиняється. Є — будується IP-заголовок, і <code>network_header</code> вказує на нього.</p>",
    },
  },
];

const E_UDP: Step[] = [
  {
    l: "transport", fn: "udp_sendmsg()", user: true, q: "wq",
    t: { en: "UDP: no connection, no state machine", uk: "UDP: без з’єднання і без машини станів" },
    d: {
      en: "<p>Destination address and port are determined. Then there are two modes:</p><p><b>corking</b> (<code>MSG_MORE</code> or <code>UDP_CORK</code>): data from several calls accumulates on the socket write queue to form one datagram;<br><b>non-corking</b>: the <code>sk_buff</code> is built right away.</p>",
      uk: "<p>Визначаються адреса і порт призначення. Далі два режими:</p><p><b>corking</b> (<code>MSG_MORE</code> або <code>UDP_CORK</code>): дані з кількох викликів накопичуються в socket write queue, щоб зібрати один датаграм;<br><b>non-corking</b>: <code>sk_buff</code> будується одразу.</p>",
    },
  },
  {
    l: "ip", fn: "ip_route_output_flow()", user: true,
    t: { en: "Route lookup in the FIB", uk: "Пошук маршруту в FIB" },
    br: [
      ["FIB", { en: "route found", uk: "знайдено маршрут" },
        { en: "A route exists: the datagram can be built and sent.", uk: "Маршрут є: датаграм можна збирати й відправляти." }],
      ["ENETUNREACH", { en: "no route → error in sendto()", uk: "нема маршруту → помилка в sendto()" },
        { en: "<p>In this case the routing table has no route to the destination. <code>ip_route_output_flow()</code> returns an error, nothing is queued or sent, and <code>sendto()</code> fails right away with <code>ENETUNREACH</code> (“Network is unreachable”). If the matching route is an explicit <code>unreachable</code> or <code>prohibit</code> route, the error is <code>EHOSTUNREACH</code> or <code>EACCES</code> instead.</p><p>Unlike TCP, nothing is retried: UDP leaves that to the application.</p>", uk: "<p>У цьому випадку в таблиці маршрутизації нема маршруту до одержувача. <code>ip_route_output_flow()</code> повертає помилку, нічого не стає в чергу й не відправляється, а <code>sendto()</code> одразу завершується з <code>ENETUNREACH</code> («Network is unreachable»). Якщо знайдений маршрут явно має тип <code>unreachable</code> чи <code>prohibit</code>, помилка буде <code>EHOSTUNREACH</code> або <code>EACCES</code>.</p><p>На відміну від TCP, повторних спроб нема: UDP лишає це застосунку.</p>" }, "end"],
    ],
    brPick: 0,
    d: {
      en: "<p>Unlike TCP, the route is looked up already at the UDP stage: a datagram has no connection to cache it in (unless the socket was “connected” with <code>connect()</code>).</p>",
      uk: "<p>На відміну від TCP, маршрут шукається вже на етапі UDP: у датаграма нема з’єднання, де він міг би зберігатися (хіба що сокет «connected» через <code>connect()</code>).</p>",
    },
  },
  {
    l: "transport", fn: "ip_make_skb() / ip_append_data()", hdr: ["PAY"], data: "PAY", q: "wq",
    t: { en: "Data is copied into an sk_buff", uk: "Дані копіюються в sk_buff" },
    d: {
      en: "<p>The payload is copied from user space into an <code>sk_buff</code>, with headroom reserved in front for headers. In corking mode <code>ip_append_data()</code> appends new data to the pending packet, so one IP packet can carry data from several calls.</p>",
      uk: "<p>Корисне навантаження копіюється з user space у <code>sk_buff</code>, з резервом місця попереду під заголовки. У режимі corking <code>ip_append_data()</code> дописує нові дані до вже накопиченого пакета, тож один IP-пакет може містити дані кількох викликів.</p>",
    },
  },
  {
    l: "transport", fn: "udp_send_skb()", hdr: L3, data: "IP", f: F_NT,
    t: { en: "UDP and IP headers are ready", uk: "UDP- і IP-заголовки готові" },
    d: {
      en: "<p>An 8-byte UDP header is added: ports, length, checksum. The IP header was already assembled in <code>__ip_make_skb()</code>. Then <code>ip_send_skb()</code> hands the packet to the common IP output path.</p><p>No locking, no state, no retransmissions, so the UDP path is noticeably shorter and faster than TCP.</p>",
      uk: "<p>Додається 8-байтовий UDP-заголовок: порти, довжина, контрольна сума. IP-заголовок уже зібрано в <code>__ip_make_skb()</code>. Далі <code>ip_send_skb()</code> передає пакет у загальний вихідний шлях IP.</p><p>Немає блокувань, станів і ретрансмісій, тому UDP-шлях помітно коротший і швидший за TCP.</p>",
    },
  },
];

// Shared tail of the output path, from IP down to the wire
const OUT_LINK: Step[] = [
  {
    l: "link", fn: "dev_queue_xmit()", hdr: ALL, data: "ETH", f: F_ALL, q: "qdisc",
    t: { en: "tc egress and the qdisc", uk: "tc egress і черга qdisc" },
    d: {
      en: "<p><code>mac_header</code> is set. The packet passes <code>tc egress</code> (classifiers, tc BPF programs) and is enqueued into the <b>qdisc</b>: <code>fq_codel</code>, <code>fq</code>, <code>pfifo_fast</code> and so on. This is where shaping, priorities and AQM happen.</p><p>Devices with <code>noqueue</code> (typically virtual ones such as loopback or veth) have no qdisc: the packet goes straight to the driver via <code>dev_hard_start_xmit()</code>.</p>",
      uk: "<p>Виставляється <code>mac_header</code>. Пакет проходить <code>tc egress</code> (класифікатори, BPF-програми tc) і стає в чергу дисципліни <b>qdisc</b>: <code>fq_codel</code>, <code>fq</code>, <code>pfifo_fast</code> тощо. Саме тут працюють шейпінг, пріоритети й AQM.</p><p>У пристроїв з <code>noqueue</code> (зазвичай віртуальних, як-от loopback чи veth) qdisc нема: пакет одразу йде в драйвер через <code>dev_hard_start_xmit()</code>.</p>",
    },
    v7: {
      note: {
        en: "<b>Linux 7.x.</b> Before the qdisc there are two hook points: the netfilter <b>egress</b> hook (<code>nf_hook_egress()</code>, an nftables <code>egress</code> chain), then tc egress. tc BPF programs can now attach through <b>tcx</b> (<code>tcx_run()</code>): multi-program BPF links instead of only clsact filters.",
        uk: "<b>Linux 7.x.</b> Перед qdisc дві точки: netfilter-хук <b>egress</b> (<code>nf_hook_egress()</code>, ланцюжок nftables <code>egress</code>), потім tc egress. BPF-програми tc тепер можна чіпляти через <b>tcx</b> (<code>tcx_run()</code>): кілька програм через BPF links замість лише фільтрів clsact.",
      },
    },
  },
  {
    l: "link", fn: "__qdisc_run() → ndo_start_xmit", hdr: ALL, data: "ETH", f: F_ALL, q: "txring",
    t: { en: "The driver puts the packet into the TX ring", uk: "Драйвер кладе пакет у TX ring" },
    d: {
      en: "<p>While the NIC has room, <code>__qdisc_run()</code> dequeues packets. <code>validate_xmit_skb()</code> does post-processing: checksums, VLAN tags, software segmentation if the card can’t offload it.</p><p>Then the driver places the packet into the card’s <b>TX ring</b> via <code>ndo_start_xmit</code>. If the ring is full, the kernel stops the qdisc and packets wait in it.</p>",
      uk: "<p>Поки в NIC є місце, <code>__qdisc_run()</code> вибирає пакети з qdisc. <code>validate_xmit_skb()</code> робить пост-обробку: контрольні суми, VLAN-теги, програмну сегментацію, якщо карта не вміє offload.</p><p>Далі драйвер через <code>ndo_start_xmit</code> кладе пакет у <b>TX ring</b> карти. Якщо ring заповнений, ядро зупиняє qdisc, і пакети чекають у ній.</p>",
    },
    note: {
      en: "<b>Bypassing the qdisc:</b> <code>dev_direct_xmit()</code> writes a packet straight into the TX ring with no queue. It is used by packet sockets with <code>PACKET_QDISC_BYPASS</code> and by AF_XDP in copy mode; zero-copy AF_XDP talks to the driver directly.",
      uk: "<b>Обхід qdisc:</b> <code>dev_direct_xmit()</code> пише пакет одразу в TX ring без черги. Ним користуються packet-сокети з <code>PACKET_QDISC_BYPASS</code> і AF_XDP у режимі копіювання; zero-copy AF_XDP працює з драйвером напряму.",
    },
  },
  {
    l: "nic", fn: "DMA + IRQ", hdr: ALL, data: "ETH", f: F_ALL, q: "txring",
    t: { en: "The card fetches the frame from memory itself", uk: "Карта сама забирає кадр з пам’яті" },
    d: {
      en: "<p>The packet buffer is mapped for DMA. The NIC reads the frame from RAM on its own, without the CPU, and sends it onto the wire.</p><p>When transmission is done the card notifies the kernel with an interrupt, and the <code>sk_buff</code> is freed. For TCP that is the clone: the original waits on the retransmit queue for the ACK.</p>",
      uk: "<p>Буфер пакета відображається в пам’ять для DMA. NIC сам читає кадр з RAM без участі CPU і відправляє його в лінію.</p><p>Після передачі карта повідомляє ядро перериванням, і <code>sk_buff</code> звільняється. Для TCP це клон: оригінал чекає ACK у черзі ретрансмісії.</p>",
    },
  },
];

const neigh = (extra: Tx = { en: "", uk: "" }): Step => ({
  l: "link", fn: "ip_finish_output2() → neigh_output()", hdr: ALL, data: "ETH", f: F_NT,
  t: { en: "Who is the next hop: neighbour cache and ARP", uk: "Хто наступний хоп: кеш сусідів і ARP" },
  br: [
    ["neigh_hh_output()", { en: "MAC known, cached header", uk: "MAC відома, заголовок у кеші" },
        { en: "The neighbour entry is valid and has a ready-made Ethernet header cached; it is copied in front of the packet. The fast, common case.", uk: "Запис сусіда дійсний і має закешований готовий Ethernet-заголовок; його копіюють перед пакетом. Швидкий і звичайний випадок." }],
    ["neigh_resolve_output()", { en: "ARP request, packet waits", uk: "ARP-запит, пакет чекає" },
        { en: "<p>In this case the MAC address of the next hop isn’t known yet, or the cached entry has expired. <code>neigh_resolve_output()</code> puts the packet in the neighbour’s small waiting queue, and the kernel broadcasts an ARP request: “who has this IP?”. By default it asks 3 times, about a second apart.</p><p>When the reply arrives, the entry is filled in and the waiting packets are sent. If nobody answers, the entry becomes <code>FAILED</code>, the waiting packets are dropped and an ICMP “host unreachable” is generated, so a local application sees “No route to host”. In <code>ip neigh show</code> this looks like <code>INCOMPLETE</code>, then <code>FAILED</code>.</p>", uk: "<p>У цьому випадку MAC-адреса наступного хопа ще невідома, або запис у кеші застарів. <code>neigh_resolve_output()</code> кладе пакет у невелику чергу очікування сусіда, а ядро розсилає ARP-запит: «хто має цей IP?». За замовчуванням питає 3 рази з інтервалом близько секунди.</p><p>Коли приходить відповідь, запис заповнюється, і пакети з черги відправляються. Якщо ніхто не відповів, запис стає <code>FAILED</code>, пакети з черги відкидаються, і генерується ICMP «host unreachable», тож локальний застосунок бачить «No route to host». В <code>ip neigh show</code> це виглядає як <code>INCOMPLETE</code>, а потім <code>FAILED</code>.</p>" }],
  ],
  brPick: 0,
  d: {
    en: "<p><code>ip_finish_output2()</code> updates the multicast/broadcast counters and makes sure the <code>sk_buff</code> has headroom for the link-layer header. Then <code>ip_neigh_for_gw()</code> finds the neighbour entry for the next hop (the gateway, or the destination itself on a local network).</p><p>If the entry is valid (<code>NUD_CONNECTED</code>), <code>neigh_hh_output()</code> just copies a cached, ready-made Ethernet header in front of the packet. If the MAC isn’t known yet, <code>neigh_resolve_output()</code> sends an ARP request and the packet waits on the neighbour’s queue until the reply arrives." + extra.en + "</p>",
    uk: "<p><code>ip_finish_output2()</code> оновлює лічильники multicast/broadcast і перевіряє, що в <code>sk_buff</code> є headroom під заголовок канального рівня. Потім <code>ip_neigh_for_gw()</code> знаходить запис сусіда для наступного хопа (шлюзу, або самого одержувача в локальній мережі).</p><p>Якщо запис дійсний (<code>NUD_CONNECTED</code>), <code>neigh_hh_output()</code> просто копіює перед пакетом закешований готовий Ethernet-заголовок. Якщо MAC ще невідома, <code>neigh_resolve_output()</code> надсилає ARP-запит, і пакет чекає в черзі сусіда, поки прийде відповідь." + extra.uk + "</p>",
  },
});

const finishOutput: Step = {
  l: "ip", fn: "ip_finish_output()", hdr: L3, data: "IP", f: F_NT,
  t: { en: "cgroup BPF, MTU and fragmentation", uk: "cgroup BPF, MTU і фрагментація" },
  d: {
    en: "<p>First, cgroup BPF egress programs run and may drop the packet. Then the size is compared with the path MTU. GSO packets (one big “super-packet”) go to <code>ip_finish_output_gso()</code> and are cut into segments later, ideally by the card. A regular packet larger than the MTU goes to <code>ip_fragment()</code>: it is fragmented, or, if DF is set, dropped with ICMP “fragmentation needed” to the sender.</p>",
    uk: "<p>Спершу виконуються BPF-програми cgroup egress, які можуть відкинути пакет. Потім розмір порівнюється з MTU шляху. GSO-пакети (один великий «суперпакет») ідуть у <code>ip_finish_output_gso()</code> і ріжуться на сегменти пізніше, в ідеалі картою. Звичайний пакет, більший за MTU, іде в <code>ip_fragment()</code>: його фрагментують, а якщо стоїть DF — відкидають з ICMP «fragmentation needed» відправнику.</p>",
  },
};

// What the card does after the driver: the physical layer (shown at the end of Send and Forward)
const PHY_TX: Tx = {
  en: "<p>From here on it is hardware. The card’s MAC adds what the wire needs but the kernel never sees: a 7-byte preamble of alternating 1s and 0s plus a start-of-frame byte, so the receiver can lock onto the bit clock, and the FCS checksum at the end; frames shorter than the 64-byte minimum are padded. It hands the bits to the PHY, the transceiver chip that drives the medium, over an MII-family bus (RGMII, SGMII…).</p><p>The PHY turns bits into a physical signal with a line code that depends on the medium. 100BASE-TX sends three voltage levels (MLT-3) over one pair in each direction; 1000BASE-T sends five levels (PAM-5) over all four pairs in both directions at once; 10GBASE-T uses 16 levels (PAM-16). Fiber switches a laser on and off (64b/66b coding at 10G), and links with 50G per lane and faster use four light levels (PAM4). Wi-Fi spreads the data over many radio subcarriers (OFDM).</p><p>Linux only sees the outcome: <code>ethtool eth0</code> shows the negotiated speed, duplex and link state, and with no signal <code>ip link</code> reports <code>NO-CARRIER</code>.</p>",
  uk: "<p>Далі працює залізо. MAC карти додає те, що потрібно в лінії, але чого ядро не бачить: 7-байтову преамбулу з чергуванням 1 і 0 та байт початку кадру, щоб одержувач синхронізувався з тактом бітів, і контрольну суму FCS у кінці; кадри, коротші за мінімальні 64 байти, доповнюються. Потім біти йдуть до PHY — мікросхеми-трансивера, що працює із середовищем, — через шину сімейства MII (RGMII, SGMII…).</p><p>PHY перетворює біти на фізичний сигнал за допомогою лінійного коду, який залежить від середовища. 100BASE-TX передає три рівні напруги (MLT-3) по одній парі в кожен бік; 1000BASE-T — п’ять рівнів (PAM-5) по всіх чотирьох парах в обидва боки одночасно; 10GBASE-T — 16 рівнів (PAM-16). Оптика вмикає й вимикає лазер (кодування 64b/66b на 10G), а лінки від 50G на смугу використовують чотири рівні світла (PAM4). Wi-Fi розподіляє дані по багатьох радіопіднесучих (OFDM).</p><p>Linux бачить лише результат: <code>ethtool eth0</code> показує узгоджену швидкість, дуплекс і стан лінку, а без сигналу <code>ip link</code> пише <code>NO-CARRIER</code>.</p>",
};

const E_TAIL: Step[] = [
  {
    l: "ip", fn: "ip_local_out() → dst_output()", hdr: L3, data: "IP", f: F_NT, hook: "LOCAL_OUT",
    t: { en: "The LOCAL_OUT hook", uk: "Хук LOCAL_OUT" },
    d: {
      en: "<p>For TCP, <code>ip_options_build()</code> sets IP options before this. Then the packet passes the netfilter hook <code>NF_INET_LOCAL_OUT</code>: rules of the <b>OUTPUT</b> chain run here (filter, nat, mangle, conntrack).</p><p>After the hook, <code>dst_output()</code> calls the route’s output handler through a function pointer. For plain unicast that is <code>ip_output()</code>.</p>",
      uk: "<p>Для TCP перед цим <code>ip_options_build()</code> виставляє IP-опції. Потім пакет проходить хук netfilter <code>NF_INET_LOCAL_OUT</code>: тут спрацьовують правила ланцюжка <b>OUTPUT</b> (filter, nat, mangle, conntrack).</p><p>Після хука <code>dst_output()</code> через вказівник на функцію викликає вихідний обробник маршруту. Для звичайного unicast це <code>ip_output()</code>.</p>",
    },
    v7: { note: V7_XTABLES },
  },
  {
    l: "ip", fn: "ip_output()", hdr: L3, data: "IP", f: F_NT, hook: "POST_ROUTING",
    t: { en: "The POST_ROUTING hook", uk: "Хук POST_ROUTING" },
    d: {
      en: "<p>The route is decided, hence the name POST_ROUTING. <code>sk_buff</code> metadata is updated (output device, protocol), and the packet passes the <code>NF_INET_POST_ROUTING</code> hook: the <b>POSTROUTING</b> chain, where SNAT/masquerade happens.</p>",
      uk: "<p>Маршрут визначено, тому етап називається POST_ROUTING. Оновлюються метадані <code>sk_buff</code> (вихідний пристрій, протокол), і пакет проходить хук <code>NF_INET_POST_ROUTING</code>: ланцюжок <b>POSTROUTING</b>, де зокрема працює SNAT/masquerade.</p>",
    },
    note: {
      en: "<b>Correction.</b> The paper also mentions LOCAL_OUT after <code>ip_output()</code>. In the code the order is unambiguous: LOCAL_OUT in <code>ip_local_out()</code> → <code>ip_output()</code> → POST_ROUTING → <code>ip_finish_output()</code>.",
      uk: "<b>Уточнення.</b> У статті LOCAL_OUT згадано і після <code>ip_output()</code>. У коді порядок однозначний: LOCAL_OUT у <code>ip_local_out()</code> → <code>ip_output()</code> → POST_ROUTING → <code>ip_finish_output()</code>.",
    },
  },
  finishOutput,
  neigh({ en: " Now the frame is complete.", uk: " Тепер кадр повний." }),
  ...OUT_LINK,
  {
    l: "wire", fn: "Ethernet frame", hdr: ALL, data: "ETH", f: F_ALL,
    t: { en: "The packet is on the wire", uk: "Пакет у дроті" },
    d: {
      en: "<p>Done. From <code>write()</code> to the wire the packet gained three headers, each pushed in front of the data by simply moving the <code>data</code> pointer back into the headroom. There was exactly one copy: from user space into the <code>sk_buff</code>.</p>" + PHY_TX.en + "<p>Switch to “Receive” to walk the same path in reverse.</p>",
      uk: "<p>Готово. Від <code>write()</code> до лінії пакет обріс трьома заголовками, кожен з яких ядро додавало перед даними, просто зсуваючи вказівник <code>data</code> назад у headroom. Копіювання було одне: з user space у <code>sk_buff</code>.</p>" + PHY_TX.uk + "<p>Перемкнись на «Прийом», щоб пройти той самий шлях у зворотному напрямку.</p>",
    },
  },
];

/* ---------------- INGRESS ---------------- */

// Shared start for receive and forward: from the wire up to ip_rcv()
const IN_LOWER: Step[] = [
  {
    l: "wire", fn: "Ethernet frame", raw: true,
    t: { en: "A frame arrives from the wire", uk: "Кадр приходить з лінії" },
    d: {
      en: "<p>On the receiving side the PHY does the reverse: it recovers the bit clock from the signal, decodes the line code back into bits, and the MAC finds the start-of-frame byte after the preamble. Only then is there a frame at all.</p><p>The same set arrives: Ethernet + IPv4 + TCP/UDP + data. Now the kernel does the opposite: it parses headers, decides at each layer who gets the packet next, and strips the header.</p>",
      uk: "<p>На боці прийому PHY робить зворотне: відновлює такт бітів із сигналу, декодує лінійний код назад у біти, а MAC знаходить байт початку кадру після преамбули. Лише тоді взагалі з’являється кадр.</p><p>На вхід приходить той самий набір: Ethernet + IPv4 + TCP/UDP + дані. Тепер ядро робить протилежне: розбирає заголовки, на кожному рівні вирішує, кому віддати пакет далі, і знімає заголовок.</p>",
    },
  },
  {
    l: "nic", fn: "FCS, MAC filter, DMA → RX ring, IRQ", raw: true, q: "rxring",
    t: { en: "The card puts the frame into RAM", uk: "Карта кладе кадр у RAM" },
    d: {
      en: "<p>The NIC checks the Ethernet checksum (FCS) and the MAC filter, dropping frames for other hosts. Then it DMAs the frame into memory, into an <b>RX ring</b> buffer, and raises an interrupt to tell the OS where the data is.</p>",
      uk: "<p>NIC перевіряє Ethernet-контрольну суму (FCS) і MAC-фільтр, відкидаючи чужі кадри. Потім через DMA кладе кадр у пам’ять, у буфер <b>RX ring</b>, і перериванням повідомляє ОС, де лежать дані.</p>",
    },
  },
  {
    l: "link", fn: "IRQ → NAPI poll → eth_type_trans()", data: "IP", f: ["mac"],
    t: { en: "An sk_buff is born", uk: "Народжується sk_buff" },
    d: {
      en: "<p>The kernel allocates an <code>sk_buff</code> and fills in metadata: interface, protocol (from the EtherType field: IP), packet type (for us, broadcast, multicast, someone else’s).</p><p><code>mac_header</code> is set to the start of the frame, then the Ethernet header is “stripped”: <code>data</code> just moves forward to the IP header. Nobody copies or erases bytes.</p>",
      uk: "<p>Ядро виділяє <code>sk_buff</code> і заповнює метадані: інтерфейс, протокол (з поля EtherType: IP), тип пакета (для нас, broadcast, multicast, чужий).</p><p><code>mac_header</code> ставиться на початок кадру, після чого Ethernet-заголовок «знімається»: <code>data</code> просто зсувається на IP-заголовок. Байти ніхто не копіює й не стирає.</p>",
    },
    note: {
      en: "<b>Correction.</b> In 5.10 the IRQ handler only schedules NAPI. Packets are pulled in batches by the NET_RX softirq (<code>napi_poll</code> → <code>napi_gro_receive</code>), which is why <code>ksoftirqd</code> shows up under load, with counters in <code>/proc/net/softnet_stat</code>. An XDP program, if attached, runs before the <code>sk_buff</code> is even allocated.",
      uk: "<b>Уточнення.</b> У 5.10 обробник IRQ лише планує NAPI. Пакети пачками забирає softirq NET_RX (<code>napi_poll</code> → <code>napi_gro_receive</code>), тому під навантаженням видно <code>ksoftirqd</code>, а лічильники — у <code>/proc/net/softnet_stat</code>. XDP-програма, якщо вона є, виконується ще до виділення <code>sk_buff</code>.",
    },
    v7: {
      note: {
        en: "<b>Linux 7.x.</b> GRO lives in its own file, <code>net/core/gro.c</code>; <code>napi_gro_receive()</code> is now an inline wrapper around <code>gro_receive_skb()</code>. NAPI can also run in <b>threaded</b> mode: polling happens in <code>napi/&lt;dev&gt;-&lt;id&gt;</code> kernel threads instead of softirq, toggled via <code>/sys/class/net/&lt;dev&gt;/threaded</code>.",
        uk: "<b>Linux 7.x.</b> GRO винесено в окремий файл <code>net/core/gro.c</code>; <code>napi_gro_receive()</code> тепер inline-обгортка над <code>gro_receive_skb()</code>. NAPI також може працювати в режимі <b>threaded</b>: опитування йде в потоках ядра <code>napi/&lt;dev&gt;-&lt;id&gt;</code> замість softirq, вмикається через <code>/sys/class/net/&lt;dev&gt;/threaded</code>.",
      },
    },
  },
  {
    l: "link", fn: "netif_receive_skb()", data: "IP", f: ["mac", "network"],
    t: { en: "Who gets the packet", uk: "Кому віддати пакет" },
    br: [
      ["ptype_all", { en: "tcpdump / AF_PACKET get a copy", uk: "копія для tcpdump / AF_PACKET" },
        { en: "<p>In this case the interesting part is the sniffer: a running tcpdump or Wireshark has an <code>AF_PACKET</code> socket on the <code>ptype_all</code> list. Its capture filter runs in the kernel, and if the packet matches, the sniffer gets a copy of the bytes in its ring buffer.</p><p>This branch never ends the packet’s path: after the sniffers have looked, the packet goes on to tc, netfilter ingress and the protocol handler. That is why tcpdump shows incoming packets that a firewall drops later.</p>", uk: "<p>У цьому випадку цікавий саме снифер: запущений tcpdump чи Wireshark має <code>AF_PACKET</code>-сокет у списку <code>ptype_all</code>. Його фільтр захоплення виконується в ядрі, і якщо пакет підходить, снифер отримує копію байтів у свій кільцевий буфер.</p><p>Ця гілка ніколи не завершує шлях пакета: після сниферів він іде далі до tc, netfilter ingress і обробника протоколу. Саме тому tcpdump показує вхідні пакети, які фаєрвол потім відкидає.</p>" }],
      ["tc / nf ingress", { en: "may drop or redirect", uk: "можуть відкинути чи перенаправити" },
        { en: "<p>In this case a program attached to the interface decides the packet’s fate before IP sees it. tc ingress filters and BPF programs can let it through, drop it, or redirect it to another interface, for example straight into a container’s veth; Kubernetes CNIs such as Cilium work this way. After tc, an nftables <code>ingress</code> chain (in the <code>netdev</code> family) can filter it too.</p><p>A dropped packet ends here. A redirected one continues on the other interface instead of going up this one’s stack.</p>", uk: "<p>У цьому випадку програма, прикріплена до інтерфейсу, вирішує долю пакета ще до IP. Фільтри tc ingress і BPF-програми можуть пропустити його, відкинути або перенаправити на інший інтерфейс, наприклад одразу у veth контейнера; так працюють CNI для Kubernetes, як-от Cilium. Після tc пакет може відфільтрувати ще й ланцюжок nftables <code>ingress</code> (у сімействі <code>netdev</code>).</p><p>Відкинутий пакет на цьому закінчується. Перенаправлений продовжує шлях на іншому інтерфейсі, а не піднімається по стеку цього.</p>" }, "out"],
      ["VLAN", { en: "to the VLAN interface", uk: "на VLAN-інтерфейс" },
        { en: "<p>In this case the frame carries an 802.1Q VLAN tag. If there is a VLAN interface for that VLAN ID (e.g. <code>eth0.100</code>), the tag is removed, the packet is handed to that interface and processed again from the start, as if it had arrived there.</p><p>If no VLAN interface exists for that ID, the packet is marked as not for this host (<code>PACKET_OTHERHOST</code>) and is dropped later.</p>", uk: "<p>У цьому випадку кадр має VLAN-мітку 802.1Q. Якщо для цього VLAN ID є VLAN-інтерфейс (наприклад, <code>eth0.100</code>), мітка знімається, пакет передається цьому інтерфейсу й обробляється знову з початку, ніби прийшов туди.</p><p>Якщо VLAN-інтерфейсу для цього ID нема, пакет позначається як не для цього хоста (<code>PACKET_OTHERHOST</code>) і пізніше відкидається.</p>" }],
      ["rx_handler()", { en: "bridge / bond takes the packet", uk: "bridge / bond забирає пакет" },
        { en: "<p>In this case the interface isn’t used on its own: it is a port of a bridge or a member of a bond (macvlan, Open vSwitch and team use the same hook). Its <code>rx_handler()</code> takes the packet.</p><p>A bridge looks at the destination MAC. It may forward the frame to another port at layer 2, without IP ever seeing it (this is how containers on a Docker bridge talk to each other), or pass it up as traffic of the bridge device itself (<code>br0</code>, <code>docker0</code>). A bond relabels the packet as received on the bond device and runs the receive step again.</p>", uk: "<p>У цьому випадку інтерфейс не працює сам по собі: він порт bridge або учасник bond (той самий хук використовують macvlan, Open vSwitch і team). Пакет забирає його <code>rx_handler()</code>.</p><p>Bridge дивиться на MAC одержувача. Він може переслати кадр на інший порт на рівні 2, і IP-рівень його навіть не побачить (так спілкуються контейнери на Docker bridge), або передати нагору як трафік самого bridge-пристрою (<code>br0</code>, <code>docker0</code>). Bond позначає пакет як отриманий на bond-пристрої й запускає крок прийому ще раз.</p>" }, "out"],
      ["ip_rcv()", { en: "plain IPv4", uk: "звичайний IPv4" },
        { en: "An ordinary IPv4 frame: it goes to the IPv4 handler.", uk: "Звичайний IPv4-кадр: він іде до обробника IPv4." }],
    ],
    brPick: 4,
    d: {
      en: "<p>Here the kernel decides who gets the packet. <code>network_header</code> is set right away.</p><p>Sniffers come first. A running tcpdump or Wireshark has an <code>AF_PACKET</code> socket open, and such sockets sit on the <code>ptype_all</code> list. Each of them is shown the packet: the capture filter runs in the kernel first (e.g. <code>tcpdump port 80</code>, compiled to BPF), and if it matches, tcpdump gets a copy of the bytes in its shared-memory ring buffer. The packet itself goes on regardless: a sniffer only watches, it doesn’t take the packet away.</p><p>Then tc ingress (classifiers, tc BPF) and the netfilter <code>ingress</code> hook run; either may drop or redirect the packet. Frames with a VLAN tag go to the VLAN interface. If the interface is part of a bridge or bond, its <code>rx_handler()</code> takes the packet over, and from then on it is traffic of the bridge or bond, not of this interface.</p><p>Otherwise the handler for the EtherType (<code>ptype_base</code>) is called: for IPv4 that is <code>ip_rcv()</code>.</p>",
      uk: "<p>Тут ядро вирішує, хто отримає пакет. Одразу виставляється <code>network_header</code>.</p><p>Спершу снифери. Запущений tcpdump чи Wireshark тримає відкритий <code>AF_PACKET</code>-сокет, а такі сокети стоять у списку <code>ptype_all</code>. Кожному з них показують пакет: спершу в ядрі виконується фільтр захоплення (наприклад, <code>tcpdump port 80</code>, скомпільований у BPF), і якщо пакет підходить, tcpdump отримує копію байтів у свій кільцевий буфер у спільній пам’яті. Сам пакет іде далі в будь-якому разі: снифер лише дивиться, а не забирає пакет.</p><p>Далі tc ingress (класифікатори, BPF tc) і netfilter-хук <code>ingress</code>; кожен може відкинути чи перенаправити пакет. Кадри з VLAN-тегом ідуть на VLAN-інтерфейс. Якщо інтерфейс входить у bridge чи bond, його <code>rx_handler()</code> забирає пакет собі, і далі це вже трафік bridge чи bond, а не цього інтерфейсу.</p><p>Інакше викликається обробник для EtherType (<code>ptype_base</code>): для IPv4 це <code>ip_rcv()</code>.</p>",
    },
    note: {
      en: "<b>Correction.</b> The paper treats TAP as a virtual interface for VMs. In the code it is the <code>ptype_all</code> list: anything that opened an <code>AF_PACKET</code> socket. That is where tcpdump and Wireshark see the packet, before netfilter.",
      uk: "<b>Уточнення.</b> Стаття трактує TAP як віртуальний інтерфейс для ВМ. У коді це список <code>ptype_all</code>: усе, що відкрило <code>AF_PACKET</code>-сокет, тобто tcpdump і Wireshark бачать пакет саме тут, до netfilter.",
    },
    v7: {
      note: {
        en: "<b>Linux 7.x.</b> The order in <code>__netif_receive_skb_core()</code> is the same. New: tc ingress BPF programs can attach through <b>tcx</b> links (<code>tcx_run()</code>), several programs per device.",
        uk: "<b>Linux 7.x.</b> Порядок у <code>__netif_receive_skb_core()</code> той самий. Нове: BPF-програми tc ingress можна чіпляти через <b>tcx</b> links (<code>tcx_run()</code>), кілька програм на пристрій.",
      },
    },
  },
  {
    l: "ip", fn: "ip_rcv()", data: "IP", f: F_ALL, hook: "PRE_ROUTING",
    t: { en: "Sanity checks and the PRE_ROUTING hook", uk: "Перевірки і хук PRE_ROUTING" },
    d: {
      en: "<p>Packets for another MAC (<code>PACKET_OTHERHOST</code>) are dropped. Version, length and the IP header checksum are checked. <code>transport_header</code> is set.</p><p>Then the <code>NF_INET_PRE_ROUTING</code> hook: the <b>PREROUTING</b> chain, conntrack, DNAT. The hook receives a pointer to <code>ip_rcv_finish()</code> and calls it if the packet is accepted.</p>",
      uk: "<p>Пакети для чужого MAC (<code>PACKET_OTHERHOST</code>) відкидаються. Перевіряються версія, довжина і контрольна сума IP-заголовка. Виставляється <code>transport_header</code>.</p><p>Далі хук <code>NF_INET_PRE_ROUTING</code>: ланцюжок <b>PREROUTING</b>, conntrack, DNAT. Хук отримує вказівник на <code>ip_rcv_finish()</code> і викликає його, якщо пакет пропущено.</p>",
    },
    v7: {
      note: {
        en: "<b>Linux 7.x.</b> Every drop now records a reason: <code>kfree_skb_reason()</code> / <code>sk_skb_reason_drop()</code> with codes such as <code>IP_CSUM</code>, <code>NETFILTER_DROP</code>, <code>NO_SOCKET</code> (over 120 in total). You can see them with <code>perf trace -e skb:kfree_skb</code>, <code>dropwatch</code> or <code>pwru</code>, instead of guessing.",
        uk: "<b>Linux 7.x.</b> Кожен дроп тепер має причину: <code>kfree_skb_reason()</code> / <code>sk_skb_reason_drop()</code> з кодами на зразок <code>IP_CSUM</code>, <code>NETFILTER_DROP</code>, <code>NO_SOCKET</code> (понад 120). Їх видно через <code>perf trace -e skb:kfree_skb</code>, <code>dropwatch</code> або <code>pwru</code>, замість гадати.",
      },
    },
  },
];

// The routing decision has a full description per outcome; the step shows the one its scenario takes,
// and clicking another branch shows that one instead
const ROUTE_FWD: Txt = {
  en: "<p>In this case the packet is addressed to another host: its destination IP is not one of this host’s own addresses. <code>ip_route_input_noref()</code> looks up the route for that address, and since forwarding is enabled (<code>net.ipv4.ip_forward = 1</code>), the route gets the <code>ip_forward()</code> handler.</p><p>If forwarding is disabled, the router simply drops the packet. That is the most common answer to “why doesn’t my Linux router route”.</p>",
  uk: "<p>У цьому випадку пакет адресований іншому хосту: його IP призначення не є жодною з власних адрес цього хоста. <code>ip_route_input_noref()</code> шукає маршрут до цієї адреси, і оскільки пересилання ввімкнене (<code>net.ipv4.ip_forward = 1</code>), маршрут отримує обробник <code>ip_forward()</code>.</p><p>Якщо пересилання вимкнене, маршрутизатор пакет просто відкине. Це найчастіша причина «чому мій Linux-роутер не роутить».</p>",
};
const ROUTE_LOCAL: Txt = {
  en: "<p>In this case the packet is addressed to this host: its destination IP is one of the host’s own addresses (or a broadcast address). With early demux enabled, TCP/UDP first try to find an established socket and reuse its cached route; otherwise <code>ip_route_input_noref()</code> looks up the route. <code>ip_rcv_options()</code> handles IP options.</p><p>The route gets the <code>ip_local_deliver()</code> handler, and <code>dst_input()</code> calls it: the packet goes up the stack, towards TCP/UDP and a socket.</p>",
  uk: "<p>У цьому випадку пакет адресований цьому хосту: його IP призначення — одна з власних адрес хоста (або broadcast-адреса). Якщо ввімкнено early demux, TCP/UDP спершу шукають встановлений сокет і беруть його закешований маршрут; інакше маршрут шукає <code>ip_route_input_noref()</code>. <code>ip_rcv_options()</code> обробляє IP-опції.</p><p>Маршрут отримує обробник <code>ip_local_deliver()</code>, і <code>dst_input()</code> викликає його: пакет іде нагору по стеку, до TCP/UDP і сокета.</p>",
};
const ROUTE_MC: Txt = {
  en: "<p>In this case the destination is a multicast group (224.0.0.0/4). If this host has joined the group, the route gets <code>ip_local_deliver()</code>, like any packet for us.</p><p>If multicast forwarding is enabled on the interface (a multicast routing daemon such as pimd or smcroute turns it on) and the group is not link-local (outside 224.0.0.x), the handler is <code>ip_mr_input()</code> instead. It sends copies out of the interfaces listed in the multicast routing table, and still delivers locally if the host is a member. If neither applies, the packet is dropped.</p>",
  uk: "<p>У цьому випадку одержувач — multicast-група (224.0.0.0/4). Якщо цей хост підписаний на групу, маршрут отримує <code>ip_local_deliver()</code>, як будь-який пакет для нас.</p><p>Якщо на інтерфейсі ввімкнене multicast-пересилання (його вмикає демон multicast-маршрутизації, як-от pimd чи smcroute) і група не link-local (поза 224.0.0.x), обробником стає <code>ip_mr_input()</code>. Він розсилає копії на інтерфейси з таблиці multicast-маршрутизації, а якщо хост у групі, ще й доставляє локально. Якщо не підходить ні те, ні інше, пакет відкидається.</p>",
};

const routeDecision = (pick: number): Step => ({
  l: "ip", fn: "ip_rcv_finish() → dst_input()", data: "IP", f: F_ALL,
  t: { en: "Routing decision", uk: "Рішення маршрутизації" },
  br: [
    ["ip_forward()", { en: "not for us → forward", uk: "не нам → пересилання" }, ROUTE_FWD, "forward"],
    ["ip_local_deliver()", { en: "for us → up the stack", uk: "нам → нагору по стеку" }, ROUTE_LOCAL, "ingress"],
    ["ip_mr_input()", "multicast", ROUTE_MC, "out"],
  ],
  brPick: pick,
  d: [ROUTE_FWD, ROUTE_LOCAL, ROUTE_MC][pick],
});

const I_UPPER: Step[] = [
  routeDecision(1),
  {
    l: "ip", fn: "ip_local_deliver()", data: "L4", f: F_ALL, hook: "LOCAL_IN",
    t: { en: "Defragmentation and the LOCAL_IN hook", uk: "Дефрагментація і хук LOCAL_IN" },
    d: {
      en: "<p><code>ip_defrag()</code> reassembles fragments: the packet waits on a queue until all parts arrive. Then the <code>NF_INET_LOCAL_IN</code> hook: the <b>INPUT</b> chain, where host firewall rules usually live.</p><p><code>ip_local_deliver_finish()</code> strips the IP header and picks the transport handler by the protocol field.</p>",
      uk: "<p><code>ip_defrag()</code> складає фрагменти: пакет чекає в черзі, поки прийдуть усі частини. Потім хук <code>NF_INET_LOCAL_IN</code>: ланцюжок <b>INPUT</b>, де зазвичай живуть правила фаєрвола хоста.</p><p><code>ip_local_deliver_finish()</code> знімає IP-заголовок і за полем protocol обирає обробник транспорту.</p>",
    },
  },
];

const I_TCP: Step[] = [
  {
    l: "transport", fn: "tcp_v4_rcv()", data: "L4", f: F_ALL,
    t: { en: "Validation and socket lookup", uk: "Перевірка і пошук сокета" },
    br: [
      ["TCP_NEW_SYN_RECV", { en: "new connection request", uk: "новий запит на з’єднання" },
        { en: "<p>In this case the segment belongs to a connection that is still being set up: a client sent SYN and we replied with SYN-ACK. Until the handshake finishes, the kernel keeps only a small “request sock”, not a full socket.</p><p><code>tcp_check_req()</code> checks the segment. If it is the final ACK of the handshake, a full socket is created and put on the listening socket’s accept queue, where <code>accept()</code> will pick it up. If that queue is full, the segment is dropped and the <code>ListenOverflows</code> counter grows: a sign that the application doesn’t call <code>accept()</code> fast enough.</p>", uk: "<p>У цьому випадку сегмент належить з’єднанню, яке ще встановлюється: клієнт надіслав SYN, ми відповіли SYN-ACK. Поки handshake не завершився, ядро тримає лише маленький «request sock», а не повноцінний сокет.</p><p><code>tcp_check_req()</code> перевіряє сегмент. Якщо це завершальний ACK handshake, створюється повноцінний сокет і стає в чергу accept слухаючого сокета, звідки його забере <code>accept()</code>. Якщо ця черга переповнена, сегмент відкидається, і зростає лічильник <code>ListenOverflows</code>: ознака того, що застосунок не встигає викликати <code>accept()</code>.</p>" }, "end"],
      ["TCP_TIME_WAIT", { en: "connection closed", uk: "з’єднання закрито" },
        { en: "<p>In this case the connection was closed recently. So that late packets of the old connection can’t confuse a new one on the same ports, the kernel keeps a tiny TIME_WAIT entry for 60 seconds instead of the full socket.</p><p>A retransmitted FIN gets its ACK again; most other segments are dropped. A new SYN with a higher sequence number may end TIME_WAIT early and start a fresh connection on the same ports.</p>", uk: "<p>У цьому випадку з’єднання нещодавно закрили. Щоб запізнілі пакети старого з’єднання не сплутали нове на тих самих портах, ядро на 60 секунд тримає замість повного сокета крихітний запис TIME_WAIT.</p><p>На повторний FIN ще раз іде ACK; більшість інших сегментів відкидається. Новий SYN з більшим sequence number може достроково завершити TIME_WAIT і почати нове з’єднання на тих самих портах.</p>" }, "end"],
      ["ESTABLISHED", { en: "regular segment", uk: "звичайний сегмент" },
        { en: "The usual case: the segment belongs to an open connection.", uk: "Звичайний випадок: сегмент належить відкритому з’єднанню." }],
    ],
    brPick: 2,
    d: {
      en: "<p>Segments not addressed to this host (<code>pkt_type != PACKET_HOST</code>) are dropped. <code>pskb_may_pull()</code> makes sure the header is accessible, and the TCP checksum is verified. <code>__inet_lookup_skb()</code> finds the socket by the 4-tuple (IP and port of both sides).</p><p>Some states are handled separately: <code>TCP_NEW_SYN_RECV</code> means a handshake is in progress, <code>TCP_TIME_WAIT</code> means the connection is already closed and most segments are dropped.</p><p>If the application is holding the socket lock right now, the segment is put on the socket backlog (<code>tcp_add_backlog()</code>) and processed when the lock is released.</p>",
      uk: "<p>Сегменти, не адресовані цьому хосту (<code>pkt_type != PACKET_HOST</code>), відкидаються. <code>pskb_may_pull()</code> гарантує, що заголовок доступний, перевіряється контрольна сума TCP. <code>__inet_lookup_skb()</code> знаходить сокет за четвіркою (IP і порти обох сторін).</p><p>Окремо обробляються стани: <code>TCP_NEW_SYN_RECV</code> — триває handshake, <code>TCP_TIME_WAIT</code> — з’єднання вже закрите, і більшість сегментів відкидається.</p><p>Якщо застосунок саме тримає блокування сокета, сегмент іде в backlog сокета (<code>tcp_add_backlog()</code>) і обробиться, коли блокування звільниться.</p>",
    },
    note: {
      en: "<b>Correction.</b> The paper calls this function <code>tcp_ipv4_recv()</code>; the correct name is <code>tcp_v4_rcv()</code>. Also, <code>tcp_filter()</code> applies the BPF socket filter, which can drop any segment, not only a new connection.",
      uk: "<b>Уточнення.</b> У статті функція названа <code>tcp_ipv4_recv()</code>; правильна назва — <code>tcp_v4_rcv()</code>. А <code>tcp_filter()</code> застосовує BPF socket filter, який може відкинути сегмент, а не лише нове з’єднання.",
    },
    v7: {
      note: {
        en: "<b>Linux 7.x.</b> Same structure. <code>tcp_filter()</code> moved to <code>include/net/tcp.h</code> and returns a drop reason, so a dropped segment tells you why, e.g. <code>TCP_CSUM</code> or <code>SOCKET_FILTER</code>.",
        uk: "<b>Linux 7.x.</b> Структура та сама. <code>tcp_filter()</code> переїхала в <code>include/net/tcp.h</code> і повертає причину дропу, тож відкинутий сегмент «каже», чому: наприклад, <code>TCP_CSUM</code> чи <code>SOCKET_FILTER</code>.",
      },
    },
  },
  {
    l: "transport", fn: "tcp_v4_do_rcv() → tcp_rcv_established()", data: "PAY", f: F_ALL, q: "rq",
    t: { en: "Fast path or slow path", uk: "Fast path чи slow path" },
    br: [
      ["fast path", { en: "expected segment, minimal checks", uk: "очікуваний сегмент, мінімум перевірок" },
        { en: "The segment is exactly what was expected next: data is queued for the reader almost without checks.", uk: "Сегмент — саме той, що очікувався наступним: дані стають у чергу читача майже без перевірок." }],
      ["slow path", { en: "more checks and lookups", uk: "більше перевірок і пошуків" },
        { en: "<p>In this case the segment isn’t simply “the next expected byte”: data came out of order, it carries unusual flags, or the window changed. The slow path checks it fully (<code>tcp_validate_incoming()</code>): is it inside the receive window, is it a stale duplicate, does it carry RST or SYN. Then <code>tcp_ack()</code> processes what its ACK acknowledges.</p><p>In-order data goes to the receive queue as usual. A segment that arrived early waits in a separate out-of-order queue, and the receiver keeps acknowledging the last in-order byte, with SACK telling the sender what it already has. When the missing piece arrives, the waiting segments move to the receive queue in one go.</p>", uk: "<p>У цьому випадку сегмент — не просто «наступний очікуваний байт»: дані прийшли не по порядку, є незвичні прапори, або змінилося вікно. Slow path перевіряє його повністю (<code>tcp_validate_incoming()</code>): чи він у вікні прийому, чи не застарілий дублікат, чи нема RST або SYN. Потім <code>tcp_ack()</code> обробляє, що підтверджує його ACK.</p><p>Дані по порядку йдуть у чергу прийому як завжди. Сегмент, що прийшов зарано, чекає в окремій черзі «не по порядку», а одержувач далі підтверджує останній байт по порядку, повідомляючи через SACK, що вже має. Коли приходить пропущений шматок, сегменти з черги переходять у чергу прийому разом.</p>" }],
    ],
    brPick: 0,
    d: {
      en: "<p>The kernel tries the fast path first (header prediction): if the flags and window match what is expected and the segment’s sequence number is exactly the next expected byte (<code>rcv_nxt</code>), checks are minimal. Otherwise (out-of-order data, unusual flags, window changes) the slow path runs full validation, and out-of-order segments wait in a separate queue.</p><p>The TCP header is stripped, the data lands on the <b>socket receive queue</b>, and the kernel wakes up the reader (epoll/poll; SIGIO if configured).</p>",
      uk: "<p>Ядро спершу пробує fast path (header prediction): якщо прапори й вікно такі, як очікується, а sequence number сегмента — рівно наступний очікуваний байт (<code>rcv_nxt</code>), перевірок мінімум. Інакше (дані не по порядку, незвичні прапори, зміна вікна) іде slow path з повною перевіркою, а сегменти не по порядку чекають в окремій черзі.</p><p>TCP-заголовок знімається, дані стають у <b>socket receive queue</b>, і ядро будить читача (epoll/poll; SIGIO, якщо налаштовано).</p>",
    },
  },
];

const I_UDP: Step[] = [
  {
    l: "transport", fn: "udp_rcv() → __udp4_lib_rcv()", data: "L4", f: F_ALL, q: "rq",
    t: { en: "Socket lookup by port", uk: "Пошук сокета за портом" },
    br: [
      [{ en: "socket found", uk: "сокет знайдено" }, "udp_queue_rcv_skb()",
        { en: "A socket is bound to this port: the datagram goes to its receive queue and the reader is woken up.", uk: "До цього порту прив’язаний сокет: датаграм іде в його чергу прийому, і читача будять." }],
      [{ en: "no socket", uk: "нема сокета" }, "ICMP port unreachable",
        { en: "<p>In this case nothing is listening on the destination port. If the checksum is valid, the datagram is dropped, the <code>NoPorts</code> counter grows (<code>nstat -az UdpNoPorts</code>), and an ICMP “port unreachable” goes back to the sender. ICMP replies are rate-limited, so a flood of probes can’t make the host send a flood back.</p><p>This is how a UDP port scan tells closed ports from open or filtered ones, and why <code>dig</code> against a host with no DNS server says “connection refused” right away instead of waiting for a timeout.</p>", uk: "<p>У цьому випадку порт призначення ніхто не слухає. Якщо контрольна сума правильна, датаграм відкидається, зростає лічильник <code>NoPorts</code> (<code>nstat -az UdpNoPorts</code>), а відправнику йде ICMP «port unreachable». Відповіді ICMP обмежені за частотою, тож потік запитів не змусить хост слати такий самий потік у відповідь.</p><p>Так сканер UDP-портів відрізняє закриті порти від відкритих чи відфільтрованих, і тому <code>dig</code> до хоста без DNS-сервера одразу пише «connection refused», а не чекає таймауту.</p>" }, "end"],
    ],
    brPick: 0,
    d: {
      en: "<p>The datagram length is checked. The socket is looked up by destination IP and port. If found, <code>udp_queue_rcv_skb()</code> puts the datagram on the <b>socket receive queue</b> and wakes the reader. If not, an ICMP “port unreachable” is sent back.</p><p>No connection, no windows, no segment ordering, so UDP is an order of magnitude simpler than TCP here.</p>",
      uk: "<p>Перевіряється довжина датаграма. Сокет шукається за IP і портом призначення. Знайшовся — <code>udp_queue_rcv_skb()</code> кладе датаграм у <b>socket receive queue</b> і будить читача. Нема — у відповідь іде ICMP «port unreachable».</p><p>Ні з’єднання, ні вікон, ні порядку сегментів — тому UDP тут на порядок простіший за TCP.</p>",
    },
    note: {
      en: "<b>Correction.</b> The paper describes this stage via <code>udp_rcvmsg()</code>. In fact <code>udp_rcv()</code> runs in softirq, and <code>udp_recvmsg()</code> runs later on the reading side (next step).",
      uk: "<b>Уточнення.</b> Стаття описує цей етап через <code>udp_rcvmsg()</code>. Насправді в softirq працює <code>udp_rcv()</code>, а <code>udp_recvmsg()</code> виконується вже на боці читання (наступний крок).",
    },
    v7: {
      fn: "udp_rcv()",
      note: {
        en: "<b>Linux 7.x.</b> UDP-Lite support was removed, and <code>__udp4_lib_rcv()</code> was folded into <code>udp_rcv()</code>. The logic is the same; the first lookup is <code>inet_steal_sock()</code>, which takes a socket already attached to the skb (early demux or BPF <code>bpf_sk_assign()</code>).",
        uk: "<b>Linux 7.x.</b> Підтримку UDP-Lite прибрали, а <code>__udp4_lib_rcv()</code> влили в <code>udp_rcv()</code>. Логіка та сама; першим іде <code>inet_steal_sock()</code>, що бере сокет, уже прив’язаний до skb (early demux або BPF <code>bpf_sk_assign()</code>).",
      },
    },
  },
];

const I_SOCK: Record<Proto, Step> = {
  tcp: {
    l: "socket", fn: "read() → sock_recvmsg() → tcp_recvmsg()", data: "PAY", f: F_ALL, q: "rq",
    t: { en: "The application reads the data", uk: "Застосунок читає дані" },
    d: {
      en: "<p><code>read()</code> goes through <code>sock_read_iter()</code> (<code>recv()</code>/<code>recvfrom()</code> through <code>__sys_recvfrom()</code>), and <code>sock_recvmsg()</code> runs the call through LSM, just like on send. <code>inet_recvmsg()</code> calls <code>tcp_recvmsg()</code>.</p><p>Data is taken off the receive queue and copied into the user-space buffer (e.g. an array on the heap), and the <code>sk_buff</code> is freed.</p>",
      uk: "<p><code>read()</code> іде через <code>sock_read_iter()</code> (<code>recv()</code>/<code>recvfrom()</code> — через <code>__sys_recvfrom()</code>), а <code>sock_recvmsg()</code> пропускає виклик через LSM — як і на відправці. <code>inet_recvmsg()</code> викликає <code>tcp_recvmsg()</code>.</p><p>Дані виймаються з receive queue, копіюються в буфер user space (наприклад, масив у купі), а <code>sk_buff</code> звільняється.</p>",
    },
    v7: {
      fn: "read() → tcp_recvmsg() → tcp_recvmsg_locked()",
      note: {
        en: "<b>Linux 7.x.</b> The copy loop moved into <code>tcp_recvmsg_locked()</code>; <code>tcp_recvmsg()</code> wraps it with socket locking, busy polling and control messages.",
        uk: "<b>Linux 7.x.</b> Цикл копіювання переїхав у <code>tcp_recvmsg_locked()</code>; <code>tcp_recvmsg()</code> обгортає його блокуванням сокета, busy polling і керуючими повідомленнями.",
      },
    },
  },
  udp: {
    l: "socket", fn: "read() → udp_recvmsg()", data: "PAY", f: F_ALL, q: "rq",
    t: { en: "The application reads the datagram", uk: "Застосунок читає датаграм" },
    d: {
      en: "<p><code>__skb_recv_udp()</code> takes the datagram off the queue, honouring the peek offset. The checksum is verified here if the card hasn’t done it already. Data is copied into the user buffer, and <code>skb_consume_udp()</code> adjusts reference counts and frees the <code>sk_buff</code>.</p>",
      uk: "<p><code>__skb_recv_udp()</code> забирає датаграм із черги з урахуванням peek offset. Контрольна сума перевіряється тут, якщо її ще не перевірила карта. Дані копіюються в буфер користувача, <code>skb_consume_udp()</code> коригує лічильники посилань і звільняє <code>sk_buff</code>.</p>",
    },
  },
};

const I_APP: Step = {
  l: "app", fn: "buf", user: true,
  t: { en: "Data reaches the application", uk: "Дані в застосунку" },
  d: {
    en: "<p>The packet has climbed the whole stack. The kernel never copied or erased headers: at each layer it only moved <code>data</code> forward. There was exactly one copy: from the <code>sk_buff</code> into your buffer.</p>",
    uk: "<p>Пакет пройшов увесь стек знизу вгору. Ядро не копіювало заголовки й не стирало їх: на кожному рівні воно лише зсувало <code>data</code> вперед. Копіювання було одне: з <code>sk_buff</code> у твій буфер.</p>",
  },
};

/* ---------------- FORWARD ---------------- */
// The paper only mentions this path (ip_forward). Steps are built from net/ipv4/ip_forward.c in 5.10.

const FWD_NOTE_SCOPE: Txt = {
  en: "<b>Beyond the paper.</b> The paper only mentions <code>ip_forward()</code>. This scenario is built from <code>net/ipv4/ip_forward.c</code> and <code>ip_output.c</code> in kernel 5.10.",
  uk: "<b>Поза статтею.</b> Стаття лише згадує <code>ip_forward()</code>. Цей сценарій зібрано за кодом <code>net/ipv4/ip_forward.c</code> і <code>ip_output.c</code> ядра 5.10.",
};

const F_MID: Step[] = [
  routeDecision(0),
  {
    l: "ip", fn: "ip_forward()", data: "IP", f: F_ALL,
    t: { en: "Checks on a transit packet", uk: "Перевірки транзитного пакета" },
    br: [
      ["TTL > 1", { en: "packet moves on", uk: "пакет іде далі" },
        { en: "Enough TTL left: the packet moves on, with TTL decremented by one.", uk: "TTL вистачає: пакет іде далі, а TTL зменшується на один." }],
      ["TTL ≤ 1", { en: "ICMP time exceeded → how traceroute works", uk: "ICMP time exceeded → так працює traceroute" },
        { en: "<p>In this case the TTL is 1 or less, so after this router it would reach zero. The packet is dropped, the <code>InHdrErrors</code> counter grows, and the sender gets ICMP “time exceeded” from this router.</p><p>traceroute is built on exactly this: it sends packets with TTL 1, 2, 3… and each router on the way reveals itself with this ICMP message. TTL is also what stops a packet from circling forever in a routing loop.</p>", uk: "<p>У цьому випадку TTL дорівнює 1 або менше, тож після цього роутера він дійшов би до нуля. Пакет відкидається, зростає лічильник <code>InHdrErrors</code>, а відправник отримує від цього роутера ICMP «time exceeded».</p><p>Саме на цьому побудований traceroute: він шле пакети з TTL 1, 2, 3…, і кожен роутер на шляху видає себе цим ICMP-повідомленням. TTL також не дає пакету вічно кружляти в петлі маршрутизації.</p>" }, "end"],
      [{ en: "> MTU and DF", uk: "> MTU і DF" }, "ICMP fragmentation needed (PMTUD)",
        { en: "<p>In this case the packet is larger than the MTU of the outgoing interface and has the Don’t Fragment flag set. The router may not split it, so it drops it, counts it in <code>FragFails</code>, and sends the sender ICMP “fragmentation needed” with the MTU that would fit. The sender then lowers its packet size: that is Path MTU Discovery.</p><p>If a firewall on the way blocks these ICMP messages, large packets vanish silently while small ones work: the classic “PMTU black hole”. Without DF, the packet would simply be forwarded and fragmented later, in <code>ip_finish_output()</code>.</p>", uk: "<p>У цьому випадку пакет більший за MTU вихідного інтерфейсу й має прапорець Don’t Fragment. Роутеру не можна його ділити, тож він відкидає пакет, рахує його в <code>FragFails</code> і шле відправнику ICMP «fragmentation needed» з MTU, який пройде. Відправник зменшує розмір пакетів: це і є Path MTU Discovery.</p><p>Якщо фаєрвол на шляху блокує ці ICMP-повідомлення, великі пакети тихо зникають, а малі проходять: класична «PMTU black hole». Без DF пакет просто переслали б далі й фрагментували пізніше, в <code>ip_finish_output()</code>.</p>" }, "end"],
    ],
    brPick: 0,
    d: {
      en: "<p>The packet must be addressed to this host’s MAC (<code>PACKET_HOST</code>). IPsec (xfrm) policies are checked. If the TTL runs out, the sender gets ICMP “time exceeded”. If the packet doesn’t fit the outgoing interface MTU and has DF set, the sender gets ICMP “fragmentation needed”.</p><p>Then <code>ip_decrease_ttl()</code> decrements the TTL and incrementally updates the IP header checksum.</p>",
      uk: "<p>Пакет має бути адресований на MAC цього хоста (<code>PACKET_HOST</code>). Перевіряються політики IPsec (xfrm). Якщо TTL закінчується, відправнику йде ICMP «time exceeded». Якщо пакет не влазить у MTU вихідного інтерфейсу і має прапорець DF, відправнику йде ICMP «fragmentation needed».</p><p>Потім <code>ip_decrease_ttl()</code> зменшує TTL на 1 і інкрементально перераховує контрольну суму IP-заголовка.</p>",
    },
    note: FWD_NOTE_SCOPE,
    v7: {
      note: {
        en: "<b>Linux 7.x.</b> The logic is unchanged, but each drop now records a reason: <code>PKT_TOO_BIG</code>, <code>XFRM_POLICY</code>, <code>IP_INHDR</code> and so on, visible via the <code>skb:kfree_skb</code> tracepoint.",
        uk: "<b>Linux 7.x.</b> Логіка та сама, але кожен дроп тепер має причину: <code>PKT_TOO_BIG</code>, <code>XFRM_POLICY</code>, <code>IP_INHDR</code> тощо, її видно через tracepoint <code>skb:kfree_skb</code>.",
      },
    },
  },
  {
    l: "ip", fn: "NF_HOOK(FORWARD) → ip_forward_finish()", data: "IP", f: F_ALL, hook: "FORWARD",
    t: { en: "The FORWARD hook", uk: "Хук FORWARD" },
    d: {
      en: "<p>The packet passes the <code>NF_INET_FORWARD</code> hook: the <b>FORWARD</b> chain. Router and firewall rules live here, as do Docker and Kubernetes CNI rules for traffic between pods and to the outside.</p><p>Important: a transit packet never passes INPUT or OUTPUT. A rule in INPUT won’t stop it.</p>",
      uk: "<p>Пакет проходить хук <code>NF_INET_FORWARD</code>: ланцюжок <b>FORWARD</b>. Тут живуть правила роутерів і фаєрволів, а також правила Docker і CNI-плагінів Kubernetes для трафіку між подами й назовні.</p><p>Важливо: INPUT і OUTPUT транзитний пакет не проходить зовсім. Правило в INPUT його не зупинить.</p>",
    },
    v7: { note: V7_XTABLES },
  },
  {
    l: "ip", fn: "dst_output() → ip_output()", data: "IP", f: F_ALL, hook: "POST_ROUTING",
    t: { en: "The POST_ROUTING hook", uk: "Хук POST_ROUTING" },
    d: {
      en: "<p>From here the packet takes the same output path as the host’s own traffic, just without LOCAL_OUT. SNAT/masquerade runs in the <code>NF_INET_POST_ROUTING</code> hook: that is how a home router or a k8s node rewrites the source address to its own.</p><p>The kernel never touched the transport header: TCP/UDP is just a “passenger” here. Only the ports may change, if NAT rewrote them.</p>",
      uk: "<p>Далі пакет іде тим самим вихідним шляхом, що й власний трафік хоста, тільки без LOCAL_OUT. У хуку <code>NF_INET_POST_ROUTING</code> працює SNAT/masquerade: так домашній роутер чи вузол k8s підміняє адресу відправника на свою.</p><p>Транспортний заголовок ядро не чіпало: TCP/UDP тут лише «пасажир». Змінитися можуть хіба порти, якщо їх переписав NAT.</p>",
    },
  },
  { ...finishOutput, hdr: undefined, f: F_ALL },
  {
    ...neigh({
      en: " The old Ethernet header, stripped on the way in, is replaced with a new one: this host’s MAC as the source and the next hop’s MAC as the destination. Everything above IP stays as it was, except the TTL and possibly NAT.",
      uk: " Старий Ethernet-заголовок, знятий на вході, замінюється новим: MAC цього хоста як відправник і MAC наступного хопа як одержувач. Над IP-рівнем усе лишилось як було, крім TTL і, можливо, NAT.",
    }),
    f: F_ALL,
  },
  ...OUT_LINK,
  {
    l: "wire", fn: "Ethernet frame", hdr: ALL, data: "ETH", f: F_ALL,
    t: { en: "The packet moves on", uk: "Пакет пішов далі" },
    d: {
      en: "<p>The packet crossed the host without climbing above the IP layer: no socket, no application, no copy into user space. That is why Linux makes such a good router, and why Kubernetes nodes work well as gateways for pods.</p><p>Hooks on this path: PREROUTING → FORWARD → POSTROUTING.</p>" + PHY_TX.en,
      uk: "<p>Пакет пройшов через хост, не піднімаючись вище IP-рівня: ні сокета, ні застосунку, ні копіювання в user space. Саме тому Linux так добре працює роутером, а вузли Kubernetes — шлюзом для подів.</p><p>Хуки на цьому шляху: PREROUTING → FORWARD → POSTROUTING.</p>" + PHY_TX.uk,
    },
  },
];

/* ---------------- LIVE SYSTEM COMMANDS ---------------- */
// Commands to observe each step on a running machine. Keyed by step `fn`; the raw incoming frame uses "wire-in".
// Counter names (nstat) and tracepoints (perf trace) exist in both 5.10 and 7.3.

type Cmd = [string, Tx];
const c = (cmd: string, en: string, uk: string): Cmd => [cmd, { en, uk }];

const C_STRACE_W = c("strace -f -e trace=write,sendto,sendmsg -p <PID>", "the system calls the process makes, with the bytes it hands to the kernel", "системні виклики процесу й байти, які він віддає ядру");
const C_STRACE_R = c("strace -f -e trace=read,recvfrom,recvmsg -p <PID>", "the read calls of the process and how much data each one returns", "виклики читання процесу й скільки даних повертає кожен");
const C_SS_TCP = c("ss -tmi dst 1.1.1.1", "TCP sockets to that host: Send-Q/Recv-Q (bytes waiting in the queues), cwnd, RTT, retransmits, socket memory", "TCP-сокети до цього хоста: Send-Q/Recv-Q (байти в чергах), cwnd, RTT, ретрансмісії, пам’ять сокета");
const C_SS_UDP = c("ss -uamn", "UDP sockets with their queues and socket memory", "UDP-сокети з їхніми чергами й пам’яттю");
const C_ROUTE_OUT = c("ip route get 1.1.1.1", "which route, gateway, interface and source address the kernel picks for this destination", "який маршрут, шлюз, інтерфейс і адресу відправника ядро обере для цього одержувача");
const C_NFT = c("nft list ruleset", "all netfilter rules (nftables, including those created by iptables-nft)", "усі правила netfilter (nftables, зокрема створені через iptables-nft)");
const C_CONNTRACK = c("conntrack -L -d 1.1.1.1", "connection-tracking entries for that host, including NAT translations (needs conntrack-tools)", "записи conntrack для цього хоста, зокрема NAT-перетворення (потрібен conntrack-tools)");
const C_LINK = c("ip -s link show dev eth0", "MTU, state and packet/error/drop counters of the interface", "MTU, стан і лічильники пакетів, помилок і дропів інтерфейсу");
const C_ETHTOOL = c("ethtool eth0", "negotiated speed, duplex and whether a link is detected (in a VM the speed is often “Unknown”)", "узгоджена швидкість, дуплекс і чи є лінк (у віртуалці швидкість часто «Unknown»)");
const C_ETHTOOL_S = c("ethtool -S eth0", "the driver’s own counters, per queue (names differ between drivers)", "власні лічильники драйвера, по чергах (назви залежать від драйвера)");
const C_TCPDUMP = c("tcpdump -ni eth0 -e host 1.1.1.1", "the packets themselves, with MAC addresses (-e)", "самі пакети, з MAC-адресами (-e)");
const C_DROPS = c("perf trace -e skb:kfree_skb", "every place a packet is dropped, as it happens (with a drop reason on newer kernels)", "кожне місце, де відкидається пакет, у реальному часі (на нових ядрах — із причиною)");
const C_PWRU = c("pwru 'host 1.1.1.1'", "follows a matching packet through kernel functions one by one, like this walkthrough (eBPF tool by Cilium)", "простежує пакет через функції ядра одну за одною, як ця симуляція (eBPF-утиліта від Cilium)");

export const CMDS: Record<string, Cmd[]> = {
  "write(fd, buf, len)": [C_STRACE_W, C_PWRU],
  "sock_sendmsg()": [c("ss -tanp", "which process owns which socket, with addresses and state", "який процес володіє яким сокетом, з адресами й станом"), C_STRACE_W],
  "tcp_sendmsg()": [C_SS_TCP],
  "tcp_write_xmit()": [C_SS_TCP, c("nstat -az TcpRetransSegs", "how many segments were retransmitted", "скільки сегментів відправлено повторно"), c("perf trace -e tcp:tcp_retransmit_skb", "each retransmission as it happens", "кожна ретрансмісія в реальному часі")],
  "tcp_transmit_skb()": [c("nstat -az TcpOutSegs", "TCP segments sent", "відправлені TCP-сегменти"), C_SS_TCP],
  "__ip_queue_xmit()": [C_ROUTE_OUT, c("nstat -az IpOutRequests IpOutNoRoutes", "IP packets sent by this host and those dropped for lack of a route", "IP-пакети, відправлені хостом, і відкинуті через відсутність маршруту")],
  "udp_sendmsg()": [C_SS_UDP, C_STRACE_W],
  "ip_route_output_flow()": [C_ROUTE_OUT, c("perf trace -e fib:fib_table_lookup", "each FIB lookup and its result", "кожен пошук у FIB і його результат")],
  "ip_make_skb() / ip_append_data()": [C_SS_UDP],
  "udp_send_skb()": [c("nstat -az UdpOutDatagrams UdpSndbufErrors", "datagrams sent and sends that failed for lack of buffer space", "відправлені датаграми й відправки, що не вдалися через брак буфера")],
  "ip_local_out() → dst_output()": [c("iptables -L OUTPUT -v -n", "OUTPUT chain rules with packet and byte counters", "правила ланцюжка OUTPUT з лічильниками пакетів і байтів"), C_NFT],
  "ip_output()": [c("iptables -t nat -L POSTROUTING -v -n", "SNAT/masquerade rules with counters", "правила SNAT/masquerade з лічильниками"), C_CONNTRACK],
  "ip_finish_output()": [c("tracepath -n 1.1.1.1", "the path MTU to the host, hop by hop", "MTU шляху до хоста, хоп за хопом"), c("nstat -az IpFragCreates IpFragFails", "fragments created and packets that couldn’t be fragmented", "створені фрагменти й пакети, які не вдалося фрагментувати")],
  "ip_finish_output2() → neigh_output()": [c("ip neigh show", "the neighbour (ARP) cache: REACHABLE, STALE, INCOMPLETE, FAILED", "кеш сусідів (ARP): REACHABLE, STALE, INCOMPLETE, FAILED"), c("perf trace -e neigh:neigh_update", "every change of a neighbour entry", "кожна зміна запису сусіда")],
  "dev_queue_xmit()": [c("tc -s qdisc show dev eth0", "the qdisc with sent packets, drops, overlimits and backlog", "qdisc із відправленими пакетами, дропами, overlimits і backlog"), c("perf trace -e net:net_dev_queue", "every packet entering the device queue", "кожен пакет, що стає в чергу пристрою")],
  "__qdisc_run() → ndo_start_xmit": [c("ethtool -g eth0", "TX/RX ring sizes: current and maximum", "розміри TX/RX ring: поточні й максимальні"), c("perf trace -e net:net_dev_xmit", "each packet handed to the driver, with the result code", "кожен пакет, переданий драйверу, з кодом результату")],
  "DMA + IRQ": [c("grep eth0 /proc/interrupts", "interrupt counts per CPU for the card’s queues (in a VM with a virtio card they are named virtioN-input/output instead)", "кількість переривань по процесорах для черг карти (у віртуалці з virtio-картою вони називаються virtioN-input/output)"), C_ETHTOOL_S],
  "Ethernet frame": [C_ETHTOOL, C_LINK, C_TCPDUMP],
  "wire-in": [C_ETHTOOL, C_LINK],
  "FCS, MAC filter, DMA → RX ring, IRQ": [C_ETHTOOL_S, c("ethtool -g eth0", "RX ring size; a small ring overflows under bursts", "розмір RX ring; малий ring переповнюється під сплесками"), C_LINK],
  "IRQ → NAPI poll → eth_type_trans()": [c("cat /proc/net/softnet_stat", "per CPU, in hex: packets processed, dropped (backlog full), time_squeeze (NAPI ran out of budget)", "по процесорах, у hex: оброблені пакети, відкинуті (backlog повний), time_squeeze (NAPI вичерпав бюджет)"), c("grep eth0 /proc/interrupts", "which CPUs handle the card’s interrupts (virtioN-input in a VM)", "які процесори обробляють переривання карти (у віртуалці — virtioN-input)"), c("ethtool -k eth0 | grep generic-receive-offload", "whether GRO is on", "чи ввімкнено GRO")],
  "netif_receive_skb()": [C_TCPDUMP, c("tc -s filter show dev eth0 ingress", "tc ingress filters and BPF programs with their counters", "фільтри й BPF-програми tc ingress з лічильниками"), c("perf trace -e net:netif_receive_skb", "every packet entering the stack", "кожен пакет, що входить у стек")],
  "ip_rcv()": [c("nstat -az IpInReceives IpInHdrErrors", "IP packets received and those with bad headers", "отримані IP-пакети й ті, що мають зіпсований заголовок"), C_CONNTRACK, C_DROPS],
  "ip_rcv_finish() → dst_input()": [c("ip route get 1.1.1.1 from 10.0.0.5 iif eth0", "the routing decision for a packet arriving on eth0 from 10.0.0.5: “local” if the address is ours, a gateway if it would be forwarded, “No route to host” if forwarding is off", "рішення маршрутизації для пакета, що прийшов на eth0 від 10.0.0.5: «local», якщо адреса наша, шлюз, якщо його переслали б, «No route to host», якщо пересилання вимкнене"), c("sysctl net.ipv4.ip_forward", "whether forwarding is enabled", "чи ввімкнене пересилання")],
  "ip_local_deliver()": [c("iptables -L INPUT -v -n", "INPUT chain rules with counters", "правила ланцюжка INPUT з лічильниками"), c("nstat -az IpInDelivers IpReasmFails", "packets delivered up the stack and failed reassemblies", "пакети, доставлені нагору, і невдалі збирання фрагментів")],
  "tcp_v4_rcv()": [c("ss -tan state syn-recv", "connections in the middle of a handshake", "з’єднання посеред handshake"), c("ss -tan state time-wait | wc -l", "how many connections sit in TIME_WAIT", "скільки з’єднань у TIME_WAIT"), c("nstat -az TcpExtListenOverflows TcpExtTCPBacklogDrop", "accept queue overflows and segments dropped from a full socket backlog", "переповнення черги accept і сегменти, відкинуті через повний backlog сокета")],
  "tcp_v4_do_rcv() → tcp_rcv_established()": [C_SS_TCP, c("nstat -az TcpExtTCPOFOQueue", "segments that arrived out of order and had to wait", "сегменти, що прийшли не по порядку й мусили чекати")],
  "udp_rcv() → __udp4_lib_rcv()": [c("nstat -az UdpInDatagrams UdpNoPorts UdpRcvbufErrors", "datagrams delivered, sent to closed ports, and dropped because the socket buffer was full", "доставлені датаграми, надіслані на закриті порти, і відкинуті через повний буфер сокета"), C_SS_UDP],
  "udp_rcv()": [c("nstat -az UdpInDatagrams UdpNoPorts UdpRcvbufErrors", "datagrams delivered, sent to closed ports, and dropped because the socket buffer was full", "доставлені датаграми, надіслані на закриті порти, і відкинуті через повний буфер сокета"), C_SS_UDP],
  "read() → sock_recvmsg() → tcp_recvmsg()": [C_SS_TCP, C_STRACE_R],
  "read() → tcp_recvmsg() → tcp_recvmsg_locked()": [C_SS_TCP, C_STRACE_R],
  "read() → udp_recvmsg()": [C_SS_UDP, C_STRACE_R],
  "buf": [C_STRACE_R],
  "ip_forward()": [c("sysctl net.ipv4.ip_forward", "whether forwarding is enabled", "чи ввімкнене пересилання"), c("nstat -az IpForwDatagrams IpInHdrErrors", "forwarded packets, and drops such as expired TTL", "переслані пакети й дропи на кшталт вичерпаного TTL"), c("traceroute -n 1.1.1.1", "the TTL mechanism from the outside: every hop answers “time exceeded”", "механізм TTL ззовні: кожен хоп відповідає «time exceeded»")],
  "NF_HOOK(FORWARD) → ip_forward_finish()": [c("iptables -L FORWARD -v -n", "FORWARD chain rules with counters: did the packet get here?", "правила ланцюжка FORWARD з лічильниками: чи дійшов пакет сюди?"), C_NFT],
  "dst_output() → ip_output()": [c("iptables -t nat -L POSTROUTING -v -n", "SNAT/masquerade rules with counters", "правила SNAT/masquerade з лічильниками"), C_CONNTRACK],
};

export function buildSteps(mode: Mode, proto: Proto): Step[] {
  const list =
    mode === "egress" ? [...E_APP, ...(proto === "tcp" ? E_TCP : E_UDP), ...E_TAIL]
    : mode === "ingress" ? [...IN_LOWER, ...I_UPPER, ...(proto === "tcp" ? I_TCP : I_UDP), I_SOCK[proto], I_APP]
    : [...IN_LOWER, ...F_MID];
  return list.map((st) => ({ ...st, cmd: CMDS[st.raw ? "wire-in" : st.fn] }));
}
