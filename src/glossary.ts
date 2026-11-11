// Glossary: plain-language explanations for terms in step texts, with a link for further reading.
// Every link was checked to exist and to be about exactly this term (Wikipedia API / docs.kernel.org).
// Ukrainian Wikipedia is used only where an article exists (taken from the English article's langlinks).

import type { Lang, Tx } from "./i18n";

type Source = "wiki" | "kernel" | "man";

export interface Term {
  /** Regex alternatives, matched case-sensitively at word boundaries */
  re: string[];
  def: Tx;
  src: Source;
  url: string | Tx;
}

const wiki = (en: string, uk?: string): Tx => ({
  en: `https://en.wikipedia.org/wiki/${en}`,
  uk: uk ? `https://uk.wikipedia.org/wiki/${encodeURIComponent(uk.replace(/ /g, "_"))}` : `https://en.wikipedia.org/wiki/${en}`,
});
const kdoc = (path: string) => `https://docs.kernel.org/${path}`;

export const TERMS: Term[] = [
  {
    re: ["AF_INET"], src: "wiki", url: wiki("Berkeley_sockets", "Сокети Берклі"),
    def: {
      en: "Address family for IPv4. A socket created with AF_INET works with IP addresses and ports; the socket type picks TCP or UDP. IPv6 uses AF_INET6.",
      uk: "Сімейство адрес IPv4. Сокет з AF_INET працює з IP-адресами й портами; TCP чи UDP обирається типом сокета. Для IPv6 є AF_INET6.",
    },
  },
  {
    re: ["sk_buff"], src: "kernel", url: kdoc("networking/skbuff.html"),
    def: {
      en: "The kernel’s packet structure: metadata (device, protocol, header offsets) plus pointers into a data buffer. Headers are added and removed by moving those pointers, not by copying.",
      uk: "Структура пакета в ядрі: метадані (пристрій, протокол, зміщення заголовків) і вказівники в буфер даних. Заголовки додаються й знімаються зсувом вказівників, без копіювання.",
    },
  },
  {
    re: ["AF_PACKET"], src: "man", url: "https://man7.org/linux/man-pages/man7/packet.7.html",
    def: {
      en: "A socket type that receives raw link-layer frames, before the IP layer. This is how tcpdump and Wireshark capture traffic.",
      uk: "Тип сокета, що отримує сирі кадри канального рівня, ще до IP-рівня. Саме так tcpdump і Wireshark захоплюють трафік.",
    },
  },
  {
    re: ["AF_XDP"], src: "kernel", url: kdoc("networking/af_xdp.html"),
    def: {
      en: "A socket type that receives packets straight from an XDP program into user space, bypassing most of the network stack.",
      uk: "Тип сокета, що отримує пакети прямо з XDP-програми в user space, оминаючи більшу частину мережевого стека.",
    },
  },
  {
    re: ["MSS"], src: "wiki", url: wiki("Maximum_segment_size", "Maximum segment size"),
    def: {
      en: "Maximum Segment Size: the largest TCP payload in one segment, normally the MTU minus IP and TCP headers (1460 bytes on Ethernet).",
      uk: "Maximum Segment Size: найбільший обсяг даних TCP в одному сегменті, зазвичай MTU мінус заголовки IP і TCP (1460 байт в Ethernet).",
    },
  },
  {
    re: ["MTU"], src: "wiki", url: wiki("Maximum_transmission_unit", "MTU"),
    def: {
      en: "Maximum Transmission Unit: the largest IP packet a link can carry in one frame; 1500 bytes on standard Ethernet.",
      uk: "Maximum Transmission Unit: найбільший IP-пакет, який канал передає одним кадром; 1500 байт у звичайному Ethernet.",
    },
  },
  {
    re: ["TTL"], src: "wiki", url: wiki("Time_to_live", "Time to live"),
    def: {
      en: "Time To Live: a counter in the IP header that every router decrements. At zero the packet is dropped and the sender gets ICMP “time exceeded”, so packets can’t loop forever.",
      uk: "Time To Live: лічильник в IP-заголовку, який кожен роутер зменшує. На нулі пакет відкидається, а відправник отримує ICMP «time exceeded», тож пакети не ходять по колу вічно.",
    },
  },
  {
    re: ["ARP"], src: "wiki", url: wiki("Address_Resolution_Protocol", "ARP"),
    def: {
      en: "Address Resolution Protocol: finds the MAC address that belongs to an IPv4 address on the local network (“who has 10.0.0.1?”).",
      uk: "Address Resolution Protocol: знаходить MAC-адресу, що відповідає IPv4-адресі в локальній мережі («хто має 10.0.0.1?»).",
    },
  },
  {
    re: ["ICMP"], src: "wiki", url: wiki("Internet_Control_Message_Protocol", "ICMP"),
    def: {
      en: "Internet Control Message Protocol: error and diagnostic messages for IP, such as “destination unreachable”, “time exceeded” and ping.",
      uk: "Internet Control Message Protocol: службові повідомлення IP про помилки й діагностику, як-от «destination unreachable», «time exceeded» і ping.",
    },
  },
  {
    re: ["DF"], src: "wiki", url: wiki("IP_fragmentation"),
    def: {
      en: "The Don’t Fragment flag in the IPv4 header: the packet must not be split. If it is too big for a link, it is dropped and the sender gets ICMP “fragmentation needed”.",
      uk: "Прапорець Don’t Fragment в IPv4-заголовку: пакет не можна ділити. Якщо він завеликий для каналу, його відкидають, а відправник отримує ICMP «fragmentation needed».",
    },
  },
  {
    re: ["PMTUD"], src: "wiki", url: wiki("Path_MTU_Discovery"),
    def: {
      en: "Path MTU Discovery: finding the smallest MTU along the path by sending packets with DF set and shrinking them on ICMP “fragmentation needed”.",
      uk: "Path MTU Discovery: пошук найменшого MTU на шляху — пакети йдуть з DF, а на ICMP «fragmentation needed» відправник їх зменшує.",
    },
  },
  {
    re: ["VLAN"], src: "wiki", url: wiki("IEEE_802.1Q", "IEEE 802.1Q"),
    def: {
      en: "Virtual LAN (IEEE 802.1Q): a tag in the Ethernet frame that splits one physical network into separate logical networks.",
      uk: "Virtual LAN (IEEE 802.1Q): мітка в Ethernet-кадрі, що ділить одну фізичну мережу на кілька окремих логічних.",
    },
  },
  {
    re: ["SNAT", "DNAT", "NAT", "masquerade"], src: "wiki", url: wiki("Network_address_translation", "NAT"),
    def: {
      en: "Network Address Translation: rewriting IP addresses (and ports) of passing packets. SNAT and masquerade change the source, DNAT the destination.",
      uk: "Network Address Translation: переписування IP-адрес (і портів) у транзитних пакетах. SNAT і masquerade міняють відправника, DNAT — одержувача.",
    },
  },
  {
    re: ["three-way handshake", "handshake"], src: "wiki", url: "https://en.wikipedia.org/wiki/Transmission_Control_Protocol#Connection_establishment",
    def: {
      en: "How a TCP connection is set up: SYN → SYN-ACK → ACK. Only after these three packets can data flow.",
      uk: "Як встановлюється TCP-з’єднання: SYN → SYN-ACK → ACK. Лише після цих трьох пакетів можна передавати дані.",
    },
  },
  {
    re: ["congestion window", "congestion control", "вікно перевантаження"], src: "wiki", url: wiki("TCP_congestion_control"),
    def: {
      en: "How much unacknowledged data TCP may have in flight. The congestion-control algorithm (e.g. CUBIC or BBR) grows and shrinks it to avoid overloading the network.",
      uk: "Скільки непідтверджених даних TCP може тримати «в польоті». Алгоритм керування перевантаженням (наприклад, CUBIC чи BBR) збільшує й зменшує його, щоб не перевантажити мережу.",
    },
  },
  {
    re: ["Nagle’s algorithm", "Nagle", "алгоритм Нейгла"], src: "wiki", url: wiki("Nagle%27s_algorithm", "Алгоритм Нейгла"),
    def: {
      en: "Holds back small TCP segments while earlier data is still unacknowledged, so they can be merged into fewer packets. Turned off with TCP_NODELAY.",
      uk: "Притримує дрібні TCP-сегменти, поки попередні дані не підтверджено, щоб об’єднати їх у менше пакетів. Вимикається через TCP_NODELAY.",
    },
  },
  {
    re: ["retransmission", "retransmit", "ретрансмісі\\p{L}*"], src: "wiki", url: wiki("Retransmission_(data_networks)", "Повторна передача"),
    def: {
      en: "Sending a TCP segment again because its acknowledgment didn’t arrive in time or loss was detected.",
      uk: "Повторна відправка TCP-сегмента, бо підтвердження не прийшло вчасно або виявлено втрату.",
    },
  },
  {
    re: ["traceroute"], src: "wiki", url: wiki("Traceroute", "Traceroute"),
    def: {
      en: "A tool that maps the route to a host: it sends packets with TTL 1, 2, 3… and collects the ICMP “time exceeded” replies from each router on the way.",
      uk: "Утиліта, що показує маршрут до хоста: шле пакети з TTL 1, 2, 3… і збирає відповіді ICMP «time exceeded» від кожного роутера на шляху.",
    },
  },
  {
    re: ["user space"], src: "wiki", url: wiki("User_space_and_kernel_space"),
    def: {
      en: "Where ordinary processes run, separated from the kernel. Crossing into the kernel takes a system call, and data has to be copied across the boundary.",
      uk: "Де працюють звичайні процеси, відокремлено від ядра. Перехід у ядро — через системний виклик, а дані доводиться копіювати через цю межу.",
    },
  },
  {
    re: ["everything is a file", "все є файл\\p{L}*"], src: "wiki", url: wiki("Everything_is_a_file", "Все є файлом"),
    def: {
      en: "A Unix idea: files, devices, pipes and sockets are all accessed through file descriptors with the same calls, like read() and write().",
      uk: "Ідея Unix: файли, пристрої, канали й сокети доступні через файлові дескриптори тими самими викликами, як-от read() і write().",
    },
  },
  {
    re: ["Linux Security Modules", "LSM"], src: "wiki", url: wiki("Linux_Security_Modules", "Linux Security Modules"),
    def: {
      en: "A kernel framework of security hooks. Modules such as SELinux or AppArmor use it to allow or deny operations, including socket calls.",
      uk: "Каркас ядра з хуками безпеки. Модулі на кшталт SELinux чи AppArmor через нього дозволяють або забороняють операції, зокрема виклики сокетів.",
    },
  },
  {
    re: ["SELinux"], src: "wiki", url: wiki("SELinux", "SELinux"),
    def: {
      en: "Security-Enhanced Linux: an LSM with mandatory access control, which can restrict, for example, which processes may use which sockets and ports.",
      uk: "Security-Enhanced Linux: LSM з примусовим контролем доступу, який може обмежувати, наприклад, які процеси користуються якими сокетами й портами.",
    },
  },
  {
    re: ["epoll"], src: "wiki", url: wiki("Epoll"),
    def: {
      en: "A Linux API for waiting efficiently on many file descriptors at once, e.g. “tell me when any of these sockets has data”.",
      uk: "API Linux, щоб ефективно чекати подій на багатьох файлових дескрипторах одразу, наприклад «скажи, коли на якомусь із цих сокетів з’являться дані».",
    },
  },
  {
    re: ["checksums?", "контрольн\\p{L}* сум\\p{L}*"], src: "wiki", url: wiki("Internet_checksum"),
    def: {
      en: "A 16-bit sum over the IP header, or over the TCP/UDP header and data, used to detect corrupted packets. Network cards often compute and verify it themselves.",
      uk: "16-бітна сума по IP-заголовку або по заголовку й даних TCP/UDP, щоб виявити пошкоджені пакети. Мережеві карти часто рахують і перевіряють її самі.",
    },
  },
  {
    re: ["FIB"], src: "wiki", url: wiki("Forwarding_information_base"),
    def: {
      en: "Forwarding Information Base: the kernel’s fast lookup structure built from the routing tables. It answers “where should a packet for this address go?”.",
      uk: "Forwarding Information Base: швидка структура пошуку, яку ядро будує з таблиць маршрутизації. Відповідає на питання «куди відправити пакет для цієї адреси?».",
    },
  },
  {
    re: ["netfilter"], src: "wiki", url: wiki("Netfilter"),
    def: {
      en: "The Linux framework of hooks in the network stack (PREROUTING, INPUT, FORWARD, OUTPUT, POSTROUTING) where firewall rules, NAT and connection tracking run.",
      uk: "Каркас хуків у мережевому стеку Linux (PREROUTING, INPUT, FORWARD, OUTPUT, POSTROUTING), де працюють правила фаєрвола, NAT і відстеження з’єднань.",
    },
  },
  {
    re: ["conntrack"], src: "wiki", url: "https://en.wikipedia.org/wiki/Netfilter#Connection_tracking",
    def: {
      en: "Connection tracking: netfilter remembers every flow (addresses, ports, state). This is what makes stateful firewalls and NAT possible.",
      uk: "Відстеження з’єднань: netfilter пам’ятає кожен потік (адреси, порти, стан). Саме це робить можливими stateful-фаєрвол і NAT.",
    },
  },
  {
    re: ["iptables"], src: "wiki", url: wiki("Iptables", "Iptables"),
    def: {
      en: "The classic tool for netfilter rules, organised into tables and chains. Today it usually runs as iptables-nft on top of nftables.",
      uk: "Класична утиліта для правил netfilter, організованих у таблиці й ланцюжки. Сьогодні зазвичай працює як iptables-nft поверх nftables.",
    },
  },
  {
    re: ["nftables"], src: "wiki", url: wiki("Nftables", "Nftables"),
    def: {
      en: "The successor to iptables: one tool (nft) and one rule engine for filtering and NAT, on the same netfilter hooks.",
      uk: "Наступник iptables: одна утиліта (nft) і один рушій правил для фільтрації й NAT, на тих самих хуках netfilter.",
    },
  },
  {
    re: ["IPsec"], src: "wiki", url: wiki("IPsec", "IPsec"),
    def: {
      en: "A protocol suite for encrypting and authenticating IP packets. In Linux it is implemented by the xfrm framework.",
      uk: "Набір протоколів для шифрування й автентифікації IP-пакетів. У Linux реалізований каркасом xfrm.",
    },
  },
  {
    re: ["cgroup"], src: "wiki", url: wiki("Cgroups", "Cgroups"),
    def: {
      en: "Control groups: a Linux way to group processes and limit or account their resources. BPF programs can be attached per cgroup, e.g. to filter a container’s traffic.",
      uk: "Control groups: спосіб Linux групувати процеси й обмежувати чи рахувати їхні ресурси. BPF-програми можна чіпляти на cgroup, наприклад щоб фільтрувати трафік контейнера.",
    },
  },
  {
    re: ["eBPF", "BPF"], src: "wiki", url: wiki("EBPF", "EBPF"),
    def: {
      en: "Small programs, checked by a verifier, that are loaded into the running kernel and attached to hooks (XDP, tc, cgroups, sockets) to filter, redirect or observe packets.",
      uk: "Невеликі програми, перевірені верифікатором, які завантажують у працююче ядро й чіпляють на хуки (XDP, tc, cgroups, сокети), щоб фільтрувати, перенаправляти чи спостерігати пакети.",
    },
  },
  {
    re: ["XDP"], src: "wiki", url: wiki("Express_Data_Path", "XDP"),
    def: {
      en: "eXpress Data Path: an eBPF program that runs in the driver for each received packet, before an sk_buff is allocated, and can drop, redirect or pass it.",
      uk: "eXpress Data Path: eBPF-програма, що виконується в драйвері для кожного отриманого пакета ще до виділення sk_buff і може відкинути, перенаправити чи пропустити його.",
    },
  },
  {
    re: ["qdisc"], src: "wiki", url: wiki("Network_scheduler"),
    def: {
      en: "Queueing discipline: the outgoing queue of a network device, which decides the order and timing of packets (fq_codel, fq, pfifo_fast…). Configured with tc.",
      uk: "Queueing discipline: вихідна черга мережевого пристрою, що вирішує порядок і темп відправки пакетів (fq_codel, fq, pfifo_fast…). Налаштовується через tc.",
    },
  },
  {
    re: ["AQM"], src: "wiki", url: wiki("Active_queue_management"),
    def: {
      en: "Active Queue Management: dropping or marking packets early, before a queue is full, to keep latency low (CoDel, fq_codel).",
      uk: "Active Queue Management: відкидання чи позначення пакетів заздалегідь, до переповнення черги, щоб тримати затримки низькими (CoDel, fq_codel).",
    },
  },
  {
    re: ["GRO"], src: "kernel", url: kdoc("networking/segmentation-offloads.html"),
    def: {
      en: "Generic Receive Offload: merges consecutive packets of one flow into a bigger one before the stack processes it, saving per-packet work.",
      uk: "Generic Receive Offload: зливає послідовні пакети одного потоку в більший ще до обробки стеком, щоб зменшити роботу на кожен пакет.",
    },
  },
  {
    re: ["GSO"], src: "kernel", url: kdoc("networking/segmentation-offloads.html"),
    def: {
      en: "Generic Segmentation Offload: the stack handles one large “super-packet”, which is cut into MTU-sized segments as late as possible, ideally by the network card.",
      uk: "Generic Segmentation Offload: стек обробляє один великий «суперпакет», який ріжеться на сегменти розміру MTU якомога пізніше, в ідеалі мережевою картою.",
    },
  },
  {
    re: ["NAPI"], src: "kernel", url: kdoc("networking/napi.html"),
    def: {
      en: "The kernel’s receive mechanism: after one interrupt, interrupts are switched off and the driver is polled for a batch of packets. Under load this avoids one interrupt per packet.",
      uk: "Механізм прийому в ядрі: після одного переривання переривання вимикаються, і драйвер опитують на пачку пакетів. Під навантаженням це позбавляє від переривання на кожен пакет.",
    },
  },
  {
    re: ["IRQ", "interrupts?", "перериванн\\p{L}*"], src: "wiki", url: wiki("Interrupt", "Переривання"),
    def: {
      en: "A signal from hardware to the CPU, such as “new packets have arrived”. The CPU pauses its current work and runs a short handler.",
      uk: "Сигнал від заліза до процесора, наприклад «прийшли нові пакети». Процесор призупиняє поточну роботу й запускає короткий обробник.",
    },
  },
  {
    re: ["DMA"], src: "wiki", url: wiki("Direct_memory_access", "Прямий доступ до пам'яті"),
    def: {
      en: "Direct Memory Access: the network card reads and writes RAM itself, without the CPU copying the bytes.",
      uk: "Direct Memory Access: мережева карта сама читає й пише в оперативну пам’ять, без копіювання байтів процесором.",
    },
  },
  {
    re: ["RX ring", "TX ring"], src: "wiki", url: wiki("Circular_buffer", "Циклічний буфер"),
    def: {
      en: "A circular queue of buffer descriptors shared by the driver and the card: the card fills RX buffers with received frames and sends the frames placed in TX buffers.",
      uk: "Кільцева черга дескрипторів буферів, спільна для драйвера й карти: карта заповнює RX-буфери отриманими кадрами й відправляє кадри, покладені в TX-буфери.",
    },
  },
  {
    re: ["FCS"], src: "wiki", url: wiki("Frame_check_sequence"),
    def: {
      en: "Frame Check Sequence: a CRC at the end of every Ethernet frame. The card drops frames whose CRC doesn’t match.",
      uk: "Frame Check Sequence: CRC у кінці кожного Ethernet-кадру. Карта відкидає кадри, у яких CRC не збігається.",
    },
  },
  {
    re: ["MAC"], src: "wiki", url: wiki("MAC_address", "MAC-адреса"),
    def: {
      en: "MAC address: the hardware address of a network interface, used to deliver frames between devices on the same local network.",
      uk: "MAC-адреса: апаратна адреса мережевого інтерфейсу, за якою кадри доставляються між пристроями в одній локальній мережі.",
    },
  },
  {
    re: ["EtherType"], src: "wiki", url: wiki("EtherType"),
    def: {
      en: "A field in the Ethernet header that says what the frame carries: 0x0800 for IPv4, 0x86DD for IPv6, 0x0806 for ARP.",
      uk: "Поле в Ethernet-заголовку, що каже, що всередині кадру: 0x0800 — IPv4, 0x86DD — IPv6, 0x0806 — ARP.",
    },
  },
  {
    re: ["tcpdump"], src: "wiki", url: wiki("Tcpdump", "Tcpdump"),
    def: {
      en: "A command-line packet analyzer. It captures through an AF_PACKET socket.",
      uk: "Консольний аналізатор пакетів. Захоплює трафік через AF_PACKET-сокет.",
    },
  },
  {
    re: ["Wireshark"], src: "wiki", url: wiki("Wireshark", "Wireshark"),
    def: {
      en: "A graphical packet analyzer. On Linux it captures the same way as tcpdump.",
      uk: "Графічний аналізатор пакетів. У Linux захоплює трафік так само, як tcpdump.",
    },
  },
];

// Physical layer
TERMS.push(
  {
    re: ["PHY"], src: "wiki", url: wiki("Ethernet_physical_layer"),
    def: {
      en: "The transceiver chip (or block inside the network card) that turns bits into an electrical, optical or radio signal and back.",
      uk: "Мікросхема-трансивер (або блок усередині мережевої карти), що перетворює біти на електричний, оптичний чи радіосигнал і назад.",
    },
  },
  {
    re: ["MII"], src: "wiki", url: wiki("Media-independent_interface"),
    def: {
      en: "Media-independent interface: the standard bus between the MAC and the PHY. Variants such as RGMII and SGMII differ in width and speed.",
      uk: "Media-independent interface: стандартна шина між MAC і PHY. Варіанти на кшталт RGMII і SGMII відрізняються шириною й швидкістю.",
    },
  },
  {
    re: ["preamble", "преамбул\\p{L}*"], src: "wiki", url: "https://en.wikipedia.org/wiki/Ethernet_frame#Preamble_and_start_frame_delimiter",
    def: {
      en: "Seven bytes of alternating 1s and 0s before every Ethernet frame, followed by a start-of-frame byte. They let the receiver synchronise to the sender’s bit clock.",
      uk: "Сім байтів із чергуванням 1 і 0 перед кожним Ethernet-кадром, після них — байт початку кадру. Дають одержувачу синхронізуватися з тактом бітів відправника.",
    },
  },
  {
    re: ["line code", "лінійн\\p{L}* код\\p{L}*"], src: "wiki", url: wiki("Line_code", "Лінійне кодування"),
    def: {
      en: "The rule for turning bits into signal levels on the medium. Good line codes keep the signal balanced and contain enough transitions for the receiver to recover the clock.",
      uk: "Правило, за яким біти перетворюються на рівні сигналу в середовищі. Добрий лінійний код тримає сигнал збалансованим і має достатньо переходів, щоб одержувач відновив такт.",
    },
  },
  {
    re: ["MLT-3"], src: "wiki", url: wiki("MLT-3_encoding"),
    def: {
      en: "A line code with three voltage levels (−, 0, +) used by 100 Mbit/s Ethernet; it lowers the signal frequency so it fits ordinary twisted pair.",
      uk: "Лінійний код із трьома рівнями напруги (−, 0, +) у 100-мегабітному Ethernet; знижує частоту сигналу, щоб він проходив звичайною витою парою.",
    },
  },
  {
    re: ["PAM-5"], src: "wiki", url: "https://en.wikipedia.org/wiki/Gigabit_Ethernet#1000BASE-T",
    def: {
      en: "Five-level pulse-amplitude modulation used by gigabit Ethernet over copper (1000BASE-T), on all four pairs at once.",
      uk: "П’ятирівнева амплітудно-імпульсна модуляція в гігабітному Ethernet по міді (1000BASE-T), на всіх чотирьох парах одночасно.",
    },
  },
  {
    re: ["PAM-16"], src: "wiki", url: "https://en.wikipedia.org/wiki/10_Gigabit_Ethernet#10GBASE-T",
    def: {
      en: "Sixteen-level pulse-amplitude modulation used by 10GBASE-T, 10-gigabit Ethernet over copper.",
      uk: "Шістнадцятирівнева амплітудно-імпульсна модуляція в 10GBASE-T — 10-гігабітному Ethernet по міді.",
    },
  },
  {
    re: ["PAM4"], src: "wiki", url: wiki("Pulse-amplitude_modulation"),
    def: {
      en: "Four-level pulse-amplitude modulation: two bits per symbol. Used on fast optical and electrical links, from 50 Gbit/s per lane up.",
      uk: "Чотирирівнева амплітудно-імпульсна модуляція: два біти на символ. Застосовується на швидких оптичних та електричних лінках, від 50 Гбіт/с на смугу.",
    },
  },
  {
    re: ["64b/66b"], src: "wiki", url: wiki("64b/66b_encoding"),
    def: {
      en: "A line code that adds 2 bits to every 64, mainly to mark block boundaries; used by 10G Ethernet over fiber and many faster links.",
      uk: "Лінійний код, що додає 2 біти до кожних 64, переважно щоб позначати межі блоків; використовується в 10G Ethernet по оптиці й на багатьох швидших лінках.",
    },
  },
  {
    re: ["OFDM"], src: "wiki", url: wiki("Orthogonal_frequency-division_multiplexing", "OFDM"),
    def: {
      en: "Splitting data across many closely spaced radio subcarriers sent in parallel; the basis of modern Wi-Fi and LTE/5G.",
      uk: "Розподіл даних на багато близько розташованих радіопіднесучих, що передаються паралельно; основа сучасного Wi-Fi та LTE/5G.",
    },
  },
  {
    re: ["ethtool"], src: "wiki", url: wiki("Ethtool"),
    def: {
      en: "The Linux tool for querying and configuring network card settings: link speed and state, offloads, ring sizes, driver statistics.",
      uk: "Утиліта Linux для перегляду й налаштування мережевої карти: швидкість і стан лінку, offload-и, розміри ring-буферів, статистика драйвера.",
    },
  },
);

export const SOURCE_LABEL: Record<Source, Tx> = {
  wiki: { en: "Wikipedia", uk: "Вікіпедія" },
  kernel: { en: "Kernel docs", uk: "Документація ядра" },
  man: { en: "man page", uk: "man-сторінка" },
};

const BOUND = "[\\p{L}\\p{N}_]";
const COMPILED = TERMS.map((term) => new RegExp(`(?<!${BOUND})(?:${term.re.join("|")})(?!${BOUND})`, "u"));

export const termUrl = (k: number, lang: Lang) => {
  const u = TERMS[k].url;
  return typeof u === "string" ? u : u[lang];
};

/**
 * Wraps the first occurrence of each glossary term in `html` (text outside tags and links) in a
 * focusable span. `used` is shared across the blocks of one step so a term is marked only once.
 */
export function annotate(html: string, used: Set<number>): string {
  let inLink = 0;
  return html
    .split(/(<[^>]+>)/)
    .map((part) => {
      if (part.startsWith("<")) {
        if (/^<a[\s>]/.test(part)) inLink++;
        else if (part === "</a>") inLink--;
        return part;
      }
      if (inLink || !part) return part;
      let out = "";
      let rest = part;
      for (;;) {
        let best: { k: number; i: number; len: number } | undefined;
        COMPILED.forEach((re, k) => {
          if (used.has(k)) return;
          const m = re.exec(rest);
          if (m && (!best || m.index < best.i)) best = { k, i: m.index, len: m[0].length };
        });
        if (!best) break;
        used.add(best.k);
        out += rest.slice(0, best.i) + `<span class="term" tabindex="0" data-t="${best.k}">${rest.slice(best.i, best.i + best.len)}</span>`;
        rest = rest.slice(best.i + best.len);
      }
      return out + rest;
    })
    .join("");
}
