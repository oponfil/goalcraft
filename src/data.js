// Demo data shown on the landing page. In the product this comes from agents via MCP.
import { lang } from './i18n.js?v=56dad7ea';

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
    // The person's tasks its supervisor keeps, most urgent first (dueIn: hours from now).
    tasks: [
      { title: 'Confirm the interview time with Vertical Aerospace', detail: 'Pick one of the three slots in the recruiter\'s email.', url: 'https://mail.google.com', dueIn: 5 },
      { title: 'Do the take-home task for Seven AI', detail: 'About two hours; the brief is in your email.', url: 'https://mail.google.com', dueIn: 30 },
      { title: 'Update your LinkedIn headline', detail: 'Recruiters search for “AI product manager”.', url: 'https://www.linkedin.com' },
    ],
    source_url: 'https://docs.google.com/spreadsheets',
    guide_url: 'https://docs.google.com/document',
    theme: 'mine',
    result: ['offer', 'offers'],
    stages: [
      { count: 240, forms: ['job found', 'jobs found'] },
      { count: 96, forms: ['applied', 'applied'] },
      { count: 30, forms: ['screening call', 'screening calls'] },
      { count: 14, forms: ['interview', 'interviews'] },
      { count: 4, forms: ['final round', 'final rounds'] },
    ],
    flows: [8, 2.5, 1, 0.5, 0.15, 1 / 21],
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
    title: 'Dating',
    theme: 'love',
    result: ['relationship', 'relationships'],
    stages: [
      { count: 180, forms: ['match', 'matches'] },
      { count: 64, forms: ['conversation', 'conversations'] },
      { count: 9, forms: ['first date', 'first dates'] },
      { count: 3, forms: ['second date', 'second dates'] },
      { count: 1, forms: ['sleepover', 'sleepovers'] },
    ],
    flows: [8, 1.5, 0.5, 0.2, 0.08, 1 / 60],
    cubes: 0,
    goal: { total: 1, every: 30 },
    // The supervisor on the platform: what its last run found.
    supervisor: { agent: 'chatgpt', state: 'work', status: 'ok', summary: 'on pace for the goal' },
    workers: [
      { agent: 'kimi', zone: -1, state: 'work' },
      { agent: 'claude', zone: 0, state: 'work' },
      { agent: 'qwen', zone: 0, state: 'sleep', wakeIn: 15 },
      {
        agent: 'grok', zone: 1, state: 'ask',
        question: 'Alex suggested Saturday at 7pm at the rooftop bar. Confirm the date?',
      },
      { agent: 'chatgpt', zone: 2, state: 'sleep', wakeIn: 9 * 3600 },
      { agent: 'gemini', zone: 2, state: 'work' },
      { agent: 'deepseek', zone: 3, state: 'work' },
      { agent: 'mistral', zone: 4, state: 'work' },
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
    tasks: [
      { title: 'Verify your identity on HackerOne', detail: 'Payouts wait until you do.', url: 'https://hackerone.com' },
    ],
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
    tasks: [
      { title: 'Send the data room link to the lead investor', detail: 'They asked for it after the first call.', dueIn: -3 },
      { title: 'Record a two-minute product demo', detail: 'Investors ask for it in almost every reply.' },
    ],
    source_url: 'https://airtable.com',
    guide_url: 'https://www.notion.so',
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
    supervisor: { agent: 'gemini', state: 'ask', status: 'recommendation', summary: 'take the lead investor first', question: 'Two investors asked for a call on Friday. Take both, or only the lead?' },
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
    title: 'Research',
    source_url: 'https://www.notion.so',
    guide_url: 'https://www.notion.so',
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
    flows: [7, 1.5, 0.8, 0.3, 0.2, 1 / 7],
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
// English text. Columns: Russian, Chinese, Thai, Spanish, Vietnamese, Japanese, Portuguese, Turkish,
// Korean. Russian names have three forms [1, 2-4, 5+], Spanish and Portuguese two [1, many]; Chinese,
// Thai, Vietnamese, Japanese, Turkish (a noun after a number stays singular) and Korean have one.
const DEMO = {
  'Confirm the interview time with Vertical Aerospace': ['Подтвердить время интервью с Vertical Aerospace', '确认与 Vertical Aerospace 的面试时间', 'ยืนยันเวลาสัมภาษณ์กับ Vertical Aerospace', 'Confirmar la hora de la entrevista con Vertical Aerospace', 'Xác nhận giờ phỏng vấn với Vertical Aerospace', 'Vertical Aerospace との面接時間を確定する', 'Confirmar o horário da entrevista com a Vertical Aerospace', 'Vertical Aerospace ile mülakat saatini onayla', 'Vertical Aerospace 면접 시간 확정하기'],
  "Pick one of the three slots in the recruiter's email.": ['Выберите одно из трёх окон в письме рекрутера.', '在招聘人员的邮件里从三个时段中选一个。', 'เลือกหนึ่งในสามช่วงเวลาในอีเมลของผู้สรรหา', 'Elige uno de los tres horarios del correo del reclutador.', 'Chọn một trong ba khung giờ trong email của nhà tuyển dụng.', 'リクルーターのメールにある3つの枠から1つを選んでください。', 'Escolha um dos três horários no e-mail do recrutador.', 'İşe alım uzmanının e-postasındaki üç saatten birini seç.', '리크루터 메일에 있는 세 가지 시간 중 하나를 고르세요.'],
  'Do the take-home task for Seven AI': ['Сделать тестовое задание для Seven AI', '完成 Seven AI 的笔试作业', 'ทำแบบทดสอบที่บ้านของ Seven AI', 'Hacer la prueba técnica de Seven AI', 'Làm bài kiểm tra tại nhà cho Seven AI', 'Seven AI の課題を仕上げる', 'Fazer o teste prático da Seven AI', 'Seven AI için ev ödevini yap', 'Seven AI 과제 수행하기'],
  'About two hours; the brief is in your email.': ['Часа на два; задание у вас в почте.', '大约两小时；题目在你的邮箱里。', 'ราวสองชั่วโมง โจทย์อยู่ในอีเมลของคุณ', 'Unas dos horas; el enunciado está en tu correo.', 'Khoảng hai giờ; đề bài trong email của bạn.', '約2時間。課題の内容はメールにあります。', 'Cerca de duas horas; o enunciado está no seu e-mail.', 'Yaklaşık iki saat; görev e-postanda.', '두 시간 정도 걸려요. 과제 설명은 메일에 있어요.'],
  'Update your LinkedIn headline': ['Обновить заголовок в LinkedIn', '更新 LinkedIn 标题', 'อัปเดตหัวข้อโปรไฟล์ LinkedIn', 'Actualizar el titular de LinkedIn', 'Cập nhật tiêu đề LinkedIn', 'LinkedIn の見出しを更新する', 'Atualizar o título do LinkedIn', 'LinkedIn başlığını güncelle', 'LinkedIn 헤드라인 업데이트하기'],
  'Recruiters search for “AI product manager”.': ['Рекрутеры ищут «AI product manager».', '招聘人员搜索的是“AI product manager”。', 'ผู้สรรหาค้นหาคำว่า “AI product manager”', 'Los reclutadores buscan «AI product manager».', 'Nhà tuyển dụng tìm “AI product manager”.', 'リクルーターは「AI product manager」で検索しています。', 'Os recrutadores buscam “AI product manager”.', 'İşe alımcılar “AI product manager” diye arıyor.', '리크루터들은 “AI product manager”로 검색해요.'],
  'Send the data room link to the lead investor': ['Отправить ссылку на data room ведущему инвестору', '把数据室链接发给领投方', 'ส่งลิงก์ data room ให้นักลงทุนหลัก', 'Enviar el enlace del data room al inversor líder', 'Gửi đường dẫn data room cho nhà đầu tư dẫn dắt', 'リード投資家にデータルームのリンクを送る', 'Enviar o link do data room ao investidor líder', 'Veri odası bağlantısını lider yatırımcıya gönder', '리드 투자자에게 데이터룸 링크 보내기'],
  'They asked for it after the first call.': ['Просили после первого созвона.', '第一次通话后他们要过。', 'เขาขอไว้หลังคุยครั้งแรก', 'Lo pidieron tras la primera llamada.', 'Họ đã xin sau cuộc gọi đầu tiên.', '最初の通話のあとに頼まれました。', 'Pediram depois da primeira call.', 'İlk görüşmeden sonra istediler.', '첫 통화 후에 요청했어요.'],
  'Record a two-minute product demo': ['Записать двухминутное демо продукта', '录一段两分钟的产品演示', 'อัดวิดีโอเดโมผลิตภัณฑ์สองนาที', 'Grabar una demo del producto de dos minutos', 'Quay bản demo sản phẩm hai phút', '2分間の製品デモを録画する', 'Gravar uma demo de dois minutos do produto', 'İki dakikalık ürün demosu kaydet', '2분짜리 제품 데모 녹화하기'],
  'Investors ask for it in almost every reply.': ['Инвесторы просят его почти в каждом ответе.', '几乎每封回复里投资人都在要。', 'นักลงทุนขอแทบทุกครั้งที่ตอบกลับ', 'Los inversores lo piden en casi cada respuesta.', 'Nhà đầu tư hỏi nó trong gần như mọi phản hồi.', 'ほぼすべての返信で投資家から求められています。', 'Os investidores pedem em quase toda resposta.', 'Yatırımcılar neredeyse her yanıtta bunu istiyor.', '투자자들이 거의 모든 답장에서 요청해요.'],
  'Verify your identity on HackerOne': ['Подтвердить личность на HackerOne', '在 HackerOne 上完成身份验证', 'ยืนยันตัวตนบน HackerOne', 'Verificar tu identidad en HackerOne', 'Xác minh danh tính trên HackerOne', 'HackerOne で本人確認をする', 'Verificar sua identidade no HackerOne', 'HackerOne’da kimliğini doğrula', 'HackerOne에서 본인 인증하기'],
  'Payouts wait until you do.': ['Выплаты ждут, пока вы это не сделаете.', '完成之前奖金不会发放。', 'การจ่ายเงินจะรอจนกว่าคุณจะยืนยัน', 'Los pagos esperan hasta que lo hagas.', 'Tiền thưởng sẽ chờ đến khi bạn làm xong.', '完了するまで報酬の支払いは保留されます。', 'Os pagamentos aguardam até você fazer isso.', 'Sen yapana kadar ödemeler bekliyor.', '인증하기 전까지 지급이 보류돼요.'],
  'Post the next video on YouTube or TikTok first?': ['Следующее видео сначала на YouTube или в TikTok?', '下一个视频先发 YouTube 还是 TikTok？', 'คลิปถัดไปลง YouTube หรือ TikTok ก่อน?', '¿Publico el próximo vídeo primero en YouTube o en TikTok?', 'Video tiếp theo đăng YouTube hay TikTok trước?', '次の動画はYouTubeとTikTok、どちらを先に？', 'Posto o próximo vídeo primeiro no YouTube ou no TikTok?', 'Sonraki videoyu önce YouTube’a mı TikTok’a mı koyayım?', '다음 영상을 YouTube와 TikTok 중 어디에 먼저 올릴까요?'],
  'TikTok first': ['Сначала TikTok', '先发 TikTok', 'TikTok ก่อน', 'Primero TikTok', 'TikTok trước', 'TikTokを先に', 'Primeiro no TikTok', 'Önce TikTok', 'TikTok 먼저'],
  'Got it: posting to TikTok first.': ['Понял: сначала публикую в TikTok.', '明白：先发到 TikTok。', 'รับทราบ: ลง TikTok ก่อน', 'Entendido: primero publico en TikTok.', 'Đã rõ: đăng lên TikTok trước.', '了解：まずTikTokに投稿します。', 'Entendi: posto primeiro no TikTok.', 'Anladım: önce TikTok’a koyuyorum.', '알겠습니다: TikTok에 먼저 올릴게요.'],
  'interviews → final round': ['интервью → финал', '面试 → 终面', 'สัมภาษณ์ → รอบสุดท้าย', 'entrevistas → ronda final', 'phỏng vấn → vòng cuối', '面接 → 最終面接', 'entrevistas → rodada final', 'mülakatlar → son tur', '면접 → 최종 면접'],
  'on pace for the goal': ['идём в темпе цели', '按目标节奏推进', 'เดินตามจังหวะเป้าหมาย', 'al ritmo de la meta', 'đúng nhịp mục tiêu', '目標のペース通り', 'no ritmo da meta', 'hedefin hızında', '목표 속도대로 진행 중'],
  'add an agent on the inflow': ['добавить агента на входящие', '在入口处再加一个智能体', 'เพิ่มเอเจนต์ที่ทางเข้า', 'añadir un agente en la entrada', 'thêm một tác tử ở đầu vào', '入口にエージェントを追加', 'adicionar um agente na entrada', 'girişe bir ajan ekle', '유입 단계에 에이전트 추가'],
  'replies come back slowly': ['ответы приходят медленно', '回复来得慢', 'คำตอบกลับมาช้า', 'las respuestas tardan', 'phản hồi về chậm', '返信が遅い', 'as respostas demoram', 'yanıtlar yavaş geliyor', '답장이 느리게 옴'],
  'speed up the first replies': ['быстрее отвечать на первые письма', '加快首次回复', 'ตอบกลับครั้งแรกให้เร็วขึ้น', 'responder antes a los primeros mensajes', 'trả lời lần đầu nhanh hơn', '最初の返信を早める', 'responder mais rápido às primeiras mensagens', 'ilk yanıtları hızlandır', '첫 답장을 더 빠르게'],
  'Two investors asked for a call on Friday. Take both, or only the lead?': ['Два инвестора просят созвон в пятницу. Брать обоих или только ведущего?', '两位投资人要求周五通话。两个都约，还是只约领投方？', 'นักลงทุนสองรายขอคุยวันศุกร์ รับทั้งคู่หรือเฉพาะผู้นำการลงทุน?', 'Dos inversores piden una llamada el viernes. ¿Ambos o solo el líder?', 'Hai nhà đầu tư muốn gọi vào thứ Sáu. Nhận cả hai hay chỉ nhà đầu tư dẫn dắt?', '2人の投資家が金曜の通話を希望しています。両方受けますか、リードだけにしますか？', 'Dois investidores pediram uma call na sexta. Aceito os dois ou só o líder?', 'İki yatırımcı cuma günü görüşme istedi. İkisini de mi alayım, yalnızca lideri mi?', '투자자 두 명이 금요일 통화를 요청했습니다. 둘 다 할까요, 리드 투자자만 할까요?'],
  'Job Search': ['Поиск работы', '找工作', 'หางาน', 'Búsqueda de empleo', 'Tìm việc', '就職活動', 'Busca de emprego', 'İş arama', '구직'],
  'Creator': ['Автор', '创作者', 'ครีเอเตอร์', 'Creador', 'Nhà sáng tạo', 'クリエイター', 'Criador', 'İçerik üreticisi', '크리에이터'],
  'Bug Bounty': ['Баг-баунти', '漏洞赏金', 'บั๊กบาวน์ตี้', 'Bug bounty', 'Săn lỗi', 'バグバウンティ', 'Bug bounty', 'Hata ödülü', '버그 바운티'],
  'Fundraising': ['Привлечение инвестиций', '融资', 'ระดมทุน', 'Inversión', 'Gọi vốn', '資金調達', 'Captação', 'Yatırım turu', '투자 유치'],
  'Dating': ['Знакомства', '约会', 'หาคู่', 'Citas', 'Hẹn hò', '婚活', 'Encontros', 'Flört', '데이팅'],
  'Research': ['Исследования', '科研', 'งานวิจัย', 'Investigación', 'Nghiên cứu', '研究', 'Pesquisa', 'Araştırma', '연구'],
  'offer': [['оффер', 'оффера', 'офферов'], '录用通知', 'ข้อเสนองาน', ['oferta', 'ofertas'], 'lời mời làm việc', '内定', ['oferta', 'ofertas'], 'iş teklifi', '채용 제안'],
  'job found': [['найденная вакансия', 'найденные вакансии', 'найденных вакансий'], '找到的职位', 'งานที่พบ', ['vacante encontrada', 'vacantes encontradas'], 'việc tìm thấy', '見つけた求人', ['vaga encontrada', 'vagas encontradas'], 'bulunan ilan', '찾은 공고'],
  'applied': [['отклик', 'отклика', 'откликов'], '已投递', 'สมัครแล้ว', ['postulación', 'postulaciones'], 'đã ứng tuyển', '応募済み', ['candidatura', 'candidaturas'], 'başvuru', '지원'],
  'screening call': [['созвон с HR', 'созвона с HR', 'созвонов с HR'], '初筛电话', 'โทรคัดกรอง', ['llamada de selección', 'llamadas de selección'], 'cuộc gọi sàng lọc', '書類選考の電話', ['call de triagem', 'calls de triagem'], 'ön görüşme', '스크리닝 통화'],
  'interview': [['собеседование', 'собеседования', 'собеседований'], '面试', 'สัมภาษณ์', ['entrevista', 'entrevistas'], 'phỏng vấn', '面接', ['entrevista', 'entrevistas'], 'mülakat', '면접'],
  'final round': [['финальный раунд', 'финальных раунда', 'финальных раундов'], '终面', 'รอบสุดท้าย', ['ronda final', 'rondas finales'], 'vòng cuối', '最終面接', ['rodada final', 'rodadas finais'], 'son tur', '최종 면접'],
  'paying member': [['платный подписчик', 'платных подписчика', 'платных подписчиков'], '付费会员', 'สมาชิกที่จ่ายเงิน', ['miembro de pago', 'miembros de pago'], 'thành viên trả phí', '有料会員', ['membro pagante', 'membros pagantes'], 'ücretli üye', '유료 회원'],
  'view': [['просмотр', 'просмотра', 'просмотров'], '浏览', 'ยอดวิว', ['visualización', 'visualizaciones'], 'lượt xem', '閲覧', ['visualização', 'visualizações'], 'görüntülenme', '조회'],
  'profile visit': [['заход в профиль', 'захода в профиль', 'заходов в профиль'], '主页访问', 'เข้าชมโปรไฟล์', ['visita al perfil', 'visitas al perfil'], 'lượt vào hồ sơ', 'プロフィール訪問', ['visita ao perfil', 'visitas ao perfil'], 'profil ziyareti', '프로필 방문'],
  'follower': [['подписчик', 'подписчика', 'подписчиков'], '粉丝', 'ผู้ติดตาม', ['seguidor', 'seguidores'], 'người theo dõi', 'フォロワー', ['seguidor', 'seguidores'], 'takipçi', '팔로워'],
  'subscriber': [['подписчик рассылки', 'подписчика рассылки', 'подписчиков рассылки'], '订阅者', 'ผู้สมัครรับ', ['suscriptor', 'suscriptores'], 'người đăng ký', '購読者', ['inscrito', 'inscritos'], 'abone', '구독자'],
  'trial member': [['пробный участник', 'пробных участника', 'пробных участников'], '试用会员', 'สมาชิกทดลอง', ['miembro de prueba', 'miembros de prueba'], 'thành viên dùng thử', 'お試し会員', ['membro em teste', 'membros em teste'], 'deneme üyesi', '체험 회원'],
  'paid bounty': [['оплаченная награда', 'оплаченные награды', 'оплаченных наград'], '已付赏金', 'รางวัลที่จ่ายแล้ว', ['recompensa pagada', 'recompensas pagadas'], 'tiền thưởng đã trả', '支払われた報奨金', ['recompensa paga', 'recompensas pagas'], 'ödenen ödül', '지급된 보상금'],
  'target': [['цель', 'цели', 'целей'], '目标', 'เป้าหมาย', ['objetivo', 'objetivos'], 'mục tiêu', '対象', ['alvo', 'alvos'], 'hedef', '대상'],
  'finding': [['находка', 'находки', 'находок'], '发现', 'สิ่งที่พบ', ['hallazgo', 'hallazgos'], 'phát hiện', '発見', ['achado', 'achados'], 'bulgu', '발견'],
  'report': [['отчёт', 'отчёта', 'отчётов'], '报告', 'รายงาน', ['informe', 'informes'], 'báo cáo', '報告', ['relatório', 'relatórios'], 'rapor', '리포트'],
  'triaged': [['разобран', 'разобрано', 'разобрано'], '已分类', 'คัดกรองแล้ว', ['clasificado', 'clasificados'], 'đã phân loại', 'トリアージ済み', ['triado', 'triados'], 'incelendi', '분류됨'],
  'accepted': [['принят', 'принято', 'принято'], '已接受', 'ได้รับการยอมรับ', ['aceptado', 'aceptados'], 'được chấp nhận', '受理', ['aceito', 'aceitos'], 'kabul edildi', '수락됨'],
  'term sheet': [['термшит', 'термшита', 'термшитов'], '投资意向书', 'เทิร์มชีต', ['term sheet', 'term sheets'], 'bản điều khoản', 'タームシート', ['term sheet', 'term sheets'], 'term sheet', '텀시트'],
  'investor': [['инвестор', 'инвестора', 'инвесторов'], '投资人', 'นักลงทุน', ['inversor', 'inversores'], 'nhà đầu tư', '投資家', ['investidor', 'investidores'], 'yatırımcı', '투자자'],
  'intro': [['знакомство', 'знакомства', 'знакомств'], '引荐', 'การแนะนำ', ['presentación', 'presentaciones'], 'lời giới thiệu', '紹介', ['apresentação', 'apresentações'], 'tanıştırma', '소개'],
  'meeting': [['встреча', 'встречи', 'встреч'], '会议', 'การประชุม', ['reunión', 'reuniones'], 'cuộc gặp', '面談', ['reunião', 'reuniões'], 'toplantı', '미팅'],
  'partner meeting': [['встреча с партнёром', 'встречи с партнёрами', 'встреч с партнёрами'], '合伙人会议', 'ประชุมกับพาร์ทเนอร์', ['reunión con socios', 'reuniones con socios'], 'cuộc gặp đối tác', 'パートナー面談', ['reunião com sócios', 'reuniões com sócios'], 'ortak toplantısı', '파트너 미팅'],
  'in due diligence': [['на проверке', 'на проверке', 'на проверке'], '尽职调查中', 'อยู่ระหว่างตรวจสอบ', ['en due diligence', 'en due diligence'], 'đang thẩm định', 'デューデリジェンス中', ['em due diligence', 'em due diligence'], 'due diligence aşamasında', '실사 중'],
  'relationship': [['отношения', 'отношений', 'отношений'], '恋爱关系', 'ความสัมพันธ์', ['relación', 'relaciones'], 'mối quan hệ', '交際', ['relacionamento', 'relacionamentos'], 'ilişki', '연애'],
  'match': [['мэтч', 'мэтча', 'мэтчей'], '配对', 'แมตช์', ['match', 'matches'], 'lượt ghép đôi', 'マッチ', ['match', 'matches'], 'eşleşme', '매치'],
  'conversation': [['переписка', 'переписки', 'переписок'], '聊天', 'บทสนทนา', ['conversación', 'conversaciones'], 'cuộc trò chuyện', 'やり取り', ['conversa', 'conversas'], 'sohbet', '대화'],
  'first date': [['первое свидание', 'первых свидания', 'первых свиданий'], '第一次约会', 'เดทแรก', ['primera cita', 'primeras citas'], 'buổi hẹn đầu', '初デート', ['primeiro encontro', 'primeiros encontros'], 'ilk buluşma', '첫 데이트'],
  'second date': [['второе свидание', 'вторых свидания', 'вторых свиданий'], '第二次约会', 'เดทที่สอง', ['segunda cita', 'segundas citas'], 'buổi hẹn thứ hai', '2回目のデート', ['segundo encontro', 'segundos encontros'], 'ikinci buluşma', '두 번째 데이트'],
  'sleepover': [['ночёвка', 'ночёвки', 'ночёвок'], '过夜', 'ค้างคืน', ['noche juntos', 'noches juntos'], 'ngủ lại', 'お泊まり', ['noite juntos', 'noites juntos'], 'birlikte geçen gece', '함께 보낸 밤'],
  'published paper': [['опубликованная статья', 'опубликованные статьи', 'опубликованных статей'], '已发表论文', 'บทความที่ตีพิมพ์', ['artículo publicado', 'artículos publicados'], 'bài báo đã đăng', '掲載論文', ['artigo publicado', 'artigos publicados'], 'yayımlanan makale', '게재된 논문'],
  'idea': [['идея', 'идеи', 'идей'], '想法', 'ไอเดีย', ['idea', 'ideas'], 'ý tưởng', 'アイデア', ['ideia', 'ideias'], 'fikir', '아이디어'],
  'draft': [['черновик', 'черновика', 'черновиков'], '草稿', 'ฉบับร่าง', ['borrador', 'borradores'], 'bản nháp', '草稿', ['rascunho', 'rascunhos'], 'taslak', '초안'],
  'preprint': [['препринт', 'препринта', 'препринтов'], '预印本', 'พรีปรินต์', ['preprint', 'preprints'], 'bản tiền ấn phẩm', 'プレプリント', ['preprint', 'preprints'], 'ön baskı', '프리프린트'],
  'submitted': [['отправлена', 'отправлены', 'отправлено'], '已投稿', 'ส่งแล้ว', ['enviado', 'enviados'], 'đã nộp', '投稿済み', ['submetido', 'submetidos'], 'gönderildi', '투고됨'],
  'under review': [['на рецензии', 'на рецензии', 'на рецензии'], '审稿中', 'อยู่ระหว่างพิจารณา', ['en revisión', 'en revisión'], 'đang phản biện', '査読中', ['em revisão', 'em revisão'], 'hakem incelemesinde', '심사 중'],
  'The form asks for a salary expectation. Send the application with $120k?': ['В форме спрашивают ожидаемую зарплату. Отправить отклик с $120k?', '表单要求填写期望薪资。用 12 万美元提交申请吗？', 'แบบฟอร์มถามเงินเดือนที่คาดหวัง ส่งใบสมัครด้วย $120k ไหม?', 'El formulario pide una expectativa salarial. ¿Envío la postulación con $120k?', 'Biểu mẫu hỏi mức lương mong muốn. Gửi hồ sơ với $120k nhé?', 'フォームで希望年収を聞かれています。12万ドルで応募しますか？', 'O formulário pede a pretensão salarial. Envio a candidatura com $120k?', 'Form maaş beklentisi soruyor. Başvuruyu $120k ile göndereyim mi?', '양식에서 희망 연봉을 묻습니다. $120k로 지원할까요?'],
  'This finding looks close to a public report from March. Submit it anyway?': ['Эта находка похожа на публичный отчёт из марта. Всё равно отправить?', '这个发现和三月的一份公开报告很像。仍然提交吗？', 'สิ่งที่พบนี้คล้ายรายงานสาธารณะเมื่อเดือนมีนาคม ส่งต่อไหม?', 'Este hallazgo se parece a un informe público de marzo. ¿Lo envío igualmente?', 'Phát hiện này gần giống một báo cáo công khai hồi tháng Ba. Vẫn gửi chứ?', 'この発見は3月の公開報告に似ています。それでも提出しますか？', 'Este achado parece um relatório público de março. Envio mesmo assim?', 'Bu bulgu mart ayındaki herkese açık bir rapora benziyor. Yine de göndereyim mi?', '이 발견은 3월에 공개된 리포트와 비슷해 보입니다. 그래도 제출할까요?'],
  'Hiring': ['Найм', '招聘', 'จ้างงาน', 'Contratación', 'Tuyển dụng', '採用', 'Contratação', 'İşe alım', '채용'],
  'hire': [['сотрудник', 'сотрудника', 'сотрудников'], '录用', 'คนที่จ้างแล้ว', ['contratación', 'contrataciones'], 'người được tuyển', '採用', ['contratação', 'contratações'], 'işe alınan', '채용'],
  'candidate sourced': [['найденный кандидат', 'найденных кандидата', 'найденных кандидатов'], '找到的候选人', 'ผู้สมัครที่พบ', ['candidato encontrado', 'candidatos encontrados'], 'ứng viên tìm thấy', '見つけた候補者', ['candidato encontrado', 'candidatos encontrados'], 'bulunan aday', '찾은 후보'],
  'screened': [['прошёл отбор', 'прошли отбор', 'прошли отбор'], '已筛选', 'ผ่านคัดกรอง', ['filtrado', 'filtrados'], 'đã sàng lọc', '書類選考通過', ['triado', 'triados'], 'ön elemeyi geçti', '서류 통과'],
  'interviewed': [['прошёл интервью', 'прошли интервью', 'прошли интервью'], '已面试', 'สัมภาษณ์แล้ว', ['entrevistado', 'entrevistados'], 'đã phỏng vấn', '面接済み', ['entrevistado', 'entrevistados'], 'mülakat yapıldı', '면접 완료'],
  'final interview': [['финальное интервью', 'финальных интервью', 'финальных интервью'], '终面', 'สัมภาษณ์รอบสุดท้าย', ['entrevista final', 'entrevistas finales'], 'phỏng vấn cuối', '最終面接', ['entrevista final', 'entrevistas finais'], 'son mülakat', '최종 면접'],
  'Freelance Clients': ['Клиенты на фрилансе', '自由职业客户', 'ลูกค้าฟรีแลนซ์', 'Clientes freelance', 'Khách hàng freelance', 'フリーランスの顧客', 'Clientes freelance', 'Serbest çalışma müşterileri', '프리랜스 고객'],
  'client': [['клиент', 'клиента', 'клиентов'], '客户', 'ลูกค้า', ['cliente', 'clientes'], 'khách hàng', '顧客', ['cliente', 'clientes'], 'müşteri', '고객'],
  'lead': [['лид', 'лида', 'лидов'], '潜在客户', 'ลีด', ['contacto', 'contactos'], 'khách tiềm năng', '見込み客', ['lead', 'leads'], 'potansiyel müşteri', '리드'],
  'reply': [['ответ', 'ответа', 'ответов'], '回复', 'การตอบกลับ', ['respuesta', 'respuestas'], 'phản hồi', '返信', ['resposta', 'respostas'], 'yanıt', '답장'],
  'call': [['созвон', 'созвона', 'созвонов'], '通话', 'การโทร', ['llamada', 'llamadas'], 'cuộc gọi', '通話', ['call', 'calls'], 'görüşme', '통화'],
  'offer sent': [['отправленный оффер', 'отправленных оффера', 'отправленных офферов'], '已发出的录用通知', 'ข้อเสนอที่ส่งแล้ว', ['oferta enviada', 'ofertas enviadas'], 'lời mời đã gửi', '送付済みの内定', ['oferta enviada', 'ofertas enviadas'], 'gönderilen teklif', '보낸 제안'],
  'proposal': [['предложение', 'предложения', 'предложений'], '提案', 'ข้อเสนอ', ['propuesta', 'propuestas'], 'đề xuất', '提案', ['proposta', 'propostas'], 'teklif', '제안서'],
  'contract sent': [['отправленный договор', 'отправленных договора', 'отправленных договоров'], '已发合同', 'สัญญาที่ส่งแล้ว', ['contrato enviado', 'contratos enviados'], 'hợp đồng đã gửi', '送付済みの契約書', ['contrato enviado', 'contratos enviados'], 'gönderilen sözleşme', '보낸 계약서'],
  'recorded': [['записан', 'записано', 'записано'], '已录制', 'บันทึกแล้ว', ['grabado', 'grabados'], 'đã ghi âm', '収録済み', ['gravado', 'gravados'], 'kaydedildi', '녹음 완료'],
  'Podcast Tour': ['Подкасты', '播客巡回', 'ทัวร์พอดแคสต์', 'Gira de pódcasts', 'Chuỗi podcast', 'ポッドキャスト出演', 'Turnê de podcasts', 'Podcast turu', '팟캐스트 투어'],
  'episode aired': [['вышедший эфир', 'вышедших эфира', 'вышедших эфиров'], '已播出的节目', 'ตอนที่ออกอากาศ', ['episodio emitido', 'episodios emitidos'], 'tập đã phát sóng', '配信済みの回', ['episódio no ar', 'episódios no ar'], 'yayınlanan bölüm', '방송된 에피소드'],
  'show found': [['найденное шоу', 'найденных шоу', 'найденных шоу'], '找到的节目', 'รายการที่พบ', ['programa encontrado', 'programas encontrados'], 'chương trình tìm thấy', '見つけた番組', ['programa encontrado', 'programas encontrados'], 'bulunan program', '찾은 프로그램'],
  'pitch': [['заявка', 'заявки', 'заявок'], '自荐', 'การเสนอตัว', ['propuesta', 'propuestas'], 'lời chào', '売り込み', ['pitch', 'pitches'], 'teklif mesajı', '피칭'],
  'booked': [['назначенная запись', 'назначенные записи', 'назначенных записей'], '已约定', 'จองแล้ว', ['agendado', 'agendados'], 'đã đặt lịch', '収録決定', ['agendado', 'agendados'], 'ayarlandı', '섭외 확정'],
  'The backend candidate asks to start in January instead of December. Agree?': ['Кандидат на бэкенд просит выйти в январе, а не в декабре. Согласиться?', '后端候选人希望一月而不是十二月入职。同意吗？', 'ผู้สมัครตำแหน่งแบ็กเอนด์ขอเริ่มงานเดือนมกราคมแทนธันวาคม ตกลงไหม?', 'El candidato de backend pide empezar en enero en vez de diciembre. ¿Acepto?', 'Ứng viên backend xin bắt đầu vào tháng Một thay vì tháng Mười Hai. Đồng ý chứ?', 'バックエンドの候補者が12月ではなく1月からの入社を希望しています。了承しますか？', 'O candidato de backend pede para começar em janeiro em vez de dezembro. Aceito?', 'Backend adayı aralık yerine ocakta başlamak istiyor. Kabul edeyim mi?', '백엔드 후보가 12월 대신 1월에 입사하고 싶어 합니다. 동의할까요?'],
  'The client wants a fixed price for the landing page. Quote $2,500?': ['Клиент хочет фиксированную цену за лендинг. Назвать $2 500?', '客户想要落地页的固定报价。报 2500 美元吗？', 'ลูกค้าต้องการราคาเหมาสำหรับหน้าแลนดิ้ง เสนอ $2,500 ไหม?', 'El cliente quiere un precio cerrado por la landing. ¿Ofrezco 2.500 $?', 'Khách muốn giá trọn gói cho trang landing. Báo giá $2.500 nhé?', 'クライアントがランディングページの固定価格を求めています。2,500ドルで見積もりますか？', 'O cliente quer um preço fechado pela landing page. Cobro $2.500?', 'Müşteri açılış sayfası için sabit fiyat istiyor. $2.500 teklif edeyim mi?', '고객이 랜딩 페이지를 고정 가격으로 원합니다. $2,500로 견적을 낼까요?'],
  'Northwind Ventures asks for the cap table before Thursday. Share it from the data room?': ['Northwind Ventures просит таблицу капитализации до четверга. Дать доступ из data room?', 'Northwind Ventures 要求周四前提供股权结构表。从数据室共享吗？', 'Northwind Ventures ขอตารางผู้ถือหุ้นก่อนวันพฤหัสบดี แชร์จากดาต้ารูมไหม?', 'Northwind Ventures pide la tabla de capitalización antes del jueves. ¿La comparto desde el data room?', 'Northwind Ventures cần bảng cơ cấu vốn trước thứ Năm. Chia sẻ từ data room nhé?', 'Northwind Ventures が木曜までに資本政策表を求めています。データルームから共有しますか？', 'A Northwind Ventures pede o cap table antes de quinta. Compartilho pelo data room?', 'Northwind Ventures perşembeden önce hisse tablosunu istiyor. Veri odasından paylaşayım mı?', 'Northwind Ventures가 목요일 전까지 지분 구조표를 요청합니다. 데이터룸에서 공유할까요?'],
  'Alex suggested Saturday at 7pm at the rooftop bar. Confirm the date?': ['Алекс предложил субботу в 19:00 в баре на крыше. Подтвердить свидание?', 'Alex 提议周六晚上 7 点在屋顶酒吧见面。确认约会吗？', 'Alex ชวนวันเสาร์ 1 ทุ่มที่รูฟท็อปบาร์ ยืนยันเดทไหม?', 'Alex propuso el sábado a las 19:00 en el bar de la azotea. ¿Confirmo la cita?', 'Alex hẹn thứ Bảy lúc 19:00 ở quán bar sân thượng. Xác nhận buổi hẹn nhé?', 'Alex から土曜19時に屋上バーでと提案がありました。デートを確定しますか？', 'Alex sugeriu sábado às 19h no bar do rooftop. Confirmo o encontro?', 'Alex cumartesi saat 19:00’da çatı barını önerdi. Buluşmayı onaylayayım mı?', 'Alex가 토요일 저녁 7시에 루프톱 바에서 만나자고 했어요. 데이트를 확정할까요?'],
};
const COL = { ru: 0, zh: 1, th: 2, es: 3, vi: 4, ja: 5, pt: 6, tr: 7, ko: 8 }[lang];
const tr = text => (COL == null ? text : DEMO[text]?.[COL] ?? text);
const trForms = forms => (COL == null ? forms : DEMO[forms[0]] ? [DEMO[forms[0]][COL]].flat() : forms);
if (COL != null) for (const f of FUNNELS) {
  f.title = tr(f.title);
  f.result = trForms(f.result);
  for (const st of f.stages) st.forms = trForms(st.forms);
  for (const x of f.tasks || []) { x.title = tr(x.title); if (x.detail) x.detail = tr(x.detail); }
  if (f.supervisor) { if (f.supervisor.summary) f.supervisor.summary = tr(f.supervisor.summary); if (f.supervisor.question) f.supervisor.question = tr(f.supervisor.question); }
  for (const w of f.workers) {
    if (w.question) w.question = tr(w.question);
    for (const r of w.replies || []) { r.question = tr(r.question); r.answer = tr(r.answer); r.reply = tr(r.reply); }
  }
}

// Demo only: tasks' deadlines, as hours from when the page opens.
for (const f of FUNNELS) for (const x of f.tasks || []) if (x.dueIn != null) x.due_at = new Date(Date.now() + x.dueIn * 3600e3).toISOString();

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
