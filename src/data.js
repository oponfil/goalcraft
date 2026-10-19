// Demo data shown on the landing page. In the product this comes from agents via MCP.
import { lang } from './i18n.js?v=06e43b9f';

export const AGENTS = {
  // app: turns a web chat link into one that opens the desktop app, where the app has a link scheme.
  claude: { name: 'Claude', color: '#D97757', chat: 'https://claude.ai', app: url => url.replace(/^https:\/\/claude\.ai/, 'claude://claude.ai') },
  // The ChatGPT desktop app opens codex:// links (it has no chatgpt:// scheme): codex://threads/<id>
  // is one Codex conversation, which the server takes from Codex itself. A link to a ChatGPT chat
  // stays on the web, where it opens that conversation.
  chatgpt: { name: 'ChatGPT', color: '#10A37F', chat: 'https://chatgpt.com', app: url => (/^(https:\/\/chatgpt\.com\/.|codex:\/\/.)/.test(url) ? url : 'codex://') },
  grok: { name: 'Grok', color: '#1A1A1A', chat: 'https://grok.com' },
  gemini: { name: 'Gemini', color: '#4285F4', chat: 'https://gemini.google.com' },
  deepseek: { name: 'DeepSeek', color: '#4D6BFE', chat: 'https://chat.deepseek.com' },
  kimi: { name: 'Kimi', color: '#16161A', chat: 'https://kimi.com' },
  qwen: { name: 'Qwen', color: '#615CED', chat: 'https://chat.qwen.ai' },
  mistral: { name: 'Mistral', color: '#FA520F', chat: 'https://chat.mistral.ai' },
  perplexity: { name: 'Perplexity', color: '#20808D', chat: 'https://www.perplexity.ai' },
  hermes: { name: 'Hermes', color: '#8A6E3A', chat: 'https://nousresearch.com' },
};

// Several agents of one kind tell themselves apart with a suffix: "claude-search" is a Claude,
// shown as "Claude · search". Any other name gets a plain grey shirt without a logo.
export function agentInfo(id) {
  if (AGENTS[id]) return AGENTS[id];
  const [kind, ...rest] = id.split(/[-_]/), base = AGENTS[kind];
  // "chatgpt-search": the agent's own name for its job (several ChatGPT agents in one funnel),
  // shown after the brand; buttons that open the app use the brand alone (product).
  if (base && rest.length) return { ...base, name: `${base.name} · ${rest.join(' ')}`, product: base.name };
  return { name: id, color: '#8A8F98', chat: '' };
}

// Where "Open" and "Reply" go: the agent's desktop app when it has a link scheme (Claude,
// ChatGPT), otherwise its chat in the browser. App links fall back to the web chat (dashboard.js).
export const chatLink = (info, url) => (url && info.app ? info.app(url) : url);

// A button in the agent's own colour, with text that stays readable on it.
export function agentButton(info) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(info.color.slice(i, i + 2), 16));
  const light = 0.299 * r + 0.587 * g + 0.114 * b > 150;
  const dark = 0.299 * r + 0.587 * g + 0.114 * b < 50;
  return `background:${info.color};border-color:${dark ? '#6B6B70' : info.color};color:${light ? '#1B1714' : '#FFFFFF'}`;
}

// Label forms: [singular, plural]. A funnel has n = 2-5 stages; flows (per day) has n + 1 entries:
// flows[0] is the inflow above the first tank, flows[k + 1] the zone below stage k, and
// flows[n] (the output zone below the last tank) is results per day;
// null means not reported yet (shown as +0).
// goal: total — how many results the goal needs; every — the pace, one result per N days.
// These are the only targets an agent sets. theme: look of the column (src/themes.js).
// Workers: state work | sleep | ask; at most two per zone (left and right of the pipe).
// zone -1 is the inflow above the first tank (zone 0 in docs/MCP.md), zone k sits below stage k;
// zone n - 1 is the output zone, where agents turn the last stage into results.
// The demo runs DAY_SECONDS (src/scene.js) per day: zones move items at their flow, slower
// where no agent is working. wakeIn is seconds until a sleeping agent starts; lateBy shows one that
// overslept its run by that long, silentFor one silent at work that long (the warning triangles). result: forms of what comes out at the bottom.
// What a supervisor's earlier runs found (a status each), for its runs list in the demo.
export const SUP_RUNS = ['ok', 'ok', 'ok', 'recommendation', 'bottleneck'];
export const FUNNELS = [
  {
    title: 'Job Search',
    source_url: 'https://docs.google.com/spreadsheets',
    theme: 'mine',
    result: ['offer', 'offers'],
    stages: [
      { count: 240, forms: ['job found', 'jobs found'] },
      { count: 96, forms: ['applied', 'applied'] },
      { count: 30, forms: ['screening call', 'screening calls'] },
      { count: 14, forms: ['interview', 'interviews'] },
      { count: 4, forms: ['final round', 'final rounds'] },
    ],
    flows: [8, 4, 1.6, 0.8, 0.2, 1 / 21],
    cubes: 1,
    goal: { total: 5, every: 21 },
    // The supervisor on the platform: what its last run found.
    supervisor: { agent: 'claude', state: 'work', status: 'bottleneck', summary: 'interviews → final round' },
    workers: [
      { agent: 'chatgpt', zone: -1, state: 'work' },
      { agent: 'perplexity', zone: -1, state: 'work' },
      {
        agent: 'claude', zone: 0, state: 'ask',
        question: 'The form asks for a salary expectation. Send the application with $120k?',
      },
      { agent: 'gemini', zone: 0, state: 'work' },
      { agent: 'grok', zone: 1, state: 'sleep', wakeIn: 12 },
      { agent: 'deepseek', zone: 1, state: 'work' },
      { agent: 'mistral', zone: 2, state: 'work' },
      { agent: 'qwen', zone: 3, state: 'work' },
      { agent: 'claude', zone: 4, state: 'work' },
    ],
  },
  {
    title: 'Creator',
    theme: 'garden',
    result: ['paying member', 'paying members'],
    stages: [
      { count: 52000, forms: ['view', 'views'] },
      { count: 3100, forms: ['profile visit', 'profile visits'] },
      { count: 1240, forms: ['follower', 'followers'] },
      { count: 400, forms: ['subscriber', 'subscribers'] },
      { count: 90, forms: ['trial member', 'trial members'] },
    ],
    flows: [300, 20, 8, 3, 1.2, 0.5],
    cubes: 8,
    goal: { total: 30, every: 2 },
    // The supervisor on the platform: what its last run found.
    supervisor: { agent: 'chatgpt', state: 'sleep', wakeIn: 25, status: 'ok', summary: 'on pace for the goal' },
    workers: [
      { agent: 'claude', zone: -1, state: 'work' },
      { agent: 'mistral', zone: -1, state: 'work' },
      {
        agent: 'chatgpt', zone: 0, state: 'work',
        replies: [{ id: 'demo-reply', question: 'Post the next video on YouTube or TikTok first?', answer: 'TikTok first', reply: 'Got it: posting to TikTok first.' }],
      },
      { agent: 'gemini', zone: 1, state: 'work' },
      { agent: 'kimi', zone: 1, state: 'sleep', wakeIn: 10 },
      { agent: 'hermes', zone: 2, state: 'work' },
      { agent: 'claude', zone: 2, state: 'sleep', wakeIn: 18 },
      { agent: 'perplexity', zone: 3, state: 'work' },
      { agent: 'deepseek', zone: 4, state: 'work' },
    ],
  },
  {
    title: 'Bug Bounty',
    theme: 'code',
    result: ['paid bounty', 'paid bounties'],
    stages: [
      { count: 30, forms: ['target', 'targets'] },
      { count: 11, forms: ['finding', 'findings'] },
      { count: 6, forms: ['report', 'reports'] },
      { count: 4, forms: ['triaged', 'triaged'] },
      { count: 3, forms: ['accepted', 'accepted'] },
    ],
    flows: [2, 0.6, 0.3, 0.2, 0.15, 1 / 10],
    cubes: 2,
    goal: { total: 12, every: 7 },
    // The supervisor on the platform: what its last run found.
    supervisor: { agent: 'grok', state: 'work', status: 'recommendation', summary: 'add an agent on the inflow' },
    workers: [
      { agent: 'deepseek', zone: -1, state: 'work' },
      { agent: 'claude', zone: 0, state: 'work' },
      { agent: 'hermes', zone: 0, state: 'work' },
      {
        agent: 'chatgpt', zone: 1, state: 'ask',
        question: 'This finding looks close to a public report from March. Submit it anyway?',
      },
      { agent: 'qwen', zone: 1, state: 'work' },
      { agent: 'grok', zone: 2, state: 'work' },
      { agent: 'gemini', zone: 3, state: 'sleep', wakeIn: 14 },
      { agent: 'kimi', zone: 4, state: 'work' },
    ],
  },
  {
    title: 'Fundraising',
    source_url: 'https://airtable.com',
    theme: 'money',
    result: ['term sheet', 'term sheets'],
    stages: [
      { count: 120, forms: ['investor', 'investors'] },
      { count: 35, forms: ['intro', 'intros'] },
      { count: 12, forms: ['meeting', 'meetings'] },
      { count: 5, forms: ['partner meeting', 'partner meetings'] },
      { count: 2, forms: ['in due diligence', 'in due diligence'] },
    ],
    flows: [5, 1.5, 0.4, 0.2, 0.1, 1 / 14],
    cubes: 0,
    goal: { total: 10, every: 14 },
    // The supervisor on the platform: what its last run found.
    supervisor: { agent: 'gemini', state: 'ask', status: 'question', question: 'Two investors asked for a call on Friday. Take both, or only the lead?' },
    workers: [
      { agent: 'chatgpt', zone: -1, state: 'work' },
      { agent: 'perplexity', zone: -1, state: 'work' },
      { agent: 'gemini', zone: 0, state: 'work' },
      {
        agent: 'claude', zone: 1, state: 'ask',
        question: 'Northwind Ventures asks for the cap table before Thursday. Share it from the data room?',
      },
      { agent: 'grok', zone: 2, state: 'sleep', wakeIn: 2 * 3600 },
      { agent: 'mistral', zone: 2, state: 'work' },
      { agent: 'deepseek', zone: 3, state: 'work' },
      { agent: 'qwen', zone: 4, state: 'work' },
    ],
  },
  {
    title: 'Wedding',
    theme: 'love',
    result: ['vendor booked', 'vendors booked'],
    stages: [
      { count: 120, forms: ['vendor found', 'vendors found'] },
      { count: 46, forms: ['request sent', 'requests sent'] },
      { count: 17, forms: ['quote', 'quotes'] },
      { count: 6, forms: ['visit', 'visits'] },
      { count: 3, forms: ['finalist', 'finalists'] },
    ],
    flows: [6, 2.5, 1, 0.4, 0.2, 0.12],
    cubes: 2,
    goal: { total: 8, every: 7 },
    // The supervisor on the platform: what its last run found.
    supervisor: { agent: 'chatgpt', state: 'work', status: 'ok', summary: 'on pace for the goal' },
    workers: [
      { agent: 'kimi', zone: -1, state: 'work' },
      { agent: 'claude', zone: 0, state: 'work' },
      { agent: 'qwen', zone: 0, state: 'sleep', wakeIn: 15 },
      {
        agent: 'grok', zone: 1, state: 'ask',
        question: 'The florist can do peonies for $1,200 on June 14. Book them?',
      },
      { agent: 'chatgpt', zone: 2, state: 'sleep', wakeIn: 9 * 3600 },
      { agent: 'gemini', zone: 2, state: 'work' },
      { agent: 'deepseek', zone: 3, state: 'work' },
      { agent: 'mistral', zone: 4, state: 'work' },
    ],
  },
  {
    title: 'Research',
    source_url: 'https://www.notion.so',
    theme: 'lab',
    result: ['published paper', 'published papers'],
    stages: [
      { count: 12, forms: ['idea', 'ideas'] },
      { count: 7, forms: ['draft', 'drafts'] },
      { count: 4, forms: ['preprint', 'preprints'] },
      { count: 3, forms: ['submitted', 'submitted'] },
      { count: 2, forms: ['under review', 'under review'] },
    ],
    flows: [1 / 2, 1 / 3, 1 / 5, 1 / 7, 1 / 10, 1 / 14],
    cubes: 1,
    goal: { total: 6, every: 21 },
    // The supervisor on the platform: what its last run found.
    supervisor: { agent: 'claude', state: 'sleep', wakeIn: 40, status: 'bottleneck', summary: 'replies come back slowly' },
    workers: [
      { agent: 'perplexity', zone: -1, state: 'work' },
      { agent: 'claude', zone: 0, state: 'work' },
      { agent: 'deepseek', zone: 0, state: 'work' },
      { agent: 'qwen', zone: 1, state: 'work' },
      { agent: 'chatgpt', zone: 2, state: 'work' },
      { agent: 'grok', zone: 3, state: 'sleep', wakeIn: 20 },
      { agent: 'hermes', zone: 4, state: 'work' },
    ],
  },
  {
    title: 'Hiring',
    theme: 'forge',
    result: ['hire', 'hires'],
    stages: [
      { count: 160, forms: ['candidate sourced', 'candidates sourced'] },
      { count: 48, forms: ['screened', 'screened'] },
      { count: 15, forms: ['interviewed', 'interviewed'] },
      { count: 5, forms: ['final interview', 'final interviews'] },
      { count: 2, forms: ['offer sent', 'offers sent'] },
    ],
    flows: [6, 2, 0.6, 0.25, 0.12, 1 / 14],
    cubes: 1,
    goal: { total: 3, every: 14 },
    // The supervisor on the platform: what its last run found.
    supervisor: { agent: 'gemini', state: 'work', status: 'recommendation', summary: 'speed up the first replies' },
    workers: [
      { agent: 'perplexity', zone: -1, state: 'work' },
      { agent: 'chatgpt', zone: -1, state: 'work' },
      { agent: 'claude', zone: 0, state: 'work' },
      {
        agent: 'gemini', zone: 1, state: 'ask',
        question: 'The backend candidate asks to start in January instead of December. Agree?',
      },
      { agent: 'deepseek', zone: 2, state: 'sleep', lateBy: 2 * 3600 },
      { agent: 'kimi', zone: 2, state: 'work' },
      { agent: 'qwen', zone: 3, state: 'work' },
      { agent: 'claude', zone: 4, state: 'work' },
    ],
  },
  {
    title: 'Freelance Clients',
    theme: 'bakery',
    result: ['client', 'clients'],
    stages: [
      { count: 85, forms: ['lead', 'leads'] },
      { count: 26, forms: ['reply', 'replies'] },
      { count: 9, forms: ['call', 'calls'] },
      { count: 5, forms: ['proposal', 'proposals'] },
      { count: 3, forms: ['contract sent', 'contracts sent'] },
    ],
    flows: [4, 1.2, 0.4, 0.2, 0.12, 1 / 10],
    cubes: 3,
    goal: { total: 8, every: 10 },
    // The supervisor on the platform: what its last run found.
    supervisor: { agent: 'grok', state: 'sleep', wakeIn: 18, status: 'ok', summary: 'on pace for the goal' },
    workers: [
      { agent: 'claude', zone: -1, state: 'work' },
      { agent: 'mistral', zone: -1, state: 'sleep', wakeIn: 8 },
      { agent: 'chatgpt', zone: 0, state: 'work' },
      { agent: 'grok', zone: 1, state: 'work' },
      { agent: 'hermes', zone: 1, state: 'work' },
      {
        agent: 'gemini', zone: 2, state: 'ask',
        question: 'The client wants a fixed price for the landing page. Quote $2,500?',
      },
      { agent: 'qwen', zone: 3, state: 'work' },
      { agent: 'deepseek', zone: 4, state: 'work' },
    ],
  },
  {
    title: 'Podcast Tour',
    theme: 'blocks',
    result: ['episode aired', 'episodes aired'],
    stages: [
      { count: 140, forms: ['show found', 'shows found'] },
      { count: 60, forms: ['pitch', 'pitches'] },
      { count: 18, forms: ['reply', 'replies'] },
      { count: 6, forms: ['booked', 'booked'] },
      { count: 4, forms: ['recorded', 'recorded'] },
    ],
    flows: [7, 3, 0.8, 0.3, 0.2, 1 / 7],
    cubes: 2,
    goal: { total: 10, every: 7 },
    // The supervisor on the platform: what its last run found.
    supervisor: { agent: 'claude', state: 'work', status: 'recommendation', summary: 'add an agent on the inflow' },
    workers: [
      { agent: 'grok', zone: -1, state: 'work' },
      { agent: 'perplexity', zone: -1, state: 'work' },
      { agent: 'claude', zone: 0, state: 'work' },
      { agent: 'qwen', zone: 1, state: 'work', silentFor: 25 * 60 },
      { agent: 'chatgpt', zone: 1, state: 'sleep', wakeIn: 25 },
      { agent: 'deepseek', zone: 2, state: 'work' },
      { agent: 'mistral', zone: 3, state: 'work' },
      { agent: 'kimi', zone: 4, state: 'work' },
    ],
  },
];

// The demo in the viewer's language: titles, stage and result names, and questions, keyed by the
// English text. Columns: Russian, Chinese, Thai, Spanish, Vietnamese, Japanese. Russian names have
// three forms [1, 2-4, 5+], Spanish two [1, many]; Chinese, Thai, Vietnamese and Japanese have one.
const DEMO = {
  'Post the next video on YouTube or TikTok first?': ['Следующее видео сначала на YouTube или в TikTok?', '下一个视频先发 YouTube 还是 TikTok？', 'คลิปถัดไปลง YouTube หรือ TikTok ก่อน?', '¿Publico el próximo vídeo primero en YouTube o en TikTok?', 'Video tiếp theo đăng YouTube hay TikTok trước?', '次の動画はYouTubeとTikTok、どちらを先に？'],
  'TikTok first': ['Сначала TikTok', '先发 TikTok', 'TikTok ก่อน', 'Primero TikTok', 'TikTok trước', 'TikTokを先に'],
  'Got it: posting to TikTok first.': ['Понял: сначала публикую в TikTok.', '明白：先发到 TikTok。', 'รับทราบ: ลง TikTok ก่อน', 'Entendido: primero publico en TikTok.', 'Đã rõ: đăng lên TikTok trước.', '了解：まずTikTokに投稿します。'],
  'interviews → final round': ['интервью → финал', '面试 → 终面', 'สัมภาษณ์ → รอบสุดท้าย', 'entrevistas → ronda final', 'phỏng vấn → vòng cuối', '面接 → 最終面接'],
  'on pace for the goal': ['идём в темпе цели', '按目标节奏推进', 'เดินตามจังหวะเป้าหมาย', 'al ritmo de la meta', 'đúng nhịp mục tiêu', '目標のペース通り'],
  'add an agent on the inflow': ['добавить агента на входящие', '在入口处再加一个智能体', 'เพิ่มเอเจนต์ที่ทางเข้า', 'añadir un agente en la entrada', 'thêm một tác tử ở đầu vào', '入口にエージェントを追加'],
  'replies come back slowly': ['ответы приходят медленно', '回复来得慢', 'คำตอบกลับมาช้า', 'las respuestas tardan', 'phản hồi về chậm', '返信が遅い'],
  'speed up the first replies': ['быстрее отвечать на первые письма', '加快首次回复', 'ตอบกลับครั้งแรกให้เร็วขึ้น', 'responder antes a los primeros mensajes', 'trả lời lần đầu nhanh hơn', '最初の返信を早める'],
  'Two investors asked for a call on Friday. Take both, or only the lead?': ['Два инвестора просят созвон в пятницу. Брать обоих или только ведущего?', '两位投资人要求周五通话。两个都约，还是只约领投方？', 'นักลงทุนสองรายขอคุยวันศุกร์ รับทั้งคู่หรือเฉพาะผู้นำการลงทุน?', 'Dos inversores piden una llamada el viernes. ¿Ambos o solo el líder?', 'Hai nhà đầu tư muốn gọi vào thứ Sáu. Nhận cả hai hay chỉ nhà đầu tư dẫn dắt?', '2人の投資家が金曜の通話を希望しています。両方受けますか、リードだけにしますか？'],
  'Job Search': ['Поиск работы', '找工作', 'หางาน', 'Búsqueda de empleo', 'Tìm việc', '就職活動'],
  'Creator': ['Автор', '创作者', 'ครีเอเตอร์', 'Creador', 'Nhà sáng tạo', 'クリエイター'],
  'Bug Bounty': ['Баг-баунти', '漏洞赏金', 'บั๊กบาวน์ตี้', 'Bug bounty', 'Săn lỗi', 'バグバウンティ'],
  'Fundraising': ['Привлечение инвестиций', '融资', 'ระดมทุน', 'Inversión', 'Gọi vốn', '資金調達'],
  'Wedding': ['Свадьба', '婚礼', 'งานแต่งงาน', 'Boda', 'Đám cưới', '結婚式'],
  'Research': ['Исследования', '科研', 'งานวิจัย', 'Investigación', 'Nghiên cứu', '研究'],
  'offer': [['оффер', 'оффера', 'офферов'], '录用通知', 'ข้อเสนองาน', ['oferta', 'ofertas'], 'lời mời làm việc', '内定'],
  'job found': [['найденная вакансия', 'найденные вакансии', 'найденных вакансий'], '找到的职位', 'งานที่พบ', ['vacante encontrada', 'vacantes encontradas'], 'việc tìm thấy', '見つけた求人'],
  'applied': [['отклик', 'отклика', 'откликов'], '已投递', 'สมัครแล้ว', ['postulación', 'postulaciones'], 'đã ứng tuyển', '応募済み'],
  'screening call': [['созвон с HR', 'созвона с HR', 'созвонов с HR'], '初筛电话', 'โทรคัดกรอง', ['llamada de selección', 'llamadas de selección'], 'cuộc gọi sàng lọc', '書類選考の電話'],
  'interview': [['собеседование', 'собеседования', 'собеседований'], '面试', 'สัมภาษณ์', ['entrevista', 'entrevistas'], 'phỏng vấn', '面接'],
  'final round': [['финальный раунд', 'финальных раунда', 'финальных раундов'], '终面', 'รอบสุดท้าย', ['ronda final', 'rondas finales'], 'vòng cuối', '最終面接'],
  'paying member': [['платный подписчик', 'платных подписчика', 'платных подписчиков'], '付费会员', 'สมาชิกที่จ่ายเงิน', ['miembro de pago', 'miembros de pago'], 'thành viên trả phí', '有料会員'],
  'view': [['просмотр', 'просмотра', 'просмотров'], '浏览', 'ยอดวิว', ['visualización', 'visualizaciones'], 'lượt xem', '閲覧'],
  'profile visit': [['заход в профиль', 'захода в профиль', 'заходов в профиль'], '主页访问', 'เข้าชมโปรไฟล์', ['visita al perfil', 'visitas al perfil'], 'lượt vào hồ sơ', 'プロフィール訪問'],
  'follower': [['подписчик', 'подписчика', 'подписчиков'], '粉丝', 'ผู้ติดตาม', ['seguidor', 'seguidores'], 'người theo dõi', 'フォロワー'],
  'subscriber': [['подписчик рассылки', 'подписчика рассылки', 'подписчиков рассылки'], '订阅者', 'ผู้สมัครรับ', ['suscriptor', 'suscriptores'], 'người đăng ký', '購読者'],
  'trial member': [['пробный участник', 'пробных участника', 'пробных участников'], '试用会员', 'สมาชิกทดลอง', ['miembro de prueba', 'miembros de prueba'], 'thành viên dùng thử', 'お試し会員'],
  'paid bounty': [['оплаченная награда', 'оплаченные награды', 'оплаченных наград'], '已付赏金', 'รางวัลที่จ่ายแล้ว', ['recompensa pagada', 'recompensas pagadas'], 'tiền thưởng đã trả', '支払われた報奨金'],
  'target': [['цель', 'цели', 'целей'], '目标', 'เป้าหมาย', ['objetivo', 'objetivos'], 'mục tiêu', '対象'],
  'finding': [['находка', 'находки', 'находок'], '发现', 'สิ่งที่พบ', ['hallazgo', 'hallazgos'], 'phát hiện', '発見'],
  'report': [['отчёт', 'отчёта', 'отчётов'], '报告', 'รายงาน', ['informe', 'informes'], 'báo cáo', '報告'],
  'triaged': [['разобран', 'разобрано', 'разобрано'], '已分类', 'คัดกรองแล้ว', ['clasificado', 'clasificados'], 'đã phân loại', 'トリアージ済み'],
  'accepted': [['принят', 'принято', 'принято'], '已接受', 'ได้รับการยอมรับ', ['aceptado', 'aceptados'], 'được chấp nhận', '受理'],
  'term sheet': [['термшит', 'термшита', 'термшитов'], '投资意向书', 'เทิร์มชีต', ['term sheet', 'term sheets'], 'bản điều khoản', 'タームシート'],
  'investor': [['инвестор', 'инвестора', 'инвесторов'], '投资人', 'นักลงทุน', ['inversor', 'inversores'], 'nhà đầu tư', '投資家'],
  'intro': [['знакомство', 'знакомства', 'знакомств'], '引荐', 'การแนะนำ', ['presentación', 'presentaciones'], 'lời giới thiệu', '紹介'],
  'meeting': [['встреча', 'встречи', 'встреч'], '会议', 'การประชุม', ['reunión', 'reuniones'], 'cuộc gặp', '面談'],
  'partner meeting': [['встреча с партнёром', 'встречи с партнёрами', 'встреч с партнёрами'], '合伙人会议', 'ประชุมกับพาร์ทเนอร์', ['reunión con socios', 'reuniones con socios'], 'cuộc gặp đối tác', 'パートナー面談'],
  'in due diligence': [['на проверке', 'на проверке', 'на проверке'], '尽职调查中', 'อยู่ระหว่างตรวจสอบ', ['en due diligence', 'en due diligence'], 'đang thẩm định', 'デューデリジェンス中'],
  'vendor booked': [['забронированный подрядчик', 'забронированных подрядчика', 'забронированных подрядчиков'], '已预订的供应商', 'ผู้ให้บริการที่จองแล้ว', ['proveedor reservado', 'proveedores reservados'], 'nhà cung cấp đã đặt', '予約済みの業者'],
  'vendor found': [['найденный подрядчик', 'найденных подрядчика', 'найденных подрядчиков'], '找到的供应商', 'ผู้ให้บริการที่พบ', ['proveedor encontrado', 'proveedores encontrados'], 'nhà cung cấp tìm thấy', '見つけた業者'],
  'request sent': [['отправленный запрос', 'отправленных запроса', 'отправленных запросов'], '已发询价', 'คำขอที่ส่งแล้ว', ['solicitud enviada', 'solicitudes enviadas'], 'yêu cầu đã gửi', '送った問い合わせ'],
  'quote': [['смета', 'сметы', 'смет'], '报价', 'ใบเสนอราคา', ['presupuesto', 'presupuestos'], 'báo giá', '見積もり'],
  'visit': [['встреча', 'встречи', 'встреч'], '见面', 'นัดพบ', ['visita', 'visitas'], 'buổi gặp', '打ち合わせ'],
  'finalist': [['финалист', 'финалиста', 'финалистов'], '入围者', 'ตัวเลือกสุดท้าย', ['finalista', 'finalistas'], 'ứng viên cuối', '最終候補'],
  'published paper': [['опубликованная статья', 'опубликованные статьи', 'опубликованных статей'], '已发表论文', 'บทความที่ตีพิมพ์', ['artículo publicado', 'artículos publicados'], 'bài báo đã đăng', '掲載論文'],
  'idea': [['идея', 'идеи', 'идей'], '想法', 'ไอเดีย', ['idea', 'ideas'], 'ý tưởng', 'アイデア'],
  'draft': [['черновик', 'черновика', 'черновиков'], '草稿', 'ฉบับร่าง', ['borrador', 'borradores'], 'bản nháp', '草稿'],
  'preprint': [['препринт', 'препринта', 'препринтов'], '预印本', 'พรีปรินต์', ['preprint', 'preprints'], 'bản tiền ấn phẩm', 'プレプリント'],
  'submitted': [['отправлена', 'отправлены', 'отправлено'], '已投稿', 'ส่งแล้ว', ['enviado', 'enviados'], 'đã nộp', '投稿済み'],
  'under review': [['на рецензии', 'на рецензии', 'на рецензии'], '审稿中', 'อยู่ระหว่างพิจารณา', ['en revisión', 'en revisión'], 'đang phản biện', '査読中'],
  'The form asks for a salary expectation. Send the application with $120k?': ['В форме спрашивают ожидаемую зарплату. Отправить отклик с $120k?', '表单要求填写期望薪资。用 12 万美元提交申请吗？', 'แบบฟอร์มถามเงินเดือนที่คาดหวัง ส่งใบสมัครด้วย $120k ไหม?', 'El formulario pide una expectativa salarial. ¿Envío la postulación con $120k?', 'Biểu mẫu hỏi mức lương mong muốn. Gửi hồ sơ với $120k nhé?', 'フォームで希望年収を聞かれています。12万ドルで応募しますか？'],
  'This finding looks close to a public report from March. Submit it anyway?': ['Эта находка похожа на публичный отчёт из марта. Всё равно отправить?', '这个发现和三月的一份公开报告很像。仍然提交吗？', 'สิ่งที่พบนี้คล้ายรายงานสาธารณะเมื่อเดือนมีนาคม ส่งต่อไหม?', 'Este hallazgo se parece a un informe público de marzo. ¿Lo envío igualmente?', 'Phát hiện này gần giống một báo cáo công khai hồi tháng Ba. Vẫn gửi chứ?', 'この発見は3月の公開報告に似ています。それでも提出しますか？'],
  'Hiring': ['Найм', '招聘', 'จ้างงาน', 'Contratación', 'Tuyển dụng', '採用'],
  'hire': [['сотрудник', 'сотрудника', 'сотрудников'], '录用', 'คนที่จ้างแล้ว', ['contratación', 'contrataciones'], 'người được tuyển', '採用'],
  'candidate sourced': [['найденный кандидат', 'найденных кандидата', 'найденных кандидатов'], '找到的候选人', 'ผู้สมัครที่พบ', ['candidato encontrado', 'candidatos encontrados'], 'ứng viên tìm thấy', '見つけた候補者'],
  'screened': [['прошёл отбор', 'прошли отбор', 'прошли отбор'], '已筛选', 'ผ่านคัดกรอง', ['filtrado', 'filtrados'], 'đã sàng lọc', '書類選考通過'],
  'interviewed': [['прошёл интервью', 'прошли интервью', 'прошли интервью'], '已面试', 'สัมภาษณ์แล้ว', ['entrevistado', 'entrevistados'], 'đã phỏng vấn', '面接済み'],
  'final interview': [['финальное интервью', 'финальных интервью', 'финальных интервью'], '终面', 'สัมภาษณ์รอบสุดท้าย', ['entrevista final', 'entrevistas finales'], 'phỏng vấn cuối', '最終面接'],
  'Freelance Clients': ['Клиенты на фрилансе', '自由职业客户', 'ลูกค้าฟรีแลนซ์', 'Clientes freelance', 'Khách hàng freelance', 'フリーランスの顧客'],
  'client': [['клиент', 'клиента', 'клиентов'], '客户', 'ลูกค้า', ['cliente', 'clientes'], 'khách hàng', '顧客'],
  'lead': [['лид', 'лида', 'лидов'], '潜在客户', 'ลีด', ['contacto', 'contactos'], 'khách tiềm năng', '見込み客'],
  'reply': [['ответ', 'ответа', 'ответов'], '回复', 'การตอบกลับ', ['respuesta', 'respuestas'], 'phản hồi', '返信'],
  'call': [['созвон', 'созвона', 'созвонов'], '通话', 'การโทร', ['llamada', 'llamadas'], 'cuộc gọi', '通話'],
  'offer sent': [['отправленный оффер', 'отправленных оффера', 'отправленных офферов'], '已发出的录用通知', 'ข้อเสนอที่ส่งแล้ว', ['oferta enviada', 'ofertas enviadas'], 'lời mời đã gửi', '送付済みの内定'],
  'proposal': [['предложение', 'предложения', 'предложений'], '提案', 'ข้อเสนอ', ['propuesta', 'propuestas'], 'đề xuất', '提案'],
  'contract sent': [['отправленный договор', 'отправленных договора', 'отправленных договоров'], '已发合同', 'สัญญาที่ส่งแล้ว', ['contrato enviado', 'contratos enviados'], 'hợp đồng đã gửi', '送付済みの契約書'],
  'recorded': [['записан', 'записано', 'записано'], '已录制', 'บันทึกแล้ว', ['grabado', 'grabados'], 'đã ghi âm', '収録済み'],
  'Podcast Tour': ['Подкасты', '播客巡回', 'ทัวร์พอดแคสต์', 'Gira de pódcasts', 'Chuỗi podcast', 'ポッドキャスト出演'],
  'episode aired': [['вышедший эфир', 'вышедших эфира', 'вышедших эфиров'], '已播出的节目', 'ตอนที่ออกอากาศ', ['episodio emitido', 'episodios emitidos'], 'tập đã phát sóng', '配信済みの回'],
  'show found': [['найденное шоу', 'найденных шоу', 'найденных шоу'], '找到的节目', 'รายการที่พบ', ['programa encontrado', 'programas encontrados'], 'chương trình tìm thấy', '見つけた番組'],
  'pitch': [['заявка', 'заявки', 'заявок'], '自荐', 'การเสนอตัว', ['propuesta', 'propuestas'], 'lời chào', '売り込み'],
  'booked': [['назначенная запись', 'назначенные записи', 'назначенных записей'], '已约定', 'จองแล้ว', ['agendado', 'agendados'], 'đã đặt lịch', '収録決定'],
  'The backend candidate asks to start in January instead of December. Agree?': ['Кандидат на бэкенд просит выйти в январе, а не в декабре. Согласиться?', '后端候选人希望一月而不是十二月入职。同意吗？', 'ผู้สมัครตำแหน่งแบ็กเอนด์ขอเริ่มงานเดือนมกราคมแทนธันวาคม ตกลงไหม?', 'El candidato de backend pide empezar en enero en vez de diciembre. ¿Acepto?', 'Ứng viên backend xin bắt đầu vào tháng Một thay vì tháng Mười Hai. Đồng ý chứ?', 'バックエンドの候補者が12月ではなく1月からの入社を希望しています。了承しますか？'],
  'The client wants a fixed price for the landing page. Quote $2,500?': ['Клиент хочет фиксированную цену за лендинг. Назвать $2 500?', '客户想要落地页的固定报价。报 2500 美元吗？', 'ลูกค้าต้องการราคาเหมาสำหรับหน้าแลนดิ้ง เสนอ $2,500 ไหม?', 'El cliente quiere un precio cerrado por la landing. ¿Ofrezco 2.500 $?', 'Khách muốn giá trọn gói cho trang landing. Báo giá $2.500 nhé?', 'クライアントがランディングページの固定価格を求めています。2,500ドルで見積もりますか？'],
  'Northwind Ventures asks for the cap table before Thursday. Share it from the data room?': ['Northwind Ventures просит таблицу капитализации до четверга. Дать доступ из data room?', 'Northwind Ventures 要求周四前提供股权结构表。从数据室共享吗？', 'Northwind Ventures ขอตารางผู้ถือหุ้นก่อนวันพฤหัสบดี แชร์จากดาต้ารูมไหม?', 'Northwind Ventures pide la tabla de capitalización antes del jueves. ¿La comparto desde el data room?', 'Northwind Ventures cần bảng cơ cấu vốn trước thứ Năm. Chia sẻ từ data room nhé?', 'Northwind Ventures が木曜までに資本政策表を求めています。データルームから共有しますか？'],
  'The florist can do peonies for $1,200 on June 14. Book them?': ['Флорист сделает пионы за $1 200 к 14 июня. Бронируем?', '花艺师可以在6月14日用牡丹布置，价格 $1,200。要预订吗？', 'ร้านดอกไม้จัดดอกโบตั๋นให้ได้ในราคา $1,200 วันที่ 14 มิถุนายน จองเลยไหม?', 'La florista puede hacer peonías por $1.200 para el 14 de junio. ¿La reservo?', 'Tiệm hoa làm được hoa mẫu đơn giá $1.200 cho ngày 14/6. Đặt luôn nhé?', 'フローリストが6月14日に芍薬を$1,200で用意できます。予約しますか？'],
};
const COL = { ru: 0, zh: 1, th: 2, es: 3, vi: 4, ja: 5 }[lang];
const tr = text => (COL == null ? text : DEMO[text]?.[COL] ?? text);
const trForms = forms => (COL == null ? forms : DEMO[forms[0]] ? [DEMO[forms[0]][COL]].flat() : forms);
if (COL != null) for (const f of FUNNELS) {
  f.title = tr(f.title);
  f.result = trForms(f.result);
  for (const st of f.stages) st.forms = trForms(st.forms);
  if (f.supervisor) { if (f.supervisor.summary) f.supervisor.summary = tr(f.supervisor.summary); if (f.supervisor.question) f.supervisor.question = tr(f.supervisor.question); }
  for (const w of f.workers) {
    if (w.question) w.question = tr(w.question);
    for (const r of w.replies || []) { r.question = tr(r.question); r.answer = tr(r.answer); r.reply = tr(r.reply); }
  }
}

// Demo only: start each stage with a count that matches the funnel's conversion, so the tanks
// are consistent with the results so far. A stage holds enough for the results already out plus
// a lead of 15% of the remaining goal per stage below it (work in progress). Funnels with an unknown flow keep
// their written counts.
for (const f of FUNNELS) {
  const n = f.stages.length, fl = f.flows;
  if (fl.some(v => v == null)) continue;
  let yieldFrom = 1;
  for (let j = n - 1; j >= 0; j--) {
    yieldFrom *= Math.min(1, fl[j + 1] / fl[j]);
    f.stages[j].count = Math.round((f.cubes + 0.15 * (f.goal.total - f.cubes) * (n - j)) / yieldFrom);
  }
}

// forms: [singular, plural] (English, Spanish), [1, 2-4, 5+] (Russian) or one form (Chinese, Japanese, Thai, Vietnamese).
export function plural(n, forms) {
  if (forms.length === 1) return forms[0];
  if (forms.length === 2) return n === 1 ? forms[0] : forms[1];
  const [one, few, many] = forms;
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
