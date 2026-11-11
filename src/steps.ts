// Scenario data. Each step is one moment on the packet's path.
// Source: A. Stephan, L. Wüstrich, "The Path of a Packet Through the Linux Kernel", TUM 2024.
// Texts describe Linux 7.3 (the default) and are checked against v7.3; where 5.10.8 differs, `k510` holds the
// 5.10 version and `diff` explains the difference. Text without a `k510` override must hold for both kernels.

import type { Tx, Txt } from "./i18n";

/**
 * Modes without a button continue Receive from a decision point: "multicast" and "mcroute" from the routing decision
 * (group member, multicast router), "bridge" and "tcredir" from netif_receive_skb() (bridge port, tc/BPF redirect).
 */
export type Mode = "egress" | "ingress" | "forward" | "multicast" | "mcroute" | "bridge" | "tcredir";
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
 * "out" — it continues in code this walkthrough doesn't cover; a Mode — it continues as that scenario at the same step;
 * { mode, fn } — it continues as that scenario from the step with that `fn`.
 */
export type BranchNext = "end" | "out" | Mode | { mode: Mode; fn: string };

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
  /** Linux 5.10 version of this step where it differs from 7.3: function line and/or description */
  k510?: { fn?: string; d?: Txt };
  /** What differs between 5.10 and 7.3 in this step (shown in both modes) */
  diff?: Txt;
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
  { id: "PRE_ROUTING", chain: "PREROUTING", short: "PRE", modes: ["ingress", "forward", "multicast", "mcroute"] },
  { id: "LOCAL_IN", chain: "INPUT", short: "IN", modes: ["ingress", "multicast"] },
  { id: "FORWARD", chain: "FORWARD", short: "FWD", modes: ["forward", "mcroute"] },
  { id: "LOCAL_OUT", chain: "OUTPUT", short: "OUT", modes: ["egress"] },
  { id: "POST_ROUTING", chain: "POSTROUTING", short: "POST", modes: ["egress", "forward", "mcroute"] },
];

const ALL: Seg[] = ["ETH", "IP", "L4", "PAY"];
const L3: Seg[] = ["IP", "L4", "PAY"];
const F_ALL: Field[] = ["transport", "network", "mac"];
const F_NT: Field[] = ["transport", "network"];

const V7_XTABLES: Txt = {
  en: "<b>5.10 → 7.3.</b> The hooks are the same, but the legacy iptables tables (what <code>iptables-legacy</code>, arptables and ebtables use) now need a separate option, <code>NETFILTER_XTABLES_LEGACY</code>, which kernels may leave out. Modern distros use nftables or <code>iptables-nft</code>, which sit on the same hooks; x_tables matches and targets remain available to <code>iptables-nft</code>.",
  uk: "<b>5.10 → 7.3.</b> Хуки ті самі, але legacy-таблиці iptables (їх використовують <code>iptables-legacy</code>, arptables і ebtables) тепер потребують окремої опції <code>NETFILTER_XTABLES_LEGACY</code>, яку ядро може не мати. Сучасні дистрибутиви використовують nftables або <code>iptables-nft</code>, що сидять на тих самих хуках; matches і targets x_tables лишаються доступними для <code>iptables-nft</code>.",
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
      en: "<p>First it waits for the connection to be established (three-way handshake). Then it puts the data into <code>sk_buff</code>s on the <b>socket write queue</b>. One <code>sk_buff</code> usually holds several MSS-sized segments: it grows up to a “size goal”, a multiple of the MSS (with TSO/GSO up to about 64 KB), and is cut into segments later.</p><p>Data is appended to the last buffer on the queue (<code>tcp_write_queue_tail()</code>) while it is below the size goal, copied from user space into page fragments with <code>skb_copy_to_page_nocache()</code>. Only when the last buffer is full is a new <code>sk_buff</code> allocated (<code>tcp_stream_alloc_skb()</code>). <code>sendfile()</code> and splice don’t copy the data at all: they attach the pages themselves (<code>MSG_SPLICE_PAGES</code>).</p>",
      uk: "<p>Спочатку чекає, поки з’єднання встановиться (тристоронній handshake). Потім кладе дані в <code>sk_buff</code> у <b>socket write queue</b>. Один <code>sk_buff</code> зазвичай містить кілька сегментів розміру MSS: він росте до «цільового розміру», кратного MSS (з TSO/GSO — до приблизно 64 КБ), і ріжеться на сегменти пізніше.</p><p>Дані дописуються в останній буфер черги (<code>tcp_write_queue_tail()</code>), поки він не досяг цільового розміру: копіюються з user space у сторінкові фрагменти через <code>skb_copy_to_page_nocache()</code>. Лише коли останній буфер заповнений, виділяється новий <code>sk_buff</code> (<code>tcp_stream_alloc_skb()</code>). <code>sendfile()</code> і splice взагалі не копіюють дані: вони прикріплюють самі сторінки (<code>MSG_SPLICE_PAGES</code>).</p>",
    },
    k510: { d: {
      en: "<p>First it waits for the connection to be established (three-way handshake). Then it allocates <code>sk_buff</code>s for segments and puts them on the <b>socket write queue</b>. One <code>sk_buff</code> usually holds several MSS-sized segments: it grows up to a “size goal”, a multiple of the MSS (with TSO/GSO up to about 64 KB), and is cut into segments later.</p><p>Data is appended to the last buffer on the queue (<code>tcp_write_queue_tail()</code>) while it is below the size goal: into the linear area with <code>skb_add_data_nocache()</code> if there is room, otherwise into page fragments with <code>skb_copy_to_page_nocache()</code>. Only when the last buffer is full is a new <code>sk_buff</code> allocated (<code>sk_stream_alloc_skb()</code>).</p>",
      uk: "<p>Спочатку чекає, поки з’єднання встановиться (тристоронній handshake). Потім виділяє <code>sk_buff</code> під сегменти й ставить їх у <b>socket write queue</b>. Один <code>sk_buff</code> зазвичай містить кілька сегментів розміру MSS: він росте до «цільового розміру», кратного MSS (з TSO/GSO — до приблизно 64 КБ), і ріжеться на сегменти пізніше.</p><p>Дані дописуються в останній буфер черги (<code>tcp_write_queue_tail()</code>), поки він не досяг цільового розміру: у лінійну частину через <code>skb_add_data_nocache()</code>, якщо там є місце, інакше в сторінкові фрагменти через <code>skb_copy_to_page_nocache()</code>. Лише коли останній буфер заповнений, виділяється новий <code>sk_buff</code> (<code>sk_stream_alloc_skb()</code>).</p>",
    } },
    diff: {
        en: "<b>5.10 → 7.3.</b> <code>tcp_sendmsg_locked()</code> no longer copies into the skb’s linear area with <code>skb_add_data_nocache()</code>: payload always goes into page fragments (<code>skb_copy_to_page_nocache()</code>), and new skbs come from <code>tcp_stream_alloc_skb()</code>. The old <code>sendpage()</code> interface is gone; <code>sendfile()</code> and splice pass pages through <code>MSG_SPLICE_PAGES</code>.",
        uk: "<b>5.10 → 7.3.</b> <code>tcp_sendmsg_locked()</code> більше не копіює в лінійну частину skb через <code>skb_add_data_nocache()</code>: дані завжди йдуть у сторінкові фрагменти (<code>skb_copy_to_page_nocache()</code>), а нові skb створює <code>tcp_stream_alloc_skb()</code>. Старого інтерфейсу <code>sendpage()</code> нема; <code>sendfile()</code> і splice передають сторінки через <code>MSG_SPLICE_PAGES</code>.",
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
      en: "<p>The segment at the head of the write queue is cloned, and a TCP header is pushed in front of the clone’s data: ports, sequence/ack, flags, window. <code>transport_header</code> points to its start.</p><p>Then the packet goes to the network layer through the socket’s <code>queue_xmit</code>, i.e. <code>ip_queue_xmit()</code>.</p>",
      uk: "<p>Сегмент на початку write queue клонується, і перед даними клона додається TCP-заголовок: порти, sequence/ack, прапори, вікно. Поле <code>transport_header</code> вказує на його початок.</p><p>Далі пакет іде на мережевий рівень через функцію сокета <code>queue_xmit</code>, тобто <code>ip_queue_xmit()</code>.</p>",
    },
    note: {
      en: "<b>Correction.</b> The paper builds the TCP header in <code>tcp_sendmsg()</code>. In the code the header is built by <code>__tcp_transmit_skb()</code>, and the skb is cloned first: the original is kept on the retransmit queue until it is ACKed. A clone is a second <code>sk_buff</code> that points to the same data, so the payload isn’t copied (unless an earlier clone is still in flight; then <code>pskb_copy()</code> copies the linear part): one copy goes down to the card, the other waits in case it has to be resent.",
      uk: "<b>Уточнення.</b> Стаття описує побудову TCP-заголовка в <code>tcp_sendmsg()</code>. У коді заголовок формує <code>__tcp_transmit_skb()</code>, і перед цим skb клонується: оригінал лишається в черзі ретрансмісії, доки не прийде ACK. Клон — це другий <code>sk_buff</code>, що вказує на ті самі дані, тож самі дані не копіюються (хіба що попередній клон ще «в дорозі»; тоді <code>pskb_copy()</code> копіює лінійну частину): одна копія йде до карти, друга чекає на випадок повторної відправки.",
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
      en: "<p>The kernel looks for a route to the destination in order: first in the <code>sk_buff</code> itself, then in the socket (an established TCP connection almost always has it cached), then a full lookup in the FIB, the routing rules and tables.</p><p>No route means a “host unreachable” error and processing stops. Otherwise the IP header is built and <code>network_header</code> points to it.</p>",
      uk: "<p>Ядро шукає маршрут до одержувача по черзі: спершу в самому <code>sk_buff</code>, потім у сокеті (у встановленого TCP-з’єднання він майже завжди вже є), потім повним пошуком у FIB — правилах і таблицях маршрутизації.</p><p>Маршруту нема — помилка «host unreachable», обробка зупиняється. Є — будується IP-заголовок, і <code>network_header</code> вказує на нього.</p>",
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
    l: "transport", fn: "ip_make_skb() / ip_append_data()", hdr: ["PAY"], data: "PAY",
    t: { en: "Data is copied into an sk_buff", uk: "Дані копіюються в sk_buff" },
    d: {
      en: "<p>The payload is copied from user space into an <code>sk_buff</code>, with room for the IP and UDP headers set aside at the start of the buffer and headroom in front for the link-layer header. In corking mode <code>ip_append_data()</code> appends new data to the pending packet, so one IP packet can carry data from several calls.</p>",
      uk: "<p>Корисне навантаження копіюється з user space у <code>sk_buff</code>, з місцем під IP- і UDP-заголовки на початку буфера та запасом (headroom) попереду під заголовок канального рівня. У режимі corking <code>ip_append_data()</code> дописує нові дані до вже накопиченого пакета, тож один IP-пакет може містити дані кількох викликів.</p>",
    },
  },
  {
    l: "transport", fn: "udp_send_skb()", hdr: L3, data: "IP", f: F_NT,
    t: { en: "UDP and IP headers are ready", uk: "UDP- і IP-заголовки готові" },
    d: {
      en: "<p>An 8-byte UDP header is added: ports, length, checksum. The IP header was already assembled in <code>__ip_make_skb()</code>. Then <code>ip_send_skb()</code> hands the packet to the common IP output path.</p><p>No connection state and no retransmissions (and in the usual non-corking case not even a socket lock), so the UDP path is noticeably shorter and faster than TCP.</p>",
      uk: "<p>Додається 8-байтовий UDP-заголовок: порти, довжина, контрольна сума. IP-заголовок уже зібрано в <code>__ip_make_skb()</code>. Далі <code>ip_send_skb()</code> передає пакет у загальний вихідний шлях IP.</p><p>Ні стану з’єднання, ні ретрансмісій (а у звичайному режимі без corking — навіть блокування сокета), тому UDP-шлях помітно коротший і швидший за TCP.</p>",
    },
  },
];

// Shared tail of the output path, from IP down to the wire
const OUT_LINK: Step[] = [
  {
    l: "link", fn: "dev_queue_xmit()", hdr: ALL, data: "ETH", f: F_ALL, q: "qdisc",
    t: { en: "tc egress and the qdisc", uk: "tc egress і черга qdisc" },
    d: {
      en: "<p><code>mac_header</code> is set. If the device has nftables <code>egress</code> chains, the netfilter egress hook runs first; then <code>tc egress</code>, where classifiers and BPF programs (attached via tcx links or clsact) can drop, change or redirect the packet. Then it is enqueued into the <b>qdisc</b>: <code>fq_codel</code>, <code>fq</code>, <code>pfifo_fast</code> and so on. This is where shaping, priorities and AQM happen.</p><p>Devices with <code>noqueue</code> (typically virtual ones such as loopback or veth) have no qdisc: the packet goes straight to the driver via <code>dev_hard_start_xmit()</code>.</p>",
      uk: "<p>Виставляється <code>mac_header</code>. Якщо на пристрої є ланцюжки nftables <code>egress</code>, спершу працює netfilter-хук egress; потім <code>tc egress</code>, де класифікатори й BPF-програми (через tcx links або clsact) можуть відкинути, змінити чи перенаправити пакет. Далі пакет стає в чергу <b>qdisc</b>: <code>fq_codel</code>, <code>fq</code>, <code>pfifo_fast</code> тощо. Саме тут працюють шейпінг, пріоритети й AQM.</p><p>У пристроїв з <code>noqueue</code> (зазвичай віртуальних, як-от loopback чи veth) qdisc нема: пакет одразу йде в драйвер через <code>dev_hard_start_xmit()</code>.</p>",
    },
    k510: { d: {
      en: "<p><code>mac_header</code> is set. The packet passes <code>tc egress</code> (classifiers, tc BPF programs) and is enqueued into the <b>qdisc</b>: <code>fq_codel</code>, <code>fq</code>, <code>pfifo_fast</code> and so on. This is where shaping, priorities and AQM happen.</p><p>Devices with <code>noqueue</code> (typically virtual ones such as loopback or veth) have no qdisc: the packet goes straight to the driver via <code>dev_hard_start_xmit()</code>.</p>",
      uk: "<p>Виставляється <code>mac_header</code>. Пакет проходить <code>tc egress</code> (класифікатори, BPF-програми tc) і стає в чергу дисципліни <b>qdisc</b>: <code>fq_codel</code>, <code>fq</code>, <code>pfifo_fast</code> тощо. Саме тут працюють шейпінг, пріоритети й AQM.</p><p>У пристроїв з <code>noqueue</code> (зазвичай віртуальних, як-от loopback чи veth) qdisc нема: пакет одразу йде в драйвер через <code>dev_hard_start_xmit()</code>.</p>",
    } },
    diff: {
        en: "<b>5.10 → 7.3.</b> Before the qdisc there are two hook points: the netfilter <b>egress</b> hook (<code>nf_hook_egress()</code>, an nftables <code>egress</code> chain), then tc egress. tc BPF programs can now attach through <b>tcx</b> (<code>tcx_run()</code>): multi-program BPF links instead of only clsact filters.",
        uk: "<b>5.10 → 7.3.</b> Перед qdisc дві точки: netfilter-хук <b>egress</b> (<code>nf_hook_egress()</code>, ланцюжок nftables <code>egress</code>), потім tc egress. BPF-програми tc тепер можна чіпляти через <b>tcx</b> (<code>tcx_run()</code>): кілька програм через BPF links замість лише фільтрів clsact.",
      },
  },
  {
    l: "link", fn: "__qdisc_run() → ndo_start_xmit", hdr: ALL, data: "ETH", f: F_ALL, q: "txring",
    t: { en: "The driver puts the packet into the TX ring", uk: "Драйвер кладе пакет у TX ring" },
    d: {
      en: "<p>While the NIC has room, <code>__qdisc_run()</code> dequeues packets. <code>validate_xmit_skb()</code> does post-processing: checksums, VLAN tags, software segmentation if the card can’t offload it.</p><p>Then the driver places the packet into the card’s <b>TX ring</b> via <code>ndo_start_xmit</code>. If the ring is full, the driver stops its TX queue; the qdisc stops dequeuing and packets wait in it until the driver wakes the queue.</p>",
      uk: "<p>Поки в NIC є місце, <code>__qdisc_run()</code> вибирає пакети з qdisc. <code>validate_xmit_skb()</code> робить пост-обробку: контрольні суми, VLAN-теги, програмну сегментацію, якщо карта не вміє offload.</p><p>Далі драйвер через <code>ndo_start_xmit</code> кладе пакет у <b>TX ring</b> карти. Якщо ring заповнений, драйвер зупиняє свою TX-чергу; qdisc перестає віддавати пакети, і вони чекають у ній, доки драйвер не розбудить чергу.</p>",
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
        { en: "<p>In this case the MAC address of the next hop isn’t known yet (there is no entry, or it is FAILED). If the entry is only STALE, the packet is sent right away with the old MAC and the kernel checks reachability a few seconds later with a unicast probe; nothing waits. <code>neigh_resolve_output()</code> puts the packet in the neighbour’s small waiting queue, and the kernel broadcasts an ARP request: “who has this IP?”. By default it asks 3 times, about a second apart.</p><p>When the reply arrives, the entry is filled in and the waiting packets are sent. If nobody answers, the entry becomes <code>FAILED</code>, the waiting packets are dropped and an ICMP “host unreachable” is generated, so a local application sees “No route to host”. In <code>ip neigh show</code> this looks like <code>INCOMPLETE</code>, then <code>FAILED</code>.</p>", uk: "<p>У цьому випадку MAC-адреса наступного хопа ще невідома (запису нема або він FAILED). Якщо запис лише STALE, пакет одразу йде зі старою MAC, а ядро за кілька секунд перевіряє досяжність unicast-запитом; нічого не чекає. <code>neigh_resolve_output()</code> кладе пакет у невелику чергу очікування сусіда, а ядро розсилає ARP-запит: «хто має цей IP?». За замовчуванням питає 3 рази з інтервалом близько секунди.</p><p>Коли приходить відповідь, запис заповнюється, і пакети з черги відправляються. Якщо ніхто не відповів, запис стає <code>FAILED</code>, пакети з черги відкидаються, і генерується ICMP «host unreachable», тож локальний застосунок бачить «No route to host». В <code>ip neigh show</code> це виглядає як <code>INCOMPLETE</code>, а потім <code>FAILED</code>.</p>" }],
  ],
  brPick: 0,
  d: {
    en: "<p><code>ip_finish_output2()</code> updates the multicast/broadcast counters and makes sure the <code>sk_buff</code> has headroom for the link-layer header. Then <code>ip_neigh_for_gw()</code> finds the neighbour entry for the next hop (the gateway, or the destination itself on a local network).</p><p>If the entry is confirmed reachable (<code>NUD_CONNECTED</code>: REACHABLE, PERMANENT or NOARP) and has a cached header, <code>neigh_hh_output()</code> just copies a cached, ready-made Ethernet header in front of the packet. If the MAC isn’t known yet, <code>neigh_resolve_output()</code> sends an ARP request and the packet waits on the neighbour’s queue until the reply arrives." + extra.en + "</p>",
    uk: "<p><code>ip_finish_output2()</code> оновлює лічильники multicast/broadcast і перевіряє, що в <code>sk_buff</code> є headroom під заголовок канального рівня. Потім <code>ip_neigh_for_gw()</code> знаходить запис сусіда для наступного хопа (шлюзу, або самого одержувача в локальній мережі).</p><p>Якщо запис підтверджено досяжний (<code>NUD_CONNECTED</code>: REACHABLE, PERMANENT або NOARP) і має закешований заголовок, <code>neigh_hh_output()</code> просто копіює перед пакетом закешований готовий Ethernet-заголовок. Якщо MAC ще невідома, <code>neigh_resolve_output()</code> надсилає ARP-запит, і пакет чекає в черзі сусіда, поки прийде відповідь." + extra.uk + "</p>",
  },
});

const finishOutput: Step = {
  l: "ip", fn: "ip_finish_output()", hdr: L3, data: "IP", f: F_NT,
  t: { en: "cgroup BPF, MTU and fragmentation", uk: "cgroup BPF, MTU і фрагментація" },
  d: {
    en: "<p>First, cgroup BPF egress programs run and may drop the packet. Then the size is compared with the path MTU. GSO packets (one big “super-packet”) go to <code>ip_finish_output_gso()</code> and are cut into segments later, ideally by the card. A regular packet larger than the MTU goes to <code>ip_fragment()</code>: it is fragmented, or, if DF is set (and the socket doesn’t allow ignoring it), dropped with ICMP “fragmentation needed” to the sender.</p>",
    uk: "<p>Спершу виконуються BPF-програми cgroup egress, які можуть відкинути пакет. Потім розмір порівнюється з MTU шляху. GSO-пакети (один великий «суперпакет») ідуть у <code>ip_finish_output_gso()</code> і ріжуться на сегменти пізніше, в ідеалі картою. Звичайний пакет, більший за MTU, іде в <code>ip_fragment()</code>: його фрагментують, а якщо стоїть DF (і сокет не дозволяє його ігнорувати) — відкидають з ICMP «fragmentation needed» відправнику.</p>",
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
      en: "<p>If the socket has IP options set (rare), <code>ip_options_build()</code> has already written them into the header. Then the packet passes the netfilter hook <code>NF_INET_LOCAL_OUT</code>: rules of the <b>OUTPUT</b> chain run here (filter, nat, mangle, conntrack).</p><p>After the hook, <code>dst_output()</code> calls the route’s output handler through a function pointer. For plain unicast that is <code>ip_output()</code>.</p>",
      uk: "<p>Якщо в сокета задані IP-опції (рідко), <code>ip_options_build()</code> уже записала їх у заголовок. Потім пакет проходить хук netfilter <code>NF_INET_LOCAL_OUT</code>: тут спрацьовують правила ланцюжка <b>OUTPUT</b> (filter, nat, mangle, conntrack).</p><p>Після хука <code>dst_output()</code> через вказівник на функцію викликає вихідний обробник маршруту. Для звичайного unicast це <code>ip_output()</code>.</p>",
    },
    diff: V7_XTABLES,
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
      en: "<p>Done. From <code>write()</code> to the wire the packet gained three headers without the payload being moved. For TCP each header was pushed in front of the data by moving the <code>data</code> pointer back into the headroom; for UDP the room for the IP and UDP headers was set aside when the buffer was built, and only the Ethernet header was pushed. In the usual case there was exactly one copy: from user space into the <code>sk_buff</code>.</p>" + PHY_TX.en + "<p>Switch to “Receive” to walk the same path in reverse.</p>",
      uk: "<p>Готово. Від <code>write()</code> до лінії пакет обріс трьома заголовками, а самі дані не переміщувалися. Для TCP кожен заголовок додавався перед даними зсувом вказівника <code>data</code> назад у headroom; для UDP місце під IP- і UDP-заголовки виділено ще під час побудови буфера, а зсувом додано лише Ethernet-заголовок. У звичайному випадку копіювання було одне: з user space у <code>sk_buff</code>.</p>" + PHY_TX.uk + "<p>Перемкнись на «Прийом», щоб пройти той самий шлях у зворотному напрямку.</p>",
    },
  },
];

/* ---------------- INGRESS ---------------- */

// Shared start for receive and forward: from the wire up to ip_rcv()
// netif_receive_skb() is shared by every receive path; the usual branch is the one that path takes
const netif = (pick: number): Step => ({
  l: "link", fn: "netif_receive_skb()", data: "IP", f: ["mac", "network"],
  t: { en: "Who gets the packet", uk: "Кому віддати пакет" },
  br: [
    ["ptype_all", { en: "tcpdump / AF_PACKET get a copy", uk: "копія для tcpdump / AF_PACKET" },
      { en: "<p>In this case the interesting part is the sniffer: a running tcpdump or Wireshark has an <code>AF_PACKET</code> socket on the <code>ptype_all</code> list. Its capture filter runs in the kernel, and if the packet matches, the sniffer gets a copy of the bytes in its ring buffer.</p><p>This branch never ends the packet’s path: after the sniffers have looked, the packet goes on to tc, netfilter ingress and the protocol handler. That is why tcpdump shows incoming packets that a firewall drops later.</p>", uk: "<p>У цьому випадку цікавий саме снифер: запущений tcpdump чи Wireshark має <code>AF_PACKET</code>-сокет у списку <code>ptype_all</code>. Його фільтр захоплення виконується в ядрі, і якщо пакет підходить, снифер отримує копію байтів у свій кільцевий буфер.</p><p>Ця гілка ніколи не завершує шлях пакета: після сниферів він іде далі до tc, netfilter ingress і обробника протоколу. Саме тому tcpdump показує вхідні пакети, які фаєрвол потім відкидає.</p>" }],
    ["tc / nf ingress", { en: "may drop or redirect", uk: "можуть відкинути чи перенаправити" },
      { en: "<p>In this case a program attached to the interface decides the packet’s fate before IP sees it. tc ingress filters and BPF programs can let it through, drop it, or redirect it to another interface, for example straight into a container’s veth; Kubernetes CNIs such as Cilium work this way. After tc, an nftables <code>ingress</code> chain (in the <code>netdev</code> family) can filter it too.</p><p>A dropped packet ends here. A redirected one continues on the other interface instead of going up this one’s stack.</p>", uk: "<p>У цьому випадку програма, прикріплена до інтерфейсу, вирішує долю пакета ще до IP. Фільтри tc ingress і BPF-програми можуть пропустити його, відкинути або перенаправити на інший інтерфейс, наприклад одразу у veth контейнера; так працюють CNI для Kubernetes, як-от Cilium. Після tc пакет може відфільтрувати ще й ланцюжок nftables <code>ingress</code> (у сімействі <code>netdev</code>).</p><p>Відкинутий пакет на цьому закінчується. Перенаправлений продовжує шлях на іншому інтерфейсі, а не піднімається по стеку цього.</p>" }, "tcredir"],
    ["VLAN", { en: "to the VLAN interface", uk: "на VLAN-інтерфейс" },
      { en: "<p>In this case the frame carries an 802.1Q VLAN tag. If there is a VLAN interface for that VLAN ID (e.g. <code>eth0.100</code>), the tag is removed, the packet is handed to that interface and processed again from the start, as if it had arrived there.</p><p>If no VLAN interface exists for that ID, the packet is marked as not for this host (<code>PACKET_OTHERHOST</code>) and is dropped later.</p>", uk: "<p>У цьому випадку кадр має VLAN-мітку 802.1Q. Якщо для цього VLAN ID є VLAN-інтерфейс (наприклад, <code>eth0.100</code>), мітка знімається, пакет передається цьому інтерфейсу й обробляється знову з початку, ніби прийшов туди.</p><p>Якщо VLAN-інтерфейсу для цього ID нема, пакет позначається як не для цього хоста (<code>PACKET_OTHERHOST</code>) і пізніше відкидається.</p>" }],
    ["rx_handler()", { en: "bridge / bond takes the packet", uk: "bridge / bond забирає пакет" },
      { en: "<p>In this case the interface isn’t used on its own: it is a port of a bridge or a member of a bond (macvlan, Open vSwitch and team use the same hook). Its <code>rx_handler()</code> takes the packet.</p><p>A bridge looks at the destination MAC. It may forward the frame to another port at layer 2, without IP ever seeing it (this is how containers on a Docker bridge talk to each other), or pass it up as traffic of the bridge device itself (<code>br0</code>, <code>docker0</code>). A bond relabels the packet as received on the bond device and runs the receive step again.</p>", uk: "<p>У цьому випадку інтерфейс не працює сам по собі: він порт bridge або учасник bond (той самий хук використовують macvlan, Open vSwitch і team). Пакет забирає його <code>rx_handler()</code>.</p><p>Bridge дивиться на MAC одержувача. Він може переслати кадр на інший порт на рівні 2, і IP-рівень його навіть не побачить (так спілкуються контейнери на Docker bridge), або передати нагору як трафік самого bridge-пристрою (<code>br0</code>, <code>docker0</code>). Bond позначає пакет як отриманий на bond-пристрої й запускає крок прийому ще раз.</p>" }, "bridge"],
    ["ip_rcv()", { en: "plain IPv4", uk: "звичайний IPv4" },
      { en: "An ordinary IPv4 frame: it goes to the IPv4 handler.", uk: "Звичайний IPv4-кадр: він іде до обробника IPv4." }],
  ],
  brPick: pick,
  d: {
    en: "<p>Here the kernel decides who gets the packet. <code>network_header</code> is set right away.</p><p>Sniffers come first. A running tcpdump or Wireshark has an <code>AF_PACKET</code> socket open, and such sockets sit on the <code>ptype_all</code> list. Each of them is shown the packet: the capture filter runs in the kernel first (e.g. <code>tcpdump port 80</code>, compiled to BPF), and if it matches, tcpdump gets a copy of the bytes in its shared-memory ring buffer. The packet itself goes on regardless: a sniffer only watches, it doesn’t take the packet away.</p><p>Then tc ingress (classifiers, tc BPF) and the netfilter <code>ingress</code> hook run; either may drop or redirect the packet. Frames with a VLAN tag go to the VLAN interface. If the interface is part of a bridge or bond, its <code>rx_handler()</code> takes the packet over, and from then on it is traffic of the bridge or bond, not of this interface.</p><p>Otherwise the handler for the EtherType (<code>ptype_base</code>) is called: for IPv4 that is <code>ip_rcv()</code>.</p>",
    uk: "<p>Тут ядро вирішує, хто отримає пакет. Одразу виставляється <code>network_header</code>.</p><p>Спершу снифери. Запущений tcpdump чи Wireshark тримає відкритий <code>AF_PACKET</code>-сокет, а такі сокети стоять у списку <code>ptype_all</code>. Кожному з них показують пакет: спершу в ядрі виконується фільтр захоплення (наприклад, <code>tcpdump port 80</code>, скомпільований у BPF), і якщо пакет підходить, tcpdump отримує копію байтів у свій кільцевий буфер у спільній пам’яті. Сам пакет іде далі в будь-якому разі: снифер лише дивиться, а не забирає пакет.</p><p>Далі tc ingress (класифікатори, BPF tc) і netfilter-хук <code>ingress</code>; кожен може відкинути чи перенаправити пакет. Кадри з VLAN-тегом ідуть на VLAN-інтерфейс. Якщо інтерфейс входить у bridge чи bond, його <code>rx_handler()</code> забирає пакет собі, і далі це вже трафік bridge чи bond, а не цього інтерфейсу.</p><p>Інакше викликається обробник для EtherType (<code>ptype_base</code>): для IPv4 це <code>ip_rcv()</code>.</p>",
  },
  note: {
    en: "<b>Correction.</b> The paper treats TAP as a virtual interface for VMs. In the code it is the <code>ptype_all</code> list: anything that opened an <code>AF_PACKET</code> socket. That is where tcpdump and Wireshark see the packet, before netfilter.",
    uk: "<b>Уточнення.</b> Стаття трактує TAP як віртуальний інтерфейс для ВМ. У коді це список <code>ptype_all</code>: усе, що відкрило <code>AF_PACKET</code>-сокет, тобто tcpdump і Wireshark бачать пакет саме тут, до netfilter.",
  },
  diff: {
      en: "<b>5.10 → 7.3.</b> The order in <code>__netif_receive_skb_core()</code> is the same. New: tc ingress BPF programs can attach through <b>tcx</b> links (<code>tcx_run()</code>), several programs per device.",
      uk: "<b>5.10 → 7.3.</b> Порядок у <code>__netif_receive_skb_core()</code> той самий. Нове: BPF-програми tc ingress можна чіпляти через <b>tcx</b> links (<code>tcx_run()</code>), кілька програм на пристрій.",
    },

});

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
      en: "<b>Correction.</b> The IRQ handler only schedules NAPI. Packets are pulled in batches by the NET_RX softirq (<code>net_rx_action</code> → <code>napi_poll</code> → the driver’s <code>poll()</code> → <code>napi_gro_receive</code>), which is why <code>ksoftirqd</code> shows up under load, with counters in <code>/proc/net/softnet_stat</code>. A native (driver-mode) XDP program runs before the <code>sk_buff</code> is even allocated; generic XDP runs later, in <code>__netif_receive_skb_core()</code>.",
      uk: "<b>Уточнення.</b> Обробник IRQ лише планує NAPI. Пакети пачками забирає softirq NET_RX (<code>net_rx_action</code> → <code>napi_poll</code> → <code>poll()</code> драйвера → <code>napi_gro_receive</code>), тому під навантаженням видно <code>ksoftirqd</code>, а лічильники — у <code>/proc/net/softnet_stat</code>. XDP-програма в нативному режимі (у драйвері) виконується ще до виділення <code>sk_buff</code>; generic XDP — пізніше, у <code>__netif_receive_skb_core()</code>.",
    },
    diff: {
        en: "<b>5.10 → 7.3.</b> GRO lives in its own file, <code>net/core/gro.c</code>; <code>napi_gro_receive()</code> is now an inline wrapper around <code>gro_receive_skb()</code>. NAPI can also run in <b>threaded</b> mode: polling happens in <code>napi/&lt;dev&gt;-&lt;id&gt;</code> kernel threads instead of softirq, toggled via <code>/sys/class/net/&lt;dev&gt;/threaded</code>.",
        uk: "<b>5.10 → 7.3.</b> GRO винесено в окремий файл <code>net/core/gro.c</code>; <code>napi_gro_receive()</code> тепер inline-обгортка над <code>gro_receive_skb()</code>. NAPI також може працювати в режимі <b>threaded</b>: опитування йде в потоках ядра <code>napi/&lt;dev&gt;-&lt;id&gt;</code> замість softirq, вмикається через <code>/sys/class/net/&lt;dev&gt;/threaded</code>.",
      },
  },
  netif(4),
  {
    l: "ip", fn: "ip_rcv()", data: "IP", f: F_ALL, hook: "PRE_ROUTING",
    t: { en: "Sanity checks and the PRE_ROUTING hook", uk: "Перевірки і хук PRE_ROUTING" },
    d: {
      en: "<p>Packets for another MAC (<code>PACKET_OTHERHOST</code>) are dropped. Version, length and the IP header checksum are checked. <code>transport_header</code> is set.</p><p>Then the <code>NF_INET_PRE_ROUTING</code> hook: the <b>PREROUTING</b> chain, conntrack, DNAT. The hook receives a pointer to <code>ip_rcv_finish()</code> and calls it if the packet is accepted.</p>",
      uk: "<p>Пакети для чужого MAC (<code>PACKET_OTHERHOST</code>) відкидаються. Перевіряються версія, довжина і контрольна сума IP-заголовка. Виставляється <code>transport_header</code>.</p><p>Далі хук <code>NF_INET_PRE_ROUTING</code>: ланцюжок <b>PREROUTING</b>, conntrack, DNAT. Хук отримує вказівник на <code>ip_rcv_finish()</code> і викликає його, якщо пакет пропущено.</p>",
    },
    diff: {
        en: "<b>5.10 → 7.3.</b> Every drop now records a reason: <code>kfree_skb_reason()</code> / <code>sk_skb_reason_drop()</code> with codes such as <code>IP_CSUM</code>, <code>NETFILTER_DROP</code>, <code>NO_SOCKET</code> (over 120 in total). You can see them with <code>perf trace -e skb:kfree_skb</code>, <code>dropwatch</code> or <code>pwru</code>, instead of guessing.",
        uk: "<b>5.10 → 7.3.</b> Кожен дроп тепер має причину: <code>kfree_skb_reason()</code> / <code>sk_skb_reason_drop()</code> з кодами на зразок <code>IP_CSUM</code>, <code>NETFILTER_DROP</code>, <code>NO_SOCKET</code> (понад 120). Їх видно через <code>perf trace -e skb:kfree_skb</code>, <code>dropwatch</code> або <code>pwru</code>, замість гадати.",
      },
  },
];

// The routing decision has a full description per outcome; the step shows the one its scenario takes,
// and clicking another branch shows that one instead
const ROUTE_FWD: Txt = {
  en: "<p>In this case the packet is addressed to another host: its destination IP is not one of this host’s own addresses. <code>ip_route_input_noref()</code> looks up the route for that address, and since forwarding is enabled on the incoming interface (<code>net.ipv4.conf.&lt;if&gt;.forwarding</code>, which <code>net.ipv4.ip_forward = 1</code> turns on for all interfaces), the route gets the <code>ip_forward()</code> handler.</p><p>If forwarding is disabled, the router simply drops the packet. That is the most common answer to “why doesn’t my Linux router route”.</p>",
  uk: "<p>У цьому випадку пакет адресований іншому хосту: його IP призначення не є жодною з власних адрес цього хоста. <code>ip_route_input_noref()</code> шукає маршрут до цієї адреси, і оскільки на вхідному інтерфейсі ввімкнене пересилання (<code>net.ipv4.conf.&lt;if&gt;.forwarding</code>, яке <code>net.ipv4.ip_forward = 1</code> вмикає на всіх інтерфейсах), маршрут отримує обробник <code>ip_forward()</code>.</p><p>Якщо пересилання вимкнене, маршрутизатор пакет просто відкине. Це найчастіша причина «чому мій Linux-роутер не роутить».</p>",
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
    ["ip_route_input_mc()", { en: "multicast group", uk: "multicast-група" }, ROUTE_MC, "multicast"],
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
        { en: "<p>In this case the connection was closed recently. So that late packets of the old connection can’t confuse a new one on the same ports, the kernel keeps a tiny TIME_WAIT entry for 60 seconds instead of the full socket.</p><p>A retransmitted FIN gets its ACK again, and so do other late segments: they are answered with a rate-limited duplicate ACK and discarded. An RST is simply dropped. A new SYN with a higher sequence number may end TIME_WAIT early and start a fresh connection on the same ports.</p>", uk: "<p>У цьому випадку з’єднання нещодавно закрили. Щоб запізнілі пакети старого з’єднання не сплутали нове на тих самих портах, ядро на 60 секунд тримає замість повного сокета крихітний запис TIME_WAIT.</p><p>На повторний FIN ще раз іде ACK, так само як і на інші запізнілі сегменти: на них відповідають дублікатом ACK (з обмеженням частоти) і відкидають. RST просто відкидається. Новий SYN з більшим sequence number може достроково завершити TIME_WAIT і почати нове з’єднання на тих самих портах.</p>" }, "end"],
      ["ESTABLISHED", { en: "regular segment", uk: "звичайний сегмент" },
        { en: "The usual case: the segment belongs to an open connection.", uk: "Звичайний випадок: сегмент належить відкритому з’єднанню." }],
    ],
    brPick: 2,
    d: {
      en: "<p>Segments not addressed to this host (<code>pkt_type != PACKET_HOST</code>) are dropped. <code>pskb_may_pull()</code> makes sure the header is accessible, and the checksum is checked if the card already computed it (<code>skb_checksum_init()</code>); otherwise the full check happens later, in <code>tcp_rcv_established()</code>. <code>__inet_lookup_skb()</code> finds the socket by the 4-tuple (IP and port of both sides).</p><p>Some states are handled separately: <code>TCP_NEW_SYN_RECV</code> means a handshake is in progress, <code>TCP_TIME_WAIT</code> means the connection is already closed, and late segments are answered by a tiny TIME_WAIT record instead of a full socket.</p><p>If the application is holding the socket lock right now, the segment is put on the socket backlog (<code>tcp_add_backlog()</code>) and processed when the lock is released.</p>",
      uk: "<p>Сегменти, не адресовані цьому хосту (<code>pkt_type != PACKET_HOST</code>), відкидаються. <code>pskb_may_pull()</code> гарантує, що заголовок доступний, контрольна сума перевіряється, якщо її вже порахувала карта (<code>skb_checksum_init()</code>); інакше повна перевірка буде пізніше, в <code>tcp_rcv_established()</code>. <code>__inet_lookup_skb()</code> знаходить сокет за четвіркою (IP і порти обох сторін).</p><p>Окремо обробляються стани: <code>TCP_NEW_SYN_RECV</code> — триває handshake, <code>TCP_TIME_WAIT</code> — з’єднання вже закрите, і на сегменти відповідає крихітний запис TIME_WAIT замість повного сокета.</p><p>Якщо застосунок саме тримає блокування сокета, сегмент іде в backlog сокета (<code>tcp_add_backlog()</code>) і обробиться, коли блокування звільниться.</p>",
    },
    note: {
      en: "<b>Correction.</b> The paper calls this function <code>tcp_ipv4_recv()</code>; the correct name is <code>tcp_v4_rcv()</code>. Also, <code>tcp_filter()</code> applies the BPF socket filter, which can drop any segment, not only a new connection.",
      uk: "<b>Уточнення.</b> У статті функція названа <code>tcp_ipv4_recv()</code>; правильна назва — <code>tcp_v4_rcv()</code>. А <code>tcp_filter()</code> застосовує BPF socket filter, який може відкинути сегмент, а не лише нове з’єднання.",
    },
    diff: {
        en: "<b>5.10 → 7.3.</b> Same structure. <code>tcp_filter()</code> moved to <code>include/net/tcp.h</code> and returns a drop reason, so a dropped segment tells you why, e.g. <code>TCP_CSUM</code> or <code>SOCKET_FILTER</code>.",
        uk: "<b>5.10 → 7.3.</b> Структура та сама. <code>tcp_filter()</code> переїхала в <code>include/net/tcp.h</code> і повертає причину дропу, тож відкинутий сегмент «каже», чому: наприклад, <code>TCP_CSUM</code> чи <code>SOCKET_FILTER</code>.",
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
    l: "transport", fn: "udp_rcv()", k510: { fn: "udp_rcv() → __udp4_lib_rcv()" }, data: "L4", f: F_ALL, q: "rq",
    t: { en: "Socket lookup by port", uk: "Пошук сокета за портом" },
    br: [
      [{ en: "socket found", uk: "сокет знайдено" }, "udp_queue_rcv_skb()",
        { en: "A socket is bound to this port: the datagram goes to its receive queue and the reader is woken up.", uk: "До цього порту прив’язаний сокет: датаграм іде в його чергу прийому, і читача будять." }],
      [{ en: "no socket", uk: "нема сокета" }, "ICMP port unreachable",
        { en: "<p>In this case nothing is listening on the destination port. If the checksum is valid, the datagram is dropped, the <code>NoPorts</code> counter grows (<code>nstat -az UdpNoPorts</code>), and an ICMP “port unreachable” goes back to the sender. ICMP replies are rate-limited, so a flood of probes can’t make the host send a flood back.</p><p>This is how a UDP port scan tells closed ports from open or filtered ones, and why <code>dig</code> against a host with no DNS server says “connection refused” right away instead of waiting for a timeout.</p>", uk: "<p>У цьому випадку порт призначення ніхто не слухає. Якщо контрольна сума правильна, датаграм відкидається, зростає лічильник <code>NoPorts</code> (<code>nstat -az UdpNoPorts</code>), а відправнику йде ICMP «port unreachable». Відповіді ICMP обмежені за частотою, тож потік запитів не змусить хост слати такий самий потік у відповідь.</p><p>Так сканер UDP-портів відрізняє закриті порти від відкритих чи відфільтрованих, і тому <code>dig</code> до хоста без DNS-сервера одразу пише «connection refused», а не чекає таймауту.</p>" }, "end"],
    ],
    brPick: 0,
    d: {
      en: "<p>The datagram length is checked. The socket is looked up by destination IP and port (source IP and port count too, so a connected socket wins), unless early demux has already attached one. If found, <code>udp_queue_rcv_skb()</code> puts the datagram on the <b>socket receive queue</b> and wakes the reader. If not, an ICMP “port unreachable” is sent back.</p><p>No connection, no windows, no segment ordering, so UDP is an order of magnitude simpler than TCP here.</p>",
      uk: "<p>Перевіряється довжина датаграма. Сокет шукається за IP і портом призначення (IP і порт відправника теж враховуються, тож connected-сокет має перевагу), якщо early demux ще не прикріпив його. Знайшовся — <code>udp_queue_rcv_skb()</code> кладе датаграм у <b>socket receive queue</b> і будить читача. Нема — у відповідь іде ICMP «port unreachable».</p><p>Ні з’єднання, ні вікон, ні порядку сегментів — тому UDP тут на порядок простіший за TCP.</p>",
    },
    note: {
      en: "<b>Correction.</b> The paper describes this stage via <code>udp_rcvmsg()</code>. In fact <code>udp_rcv()</code> runs in softirq, and <code>udp_recvmsg()</code> runs later on the reading side (next step).",
      uk: "<b>Уточнення.</b> Стаття описує цей етап через <code>udp_rcvmsg()</code>. Насправді в softirq працює <code>udp_rcv()</code>, а <code>udp_recvmsg()</code> виконується вже на боці читання (наступний крок).",
    },
    diff: {
        en: "<b>5.10 → 7.3.</b> UDP-Lite support was removed, and <code>__udp4_lib_rcv()</code> was folded into <code>udp_rcv()</code>. The logic is the same; taking a socket already attached to the skb (early demux or BPF <code>bpf_sk_assign()</code>), which 5.10 does with <code>skb_steal_sock()</code>, is now <code>inet_steal_sock()</code>.",
        uk: "<b>5.10 → 7.3.</b> Підтримку UDP-Lite прибрали, а <code>__udp4_lib_rcv()</code> влили в <code>udp_rcv()</code>. Логіка та сама; сокет, уже прив’язаний до skb (early demux або BPF <code>bpf_sk_assign()</code>), який 5.10 бере через <code>skb_steal_sock()</code>, тепер береться через <code>inet_steal_sock()</code>.",
      },
  },
];

const I_SOCK: Record<Proto, Step> = {
  tcp: {
    l: "socket", fn: "read() → tcp_recvmsg() → tcp_recvmsg_locked()", k510: { fn: "read() → sock_recvmsg() → tcp_recvmsg()" }, data: "PAY", f: F_ALL, q: "rq",
    t: { en: "The application reads the data", uk: "Застосунок читає дані" },
    d: {
      en: "<p><code>read()</code> goes through <code>sock_read_iter()</code> (<code>recv()</code>/<code>recvfrom()</code> through <code>__sys_recvfrom()</code>), and <code>sock_recvmsg()</code> runs the call through LSM, just like on send. <code>inet_recvmsg()</code> calls <code>tcp_recvmsg()</code>.</p><p>Data is taken off the receive queue and copied into the user-space buffer (e.g. an array on the heap), and the <code>sk_buff</code> is freed.</p>",
      uk: "<p><code>read()</code> іде через <code>sock_read_iter()</code> (<code>recv()</code>/<code>recvfrom()</code> — через <code>__sys_recvfrom()</code>), а <code>sock_recvmsg()</code> пропускає виклик через LSM — як і на відправці. <code>inet_recvmsg()</code> викликає <code>tcp_recvmsg()</code>.</p><p>Дані виймаються з receive queue, копіюються в буфер user space (наприклад, масив у купі), а <code>sk_buff</code> звільняється.</p>",
    },
    diff: {
        en: "<b>5.10 → 7.3.</b> The copy loop moved into <code>tcp_recvmsg_locked()</code>; <code>tcp_recvmsg()</code> wraps it with socket locking, busy polling and control messages.",
        uk: "<b>5.10 → 7.3.</b> Цикл копіювання переїхав у <code>tcp_recvmsg_locked()</code>; <code>tcp_recvmsg()</code> обгортає його блокуванням сокета, busy polling і керуючими повідомленнями.",
      },
  },
  udp: {
    l: "socket", fn: "read() → udp_recvmsg()", data: "PAY", f: F_ALL, q: "rq",
    t: { en: "The application reads the datagram", uk: "Застосунок читає датаграм" },
    d: {
      en: "<p><code>__skb_recv_udp()</code> takes the datagram off the queue, honouring the peek offset. If the card hasn’t verified the checksum, it is checked here while copying (or earlier, on arrival, if the socket has a filter attached). Data is copied into the user buffer, and <code>skb_consume_udp()</code> adjusts reference counts and frees the <code>sk_buff</code>.</p>",
      uk: "<p><code>__skb_recv_udp()</code> забирає датаграм із черги з урахуванням peek offset. Якщо карта не перевірила контрольну суму, вона перевіряється тут під час копіювання (або раніше, при надходженні, якщо на сокеті є фільтр). Дані копіюються в буфер користувача, <code>skb_consume_udp()</code> коригує лічильники посилань і звільняє <code>sk_buff</code>.</p>",
    },
  },
};

const I_APP: Step = {
  l: "app", fn: "buf", user: true,
  t: { en: "Data reaches the application", uk: "Дані в застосунку" },
  d: {
    en: "<p>The packet has climbed the whole stack. The protocol layers never copied or erased headers: at each layer they only moved <code>data</code> forward. The one copy every byte must go through is from the <code>sk_buff</code> into your buffer (some drivers also copy headers or very small frames when they build the <code>sk_buff</code>).</p>",
    uk: "<p>Пакет пройшов увесь стек знизу вгору. Протокольні рівні не копіювали заголовки й не стирали їх: на кожному рівні вони лише зсували <code>data</code> вперед. Одне копіювання, через яке проходить кожен байт, — з <code>sk_buff</code> у твій буфер (деякі драйвери ще копіюють заголовки чи дуже малі кадри, коли будують <code>sk_buff</code>).</p>",
  },
};

/* ---------------- FORWARD ---------------- */
// The paper only mentions this path (ip_forward). Steps are built from net/ipv4/ip_forward.c in 5.10 and 7.3.

const FWD_NOTE_SCOPE: Txt = {
  en: "<b>Beyond the paper.</b> The paper only mentions <code>ip_forward()</code>. This scenario is built from <code>net/ipv4/ip_forward.c</code> and <code>ip_output.c</code> in kernels 5.10 and 7.3.",
  uk: "<b>Поза статтею.</b> Стаття лише згадує <code>ip_forward()</code>. Цей сценарій зібрано за кодом <code>net/ipv4/ip_forward.c</code> і <code>ip_output.c</code> ядер 5.10 і 7.3.",
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
    diff: {
        en: "<b>5.10 → 7.3.</b> The logic is unchanged. Most drops now record a reason (<code>PKT_TOO_BIG</code>, <code>XFRM_POLICY</code>, <code>IP_INHDR</code>), visible via the <code>skb:kfree_skb</code> tracepoint. <code>IpForwDatagrams</code> is now counted here, before the MTU check and the FORWARD hook, so it also includes packets dropped there; in 5.10 it is counted in <code>ip_forward_finish()</code>.",
        uk: "<b>5.10 → 7.3.</b> Логіка та сама. Більшість дропів тепер має причину (<code>PKT_TOO_BIG</code>, <code>XFRM_POLICY</code>, <code>IP_INHDR</code>), її видно через tracepoint <code>skb:kfree_skb</code>. <code>IpForwDatagrams</code> тепер рахується тут, до перевірки MTU й хука FORWARD, тож включає й пакети, відкинуті там; у 5.10 він рахується в <code>ip_forward_finish()</code>.",
      },
  },
  {
    l: "ip", fn: "NF_HOOK(FORWARD) → ip_forward_finish()", data: "IP", f: F_ALL, hook: "FORWARD",
    t: { en: "The FORWARD hook", uk: "Хук FORWARD" },
    d: {
      en: "<p>The packet passes the <code>NF_INET_FORWARD</code> hook: the <b>FORWARD</b> chain. Router and firewall rules live here, as do Docker and Kubernetes CNI rules for traffic between pods and to the outside.</p><p>Important: a transit packet never passes INPUT or OUTPUT. A rule in INPUT won’t stop it.</p>",
      uk: "<p>Пакет проходить хук <code>NF_INET_FORWARD</code>: ланцюжок <b>FORWARD</b>. Тут живуть правила роутерів і фаєрволів, а також правила Docker і CNI-плагінів Kubernetes для трафіку між подами й назовні.</p><p>Важливо: INPUT і OUTPUT транзитний пакет не проходить зовсім. Правило в INPUT його не зупинить.</p>",
    },
    diff: V7_XTABLES,
  },
  {
    l: "ip", fn: "dst_output() → ip_output()", data: "IP", f: F_ALL, hook: "POST_ROUTING",
    t: { en: "The POST_ROUTING hook", uk: "Хук POST_ROUTING" },
    d: {
      en: "<p>From here the packet takes the same output path as the host’s own traffic, just without LOCAL_OUT. SNAT/masquerade runs in the <code>NF_INET_POST_ROUTING</code> hook: that is how a home router or a k8s node rewrites the source address to its own.</p><p>The kernel didn’t look at the transport header: TCP/UDP is just a “passenger” here. Only NAT changes it: the ports, if it rewrites them, and the TCP/UDP checksum, which also covers the IP addresses.</p>",
      uk: "<p>Далі пакет іде тим самим вихідним шляхом, що й власний трафік хоста, тільки без LOCAL_OUT. У хуку <code>NF_INET_POST_ROUTING</code> працює SNAT/masquerade: так домашній роутер чи вузол k8s підміняє адресу відправника на свою.</p><p>Транспортний заголовок ядро не розбирало: TCP/UDP тут лише «пасажир». Змінити його може тільки NAT: порти, якщо він їх переписує, і контрольну суму TCP/UDP, бо вона охоплює й IP-адреси.</p>",
    },
  },
  {
    ...finishOutput, hdr: undefined, f: F_ALL,
    t: { en: "MTU and fragmentation", uk: "MTU і фрагментація" },
    d: {
      en: "<p>A forwarded packet has no socket, so cgroup BPF egress programs, which work per socket, don’t run here. The size is compared with the MTU of the route or the outgoing interface (the path MTU is used only with <code>net.ipv4.ip_forward_use_pmtu = 1</code>). An oversized packet without DF, which the forwarding code let through, is fragmented here by <code>ip_fragment()</code>; GSO packets are cut into segments later.</p>",
      uk: "<p>У пересилюваного пакета нема сокета, тож BPF-програми cgroup egress, що працюють посокетно, тут не виконуються. Розмір порівнюється з MTU маршруту або вихідного інтерфейсу (MTU шляху використовується лише з <code>net.ipv4.ip_forward_use_pmtu = 1</code>). Завеликий пакет без DF, який пропустив код пересилання, тут фрагментує <code>ip_fragment()</code>; GSO-пакети ріжуться на сегменти пізніше.</p>",
    },
  },
  {
    ...neigh({
      en: " The old Ethernet header, which <code>data</code> moved past on the way in, is overwritten by a new one: this host’s MAC as the source and the next hop’s MAC as the destination. The IP header and everything above it stay as they were, except the TTL, the IP header checksum and possibly NAT.",
      uk: " Старий Ethernet-заголовок, повз який <code>data</code> зсунувся на вході, перезаписується новим: MAC цього хоста як відправник і MAC наступного хопа як одержувач. IP-заголовок і все над ним лишаються як були, крім TTL, контрольної суми IP-заголовка і, можливо, NAT.",
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

/* ---------------- MULTICAST ---------------- */
// Continuations of Receive for a group address, reached from the routing decision: "multicast" (this host is a member)
// and "mcroute" (this host is a multicast router). Not covered by the paper; built from net/ipv4/igmp.c, route.c
// (ip_route_input_mc), ipmr.c, ip_output.c (ip_mc_output), arp.c and udp.c (__udp4_lib_mcast_deliver) in 5.10 and 7.3.

const MC_SCOPE: Txt = {
  en: "<b>Beyond the paper.</b> The paper doesn’t cover multicast. This path is built from <code>net/ipv4/igmp.c</code>, <code>route.c</code>, <code>ipmr.c</code> and <code>udp.c</code> in kernels 5.10 and 7.3.",
  uk: "<b>Поза статтею.</b> Стаття не розбирає multicast. Цей шлях зібрано за кодом <code>net/ipv4/igmp.c</code>, <code>route.c</code>, <code>ipmr.c</code> і <code>udp.c</code> ядер 5.10 і 7.3.",
};

const M_WIRE: Step = {
  l: "wire", fn: "Ethernet frame → 01:00:5e:01:02:03", raw: true,
  t: { en: "A frame for a multicast group arrives", uk: "Приходить кадр для multicast-групи" },
  d: {
    en: "<p>A sender sends a UDP datagram to the group 239.1.2.3, port 5000. On Ethernet, the destination MAC is derived from the group address: the prefix 01:00:5e followed by the lowest 23 bits of the IP address, so 239.1.2.3 becomes 01:00:5e:01:02:03. Five bits of the address are lost, which means 32 groups share every multicast MAC.</p><p>A plain switch floods multicast frames to all ports; a switch with IGMP snooping sends them only to ports where a group member answered with an IGMP report, and to ports with a multicast router.</p>",
    uk: "<p>Відправник шле UDP-датаграму групі 239.1.2.3, порт 5000. В Ethernet MAC одержувача виводиться з адреси групи: префікс 01:00:5e і молодші 23 біти IP-адреси, тож 239.1.2.3 стає 01:00:5e:01:02:03. П’ять бітів адреси губляться, тому кожну multicast-MAC ділять 32 групи.</p><p>Звичайний комутатор розсилає multicast-кадри на всі порти; комутатор з IGMP snooping — лише на порти, звідки член групи відповів IGMP-звітом, і на порти з multicast-роутером.</p>",
  },
  note: MC_SCOPE,
};

const M_NIC: Step = {
  l: "nic", fn: "multicast MAC filter, DMA → RX ring, IRQ", raw: true, q: "rxring",
  t: { en: "The card lets in the groups it was told about", uk: "Карта пропускає групи, про які їй сказали" },
  d: {
    en: "<p>The card accepts this frame because an application joined the group earlier: <code>setsockopt(IP_ADD_MEMBERSHIP)</code> → <code>ip_mc_join_group()</code>. When an interface joins a group for the first time, <code>ip_mc_filter_add()</code> turns the group into its multicast MAC and <code>dev_mc_add()</code> has the driver add it to the card’s filter, and <code>igmp_group_added()</code> sends an IGMP membership report (IGMPv3 unless the network’s querier speaks an older version), so switches and routers start sending the group here. Later joins on the same interface only increase a counter.</p><p>Many cards use a hash for this filter, so frames for other groups can slip through too; the kernel sorts them out later. The rest is the same as for any frame: FCS check, DMA into the <b>RX ring</b>, an interrupt.</p>",
    uk: "<p>Карта приймає цей кадр, бо раніше застосунок підписався на групу: <code>setsockopt(IP_ADD_MEMBERSHIP)</code> → <code>ip_mc_join_group()</code>. Коли інтерфейс уперше підписується на групу, <code>ip_mc_filter_add()</code> перетворює групу на її multicast-MAC, <code>dev_mc_add()</code> просить драйвер додати її у фільтр карти, а <code>igmp_group_added()</code> надсилає IGMP-звіт про членство (IGMPv3, якщо querier у мережі не говорить старішою версією), тож комутатори й роутери починають слати групу сюди. Наступні підписки на тому ж інтерфейсі лише збільшують лічильник.</p><p>Багато карт використовують для цього фільтра хеш, тож можуть пройти й кадри інших груп; ядро відсіє їх пізніше. Далі все як для будь-якого кадру: перевірка FCS, DMA в <b>RX ring</b>, переривання.</p>",
  },
};

const R_NIC: Step = {
  l: "nic", fn: "all-multicast mode, DMA → RX ring, IRQ", raw: true, q: "rxring",
  t: { en: "A router’s card takes every multicast frame", uk: "Карта роутера бере всі multicast-кадри" },
  d: {
    en: "<p>On a multicast router, a routing daemon such as pimd or smcroute set the kernel up through <code>ip_mroute_setsockopt()</code>: <code>MRT_INIT</code> to take ownership of multicast routing, <code>MRT_ADD_VIF</code> for each interface that takes part, and <code>MRT_ADD_MFC</code> for each (source, group) route. <code>vif_add()</code> turns on multicast forwarding for the interface and puts the card into all-multicast mode with <code>dev_set_allmulti()</code>, so it accepts every multicast frame, not only joined groups.</p><p>The rest is the same as for any frame: FCS check, DMA into the <b>RX ring</b>, an interrupt.</p>",
    uk: "<p>На multicast-роутері демон маршрутизації (pimd чи smcroute) налаштував ядро через <code>ip_mroute_setsockopt()</code>: <code>MRT_INIT</code>, щоб узяти multicast-маршрутизацію на себе, <code>MRT_ADD_VIF</code> для кожного інтерфейсу, що бере участь, і <code>MRT_ADD_MFC</code> для кожного маршруту (джерело, група). <code>vif_add()</code> вмикає на інтерфейсі multicast-пересилання й переводить карту в режим all-multicast через <code>dev_set_allmulti()</code>, тож вона приймає всі multicast-кадри, а не лише групи, на які підписані.</p><p>Далі все як для будь-якого кадру: перевірка FCS, DMA в <b>RX ring</b>, переривання.</p>",
  },
  note: MC_SCOPE,
};

const mcRoute = (pick: number): Step => ({
  l: "ip", fn: "ip_rcv_finish() → dst_input()", data: "IP", f: F_ALL,
  t: { en: "Routing decision for a group address", uk: "Рішення маршрутизації для адреси групи" },
  br: [
    [{ en: "member", uk: "член групи" }, { en: "joined → deliver locally", uk: "підписаний → доставити локально" },
      { en: "This host has joined the group on this interface: the packet is delivered locally through <code>ip_local_deliver()</code>.", uk: "Хост підписаний на групу на цьому інтерфейсі: пакет доставляється локально через <code>ip_local_deliver()</code>." }, "multicast"],
    ["ip_mr_input()", { en: "multicast router", uk: "multicast-роутер" },
      { en: "Multicast forwarding is on for this interface and the group is not link-local: the packet goes to <code>ip_mr_input()</code> to be forwarded.", uk: "На інтерфейсі ввімкнене multicast-пересилання, а група не link-local: пакет іде в <code>ip_mr_input()</code> на пересилання." }, "mcroute"],
    [{ en: "neither", uk: "ні те, ні інше" }, { en: "dropped", uk: "відкидається" },
      { en: "<p>In this case the host hasn’t joined the group on this interface and doesn’t route multicast. No route is created, and the packet is dropped. This is what happens to frames for other groups that slipped through the card’s hash filter.</p>",
        uk: "<p>У цьому випадку хост не підписаний на групу на цьому інтерфейсі й не маршрутизує multicast. Маршрут не створюється, пакет відкидається. Саме це стається з кадрами інших груп, що проскочили хеш-фільтр карти.</p>" }, "end"],
  ],
  brPick: pick,
  d: pick === 0 ? {
    en: "<p>The destination is a multicast address, so routing takes a separate path: <code>ip_route_input_mc()</code>. First <code>ip_check_mc_rcu()</code> checks whether this interface has joined the group (and, with IGMPv3 source filters, whether this sender is allowed). It has, so the route gets the <code>ip_local_deliver()</code> handler.</p><p>Unlike unicast, the routing table isn’t asked where the packet goes: the membership list decides.</p>",
    uk: "<p>Адреса одержувача — multicast, тож маршрутизація йде окремим шляхом: <code>ip_route_input_mc()</code>. Спершу <code>ip_check_mc_rcu()</code> перевіряє, чи підписаний цей інтерфейс на групу (і, з фільтрами джерел IGMPv3, чи дозволений цей відправник). Підписаний, тож маршрут отримує обробник <code>ip_local_deliver()</code>.</p><p>На відміну від unicast, таблицю маршрутизації не питають, куди йде пакет: вирішує список членства.</p>",
  } : {
    en: "<p>The destination is a multicast address, so routing takes a separate path: <code>ip_route_input_mc()</code>. Multicast forwarding is on for this interface and the group is not link-local (outside 224.0.0.x, which never leaves the local network), so the route gets the <code>ip_mr_input()</code> handler. If the router has also joined the group, the route is marked local as well, and one copy will be delivered to its own sockets.</p>",
    uk: "<p>Адреса одержувача — multicast, тож маршрутизація йде окремим шляхом: <code>ip_route_input_mc()</code>. На інтерфейсі ввімкнене multicast-пересилання, а група не link-local (поза 224.0.0.x, яка ніколи не виходить за локальну мережу), тож маршрут отримує обробник <code>ip_mr_input()</code>. Якщо роутер ще й підписаний на групу, маршрут позначається і як локальний, і одна копія дістанеться його власним сокетам.</p>",
  },
});

const M_UDP: Step = {
  l: "transport", fn: "udp_rcv() → __udp4_lib_mcast_deliver()", k510: { fn: "udp_rcv() → __udp4_lib_rcv() → __udp4_lib_mcast_deliver()" }, data: "L4", f: F_ALL, q: "rq",
  t: { en: "A copy for every member socket", uk: "Копія кожному сокету-члену" },
  br: [
    [{ en: "member sockets", uk: "є сокети-члени" }, { en: "each gets a copy", uk: "кожен отримує копію" },
      { en: "Each socket that matches gets the datagram in its receive queue.", uk: "Кожен відповідний сокет отримує датаграму в свою чергу прийому." }],
    [{ en: "no socket", uk: "нема сокета" }, { en: "dropped silently", uk: "тихо відкидається" },
      { en: "<p>In this case no socket on this port has joined the group (the interface may still be a member because of another application, or the frame slipped through the filter). The datagram is dropped and the <code>IgnoredMulti</code> counter grows; unlike unicast, no ICMP “port unreachable” is sent, so a group with many receivers can’t trigger a storm of replies.</p>",
        uk: "<p>У цьому випадку жоден сокет на цьому порту не підписаний на групу (інтерфейс може бути членом через інший застосунок, або кадр проскочив фільтр). Датаграма відкидається, зростає лічильник <code>IgnoredMulti</code>; на відміну від unicast, ICMP «port unreachable» не шлеться, тож група з багатьма одержувачами не викличе зливи відповідей.</p>" }, "end"],
  ],
  brPick: 0,
  d: {
    en: "<p>The route is marked as multicast, so <code>udp_rcv()</code> hands the datagram to <code>__udp4_lib_mcast_deliver()</code>. It walks all sockets bound to the destination port, and <code>__udp_is_mcast_sock()</code> keeps those that fit: bound to the group or to any address, not bound to another device, and joined to this group with this sender allowed (<code>ip_mc_sf_allow()</code>).</p><p>Every matching socket gets the datagram: the first one the original <code>sk_buff</code>, the others clones that share the same data. So two programs listening to the same group each get their own copy.</p>",
    uk: "<p>Маршрут позначений як multicast, тож <code>udp_rcv()</code> передає датаграму в <code>__udp4_lib_mcast_deliver()</code>. Вона перебирає всі сокети, прив’язані до порту призначення, а <code>__udp_is_mcast_sock()</code> залишає ті, що підходять: прив’язані до групи чи до будь-якої адреси, не прив’язані до іншого пристрою, і підписані на цю групу з дозволом для цього відправника (<code>ip_mc_sf_allow()</code>).</p><p>Кожен відповідний сокет отримує датаграму: перший — оригінальний <code>sk_buff</code>, інші — клони, що ділять ті самі дані. Тож дві програми, які слухають одну групу, отримують кожна свою копію.</p>",
  },
  diff: {
    en: "<b>5.10 → 7.3.</b> The path is the same; in 5.10 the multicast branch is taken inside <code>__udp4_lib_rcv()</code>, which 7.3 folded into <code>udp_rcv()</code> together with removing UDP-Lite.",
    uk: "<b>5.10 → 7.3.</b> Шлях той самий; у 5.10 гілку multicast обирає <code>__udp4_lib_rcv()</code>, яку 7.3 влило в <code>udp_rcv()</code> разом із прибиранням UDP-Lite.",
  },
};

const R_INPUT: Step = {
  l: "ip", fn: "ip_mr_input()", data: "IP", f: F_ALL,
  t: { en: "Look the group up in the multicast cache", uk: "Пошук групи в multicast-кеші" },
  br: [
    [{ en: "entry found", uk: "запис є" }, { en: "forward", uk: "пересилати" },
      { en: "The multicast forwarding cache has an entry for this (source, group): the packet goes on to <code>ip_mr_forward()</code>.", uk: "У кеші multicast-пересилання є запис для цієї пари (джерело, група): пакет іде далі в <code>ip_mr_forward()</code>." }],
    [{ en: "no entry yet", uk: "запису ще нема" }, { en: "ask the daemon, wait", uk: "спитати демона, чекати" },
      { en: "<p>In this case the cache has no entry for this (source, group) yet. <code>ipmr_cache_unresolved()</code> creates a temporary one, queues the packet on it (at most three packets; more are dropped) and sends an <code>IGMPMSG_NOCACHE</code> message to the routing daemon through its socket.</p><p>When the daemon adds the route with <code>MRT_ADD_MFC</code>, the waiting packets are forwarded and the path continues as usual. If nothing arrives within 10 seconds, they are dropped.</p>",
        uk: "<p>У цьому випадку в кеші ще нема запису для цієї пари (джерело, група). <code>ipmr_cache_unresolved()</code> створює тимчасовий запис, ставить на нього пакет у чергу (щонайбільше три пакети; решта відкидається) і шле демону маршрутизації повідомлення <code>IGMPMSG_NOCACHE</code> через його сокет.</p><p>Коли демон додає маршрут через <code>MRT_ADD_MFC</code>, пакети з черги пересилаються, і шлях іде далі як зазвичай. Якщо за 10 секунд нічого не прийде, їх відкидають.</p>" }],
  ],
  brPick: 0,
  d: {
    en: "<p><code>ip_mr_input()</code> looks the packet up in the multicast forwarding cache, first by (source, group) with <code>ipmr_cache_find()</code>, then by (any source, group). Unlike unicast routing, the key includes the sender: different sources of the same group can be routed differently.</p><p>If the router itself has joined the group, it first makes a clone and delivers it locally with <code>ip_local_deliver()</code>; the original goes on to be forwarded.</p>",
    uk: "<p><code>ip_mr_input()</code> шукає пакет у кеші multicast-пересилання: спершу за парою (джерело, група) через <code>ipmr_cache_find()</code>, потім за (будь-яке джерело, група). На відміну від unicast-маршрутизації, ключ включає відправника: різні джерела однієї групи можна маршрутизувати по-різному.</p><p>Якщо роутер сам підписаний на групу, він спершу робить клон і доставляє його локально через <code>ip_local_deliver()</code>; оригінал іде на пересилання.</p>",
  },
};

const R_FWD: Step = {
  l: "ip", fn: "ip_mr_forward()", data: "IP", f: F_ALL,
  t: { en: "Check the arrival interface, pick the outputs", uk: "Перевірка вхідного інтерфейсу, вибір виходів" },
  br: [
    [{ en: "expected interface", uk: "очікуваний інтерфейс" }, { en: "copies go out", uk: "копії йдуть далі" },
      { en: "The packet arrived on the interface the route expects: copies go to the outgoing interfaces.", uk: "Пакет прийшов на той інтерфейс, який очікує маршрут: копії йдуть на вихідні інтерфейси." }],
    [{ en: "wrong interface", uk: "не той інтерфейс" }, { en: "not forwarded", uk: "не пересилається" },
      { en: "<p>In this case the packet arrived on a different interface than the route expects. That usually means a loop or a second path, so it is not forwarded. The entry’s <code>wrong_if</code> counter grows (the “Wrong” column in <code>/proc/net/ip_mr_cache</code>), and the daemon may get an <code>IGMPMSG_WRONGVIF</code> message, which PIM uses to sort out which router should forward.</p>",
        uk: "<p>У цьому випадку пакет прийшов не на той інтерфейс, який очікує маршрут. Зазвичай це петля або другий шлях, тож він не пересилається. Зростає лічильник запису <code>wrong_if</code> (колонка «Wrong» у <code>/proc/net/ip_mr_cache</code>), а демон може отримати повідомлення <code>IGMPMSG_WRONGVIF</code>, з яким PIM з’ясовує, який роутер має пересилати.</p>" }, "end"],
  ],
  brPick: 0,
  d: {
    en: "<p>Every cache entry names the one interface its traffic must arrive on. <code>ip_mr_forward()</code> checks that first: this protects against loops, a bit like reverse-path filtering for unicast.</p><p>Then it goes through the outgoing interfaces of the entry. Each has a TTL threshold, and a copy goes out only where the packet’s TTL is above it; this lets an administrator keep a group inside a site. Every interface except the last gets a clone; the last one gets the original.</p>",
    uk: "<p>Кожен запис кешу називає один інтерфейс, на який мусить приходити його трафік. <code>ip_mr_forward()</code> перевіряє це першим: це захист від петель, трохи схожий на reverse-path filtering для unicast.</p><p>Потім вона проходить вихідні інтерфейси запису. Кожен має поріг TTL, і копія йде лише туди, де TTL пакета більший за поріг; так адміністратор може тримати групу в межах сайту. Кожен інтерфейс, крім останнього, отримує клон; останній — оригінал.</p>",
  },
};

const R_XMIT: Step = {
  l: "ip", fn: "ipmr_queue_fwd_xmit() → ipmr_prepare_xmit()", k510: { fn: "ipmr_queue_xmit()" }, data: "IP", f: F_ALL, hook: "FORWARD",
  t: { en: "Each copy: TTL, MTU and the FORWARD hook", uk: "Кожна копія: TTL, MTU і хук FORWARD" },
  d: {
    en: "<p>For each outgoing interface the copy gets an output route to that interface (<code>ip_route_output_ports()</code>). If it is larger than the interface MTU and has DF set, it is dropped and counted in <code>FragFails</code>; unlike unicast forwarding, no ICMP “fragmentation needed” is sent back. Then <code>ip_decrease_ttl()</code> decrements the TTL.</p><p>The copy passes the <code>NF_INET_FORWARD</code> hook, the <b>FORWARD</b> chain, just like forwarded unicast. <code>ipmr_forward_finish()</code> counts it in <code>OutForwDatagrams</code> and sends it on with <code>dst_output()</code>.</p>",
    uk: "<p>Для кожного вихідного інтерфейсу копія отримує вихідний маршрут на цей інтерфейс (<code>ip_route_output_ports()</code>). Якщо вона більша за MTU інтерфейсу й має DF, її відкидають і рахують у <code>FragFails</code>; на відміну від unicast-пересилання, ICMP «fragmentation needed» назад не шлеться. Потім <code>ip_decrease_ttl()</code> зменшує TTL.</p><p>Копія проходить хук <code>NF_INET_FORWARD</code>, ланцюжок <b>FORWARD</b>, як і переслений unicast. <code>ipmr_forward_finish()</code> рахує її в <code>OutForwDatagrams</code> і відправляє далі через <code>dst_output()</code>.</p>",
  },
  diff: {
    en: "<b>5.10 → 7.3.</b> The same work; 5.10 does it all in <code>ipmr_queue_xmit()</code>, while 7.3 splits it into <code>ipmr_prepare_xmit()</code> (route, MTU, TTL) and <code>ipmr_queue_fwd_xmit()</code> (the FORWARD hook), with a separate <code>ipmr_queue_output_xmit()</code> for multicast the router sends itself.",
    uk: "<b>5.10 → 7.3.</b> Робота та сама; 5.10 робить усе в <code>ipmr_queue_xmit()</code>, а 7.3 ділить на <code>ipmr_prepare_xmit()</code> (маршрут, MTU, TTL) і <code>ipmr_queue_fwd_xmit()</code> (хук FORWARD), з окремою <code>ipmr_queue_output_xmit()</code> для multicast, який роутер шле сам.",
  },
};

const R_OUT: Step = {
  l: "ip", fn: "dst_output() → ip_mc_output()", data: "IP", f: F_ALL, hook: "POST_ROUTING",
  t: { en: "Multicast output and POST_ROUTING", uk: "Вихід multicast і POST_ROUTING" },
  d: {
    en: "<p>An output route to a group address uses <code>ip_mc_output()</code> instead of <code>ip_output()</code>. If the router is itself a member of the group on the outgoing interface, it loops a copy back to its own sockets; a copy with TTL 0 never leaves the host.</p><p>Then the packet passes the <code>NF_INET_POST_ROUTING</code> hook and continues to <code>ip_finish_output()</code>, like any outgoing packet.</p>",
    uk: "<p>Вихідний маршрут на адресу групи використовує <code>ip_mc_output()</code> замість <code>ip_output()</code>. Якщо роутер сам член групи на вихідному інтерфейсі, він повертає копію власним сокетам; копія з TTL 0 ніколи не виходить за межі хоста.</p><p>Потім пакет проходить хук <code>NF_INET_POST_ROUTING</code> і йде далі в <code>ip_finish_output()</code>, як будь-який вихідний пакет.</p>",
  },
};

const R_NEIGH: Step = {
  l: "link", fn: "ip_finish_output2() → neigh_output()", hdr: ALL, data: "ETH", f: F_ALL,
  t: { en: "No ARP for a group", uk: "Для групи ARP не потрібен" },
  d: {
    en: "<p>A group has no single owner to ask, so there is no ARP. When the neighbour entry for a multicast address is created, <code>arp_constructor()</code> marks it <code>NUD_NOARP</code> and computes the MAC right away with <code>arp_mc_map()</code>: 01:00:5e plus the low 23 bits of the group. <code>neigh_hh_output()</code> then puts the cached Ethernet header, with this router’s MAC as the source, in front of the packet.</p>",
    uk: "<p>У групи нема одного власника, якого можна спитати, тож ARP нема. Коли створюється запис сусіда для multicast-адреси, <code>arp_constructor()</code> позначає його <code>NUD_NOARP</code> і одразу обчислює MAC через <code>arp_mc_map()</code>: 01:00:5e плюс молодші 23 біти групи. Потім <code>neigh_hh_output()</code> ставить перед пакетом закешований Ethernet-заголовок із MAC цього роутера як відправника.</p>",
  },
};

const MC_STEPS: Step[] = [M_WIRE, M_NIC, ...IN_LOWER.slice(2), mcRoute(0), I_UPPER[1], M_UDP, I_SOCK.udp, I_APP];
const MCROUTE_STEPS: Step[] = [
  M_WIRE, R_NIC, ...IN_LOWER.slice(2), mcRoute(1), R_INPUT, R_FWD, R_XMIT, R_OUT, F_MID[4], R_NEIGH, ...OUT_LINK, F_MID[F_MID.length - 1],
];

/* ---------------- BRIDGE AND TC REDIRECT (CONTAINERS) ---------------- */
// Continuations of Receive from netif_receive_skb(): a frame taken by a Linux bridge (Docker bridge, bridge CNIs) and a
// frame redirected by a tc BPF program (Cilium-style). Both end in a container's network namespace behind a veth pair.
// Not covered by the paper; built from net/bridge/, net/core/dev.c, net/core/filter.c and drivers/net/veth.c in 5.10 and 7.3.

const CT_SCOPE: Txt = {
  en: "<b>Beyond the paper.</b> The paper doesn’t follow this path. It is built from <code>net/bridge/</code>, <code>net/core/dev.c</code>, <code>net/core/filter.c</code> and <code>drivers/net/veth.c</code> in kernels 5.10 and 7.3.",
  uk: "<b>Поза статтею.</b> Стаття цей шлях не простежує. Його зібрано за кодом <code>net/bridge/</code>, <code>net/core/dev.c</code>, <code>net/core/filter.c</code> і <code>drivers/net/veth.c</code> ядер 5.10 і 7.3.",
};

const B_NIC: Step = {
  l: "nic", fn: "bridge port in promiscuous mode, DMA → RX ring, IRQ", raw: true, q: "rxring",
  t: { en: "A bridge port takes frames for other MACs too", uk: "Порт bridge бере кадри і для чужих MAC" },
  d: {
    en: "<p>This interface is a port of a Linux bridge (for example <code>docker0</code> or <code>cni0</code>, with the host’s NIC or the containers’ veth ends as ports). When <code>br_add_if()</code> added it, it registered <code>br_handle_frame()</code> as the interface’s <code>rx_handler</code> and, in the usual case, put the card into promiscuous mode: a bridge must accept frames addressed to the MACs behind it, not only its own.</p><p>The rest is the same as for any frame: FCS check, DMA into the <b>RX ring</b>, an interrupt.</p>",
    uk: "<p>Цей інтерфейс — порт Linux bridge (наприклад, <code>docker0</code> чи <code>cni0</code>, де портами є карта хоста або veth-кінці контейнерів). Коли <code>br_add_if()</code> додавав його, він зареєстрував <code>br_handle_frame()</code> як <code>rx_handler</code> інтерфейсу і, у звичайному випадку, перевів карту в promiscuous mode: bridge має приймати кадри для MAC-адрес за ним, а не лише для своєї.</p><p>Далі все як для будь-якого кадру: перевірка FCS, DMA в <b>RX ring</b>, переривання.</p>",
  },
  note: CT_SCOPE,
};

const B_HANDLE: Step = {
  l: "link", fn: "br_handle_frame()", data: "IP", f: ["mac", "network"],
  t: { en: "The bridge takes the frame", uk: "Bridge забирає кадр" },
  d: {
    en: "<p><code>__netif_receive_skb_core()</code> calls the port’s <code>rx_handler</code>, <code>br_handle_frame()</code>, and the frame now belongs to the bridge; it won’t go to <code>ip_rcv()</code> of this interface. Link-local frames (01:80:c2:00:00:0x, such as STP) are handled separately. The port must be in the forwarding or learning state; a learning port only records MACs and drops the frame.</p><p>Then the bridge <b>PREROUTING</b> hook runs: nftables tables of the <code>bridge</code> family or ebtables. If <code>br_netfilter</code> is loaded and <code>net.bridge.bridge-nf-call-iptables = 1</code>, IPv4 packets also pass the regular iptables chains here, which is what Kubernetes relies on to apply Service rules to traffic between pods on one bridge.</p>",
    uk: "<p><code>__netif_receive_skb_core()</code> викликає <code>rx_handler</code> порту, <code>br_handle_frame()</code>, і кадр тепер належить bridge; до <code>ip_rcv()</code> цього інтерфейсу він не дійде. Link-local кадри (01:80:c2:00:00:0x, як-от STP) обробляються окремо. Порт має бути в стані forwarding або learning; порт у стані learning лише запам’ятовує MAC і відкидає кадр.</p><p>Далі хук bridge <b>PREROUTING</b>: таблиці nftables сімейства <code>bridge</code> або ebtables. Якщо завантажено <code>br_netfilter</code> і <code>net.bridge.bridge-nf-call-iptables = 1</code>, IPv4-пакети тут проходять і звичайні ланцюжки iptables; на цьому тримаються правила Service у Kubernetes для трафіку між подами на одному bridge.</p>",
  },
};

const B_FINISH: Step = {
  l: "link", fn: "br_handle_frame_finish()", data: "IP", f: ["mac", "network"],
  t: { en: "Learn the sender, look up the receiver", uk: "Запам’ятати відправника, знайти одержувача" },
  br: [
    [{ en: "known MAC", uk: "відома MAC" }, { en: "forward to its port", uk: "переслати на її порт" },
      { en: "The destination MAC is in the forwarding table on another port: the frame goes to that port only.", uk: "MAC одержувача є в таблиці пересилання на іншому порту: кадр іде лише на цей порт." }],
    [{ en: "unknown MAC", uk: "невідома MAC" }, { en: "flood", uk: "розіслати всім" },
      { en: "<p>In this case the bridge hasn’t seen this MAC yet (or the frame is broadcast or multicast). <code>br_flood()</code> sends a copy out of every port except the one it came in on, like a switch would; each copy then takes the same steps as a forwarded frame. Once the receiver answers, the bridge learns its port and later frames go only there.</p>",
        uk: "<p>У цьому випадку bridge ще не бачив цю MAC (або кадр broadcast чи multicast). <code>br_flood()</code> шле копію на кожен порт, крім того, звідки кадр прийшов, як зробив би комутатор; кожна копія далі проходить ті самі кроки, що й переслений кадр. Щойно одержувач відповість, bridge запам’ятає його порт, і наступні кадри підуть лише туди.</p>" }],
    [{ en: "the bridge’s own MAC", uk: "MAC самого bridge" }, { en: "up the stack as br0", uk: "нагору як br0" },
      { en: "<p>In this case the frame is addressed to the bridge itself, for example a container talking to the host. <code>br_pass_frame_up()</code> runs the bridge <b>INPUT</b> hook, sets <code>skb->dev</code> to the bridge device (<code>br0</code>, <code>docker0</code>) and calls <code>netif_receive_skb()</code> again. The packet continues as a normal Receive, as if it had arrived on the bridge interface.</p>",
        uk: "<p>У цьому випадку кадр адресований самому bridge, наприклад контейнер звертається до хоста. <code>br_pass_frame_up()</code> проганяє хук bridge <b>INPUT</b>, ставить <code>skb->dev</code> на bridge-пристрій (<code>br0</code>, <code>docker0</code>) і знову викликає <code>netif_receive_skb()</code>. Пакет іде далі звичайним Прийомом, ніби прийшов на інтерфейс bridge.</p>" }, { mode: "ingress", fn: "ip_rcv()" }],
  ],
  brPick: 0,
  d: {
    en: "<p>The bridge works like a switch. With VLAN filtering on, it first checks that the frame’s VLAN is allowed on this port. Then it learns: <code>br_fdb_update()</code> records that the sender’s MAC lives behind this port. Then <code>br_fdb_find_rcu()</code> looks the destination MAC up in the same forwarding table to decide where the frame goes.</p><p>All of this happens at layer 2: the IP header isn’t read for the decision, and nothing in the packet changes.</p>",
    uk: "<p>Bridge працює як комутатор. Якщо ввімкнено VLAN filtering, спершу він перевіряє, що VLAN кадру дозволений на цьому порту. Потім запам’ятовує: <code>br_fdb_update()</code> записує, що MAC відправника живе за цим портом. Далі <code>br_fdb_find_rcu()</code> шукає MAC одержувача в тій самій таблиці пересилання, щоб вирішити, куди йде кадр.</p><p>Усе це відбувається на рівні 2: для рішення IP-заголовок не читається, і в пакеті нічого не змінюється.</p>",
  },
};

const B_FWD: Step = {
  l: "link", fn: "br_forward() → __br_forward()", hdr: ALL, data: "ETH", f: ["mac", "network"],
  t: { en: "Out of the bridge port", uk: "Вихід через порт bridge" },
  d: {
    en: "<p>The frame passes the bridge <b>FORWARD</b> hook (with <code>br_netfilter</code>, the iptables FORWARD chain too), then <code>br_forward_finish()</code> runs the bridge <b>POSTROUTING</b> hook. <code>br_dev_queue_push_xmit()</code> moves <code>data</code> back to the Ethernet header, which is still there unchanged, and calls <code>dev_queue_xmit()</code> on the outgoing port.</p><p>Unlike IP forwarding, nothing is decremented or rewritten: TTL, MACs and checksums stay the same.</p>",
    uk: "<p>Кадр проходить хук bridge <b>FORWARD</b> (з <code>br_netfilter</code> — і ланцюжок FORWARD iptables), потім <code>br_forward_finish()</code> проганяє хук bridge <b>POSTROUTING</b>. <code>br_dev_queue_push_xmit()</code> повертає <code>data</code> на Ethernet-заголовок, який так і лежить незмінним, і викликає <code>dev_queue_xmit()</code> на вихідному порту.</p><p>На відміну від IP-пересилання, нічого не зменшується й не переписується: TTL, MAC і контрольні суми лишаються тими самими.</p>",
  },
};

const B_VETH: Step = {
  l: "link", fn: "dev_queue_xmit() → veth_xmit()", hdr: ALL, data: "ETH", f: ["mac", "network"],
  t: { en: "Through the veth pair into the container", uk: "Через veth-пару в контейнер" },
  d: {
    en: "<p>The outgoing port is the host end of a veth pair; the other end is <code>eth0</code> inside the container’s network namespace. A veth device has no qdisc (<code>noqueue</code>), so <code>dev_queue_xmit()</code> calls the driver straight away: <code>veth_xmit()</code>.</p><p>There is no wire: <code>veth_forward_skb()</code> hands the same <code>sk_buff</code> to the peer. <code>__dev_forward_skb()</code> scrubs what must not cross namespaces (marks, conntrack state, the route) and runs <code>eth_type_trans()</code> for the peer device, and the packet is put on the CPU’s backlog queue (<code>enqueue_to_backlog()</code>), as if a card had received it. The NET_RX softirq picks it up there.</p>",
    uk: "<p>Вихідний порт — це кінець veth-пари з боку хоста; інший кінець — <code>eth0</code> у мережевому просторі імен контейнера. Пристрій veth не має qdisc (<code>noqueue</code>), тож <code>dev_queue_xmit()</code> одразу викликає драйвер: <code>veth_xmit()</code>.</p><p>Лінії тут нема: <code>veth_forward_skb()</code> передає той самий <code>sk_buff</code> парі. <code>__dev_forward_skb()</code> очищає те, що не повинно переходити між просторами імен (мітки, стан conntrack, маршрут), і викликає <code>eth_type_trans()</code> для пристрою-пари, а пакет стає в чергу backlog процесора (<code>enqueue_to_backlog()</code>), ніби його прийняла карта. Звідти його забирає softirq NET_RX.</p>",
  },
  diff: {
    en: "<b>5.10 → 7.3.</b> The same path; 5.10 queues the packet with <code>netif_rx()</code>, 7.3 with <code>__netif_rx()</code>. With an XDP program on the veth, both use the veth’s own NAPI instead.",
    uk: "<b>5.10 → 7.3.</b> Шлях той самий; 5.10 ставить пакет у чергу через <code>netif_rx()</code>, 7.3 — через <code>__netif_rx()</code>. Якщо на veth є XDP-програма, обидва натомість використовують власний NAPI veth.",
  },
};

const B_POD: Step = {
  l: "link", fn: "netif_receive_skb() → ip_rcv() in the container", data: "IP", f: ["mac", "network"],
  t: { en: "Receive again, inside the container", uk: "Знову прийом, уже в контейнері" },
  d: {
    en: "<p>The packet now arrives on <code>eth0</code> inside the container’s network namespace, and from here it takes the normal Receive path: <code>netif_receive_skb()</code>, <code>ip_rcv()</code>, the routing decision, INPUT, TCP or UDP, and the container’s socket.</p><p>Everything on that path is per namespace: the container has its own interfaces, routing table, netfilter rules and sockets. The kernel and the <code>sk_buff</code> are the same; only the namespace it is processed in has changed.</p>",
    uk: "<p>Тепер пакет приходить на <code>eth0</code> у мережевому просторі імен контейнера, і далі йде звичайним шляхом Прийому: <code>netif_receive_skb()</code>, <code>ip_rcv()</code>, рішення маршрутизації, INPUT, TCP чи UDP і сокет контейнера.</p><p>Усе на цьому шляху своє для кожного простору імен: у контейнера власні інтерфейси, таблиця маршрутизації, правила netfilter і сокети. Ядро й <code>sk_buff</code> ті самі; змінився лише простір імен, у якому пакет обробляється.</p>",
  },
};

const T_TC: Step = {
  l: "link", fn: "sch_handle_ingress() → tcx_run()", k510: { fn: "sch_handle_ingress() → tcf_classify_ingress()" }, data: "IP", f: ["mac", "network"],
  t: { en: "A tc BPF program decides", uk: "Вирішує BPF-програма tc" },
  br: [
    [{ en: "redirect", uk: "перенаправити" }, "TC_ACT_REDIRECT",
      { en: "The program asked for the packet to be sent somewhere else: <code>skb_do_redirect()</code> does it.", uk: "Програма попросила відправити пакет деінде: це робить <code>skb_do_redirect()</code>." }],
    [{ en: "pass", uk: "пропустити" }, "TC_ACT_OK",
      { en: "<p>In this case the program lets the packet continue. <code>__netif_receive_skb_core()</code> goes on with the netfilter <code>ingress</code> hook, VLAN, <code>rx_handler()</code> and finally <code>ip_rcv()</code>: a normal Receive.</p>",
        uk: "<p>У цьому випадку програма пропускає пакет далі. <code>__netif_receive_skb_core()</code> продовжує з netfilter-хуком <code>ingress</code>, VLAN, <code>rx_handler()</code> і врешті <code>ip_rcv()</code>: звичайний Прийом.</p>" }, { mode: "ingress", fn: "ip_rcv()" }],
    [{ en: "drop", uk: "відкинути" }, "TC_ACT_SHOT",
      { en: "<p>In this case the program drops the packet, for example as a network policy or DDoS filter. It is freed right here, before netfilter and the IP layer ever see it.</p>",
        uk: "<p>У цьому випадку програма відкидає пакет, наприклад як мережева політика чи фільтр DDoS. Його звільняють прямо тут, ще до netfilter і IP-рівня.</p>" }, "end"],
  ],
  brPick: 0,
  d: {
    en: "<p>The interface has a tc ingress hook with a BPF program attached, the way CNIs such as Cilium handle pod traffic. <code>sch_handle_ingress()</code> runs it inside <code>__netif_receive_skb_core()</code>, after the sniffers and before netfilter and IP. The program can read and rewrite the packet and returns a verdict: let it through, drop it, or redirect it.</p>",
    uk: "<p>На інтерфейсі є tc-хук ingress з BPF-програмою, як це роблять CNI на кшталт Cilium для трафіку подів. <code>sch_handle_ingress()</code> запускає її всередині <code>__netif_receive_skb_core()</code>, після сниферів і до netfilter та IP. Програма може читати й змінювати пакет і повертає вердикт: пропустити, відкинути чи перенаправити.</p>",
  },
  diff: {
    en: "<b>5.10 → 7.3.</b> In 5.10 BPF programs are classifiers in a clsact qdisc, run by <code>tcf_classify_ingress()</code>. 7.3 first runs programs attached through <b>tcx</b> links (<code>tcx_run()</code>), several per device, then classic tc filters.",
    uk: "<b>5.10 → 7.3.</b> У 5.10 BPF-програми — це класифікатори в qdisc clsact, їх запускає <code>tcf_classify_ingress()</code>. 7.3 спершу запускає програми, прикріплені через <b>tcx</b> links (<code>tcx_run()</code>), кілька на пристрій, а потім класичні фільтри tc.",
  },
  note: CT_SCOPE,
};

const T_REDIR: Step = {
  l: "link", fn: "skb_do_redirect()", data: "IP", f: ["mac", "network"],
  t: { en: "Straight into the container", uk: "Одразу в контейнер" },
  br: [
    ["bpf_redirect_peer()", { en: "into the container’s namespace", uk: "у простір імен контейнера" },
      { en: "The packet is handed to the veth peer inside the container without crossing the veth pair.", uk: "Пакет передається veth-парі всередині контейнера, не проходячи через саму veth-пару." }],
    ["bpf_redirect()", { en: "to another device", uk: "на інший пристрій" },
      { en: "<p>In this case the program redirected the packet to another device. With <code>BPF_F_INGRESS</code> it is received on that device as if it had arrived there (through the backlog queue). Without it, it is transmitted out of that device with <code>dev_queue_xmit()</code>, for example out of the host end of a veth pair, after which it goes through <code>veth_xmit()</code> like a frame from a bridge.</p>",
        uk: "<p>У цьому випадку програма перенаправила пакет на інший пристрій. З <code>BPF_F_INGRESS</code> він приймається на тому пристрої, ніби прийшов туди (через чергу backlog). Без нього — відправляється з того пристрою через <code>dev_queue_xmit()</code>, наприклад з хостового кінця veth-пари, і далі йде через <code>veth_xmit()</code>, як кадр із bridge.</p>" }],
  ],
  brPick: 0,
  d: {
    en: "<p>The program called <code>bpf_redirect_peer()</code> with the host end of the container’s veth pair. <code>skb_do_redirect()</code> takes its peer, the container’s <code>eth0</code> (it must be in another network namespace), sets <code>skb->dev</code> to it and returns <code>-EAGAIN</code>.</p><p>That makes <code>__netif_receive_skb_core()</code> start another round with the new device. The packet skips <code>veth_xmit()</code> and the backlog queue and continues inside the container in the same softirq run, which is why this is the fast path for pod traffic.</p>",
    uk: "<p>Програма викликала <code>bpf_redirect_peer()</code> з хостовим кінцем veth-пари контейнера. <code>skb_do_redirect()</code> бере його пару, <code>eth0</code> контейнера (вона має бути в іншому мережевому просторі імен), ставить на неї <code>skb->dev</code> і повертає <code>-EAGAIN</code>.</p><p>Через це <code>__netif_receive_skb_core()</code> починає ще одне коло вже з новим пристроєм. Пакет оминає <code>veth_xmit()</code> і чергу backlog і продовжує всередині контейнера в тому самому проході softirq; тому це швидкий шлях для трафіку подів.</p>",
  },
};

const BRIDGE_STEPS: Step[] = [IN_LOWER[0], B_NIC, IN_LOWER[2], netif(3), B_HANDLE, B_FINISH, B_FWD, B_VETH, B_POD];
const TCREDIR_STEPS: Step[] = [...IN_LOWER.slice(0, 3), netif(1), T_TC, T_REDIR, B_POD];

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
  "__ip_queue_xmit()": [C_ROUTE_OUT, c("nstat -az IpOutRequests IpOutNoRoutes", "IP packets sent (in 5.10 this includes forwarded ones, in newer kernels only those created here) and those dropped for lack of a route", "відправлені IP-пакети (у 5.10 враховуються й переслані, у новіших ядрах — лише створені тут) і відкинуті через відсутність маршруту")],
  "udp_sendmsg()": [C_SS_UDP, C_STRACE_W],
  "ip_route_output_flow()": [C_ROUTE_OUT, c("perf trace -e fib:fib_table_lookup", "each FIB lookup and its result", "кожен пошук у FIB і його результат")],
  "ip_make_skb() / ip_append_data()": [C_SS_UDP],
  "udp_send_skb()": [c("nstat -az UdpOutDatagrams UdpSndbufErrors", "datagrams sent and sends that failed for lack of buffer space", "відправлені датаграми й відправки, що не вдалися через брак буфера")],
  "ip_local_out() → dst_output()": [c("iptables -L OUTPUT -v -n", "OUTPUT chain rules with packet and byte counters", "правила ланцюжка OUTPUT з лічильниками пакетів і байтів"), C_NFT],
  "ip_output()": [c("iptables -t nat -L POSTROUTING -v -n", "SNAT/masquerade rules with counters", "правила SNAT/masquerade з лічильниками"), C_CONNTRACK],
  "ip_finish_output()": [c("tracepath -n 1.1.1.1", "the path MTU to the host, hop by hop", "MTU шляху до хоста, хоп за хопом"), c("nstat -az IpFragCreates IpFragFails", "fragments created and packets that couldn’t be fragmented", "створені фрагменти й пакети, які не вдалося фрагментувати")],
  "ip_finish_output2() → neigh_output()": [c("ip neigh show", "the neighbour (ARP) cache: REACHABLE, STALE, INCOMPLETE, FAILED", "кеш сусідів (ARP): REACHABLE, STALE, INCOMPLETE, FAILED"), c("perf trace -e 'neigh:*'", "neighbour entries being created, updated by ARP replies and changed by timers (REACHABLE → STALE → …)", "створення записів сусідів, оновлення ARP-відповідями й зміни за таймером (REACHABLE → STALE → …)")],
  "dev_queue_xmit()": [c("tc -s qdisc show dev eth0", "the qdisc with sent packets, drops, overlimits and backlog", "qdisc із відправленими пакетами, дропами, overlimits і backlog"), c("perf trace -e net:net_dev_queue", "every packet entering the device queue", "кожен пакет, що стає в чергу пристрою")],
  "__qdisc_run() → ndo_start_xmit": [c("ethtool -g eth0", "TX/RX ring sizes: current and maximum", "розміри TX/RX ring: поточні й максимальні"), c("perf trace -e net:net_dev_xmit", "each packet handed to the driver, with the result code", "кожен пакет, переданий драйверу, з кодом результату")],
  "DMA + IRQ": [c("grep eth0 /proc/interrupts", "interrupt counts per CPU for the card’s queues (in a VM with a virtio card they are named virtioN-input/output instead)", "кількість переривань по процесорах для черг карти (у віртуалці з virtio-картою вони називаються virtioN-input/output)"), C_ETHTOOL_S],
  "Ethernet frame": [C_ETHTOOL, C_LINK, C_TCPDUMP],
  "wire-in": [C_ETHTOOL, C_LINK],
  "FCS, MAC filter, DMA → RX ring, IRQ": [C_ETHTOOL_S, c("ethtool -g eth0", "RX ring size; a small ring overflows under bursts", "розмір RX ring; малий ring переповнюється під сплесками"), C_LINK],
  "IRQ → NAPI poll → eth_type_trans()": [c("cat /proc/net/softnet_stat", "per CPU, in hex: packets processed, dropped (backlog full), time_squeeze (the softirq used up its budget or time with packets still waiting)", "по процесорах, у hex: оброблені пакети, відкинуті (backlog повний), time_squeeze (softirq вичерпав бюджет чи час, а пакети ще чекали)"), c("grep eth0 /proc/interrupts", "which CPUs handle the card’s interrupts (virtioN-input in a VM)", "які процесори обробляють переривання карти (у віртуалці — virtioN-input)"), c("ethtool -k eth0 | grep generic-receive-offload", "whether GRO is on", "чи ввімкнено GRO")],
  "netif_receive_skb()": [C_TCPDUMP, c("tc -s filter show dev eth0 ingress", "tc ingress filters and BPF programs with their counters", "фільтри й BPF-програми tc ingress з лічильниками"), c("perf trace -e net:netif_receive_skb", "every packet entering the stack", "кожен пакет, що входить у стек")],
  "ip_rcv()": [c("nstat -az IpInReceives IpInHdrErrors", "IP packets received and those with bad headers", "отримані IP-пакети й ті, що мають зіпсований заголовок"), C_CONNTRACK, C_DROPS],
  "ip_rcv_finish() → dst_input()": [c("ip route get 1.1.1.1 from 10.0.0.5 iif eth0", "the routing decision for a packet arriving on eth0 from 10.0.0.5: “local” if the address is ours, a gateway if it would be forwarded, “No route to host” if forwarding is off", "рішення маршрутизації для пакета, що прийшов на eth0 від 10.0.0.5: «local», якщо адреса наша, шлюз, якщо його переслали б, «No route to host», якщо пересилання вимкнене"), c("sysctl net.ipv4.ip_forward", "whether forwarding is enabled", "чи ввімкнене пересилання")],
  "ip_local_deliver()": [c("iptables -L INPUT -v -n", "INPUT chain rules with counters", "правила ланцюжка INPUT з лічильниками"), c("nstat -az IpInDelivers IpReasmFails", "packets delivered up the stack and failed reassemblies", "пакети, доставлені нагору, і невдалі збирання фрагментів")],
  "tcp_v4_rcv()": [c("ss -tan state syn-recv", "connections in the middle of a handshake", "з’єднання посеред handshake"), c("ss -tan state time-wait | wc -l", "how many connections sit in TIME_WAIT", "скільки з’єднань у TIME_WAIT"), c("nstat -az TcpExtListenOverflows TcpExtTCPBacklogDrop", "accept queue overflows and segments dropped from a full socket backlog", "переповнення черги accept і сегменти, відкинуті через повний backlog сокета")],
  "tcp_v4_do_rcv() → tcp_rcv_established()": [C_SS_TCP, c("nstat -az TcpExtTCPOFOQueue", "segments that arrived out of order and had to wait", "сегменти, що прийшли не по порядку й мусили чекати")],
  "udp_rcv() → __udp4_lib_rcv()": [c("nstat -az UdpInDatagrams UdpNoPorts UdpRcvbufErrors", "datagrams read by applications (counted on read, not on arrival), sent to closed ports, and dropped because the socket buffer was full", "датаграми, прочитані застосунками (рахуються при читанні, а не при надходженні), надіслані на закриті порти, і відкинуті через повний буфер сокета"), C_SS_UDP],
  "udp_rcv()": [c("nstat -az UdpInDatagrams UdpNoPorts UdpRcvbufErrors", "datagrams read by applications (counted on read, not on arrival), sent to closed ports, and dropped because the socket buffer was full", "датаграми, прочитані застосунками (рахуються при читанні, а не при надходженні), надіслані на закриті порти, і відкинуті через повний буфер сокета"), C_SS_UDP],
  "read() → sock_recvmsg() → tcp_recvmsg()": [C_SS_TCP, C_STRACE_R],
  "read() → tcp_recvmsg() → tcp_recvmsg_locked()": [C_SS_TCP, C_STRACE_R],
  "read() → udp_recvmsg()": [C_SS_UDP, C_STRACE_R],
  "buf": [C_STRACE_R],
  "Ethernet frame → 01:00:5e:01:02:03": [c("tcpdump -ni eth0 -e multicast", "multicast frames with their 01:00:5e… MAC addresses", "multicast-кадри з їхніми MAC 01:00:5e…")],
  "multicast MAC filter, DMA → RX ring, IRQ": [c("ip maddr show dev eth0", "groups the interface has joined and the multicast MACs the card is told to accept", "групи, на які підписаний інтерфейс, і multicast-MAC, які карта має приймати"), c("cat /proc/net/igmp", "joined groups per interface, with user counts and the IGMP version of the querier", "групи по інтерфейсах із кількістю користувачів і версією IGMP querier-а"), c("ip -s link show dev eth0", "the RX “mcast” column counts multicast packets received", "колонка RX «mcast» рахує отримані multicast-пакети")],
  "all-multicast mode, DMA → RX ring, IRQ": [c("ip link show dev eth0", "ALLMULTI among the flags once the interface is a multicast VIF", "ALLMULTI серед прапорців, коли інтерфейс став multicast VIF"), c("cat /proc/net/ip_mr_vif", "the interfaces (VIFs) the routing daemon registered, with packet and byte counters", "інтерфейси (VIF), які зареєстрував демон маршрутизації, з лічильниками пакетів і байтів")],
  "ip_mr_input()": [c("ip mroute show", "multicast routes: (source, group), incoming interface and outgoing interfaces", "multicast-маршрути: (джерело, група), вхідний і вихідні інтерфейси"), c("nstat -az IpExtInMcastPkts", "multicast packets received", "отримані multicast-пакети")],
  "ip_mr_forward()": [c("cat /proc/net/ip_mr_cache", "every cache entry with its packets, bytes and “Wrong” (arrived on the wrong interface)", "кожен запис кешу з пакетами, байтами й «Wrong» (прийшли не на той інтерфейс)")],
  "ipmr_queue_fwd_xmit() → ipmr_prepare_xmit()": [c("cat /proc/net/ip_mr_vif", "BytesOut and PktsOut per interface: copies sent out", "BytesOut і PktsOut по інтерфейсах: відправлені копії"), c("iptables -L FORWARD -v -n", "FORWARD rules with counters; multicast copies pass here too", "правила FORWARD з лічильниками; multicast-копії теж ідуть тут")],
  "bridge port in promiscuous mode, DMA → RX ring, IRQ": [c("bridge link show", "bridge ports, their bridge and STP state (forwarding, learning…)", "порти bridge, їхній bridge і стан STP (forwarding, learning…)"), c("ip -d link show dev eth0", "“promiscuity 1” and “bridge_slave” for a bridge port", "«promiscuity 1» і «bridge_slave» для порту bridge")],
  "br_handle_frame()": [c("nft list ruleset", "rules of the bridge family (and inet/ip families if br_netfilter sends bridged IPv4 through them)", "правила сімейства bridge (та inet/ip, якщо br_netfilter пускає через них IPv4 з bridge)"), c("sysctl net.bridge.bridge-nf-call-iptables", "whether bridged IPv4 also passes iptables (exists only when br_netfilter is loaded)", "чи проходить IPv4 з bridge ще й iptables (є лише з завантаженим br_netfilter)")],
  "br_handle_frame_finish()": [c("bridge fdb show br br0", "the bridge’s forwarding table: which MAC was learned on which port", "таблиця пересилання bridge: яку MAC вивчено на якому порту")],
  "br_forward() → __br_forward()": [c("ip -s link show master br0", "every port of the bridge with its packet counters", "кожен порт bridge з лічильниками пакетів")],
  "dev_queue_xmit() → veth_xmit()": [c("ip -d link show type veth", "veth devices, their qdisc (noqueue) and the network namespace of the peer (link-netnsid)", "veth-пристрої, їхній qdisc (noqueue) і простір імен пари (link-netnsid)"), c("ethtool -S veth1234", "peer_ifindex: the interface number of the other end", "peer_ifindex: номер інтерфейсу на іншому кінці")],
  "netif_receive_skb() → ip_rcv() in the container": [c("nsenter -t <PID> -n ip -s link", "the container’s own interfaces and counters (PID of a process in the container)", "власні інтерфейси й лічильники контейнера (PID процесу в контейнері)"), c("nsenter -t <PID> -n ss -tanp", "the container’s sockets", "сокети контейнера")],
  "sch_handle_ingress() → tcx_run()": [c("bpftool net show dev eth0", "BPF programs attached to the device: tc, tcx and XDP", "BPF-програми на пристрої: tc, tcx і XDP"), c("tc filter show dev eth0 ingress", "classic tc ingress filters, including BPF classifiers", "класичні фільтри tc ingress, зокрема BPF-класифікатори")],
  "skb_do_redirect()": [c("bpftool prog show", "loaded BPF programs; look for type sched_cls", "завантажені BPF-програми; шукай тип sched_cls")],
  "dst_output() → ip_mc_output()": [c("nstat -az IpExtOutMcastPkts", "multicast packets sent", "відправлені multicast-пакети")],
  "udp_rcv() → __udp4_lib_mcast_deliver()": [c("nstat -az UdpIgnoredMulti UdpInDatagrams", "multicast/broadcast datagrams no socket wanted, and datagrams read by applications", "multicast/broadcast-датаграми, яких не захотів жоден сокет, і датаграми, прочитані застосунками"), C_SS_UDP],
  "ip_forward()": [c("sysctl net.ipv4.ip_forward", "whether forwarding is enabled", "чи ввімкнене пересилання"), c("nstat -az IpForwDatagrams IpInHdrErrors", "forwarded packets, and drops such as expired TTL", "переслані пакети й дропи на кшталт вичерпаного TTL"), c("traceroute -n 1.1.1.1", "the TTL mechanism from the outside: every hop answers “time exceeded”", "механізм TTL ззовні: кожен хоп відповідає «time exceeded»")],
  "NF_HOOK(FORWARD) → ip_forward_finish()": [c("iptables -L FORWARD -v -n", "FORWARD chain rules with counters: did the packet get here?", "правила ланцюжка FORWARD з лічильниками: чи дійшов пакет сюди?"), C_NFT],
  "dst_output() → ip_output()": [c("iptables -t nat -L POSTROUTING -v -n", "SNAT/masquerade rules with counters", "правила SNAT/masquerade з лічильниками"), C_CONNTRACK],
};

export function buildSteps(mode: Mode, proto: Proto): Step[] {
  const list =
    mode === "egress" ? [...E_APP, ...(proto === "tcp" ? E_TCP : E_UDP), ...E_TAIL]
    : mode === "ingress" ? [...IN_LOWER, ...I_UPPER, ...(proto === "tcp" ? I_TCP : I_UDP), I_SOCK[proto], I_APP]
    : mode === "forward" ? [...IN_LOWER, ...F_MID]
    : mode === "multicast" ? MC_STEPS // multicast paths are UDP only
    : mode === "mcroute" ? MCROUTE_STEPS
    : mode === "bridge" ? BRIDGE_STEPS
    : TCREDIR_STEPS;
  return list.map((st) => ({ ...st, cmd: CMDS[st.raw ? "wire-in" : st.fn] }));
}
