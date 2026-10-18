// Interface languages. The language comes from the person's choice (kept in this browser, and in
// their account once signed in), else from the browser, else English. Every text of the interface
// lives in STRINGS, one entry per key with a version per language. English, Russian, Chinese and
// Thai are columns here; Spanish, Vietnamese and Japanese are kept in src/lang/ and merged in below. A new
// language is a file there and a line in LANGS.
// Static pages mark text with data-i18n="key" (text), data-i18n-html="key" (text with links) and
// data-i18n-attr="placeholder:key; title:key"; scripts call t(key, …args).

import es from './lang/es.js?v=73ac3c6d';
import vi from './lang/vi.js?v=73ac3c6d';
import ja from './lang/ja.js?v=73ac3c6d';

export const LANGS = { en: 'English', ru: 'Русский', es: 'Español', zh: '中文', ja: '日本語', th: 'ไทย', vi: 'Tiếng Việt' };
export const SHORT = { en: 'EN', ru: 'RU', es: 'ES', zh: '中文', ja: 'JA', th: 'ไทย', vi: 'VI' };
const KEY = 'goalcraft-lang';

// Whether the person picked a language in this browser (rather than it coming from the browser).
let picked = null;
try { picked = localStorage.getItem(KEY); } catch {}
export const chosen = picked in LANGS;

function detect() {
  // ?lang=xx in the address wins for that page (not remembered): for links and the picture renderer.
  const asked = new URLSearchParams(location.search).get('lang');
  if (asked in LANGS) return asked;
  if (chosen) return picked;
  for (const l of navigator.languages || [navigator.language || '']) {
    const code = String(l).slice(0, 2).toLowerCase();
    if (code in LANGS) return code;
  }
  return 'en';
}
export const lang = detect();

// Plural category of n in this language: one, few, many or other (English, Spanish: one/other;
// Chinese, Japanese, Thai, Vietnamese: always other).
const rules = new Intl.PluralRules(lang);
export const pluralOf = n => rules.select(n);

// Choose: the person picked a language. Kept in this browser; saveRemote (set by nav.js once signed
// in) also keeps it in their account. The page reloads in the new language.
let saveRemote = null;
export const onLangSaved = fn => { saveRemote = fn; };
export async function setLang(code) {
  try { localStorage.setItem(KEY, code); } catch {}
  if (saveRemote) await saveRemote(code).catch(() => {});
  location.reload();
}
// On a device where nothing was picked yet, the account's language is adopted without asking.
export function adoptLang(code) {
  if (!(code in LANGS) || code === lang) return;
  try { localStorage.setItem(KEY, code); } catch {}
  location.reload();
}

// Flows on the board are counted per hour, day or week: one unit for every funnel, picked in the
// profile menu, per day until then. Kept in this browser; saveFlowRemote (set by nav.js once signed
// in) also keeps it in the account. The board reads flowUnit on every frame, so a change shows at once.
const FLOW_KEY = 'goalcraft-flow';
export const FLOW_UNITS = ['h', 'd', 'w'];
let flowPicked = null;
try { flowPicked = localStorage.getItem(FLOW_KEY); } catch {}
export let flowUnit = FLOW_UNITS.includes(flowPicked) ? flowPicked : 'd';
let saveFlowRemote = null;
export const onFlowSaved = fn => { saveFlowRemote = fn; };
export function setFlowUnit(unit, { remote = true } = {}) {
  if (!FLOW_UNITS.includes(unit)) return;
  flowUnit = unit;
  try { localStorage.setItem(FLOW_KEY, unit); } catch {}
  if (remote && saveFlowRemote) saveFlowRemote(unit).catch(() => {});
}

const L = (en, ru, zh, th) => ({ en, ru, zh, th });

const STRINGS = {
  // Navigation and footer
  'nav.connect': L('Connect', 'Подключить', '连接', 'เชื่อมต่อ'),
  'footer.docs': L('Docs', 'Документация', '文档', 'เอกสาร'),
  'nav.pricing': L('Pricing', 'Тарифы', '价格', 'ราคา'),
  'nav.signin': L('Sign in', 'Войти', '登录', 'เข้าสู่ระบบ'),
  'nav.goals': L('Goals', 'Цели', '目标', 'เป้าหมาย'),
  'nav.notify': L('Email me', 'Письма', '邮件通知', 'แจ้งทางอีเมล'),
  'nav.notifyTitle': L((e) => `Email ${e} when an agent asks you a question`, (e) => `Присылать письмо на ${e}, когда агент задаёт вопрос`, (e) => `智能体向你提问时发邮件到 ${e}`, (e) => `ส่งอีเมลถึง ${e} เมื่อเอเจนต์ถามคำถามคุณ`),
  'nav.profile': L('Profile', 'Профиль', '个人资料', 'โปรไฟล์'),
  'nav.notifyLong': L('Email me when an agent asks a question', 'Присылать письмо, когда агент задаёт вопрос', '智能体提问时给我发邮件', 'ส่งอีเมลเมื่อเอเจนต์ถามคำถาม'),
  'nav.signout': L('Sign out', 'Выйти', '退出', 'ออกจากระบบ'),
  'nav.flow': L('Flows', 'Прирост', '增长', 'การเพิ่มขึ้น'),
  'flow.h': L('per hour', 'в час', '每小时', 'ต่อชั่วโมง'),
  'flow.d': L('per day', 'в день', '每天', 'ต่อวัน'),
  'flow.w': L('per week', 'в неделю', '每周', 'ต่อสัปดาห์'),
  'nav.plan': L('Plan', 'Тариф', '套餐', 'แพ็กเกจ'),
  'nav.planFree': L('Free', 'Бесплатный', '免费版', 'ฟรี'),
  'nav.upgrade': L('Upgrade to Pro', 'Перейти на Pro', '升级到 Pro', 'อัปเกรดเป็น Pro'),
  'nav.canceled': L('subscription cancelled', 'подписка отменена', '订阅已取消', 'ยกเลิกการสมัครแล้ว'),
  'nav.manage': L('Manage subscription', 'Управлять подпиской', '管理订阅', 'จัดการการสมัคร'),
  'nav.proUntil': L((d) => `Pro until ${d}`, (d) => `Pro до ${d}`, (d) => `Pro 到 ${d}`, (d) => `Pro ถึง ${d}`),
  'nav.lang': L('Language', 'Язык', '语言', 'ภาษา'),
  'footer.built': L('© 2026 Goalcraft', '© 2026 Goalcraft', '© 2026 Goalcraft', '© 2026 Goalcraft'),
  'footer.terms': L('Terms', 'Условия', '条款', 'ข้อกำหนด'),
  'footer.deck': L('Pitch deck', 'Презентация', '路演文稿', 'พิตช์เด็ค'),
  'footer.privacy': L('Privacy', 'Конфиденциальность', '隐私', 'ความเป็นส่วนตัว'),
  'footer.contact': L('Contact', 'Контакты', '联系', 'ติดต่อ'),

  // Landing
  'home.h1': L('Watch AI agents craft your goals', 'Смотрите, как AI-агенты воплощают ваши цели', '看 AI 智能体实现你的目标', 'ดูเอเจนต์ AI สร้างเป้าหมายของคุณให้เป็นจริง'),
  'home.lead': L(
    'Every goal is a funnel: a job, a partner, a paper, an audience. Your agents move it stage by stage. See the flow, the next result, and who is waiting for you.',
    'Каждая цель — это воронка: работа, партнёр, статья, аудитория. Агенты двигают её этап за этапом. Видно поток, следующий результат и кто ждёт вашего ответа.',
    '每个目标都是一个漏斗：一份工作、一位伴侣、一篇论文、一批受众。你的智能体一步步推进它。看清流量、下一个成果，以及谁在等你回复。',
    'ทุกเป้าหมายคือกรวย: งาน คู่ชีวิต งานวิจัย ผู้ติดตาม เอเจนต์ของคุณขยับมันทีละขั้น เห็นการไหล ผลลัพธ์ถัดไป และใครกำลังรอคุณอยู่'),
  'home.demo': L('Open the live demo', 'Открыть живое демо', '打开实时演示', 'เปิดเดโมสด'),
  'home.connect': L('Connect your agents', 'Подключить агентов', '连接你的智能体', 'เชื่อมต่อเอเจนต์ของคุณ'),
  'home.shotAlt': L('One goal funnel with labels: the sheet, tanks, a question, agents asleep and at work, results and the prediction', 'Одна воронка цели с подписями: таблица, баки, вопрос, агенты спят и работают, результаты и прогноз', '一个带标注的目标漏斗：表格、储罐、问题、睡眠和工作中的智能体、成果和预测', 'กรวยเป้าหมายหนึ่งอันพร้อมคำอธิบาย: ตาราง ถัง คำถาม เอเจนต์ที่หลับและทำงาน ผลลัพธ์ และการคาดการณ์'),
  'home.p1h': L('Goals as funnels', 'Цели как воронки', '目标即漏斗', 'เป้าหมายคือกรวย'),
  'home.p1': L('Not tasks — stages. How much is at each step, how fast it flows, when the next result is due.', 'Не задачи, а этапы. Сколько на каждом шаге, как быстро движется, когда следующий результат.', '不是任务，而是阶段。每一步有多少、流动多快、下一个成果何时到来。', 'ไม่ใช่งาน แต่เป็นขั้นตอน แต่ละขั้นมีเท่าไร ไหลเร็วแค่ไหน และผลลัพธ์ถัดไปจะมาเมื่อไร'),
  'home.p2h': L('Your agents, at work', 'Ваши агенты за работой', '你的智能体正在工作', 'เอเจนต์ของคุณกำลังทำงาน'),
  'home.p2': L('Claude, ChatGPT, Gemini and others report through MCP. You watch them mine, brew, garden and code.', 'Claude, ChatGPT, Gemini и другие отчитываются через MCP. Вы смотрите, как они добывают, варят, садовничают и пишут код.', 'Claude、ChatGPT、Gemini 等通过 MCP 汇报。你看着它们采矿、调配、园艺和写代码。', 'Claude, ChatGPT, Gemini และอื่น ๆ รายงานผ่าน MCP คุณได้ดูพวกมันขุด ผสม ทำสวน และเขียนโค้ด'),
  'home.p3h': L('Answer from anywhere', 'Отвечайте откуда угодно', '随时随地回复', 'ตอบได้จากทุกที่'),
  'home.p3': L('When an agent needs you, it raises a hand. Reply from your phone and it gets back to work.', 'Когда агенту нужны вы, он поднимает руку. Ответьте с телефона — и он вернётся к работе.', '当智能体需要你时，它会举手。用手机回复，它就继续工作。', 'เมื่อเอเจนต์ต้องการคุณ มันจะยกมือ ตอบจากมือถือแล้วมันจะกลับไปทำงานต่อ'),

  // The landing page's funnel: what each part is
  'guide.sheet.h': L('Sheet', 'Таблица', '表格', 'ตาราง'),
  'guide.sheet': L('The table where the agents keep track of everything.', 'Таблица, где агенты ведут учёт всего.', '智能体记录一切的表格。', 'ตารางที่เอเจนต์ใช้ติดตามทุกอย่าง'),
  'guide.tank.h': L('Tank', 'Бак', '储罐', 'ถัง'),
  'guide.tank': L('Items at this stage so far, and +N a day (or an hour, a week: your choice).', 'Сколько позиций дошло до этого этапа и +N в день (или в час, в неделю — как выберете).', '到达这个阶段的数量，以及每天 +N（也可选每小时、每周）。', 'จำนวนรายการที่ถึงขั้นนี้แล้ว และ +N ต่อวัน (หรือต่อชั่วโมง ต่อสัปดาห์ ตามที่เลือก)'),
  'guide.question.h': L('Question', 'Вопрос', '问题', 'คำถาม'),
  'guide.question': L('An agent waits for your answer. Click it to reply.', 'Агент ждёт вашего ответа. Нажмите, чтобы ответить.', '智能体在等你回复。点击即可回复。', 'เอเจนต์กำลังรอคำตอบจากคุณ คลิกเพื่อตอบ'),
  'guide.asleep.h': L('Asleep', 'Спит', '休眠', 'หลับอยู่'),
  'guide.asleep': L('Resting until its next run; the timer counts down.', 'Отдыхает до следующего запуска; таймер отсчитывает время.', '休息到下次运行；计时器在倒数。', 'พักจนถึงรอบถัดไป ตัวจับเวลากำลังนับถอยหลัง'),
  'guide.work.h': L('Agent at work', 'Агент за работой', '工作中的智能体', 'เอเจนต์กำลังทำงาน'),
  'guide.work': L('+N is what its current run added.', '+N — сколько добавил текущий запуск.', '+N 是本次运行新增的数量。', '+N คือสิ่งที่รอบปัจจุบันเพิ่มเข้ามา'),
  'guide.results.h': L('Results', 'Результаты', '成果', 'ผลลัพธ์'),
  'guide.results': L('One per result the goal needs; filled ones are done.', 'По одному на каждый нужный результат; заполненные — уже получены.', '目标需要的每个成果一个；已填满的表示已完成。', 'หนึ่งช่องต่อผลลัพธ์ที่เป้าหมายต้องการ ช่องที่เต็มคือได้แล้ว'),
  'guide.prediction.h': L('Prediction', 'Прогноз', '预测', 'การคาดการณ์'),
  'guide.prediction': L('When the next result is due at the current pace.', 'Когда будет следующий результат при текущем темпе.', '按当前速度，下一个成果何时到来。', 'ผลลัพธ์ถัดไปจะมาเมื่อไรตามจังหวะปัจจุบัน'),

  // Connecting an agent
  'connect.h1': L('Connect an agent', 'Подключите агента', '连接一个智能体', 'เชื่อมต่อเอเจนต์'),
  'connect.empty.h1': L('Connect your agents', 'Подключите своих агентов', '连接你的智能体', 'เชื่อมต่อเอเจนต์ของคุณ'),
  'connect.intro': L(
    'Paste this into your agent: Claude, ChatGPT, Cursor or any other that supports MCP. It connects Goalcraft, or tells you how.',
    'Вставьте это в своего агента: Claude, ChatGPT, Cursor или любого другого с поддержкой MCP. Он подключит Goalcraft или подскажет, как это сделать.',
    '把这段话粘贴给你的智能体：Claude、ChatGPT、Cursor 或任何支持 MCP 的智能体。它会连接 Goalcraft，或告诉你怎么做。',
    'วางข้อความนี้ในเอเจนต์ของคุณ: Claude, ChatGPT, Cursor หรือเอเจนต์อื่นที่รองรับ MCP มันจะเชื่อมต่อ Goalcraft หรือบอกวิธีให้คุณ'),
  'connect.after': L(
    'When the agent connects, a Goalcraft page asks you to sign in and allow it. Then tell the agent which goal to work on, and its funnel appears in <a href="../app/">Goals</a>. Connect as many agents as you like, one by one.',
    'Когда агент подключается, страница Goalcraft попросит войти и разрешить доступ. Потом скажите агенту, над какой целью работать, и её воронка появится в разделе <a href="../app/">Цели</a>. Подключайте сколько угодно агентов, по одному.',
    '智能体连接时，Goalcraft 页面会请你登录并授权。然后告诉它要推进哪个目标，它的漏斗就会出现在<a href="../app/">目标</a>里。可以逐个连接任意多个智能体。',
    'เมื่อเอเจนต์เชื่อมต่อ หน้า Goalcraft จะขอให้คุณเข้าสู่ระบบและอนุญาต จากนั้นบอกเอเจนต์ว่าจะทำเป้าหมายไหน แล้วกรวยของมันจะปรากฏใน<a href="../app/">เป้าหมาย</a> เชื่อมต่อเอเจนต์ได้มากเท่าที่ต้องการ ทีละตัว'),
  'connect.empty.after': L(
    'Then tell it which goal to work on, and your funnels appear here. Not sure what it will look like? <a href="../demo/">See the demo</a>.',
    'Потом скажите ему, над какой целью работать, и ваши воронки появятся здесь. Хотите посмотреть, как это выглядит? <a href="../demo/">Откройте демо</a>.',
    '然后告诉它要推进哪个目标，你的漏斗就会出现在这里。想先看看效果？<a href="../demo/">查看演示</a>。',
    'จากนั้นบอกมันว่าจะทำเป้าหมายไหน แล้วกรวยของคุณจะปรากฏที่นี่ อยากเห็นหน้าตาก่อน? <a href="../demo/">ดูเดโม</a>'),
  'connect.prompt': L(
    (url) => `Connect this MCP server for me: ${url} (Goalcraft, remote, sign-in with OAuth). If you can't connect it yourself, tell me exactly how to do it in this app.`,
    (url) => `Подключи мне этот MCP-сервер: ${url} (Goalcraft, удалённый, вход через OAuth). Если не можешь подключить сам, объясни точно, как это сделать в этом приложении.`,
    (url) => `请帮我连接这个 MCP 服务器：${url}（Goalcraft，远程，通过 OAuth 登录）。如果你无法自己连接，请准确告诉我在这个应用里该怎么做。`,
    (url) => `ช่วยเชื่อมต่อ MCP เซิร์ฟเวอร์นี้ให้หน่อย: ${url} (Goalcraft, รีโมต, เข้าสู่ระบบด้วย OAuth) ถ้าเชื่อมต่อเองไม่ได้ ช่วยบอกวิธีทำในแอปนี้อย่างละเอียด`),
  'copy': L('Copy', 'Копировать', '复制', 'คัดลอก'),
  'copied': L('Copied', 'Скопировано', '已复制', 'คัดลอกแล้ว'),
  'copy.manual': L('Select the text and copy it', 'Выделите текст и скопируйте', '请选中文字并复制', 'เลือกข้อความแล้วคัดลอก'),

  // Goals page
  'app.updated': L((t) => `Updated ${t} ago`, (t) => `Обновлено ${t} назад`, (t) => `${t}前更新`, (t) => `อัปเดตเมื่อ ${t} ที่แล้ว`),
  'app.failed': L('Could not update', 'Не удалось обновить', '更新失败', 'อัปเดตไม่สำเร็จ'),
  'app.refresh': L('Refresh', 'Обновить', '刷新', 'รีเฟรช'),
  'app.refreshTitle': L('Refresh now', 'Обновить сейчас', '立即刷新', 'รีเฟรชตอนนี้'),
  // One short unit each, written right after the number: 30s, 15m, 8h, 21d, 2w; flows +8/d. No
  // months, so "m" is always minutes.
  'units': L({ s: 's', m: 'm', h: 'h', d: 'd', w: 'w' }, { s: 'с', m: 'м', h: 'ч', d: 'д', w: 'н' },
    { s: '秒', m: '分', h: '时', d: '天', w: '周' }, { s: 'วิ', m: 'น.', h: 'ชม.', d: 'ว.', w: 'สป.' }),
  'demo.clock': L((d) => `Demo · day ${d}`, (d) => `Демо · день ${d}`, (d) => `演示 · 第 ${d} 天`, (d) => `เดโม · วันที่ ${d}`),
  'demo.reply': L('Got it, thanks: carrying on with that.', 'Понял, спасибо: продолжаю так.', '明白了，谢谢：我就按这个继续。', 'รับทราบ ขอบคุณ: ทำต่อตามนั้น'),
  'demo.clockTitle': L('Demo time runs fast: one day every two seconds', 'В демо время идёт быстро: день за две секунды', '演示中时间过得很快：两秒一天', 'ในเดโมเวลาเดินเร็ว: สองวินาทีเท่ากับหนึ่งวัน'),

  // Board: popups and badges
  'board.waiting': L(
    (n) => `${n} ${n === 1 ? 'question waits' : 'questions wait'} for your answer`,
    (n) => `${n} ${({ one: 'вопрос ждёт', few: 'вопроса ждут' })[pluralOf(n)] || 'вопросов ждут'} вашего ответа`,
    (n) => `${n} 个问题在等你回复`,
    (n) => `${n} คำถามรอคำตอบจากคุณ`),
  'board.asking': L((who) => `${who} is waiting for you`, (who) => `${who} ждёт вашего ответа`, (who) => `${who} 在等你回复`, (who) => `${who} กำลังรอคุณ`),
  'board.askedAsleep': L((who) => `${who} asked you, then went to sleep`, (who) => `${who} задал вопрос и уснул`, (who) => `${who} 提了问题，然后睡着了`, (who) => `${who} ถามคุณแล้วเข้านอน`),
  'board.nextRun': L(
    (t) => (t ? `It will pick your answer up when it wakes up, in ${t}.` : 'It will pick your answer up when it wakes up.'),
    (t) => (t ? `Заберёт ответ, когда проснётся: через ${t}.` : 'Заберёт ответ, когда проснётся.'),
    (t) => (t ? `它醒来后会取走你的回复：${t}后。` : '它醒来后会取走你的回复。'),
    (t) => (t ? `จะรับคำตอบเมื่อตื่น: ในอีก ${t}` : 'จะรับคำตอบเมื่อตื่น')),
  'board.overdue': L((who) => `${who} did not wake up on time`, (who) => `${who} не проснулся вовремя`, (who) => `${who} 没有按时醒来`, (who) => `${who} ไม่ตื่นตามเวลา`),
  'board.lastSignal': L((ago) => `Last signal ${ago} ago.`, (ago) => `Последний сигнал ${ago} назад.`, (ago) => `最后一次信号是 ${ago}前。`, (ago) => `สัญญาณล่าสุดเมื่อ ${ago}ที่แล้ว`),
  'board.silent': L((n) => `Agents not heard from in time: ${n}`, (n) => `Не вышли на связь вовремя: ${n}`, (n) => `未按时联系的智能体：${n}`, (n) => `เอเจนต์ที่ไม่ติดต่อตามเวลา: ${n}`),
  'board.lost': L((who) => `No word from ${who}`, (who) => `${who} не выходит на связь`, (who) => `${who} 没有消息`, (who) => `ไม่มีสัญญาณจาก ${who}`),
  'board.runs': L('Previous runs', 'Предыдущие запуски', '之前的运行', 'การรันก่อนหน้า'),
  'board.runNow': L('running', 'идёт', '进行中', 'กำลังรัน'),
  'board.noRuns': L('No runs recorded yet.', 'Запусков пока не записано.', '还没有记录到运行。', 'ยังไม่มีการรันที่บันทึกไว้'),
  'board.runsFailed': L('Could not load the runs.', 'Не удалось загрузить запуски.', '无法加载运行记录。', 'โหลดการรันไม่สำเร็จ'),
  'board.resting': L((who) => `${who} is asleep`, (who) => `${who} спит`, (who) => `${who} 在睡觉`, (who) => `${who} กำลังหลับ`),
  'board.wakesIn': L((t) => `Wakes up in ${t}.`, (t) => `Проснётся через ${t}.`, (t) => `${t}后醒来。`, (t) => `จะตื่นในอีก ${t}`),
  'board.starting': L((who) => `${who} is starting a shift`, (who) => `${who} начинает смену`, (who) => `${who} 开始轮班`, (who) => `${who} กำลังเริ่มกะ`),
  'board.finished': L((who) => `${who} finished a shift`, (who) => `${who} закончил смену`, (who) => `${who} 结束了轮班`, (who) => `${who} จบกะแล้ว`),
  'board.working': L((who) => `${who} is working`, (who) => `${who} работает`, (who) => `${who} 正在工作`, (who) => `${who} กำลังทำงาน`),
  'board.open': L((who) => `Open ${who}`, (who) => `Открыть ${who}`, (who) => `打开 ${who}`, (who) => `เปิด ${who}`),
  'board.replyIn': L((who) => `Reply in ${who}`, (who) => `Ответить в ${who}`, (who) => `在 ${who} 中回复`, (who) => `ตอบใน ${who}`),
  'board.answer': L('Your answer', 'Ваш ответ', '你的回复', 'คำตอบของคุณ'),
  'board.send': L('Send answer', 'Отправить ответ', '发送回复', 'ส่งคำตอบ'),
  'board.sheet': L((where) => `Open the list in ${where}`, (where) => `Открыть список в ${where}`, (where) => `在 ${where} 中打开列表`, (where) => `เปิดรายการใน ${where}`),
  'board.close': L('Close', 'Закрыть', '关闭', 'ปิด'),
  'board.goalReached': L('goal reached ✓', 'цель достигнута ✓', '目标已达成 ✓', 'ถึงเป้าหมายแล้ว ✓'),
  'board.goal': L((total, time) => `goal: +${total} in ${time}`, (total, time) => `цель: +${total} за ${time}`, (total, time) => `目标：${time} 内 +${total}`, (total, time) => `เป้าหมาย: +${total} ใน ${time}`),
  'board.next': L((eta) => `next ${eta}`, (eta) => `следующий ${eta}`, (eta) => `下一个 ${eta}`, (eta) => `ถัดไป ${eta}`),

  // Pricing
  'pricing.canceled': L((d) => `Subscription cancelled. Pro until ${d}, then Free.`, (d) => `Подписка отменена. Pro до ${d}, потом Free.`, (d) => `订阅已取消。Pro 有效至 ${d}，之后转为 Free。`, (d) => `ยกเลิกการสมัครแล้ว ใช้ Pro ได้ถึง ${d} จากนั้นเป็น Free`),
  'pricing.downgrade': L('Downgrade to Free', 'Перейти на Free', '降级到 Free', 'ลดเป็น Free'),
  'pricing.downgradeConfirm': L('Downgrade to Free now? Pro ends at once. Your funnels stay; new ones follow the Free limits.', 'Перейти на Free сейчас? Pro закончится сразу. Ваши воронки останутся, новые — в пределах Free.', '现在降级到 Free？Pro 将立即结束。你的漏斗会保留，新建的按 Free 限制。', 'ลดเป็น Free ตอนนี้? Pro จะสิ้นสุดทันที กรวยที่มีอยู่ยังอยู่ ส่วนกรวยใหม่จะเป็นไปตามขีดจำกัดของ Free'),
  'pricing.current': L('Your plan', 'Ваш тариф', '当前套餐', 'แพ็กเกจของคุณ'),
  'billing.opening': L('Opening Polar…', 'Открываем Polar…', '正在打开 Polar…', 'กำลังเปิด Polar…'),
  'billing.switching': L('Switching to Free…', 'Переходим на Free…', '正在切换到 Free…', 'กำลังเปลี่ยนเป็น Free…'),
  'billing.pending': L('Payment received. Turning Pro on…', 'Оплата получена. Включаем Pro…', '已收到付款，正在开通 Pro…', 'ได้รับการชำระเงินแล้ว กำลังเปิดใช้ Pro…'),
  'billing.done': L((d) => `Pro is on${d ? ` until ${d}` : ''}. Thank you!`, (d) => `Pro подключён${d ? ` до ${d}` : ''}. Спасибо!`, (d) => `Pro 已开通${d ? `，有效期至 ${d}` : ''}。谢谢！`, (d) => `เปิดใช้ Pro แล้ว${d ? ` ถึง ${d}` : ''} ขอบคุณ!`),
  'billing.late': L("Pro hasn't turned on yet. If it doesn't in a few minutes, write to support@goalcraft.ai and we'll sort it out.", 'Pro ещё не включился. Если через несколько минут не появится, напишите на support@goalcraft.ai — разберёмся.', 'Pro 尚未开通。如果几分钟后仍未开通，请写信至 support@goalcraft.ai，我们会处理。', 'Pro ยังไม่เปิดใช้ หากไม่กี่นาทียังไม่ขึ้น เขียนมาที่ support@goalcraft.ai แล้วเราจะจัดการให้'),
  'billing.failed': L('Could not open the payment page. Try again in a minute.', 'Не удалось открыть страницу оплаты. Попробуйте через минуту.', '无法打开付款页面，请稍后再试。', 'เปิดหน้าชำระเงินไม่ได้ ลองใหม่อีกครั้งในอีกสักครู่'),
  'pricing.h1': L('Pricing', 'Тарифы', '价格', 'ราคา'),
  'pricing.lead': L('Early-access price: Pro is $9 a month instead of $15, and stays $9 while you keep it.', 'Цена раннего доступа: Pro за $9 в месяц вместо $15, и цена не вырастет, пока вы не отмените подписку.', '早期价格：Pro 每月 $9，原价 $15；只要不取消订阅，价格就一直是 $9。', 'ราคาช่วงเปิดตัว: Pro เดือนละ $9 แทน $15 และคงราคา $9 ตราบที่คุณยังสมัครอยู่'),
  'pricing.forever': L('forever', 'навсегда', '永久', 'ตลอดไป'),
  'pricing.free1': L('<b>3</b> goal funnels', '<b>3</b> воронки целей', '<b>3</b> 个目标漏斗', 'กรวยเป้าหมาย <b>3</b> อัน'),
  'pricing.free2': L('<b>3</b> stages in each funnel', '<b>3</b> этапа в каждой воронке', '每个漏斗 <b>3</b> 个阶段', '<b>3</b> ขั้นในแต่ละกรวย'),
  'pricing.free3': L('<b>1</b> agent at each step, <b>4</b> in a funnel', '<b>1</b> агент на каждом шаге, <b>4</b> в воронке', '每一步 <b>1</b> 个智能体，每个漏斗 <b>4</b> 个', 'เอเจนต์ <b>1</b> ตัวต่อขั้น <b>4</b> ตัวต่อกรวย'),
  'pricing.pro1': L('<b>10</b> goal funnels', '<b>10</b> воронок целей', '<b>10</b> 个目标漏斗', 'กรวยเป้าหมาย <b>10</b> อัน'),
  'pricing.pro2': L('<b>5</b> stages in each funnel', '<b>5</b> этапов в каждой воронке', '每个漏斗 <b>5</b> 个阶段', '<b>5</b> ขั้นในแต่ละกรวย'),
  'pricing.pro3': L('<b>2</b> agents at each step, <b>12</b> in a funnel', '<b>2</b> агента на каждом шаге, <b>12</b> в воронке', '每一步 <b>2</b> 个智能体，每个漏斗 <b>12</b> 个', 'เอเจนต์ <b>2</b> ตัวต่อขั้น <b>12</b> ตัวต่อกรวย'),
  'pricing.any': L('Claude, ChatGPT, Gemini and any MCP agent', 'Claude, ChatGPT, Gemini и любой MCP-агент', 'Claude、ChatGPT、Gemini 及任何 MCP 智能体', 'Claude, ChatGPT, Gemini และเอเจนต์ MCP ใดก็ได้'),
  'pricing.live': L('Live dashboard, all nine themes', 'Живая доска, все девять тем', '实时看板，全部九种主题', 'แดชบอร์ดสด ครบทั้งเก้าธีม'),
  'pricing.themes': L('<b>9</b> visual themes', '<b>9</b> визуальных тем', '<b>9</b> 种视觉主题', 'ธีมภาพ <b>9</b> แบบ'),
  'pricing.answer': L('Answer your agents from the dashboard', 'Отвечайте агентам прямо с доски', '直接在看板上回复智能体', 'ตอบเอเจนต์ได้จากแดชบอร์ด'),
  'pricing.startFree': L('Start free', 'Начать бесплатно', '免费开始', 'เริ่มใช้ฟรี'),
  'pricing.early': L('Early access', 'Ранний доступ', '抢先体验', 'ทดลองใช้ก่อนใคร'),
  'pricing.perMonth': L('per month, early-access price', 'в месяц, цена раннего доступа', '每月，早期价格', 'ต่อเดือน ราคาช่วงเปิดตัว'),
  'pricing.getPro': L('Get Pro', 'Подключить Pro', '开通 Pro', 'สมัคร Pro'),
  'pricing.fine2': L('Payments go through Polar, our merchant of record. Cancel any time in the profile menu: Pro stays until the end of the month you paid for. When early access ends, Pro will cost $15 a month for new subscribers.', 'Оплата проходит через Polar, нашего платёжного партнёра. Отменить можно в любой момент в меню профиля: Pro остаётся до конца оплаченного месяца. После раннего доступа новые подписчики будут платить $15 в месяц.', '付款通过我们的销售方 Polar 完成。可随时在个人菜单中取消：Pro 保留到已付费月份结束。早期阶段结束后，新订阅为每月 $15。', 'ชำระเงินผ่าน Polar ผู้ขายของเรา ยกเลิกได้ทุกเมื่อในเมนูโปรไฟล์: Pro ใช้ได้จนจบเดือนที่จ่ายแล้ว เมื่อช่วงเปิดตัวจบ สมาชิกใหม่จะจ่ายเดือนละ $15'),

  // Privacy
  'privacy.h1': L('Privacy', 'Конфиденциальность', '隐私', 'ความเป็นส่วนตัว'),
  'privacy.updated': L('Last updated: 18 October 2026', 'Обновлено: 18 октября 2026', '最后更新：2026 年 10 月 18 日', 'อัปเดตล่าสุด: 18 ตุลาคม 2026'),
  'privacy.h.store': L('What we store', 'Что мы храним', '我们存储什么', 'เราเก็บอะไรบ้าง'),
  'privacy.store': L(
    'When you sign in with Google or an email link, we store your email address and a user ID. With Google we also receive your name and profile picture; we do not use them for anything else. When your agents connect, we store the funnels, counts, results and agent states they report.',
    'Когда вы входите через Google или по ссылке из письма, мы храним ваш адрес почты и идентификатор пользователя. От Google мы также получаем имя и фото профиля и больше ни для чего их не используем. Когда подключаются ваши агенты, мы храним воронки, счётчики, результаты и состояния агентов, о которых они сообщают.',
    '当你通过 Google 或邮件链接登录时，我们存储你的邮箱地址和用户 ID。通过 Google 我们还会收到你的姓名和头像，但不会用于其他用途。当你的智能体连接后，我们存储它们汇报的漏斗、计数、成果和智能体状态。',
    'เมื่อคุณเข้าสู่ระบบด้วย Google หรือลิงก์ทางอีเมล เราเก็บที่อยู่อีเมลและรหัสผู้ใช้ของคุณ จาก Google เรายังได้รับชื่อและรูปโปรไฟล์ แต่ไม่นำไปใช้อย่างอื่น เมื่อเอเจนต์ของคุณเชื่อมต่อ เราเก็บกรวย ตัวเลข ผลลัพธ์ และสถานะเอเจนต์ที่พวกมันรายงาน'),
  'privacy.h.why': L('Why', 'Зачем', '为什么', 'ทำไม'),
  'privacy.why': L(
    'Only to sign you in and show your dashboard. We do not sell your data, show ads or share it with third parties, except the services that run Goalcraft: Supabase (database and sign-in) and GitHub Pages (hosting).',
    'Только чтобы вы могли войти и видеть свою доску. Мы не продаём данные, не показываем рекламу и не передаём данные третьим лицам, кроме сервисов, на которых работает Goalcraft: Supabase (база данных и вход) и GitHub Pages (хостинг).',
    '仅用于让你登录并显示你的看板。我们不出售你的数据、不展示广告，也不与第三方共享，运行 Goalcraft 的服务除外：Supabase（数据库和登录）和 GitHub Pages（托管）。',
    'เพื่อให้คุณเข้าสู่ระบบและแสดงแดชบอร์ดเท่านั้น เราไม่ขายข้อมูล ไม่แสดงโฆษณา และไม่แบ่งปันกับบุคคลที่สาม ยกเว้นบริการที่ใช้รัน Goalcraft: Supabase (ฐานข้อมูลและการเข้าสู่ระบบ) และ GitHub Pages (โฮสติ้ง)'),
  'privacy.h.google': L('Google data', 'Данные Google', 'Google 数据', 'ข้อมูลจาก Google'),
  'privacy.google': L(
    'Goalcraft asks Google only for your email and basic profile. Its use of information received from Google APIs follows the <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, including the Limited Use requirements.',
    'Goalcraft запрашивает у Google только почту и базовый профиль. Использование информации, полученной через API Google, соответствует <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, включая требования Limited Use.',
    'Goalcraft 只向 Google 请求你的邮箱和基本资料。对从 Google API 获得的信息的使用遵循 <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>，包括 Limited Use 要求。',
    'Goalcraft ขอจาก Google เพียงอีเมลและโปรไฟล์พื้นฐาน การใช้ข้อมูลที่ได้รับจาก Google API เป็นไปตาม <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a> รวมถึงข้อกำหนด Limited Use'),
  'privacy.h.pay': L('Payments', 'Оплата', '付款', 'การชำระเงิน'),
  'privacy.pay': L('If you buy Pro, Polar processes the payment as our merchant of record. We receive only your Polar customer ID and the state of your subscription, never your card details.', 'Если вы покупаете Pro, оплату проводит Polar, наш платёжный партнёр. Мы получаем только ваш номер клиента в Polar и состояние подписки, данные карты нам не передаются.', '如果你购买 Pro，付款由我们的销售方 Polar 处理。我们只会收到你在 Polar 的客户编号和订阅状态，不会收到银行卡信息。', 'หากคุณซื้อ Pro การชำระเงินจะดำเนินการโดย Polar ผู้ขายของเรา เราได้รับเพียงรหัสลูกค้า Polar และสถานะการสมัครของคุณ ไม่เคยได้รับข้อมูลบัตร'),
  'privacy.h.delete': L('Deleting your data', 'Удаление данных', '删除你的数据', 'การลบข้อมูลของคุณ'),
  'privacy.delete': L(
    'Write to <a href="mailto:support@goalcraft.ai">support@goalcraft.ai</a> and we will delete your account and everything your agents reported.',
    'Напишите на <a href="mailto:support@goalcraft.ai">support@goalcraft.ai</a>, и мы удалим ваш аккаунт и всё, что сообщили ваши агенты.',
    '写信到 <a href="mailto:support@goalcraft.ai">support@goalcraft.ai</a>，我们会删除你的账户及你的智能体汇报的所有内容。',
    'เขียนมาที่ <a href="mailto:support@goalcraft.ai">support@goalcraft.ai</a> แล้วเราจะลบบัญชีของคุณและทุกอย่างที่เอเจนต์ของคุณรายงาน'),

  // Terms
  'terms.h1': L(
    'Terms of Service',
    'Условия использования',
    '服务条款',
    'ข้อกำหนดการให้บริการ'),
  'terms.h.who': L(
    'Who we are',
    'Кто мы',
    '我们是谁',
    'เราคือใคร'),
  'terms.who': L(
    'Goalcraft (goalcraft.ai) is made and run by Oleg Ponfilenok. Write to <a href="mailto:support@goalcraft.ai">support@goalcraft.ai</a> with any question about these terms, your account or a payment.',
    'Goalcraft (goalcraft.ai) создаёт и поддерживает Олег Понфиленок. С любым вопросом об этих условиях, аккаунте или оплате пишите на <a href="mailto:support@goalcraft.ai">support@goalcraft.ai</a>.',
    'Goalcraft (goalcraft.ai) 由 Oleg Ponfilenok 开发和运营。关于本条款、你的账户或付款的任何问题，请写信到 <a href="mailto:support@goalcraft.ai">support@goalcraft.ai</a>。',
    'Goalcraft (goalcraft.ai) สร้างและดูแลโดย Oleg Ponfilenok หากมีคำถามเกี่ยวกับข้อกำหนดนี้ บัญชี หรือการชำระเงิน เขียนมาที่ <a href="mailto:support@goalcraft.ai">support@goalcraft.ai</a>'),
  'terms.h.service': L(
    'The service',
    'Сервис',
    '服务内容',
    'บริการ'),
  'terms.service': L(
    'Goalcraft shows your goals as funnels and the AI agents working on them. Your own agents (Claude, ChatGPT and others) write to it through our MCP server; we do not run your agents. You decide what they do, and you are responsible for their actions in other services and for following those services\' rules.',
    'Goalcraft показывает ваши цели в виде воронок и ИИ-агентов, которые над ними работают. Ваши собственные агенты (Claude, ChatGPT и другие) пишут в него через наш MCP-сервер; мы ваших агентов не запускаем. Вы решаете, что они делают, и отвечаете за их действия в других сервисах и за соблюдение правил этих сервисов.',
    'Goalcraft 把你的目标显示为漏斗，并展示为之工作的 AI 智能体。你自己的智能体（Claude、ChatGPT 等）通过我们的 MCP 服务器写入数据；我们不运行你的智能体。它们做什么由你决定，你需对它们在其他服务中的行为以及遵守这些服务的规则负责。',
    'Goalcraft แสดงเป้าหมายของคุณเป็นกรวยพร้อมเอเจนต์ AI ที่ทำงานกับเป้าหมายนั้น เอเจนต์ของคุณเอง (Claude, ChatGPT และอื่น ๆ) เขียนข้อมูลผ่านเซิร์ฟเวอร์ MCP ของเรา เราไม่ได้รันเอเจนต์ของคุณ คุณเป็นผู้กำหนดว่าเอเจนต์ทำอะไร และรับผิดชอบต่อการกระทำของเอเจนต์ในบริการอื่นและการปฏิบัติตามกฎของบริการเหล่านั้น'),
  'terms.h.account': L(
    'Your account',
    'Ваш аккаунт',
    '你的账户',
    'บัญชีของคุณ'),
  'terms.account': L(
    'You sign in with Google or a one-time email link. Keep access to your email safe: whoever can read it can sign in. You must be at least 16 years old to use Goalcraft.',
    'Вы входите через Google или по одноразовой ссылке на почту. Берегите доступ к почте: кто может её читать, тот может и войти. Пользоваться Goalcraft можно с 16 лет.',
    '你通过 Google 或一次性邮件链接登录。请保护好你的邮箱：能读取邮箱的人就能登录。使用 Goalcraft 须年满 16 岁。',
    'คุณเข้าสู่ระบบด้วย Google หรือลิงก์อีเมลแบบใช้ครั้งเดียว โปรดดูแลการเข้าถึงอีเมลของคุณให้ปลอดภัย ใครที่อ่านอีเมลได้ก็เข้าสู่ระบบได้ ผู้ใช้ Goalcraft ต้องมีอายุอย่างน้อย 16 ปี'),
  'terms.h.plans': L(
    'Plans and payment',
    'Тарифы и оплата',
    '套餐与付款',
    'แพ็กเกจและการชำระเงิน'),
  'terms.plans': L(
    'The Free plan costs nothing. Pro costs $9 a month during early access; when early access ends, Pro will cost $15 a month for new subscribers, and your price stays the same while your subscription stays active. Payments are processed by Polar, our merchant of record, which also handles taxes and receipts; Polar\'s terms apply to the purchase itself. We never see your card details.',
    'Тариф Free бесплатный. Pro стоит $9 в месяц в период раннего доступа; после него новые подписчики будут платить $15 в месяц, а ваша цена не изменится, пока подписка активна. Платежи проводит Polar, наш платёжный партнёр (merchant of record), он же отвечает за налоги и чеки; к самой покупке применяются условия Polar. Данные вашей карты мы никогда не видим.',
    'Free 套餐免费。早期阶段 Pro 每月 $9；早期阶段结束后，新订阅为每月 $15，而只要你的订阅保持有效，你的价格不变。付款由我们的销售方（merchant of record）Polar 处理，Polar 同时负责税费和收据；购买本身适用 Polar 的条款。我们永远看不到你的银行卡信息。',
    'แพ็กเกจ Free ไม่มีค่าใช้จ่าย Pro ราคาเดือนละ $9 ในช่วงเปิดตัว เมื่อช่วงเปิดตัวจบ สมาชิกใหม่จะจ่ายเดือนละ $15 ส่วนราคาของคุณจะคงเดิมตราบที่การสมัครยังใช้งานอยู่ การชำระเงินดำเนินการโดย Polar ผู้ขายของเรา (merchant of record) ซึ่งดูแลภาษีและใบเสร็จด้วย ข้อกำหนดของ Polar ใช้กับการซื้อนั้น เราไม่เคยเห็นข้อมูลบัตรของคุณ'),
  'terms.plans2': L(
    'Pro renews every month until you cancel. You can cancel any time in the profile menu (Manage subscription); Pro then stays on until the end of the month you have paid for, and no further payments are taken. We do not refund partial months, but if something went wrong, write to us within 14 days of a payment and we will make it right. None of this limits the rights you have under consumer law.',
    'Pro продлевается каждый месяц, пока вы его не отмените. Отменить можно в любой момент в меню профиля («Управлять подпиской»); Pro останется до конца оплаченного месяца, и новых списаний не будет. За неполные месяцы деньги не возвращаются, но если что-то пошло не так, напишите нам в течение 14 дней после платежа, и мы всё исправим. Это не ограничивает ваши права по закону о защите прав потребителей.',
    'Pro 每月自动续订，直到你取消。你可以随时在个人菜单（管理订阅）中取消；之后 Pro 会保留到已付费月份结束，不会再扣款。我们不退还不足一个月的费用，但如果出了问题，请在付款后 14 天内联系我们，我们会妥善解决。以上内容不限制你依据消费者保护法享有的权利。',
    'Pro ต่ออายุทุกเดือนจนกว่าคุณจะยกเลิก คุณยกเลิกได้ทุกเมื่อในเมนูโปรไฟล์ (จัดการการสมัคร) จากนั้น Pro จะใช้ได้จนจบเดือนที่จ่ายแล้ว และจะไม่มีการเรียกเก็บเงินอีก เราไม่คืนเงินสำหรับเดือนที่ใช้ไม่ครบ แต่หากมีปัญหา เขียนถึงเราภายใน 14 วันหลังการชำระเงิน แล้วเราจะแก้ไขให้ ทั้งหมดนี้ไม่จำกัดสิทธิ์ของคุณตามกฎหมายคุ้มครองผู้บริโภค'),
  'terms.h.fair': L(
    'Fair use',
    'Добросовестное использование',
    '合理使用',
    'การใช้งานอย่างเหมาะสม'),
  'terms.fair': L(
    'Do not use Goalcraft to break the law, to send spam, to harass anyone, or to attack or overload the service. We may suspend an account that does.',
    'Не используйте Goalcraft, чтобы нарушать закон, рассылать спам, преследовать кого-либо, атаковать или перегружать сервис. Такой аккаунт мы можем заблокировать.',
    '请勿利用 Goalcraft 违法、发送垃圾信息、骚扰他人，或攻击、超载本服务。我们可能会暂停这样做的账户。',
    'ห้ามใช้ Goalcraft เพื่อทำผิดกฎหมาย ส่งสแปม คุกคามผู้อื่น หรือโจมตีหรือทำให้บริการทำงานหนักเกินไป เราอาจระงับบัญชีที่ทำเช่นนั้น'),
  'terms.h.data': L(
    'Your data',
    'Ваши данные',
    '你的数据',
    'ข้อมูลของคุณ'),
  'terms.data': L(
    'What you and your agents put into Goalcraft is yours. We store and use it as described in the <a href="../privacy/">privacy policy</a>, and we delete it when you ask.',
    'Всё, что вы и ваши агенты вносите в Goalcraft, принадлежит вам. Мы храним и используем эти данные, как описано в <a href="../privacy/">политике конфиденциальности</a>, и удаляем их по вашей просьбе.',
    '你和你的智能体放入 Goalcraft 的内容归你所有。我们按照<a href="../privacy/">隐私政策</a>所述存储和使用这些数据，并会在你要求时删除。',
    'ข้อมูลที่คุณและเอเจนต์ใส่ลงใน Goalcraft เป็นของคุณ เราจัดเก็บและใช้ข้อมูลตามที่อธิบายไว้ใน<a href="../privacy/">นโยบายความเป็นส่วนตัว</a> และลบเมื่อคุณขอ'),
  'terms.h.asis': L(
    'The service as it is',
    'Сервис «как есть»',
    '服务按现状提供',
    'บริการตามสภาพ'),
  'terms.asis': L(
    'Goalcraft is a young product. It is provided as it is: it will change, it may sometimes be unavailable, and we cannot promise it is free of errors. To the extent the law allows, our liability for any claim is limited to what you paid us in the 12 months before it.',
    'Goalcraft — молодой продукт. Он предоставляется «как есть»: он будет меняться, иногда может быть недоступен, и мы не можем обещать, что в нём нет ошибок. В пределах, допустимых законом, наша ответственность по любой претензии ограничена суммой, которую вы заплатили нам за 12 месяцев до неё.',
    'Goalcraft 是一个年轻的产品，按现状提供：它会不断变化，有时可能无法使用，我们也无法保证没有错误。在法律允许的范围内，我们对任何索赔的责任以你在此前 12 个月内支付给我们的金额为限。',
    'Goalcraft เป็นผลิตภัณฑ์ใหม่ ให้บริการตามสภาพ: จะมีการเปลี่ยนแปลง บางครั้งอาจใช้งานไม่ได้ และเราไม่อาจรับประกันว่าไม่มีข้อผิดพลาด ภายในขอบเขตที่กฎหมายอนุญาต ความรับผิดของเราต่อการเรียกร้องใด ๆ จำกัดไม่เกินจำนวนที่คุณจ่ายให้เราใน 12 เดือนก่อนหน้านั้น'),
  'terms.h.changes': L(
    'Changes',
    'Изменения',
    '变更',
    'การเปลี่ยนแปลง'),
  'terms.changes': L(
    'We may update these terms. If a change affects what you pay or what Pro includes, we will email you before it applies.',
    'Мы можем обновлять эти условия. Если изменение касается того, сколько вы платите или что входит в Pro, мы заранее напишем вам на почту.',
    '我们可能会更新本条款。如果变更影响你支付的费用或 Pro 包含的内容，我们会在生效前发邮件通知你。',
    'เราอาจปรับปรุงข้อกำหนดนี้ หากการเปลี่ยนแปลงกระทบต่อสิ่งที่คุณจ่ายหรือสิ่งที่ Pro มี เราจะส่งอีเมลแจ้งคุณก่อนมีผล'),

  // Contact
  'contact.h1': L('Contact', 'Контакты', '联系', 'ติดต่อ'),
  'contact.who': L('Goalcraft is made by Oleg Ponfilenok.', 'Goalcraft делает Олег Понфиленок.', 'Goalcraft 由 Oleg Ponfilenok 打造。', 'Goalcraft สร้างโดย Oleg Ponfilenok'),
  'contact.h.write': L('Write to us', 'Напишите нам', '给我们写信', 'เขียนถึงเรา'),
  'contact.write': L('Questions, ideas, bugs or a partnership: <a href="mailto:support@goalcraft.ai">support@goalcraft.ai</a>.', 'Вопросы, идеи, ошибки или партнёрство: <a href="mailto:support@goalcraft.ai">support@goalcraft.ai</a>.', '问题、想法、错误或合作：<a href="mailto:support@goalcraft.ai">support@goalcraft.ai</a>。', 'คำถาม ไอเดีย บั๊ก หรือความร่วมมือ: <a href="mailto:support@goalcraft.ai">support@goalcraft.ai</a>'),
  'contact.h.code': L('Code', 'Код', '代码', 'โค้ด'),
  'contact.code': L(
    'The code and the MCP protocol are on <a href="https://github.com/oponfil/goalcraft" target="_blank" rel="noopener">GitHub</a>. Issues and pull requests are welcome.',
    'Код и протокол MCP — на <a href="https://github.com/oponfil/goalcraft" target="_blank" rel="noopener">GitHub</a>. Issues и pull requests приветствуются.',
    '代码和 MCP 协议在 <a href="https://github.com/oponfil/goalcraft" target="_blank" rel="noopener">GitHub</a> 上，欢迎提交 issue 和 pull request。',
    'โค้ดและโปรโตคอล MCP อยู่บน <a href="https://github.com/oponfil/goalcraft" target="_blank" rel="noopener">GitHub</a> ยินดีรับ issue และ pull request'),

  // Sign in
  'login.h1': L('Sign in', 'Вход', '登录', 'เข้าสู่ระบบ'),
  'login.sub': L('New here? The same steps create your account.', 'Впервые здесь? Те же шаги создадут аккаунт.', '第一次来？同样的步骤会为你创建账户。', 'มาครั้งแรก? ขั้นตอนเดียวกันจะสร้างบัญชีให้คุณ'),
  'login.or': L('or with email', 'или по почте', '或使用邮箱', 'หรือด้วยอีเมล'),
  'login.send': L('Email me a sign-in link', 'Прислать ссылку для входа', '给我发送登录链接', 'ส่งลิงก์เข้าสู่ระบบทางอีเมล'),
  'login.withPassword': L('Sign in with a password', 'Войти по паролю', '使用密码登录', 'เข้าสู่ระบบด้วยรหัสผ่าน'),
  'login.password': L('Password', 'Пароль', '密码', 'รหัสผ่าน'),
  'login.signIn': L('Sign in', 'Войти', '登录', 'เข้าสู่ระบบ'),
  'login.wrongPassword': L('Wrong email or password.', 'Неверная почта или пароль.', '邮箱或密码不正确。', 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'),
  'login.signing': L('Signing in…', 'Входим…', '正在登录…', 'กำลังเข้าสู่ระบบ…'),
  'login.sending': L('Sending…', 'Отправляем…', '正在发送…', 'กำลังส่ง…'),
  'login.expired': L(
    'That sign-in link was already used or has expired: each link works once, for a short time. Ask for a new one below, or continue with Google.',
    'Эта ссылка для входа уже использована или устарела: каждая работает один раз и недолго. Запросите новую ниже или войдите через Google.',
    '此登录链接已被使用或已过期：每个链接只能使用一次，且有效期很短。请在下方重新获取，或使用 Google 登录。',
    'ลิงก์เข้าสู่ระบบนี้ถูกใช้ไปแล้วหรือหมดอายุ: แต่ละลิงก์ใช้ได้ครั้งเดียวในเวลาสั้น ๆ ขอลิงก์ใหม่ด้านล่าง หรือเข้าสู่ระบบด้วย Google'),
  'login.failed': L('Signing in with that link did not work. Ask for a new one below, or continue with Google.', 'Войти по этой ссылке не получилось. Запросите новую ниже или войдите через Google.', '无法通过该链接登录。请在下方重新获取，或使用 Google 登录。', 'เข้าสู่ระบบด้วยลิงก์นั้นไม่สำเร็จ ขอลิงก์ใหม่ด้านล่าง หรือเข้าสู่ระบบด้วย Google'),
  'login.badEmail': L('That email address does not look right. Check it and try again.', 'Похоже, в адресе ошибка. Проверьте его и попробуйте ещё раз.', '这个邮箱地址似乎不对。请检查后重试。', 'ที่อยู่อีเมลดูไม่ถูกต้อง ตรวจสอบแล้วลองอีกครั้ง'),
  'login.tooMany': L('Too many links asked for. Wait a few minutes and try again.', 'Слишком много запросов ссылки. Подождите несколько минут и попробуйте снова.', '请求链接次数过多。请等几分钟再试。', 'ขอลิงก์บ่อยเกินไป รอสักครู่แล้วลองอีกครั้ง'),
  'login.sendFailed': L('Could not send the link. Check the address, or continue with Google.', 'Не удалось отправить ссылку. Проверьте адрес или войдите через Google.', '无法发送链接。请检查地址，或使用 Google 登录。', 'ส่งลิงก์ไม่สำเร็จ ตรวจสอบที่อยู่ หรือเข้าสู่ระบบด้วย Google'),
  'login.again': L((s) => `Send again in ${s} s`, (s) => `Отправить ещё раз через ${s} с`, (s) => `${s} 秒后可重新发送`, (s) => `ส่งอีกครั้งได้ใน ${s} วินาที`),
  'login.check': L((email) => `Check ${email} for a sign-in link.`, (email) => `Проверьте ${email}: там ссылка для входа.`, (email) => `请查看 ${email} 中的登录链接。`, (email) => `ตรวจสอบ ${email} เพื่อดูลิงก์เข้าสู่ระบบ`),

  // OAuth consent
  'consent.loading': L('Loading…', 'Загрузка…', '加载中…', 'กำลังโหลด…'),
  'consent.cant': L("Can't connect", 'Не удаётся подключить', '无法连接', 'เชื่อมต่อไม่ได้'),
  'consent.toGoals': L('Go to Goals', 'Перейти к целям', '前往目标', 'ไปที่เป้าหมาย'),
  'consent.noRequest': L('This link has no authorization request. Start connecting from your agent again.', 'В этой ссылке нет запроса на доступ. Начните подключение из агента ещё раз.', '此链接没有授权请求。请从你的智能体重新开始连接。', 'ลิงก์นี้ไม่มีคำขออนุญาต เริ่มเชื่อมต่อจากเอเจนต์ของคุณอีกครั้ง'),
  'consent.anApp': L('An app', 'Приложение', '一个应用', 'แอปหนึ่ง'),
  'consent.theApp': L('the app', 'приложение', '该应用', 'แอป'),
  'consent.h1': L((name) => `Connect ${name}?`, (name) => `Подключить ${name}?`, (name) => `连接 ${name}？`, (name) => `เชื่อมต่อ ${name}?`),
  'consent.wants': L((name, email) => `${name} wants to work with your Goalcraft as ${email}.`, (name, email) => `${name} хочет работать с вашим Goalcraft от имени ${email}.`, (name, email) => `${name} 想以 ${email} 的身份使用你的 Goalcraft。`, (name, email) => `${name} ต้องการทำงานกับ Goalcraft ของคุณในชื่อ ${email}`),
  'consent.p1': L('See your goal funnels, counts and agents', 'Видеть ваши воронки, счётчики и агентов', '查看你的目标漏斗、计数和智能体', 'ดูกรวยเป้าหมาย ตัวเลข และเอเจนต์ของคุณ'),
  'consent.p2': L('Create and change funnels, report progress and results', 'Создавать и менять воронки, сообщать о прогрессе и результатах', '创建和修改漏斗，汇报进度和成果', 'สร้างและแก้ไขกรวย รายงานความคืบหน้าและผลลัพธ์'),
  'consent.p3': L('Show itself at work and ask you questions', 'Показывать себя за работой и задавать вам вопросы', '展示自己的工作并向你提问', 'แสดงตัวขณะทำงานและถามคำถามคุณ'),
  'consent.note': L((host) => `After you allow it, you go back to ${host}. Only allow apps you started connecting yourself.`, (host) => `После разрешения вы вернётесь в ${host}. Разрешайте только приложения, которые подключаете сами.`, (host) => `授权后你会回到 ${host}。只授权你自己发起连接的应用。`, (host) => `หลังอนุญาต คุณจะกลับไปที่ ${host} อนุญาตเฉพาะแอปที่คุณเริ่มเชื่อมต่อเองเท่านั้น`),
  'consent.allow': L('Allow', 'Разрешить', '允许', 'อนุญาต'),
  'consent.done': L('Access allowed. Go back to the app; you can close this tab.', 'Доступ разрешён. Вернитесь в приложение, эту вкладку можно закрыть.', '已允许访问。请回到应用，可以关闭此标签页。', 'อนุญาตแล้ว กลับไปที่แอป ปิดแท็บนี้ได้เลย'),
  'consent.denied': L('Access denied. You can close this tab.', 'Доступ отклонён. Эту вкладку можно закрыть.', '已拒绝访问。可以关闭此标签页。', 'ปฏิเสธแล้ว ปิดแท็บนี้ได้เลย'),
  'consent.deny': L('Deny', 'Отклонить', '拒绝', 'ปฏิเสธ'),
};

for (const [code, table] of Object.entries({ es, vi, ja })) {
  for (const [key, text] of Object.entries(table)) if (STRINGS[key]) STRINGS[key][code] = text;
}

// A duration in seconds as one number and unit: 45s, 15m, 8h (to two days), 3d (to two weeks), 2w.
export function fmtDuration(sec) {
  const u = t('units');
  sec = Math.max(0, sec);
  if (sec < 60) return Math.round(sec) + u.s;
  if (sec < 3600) return Math.round(sec / 60) + u.m;
  if (sec < 2 * 86400) return Math.round(sec / 3600) + u.h;
  if (sec < 14 * 86400) return Math.round(sec / 86400) + u.d;
  return Math.round(sec / 604800) + u.w;
}

// The text for key in the current language (English if missing); functions take args.
export function t(key, ...args) {
  const entry = STRINGS[key];
  if (!entry) return key;
  const v = entry[lang] ?? entry.en;
  return typeof v === 'function' ? v(...args) : v;
}

// Fill the static page: data-i18n (text), data-i18n-html (text with markup), data-i18n-attr.
// A key this file does not know yet (a page newer than a cached copy of this file, say) keeps the
// page's own English text rather than showing the key.
export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => { if (STRINGS[el.dataset.i18n]) el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-html]').forEach(el => { if (STRINGS[el.dataset.i18nHtml]) el.innerHTML = t(el.dataset.i18nHtml); });
  root.querySelectorAll('[data-i18n-attr]').forEach(el => {
    for (const pair of el.dataset.i18nAttr.split(';')) {
      const [attr, key] = pair.split(':').map(s => s.trim());
      if (attr && STRINGS[key]) el.setAttribute(attr, t(key));
    }
  });
}

document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : lang;
applyI18n();
