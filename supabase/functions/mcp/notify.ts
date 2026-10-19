// Email to the person when an agent asks them a question, if they ticked "Email me" in the nav
// (user_metadata.notify_email). Sent through ImprovMX SMTP from noreply@goalcraft.ai, the
// same sender as the sign-in links; the password is the SMTP_PASS function secret. Port 465:
// edge functions cannot reach port 587.
import nodemailer from 'npm:nodemailer@6.9.16'

const FROM = 'noreply@goalcraft.ai'
const APP = 'https://goalcraft.ai/app/'

const NAMES: Record<string, string> = {
  claude: 'Claude', chatgpt: 'ChatGPT', grok: 'Grok', gemini: 'Gemini', deepseek: 'DeepSeek',
  kimi: 'Kimi', qwen: 'Qwen', mistral: 'Mistral', perplexity: 'Perplexity', hermes: 'Hermes',
}
// "claude-search" is Claude; an unknown name is shown as written, capitalised.
const nameOf = (agent: string) => {
  const base = agent.split(/[-_]/)[0]
  return NAMES[base] ?? agent.charAt(0).toUpperCase() + agent.slice(1)
}

type Words = { subject: (who: string, q: string) => string, body: (who: string, funnel: string) => string, answer: string, why: string }
const WORDS: Record<string, Words> = {
  en: {
    subject: (who, q) => `${who} asks: ${q}`,
    body: (who, funnel) => `${who} in “${funnel}” is waiting for your answer:`,
    answer: 'Answer on the dashboard',
    why: 'You get this because “Email me” is ticked in the menu on goalcraft.ai. Untick it to stop these emails.',
  },
  ru: {
    subject: (who, q) => `${who} спрашивает: ${q}`,
    body: (who, funnel) => `${who} в «${funnel}» ждёт вашего ответа:`,
    answer: 'Ответить на дашборде',
    why: 'Это письмо пришло, потому что в меню на goalcraft.ai отмечено «Письма». Снимите галочку, чтобы письма больше не приходили.',
  },
  es: {
    subject: (who, q) => `${who} pregunta: ${q}`,
    body: (who, funnel) => `${who} en «${funnel}» espera tu respuesta:`,
    answer: 'Responder en el panel',
    why: 'Recibes este correo porque «Avisos» está marcado en el menú de goalcraft.ai. Desmárcalo para dejar de recibirlos.',
  },
  vi: {
    subject: (who, q) => `${who} hỏi: ${q}`,
    body: (who, funnel) => `${who} trong “${funnel}” đang chờ bạn trả lời:`,
    answer: 'Trả lời trên bảng',
    why: 'Bạn nhận được email này vì mục “Thông báo” đang được chọn trong menu trên goalcraft.ai. Bỏ chọn để ngừng nhận.',
  },
  ja: {
    subject: (who, q) => `${who} からの質問：${q}`,
    body: (who, funnel) => `「${funnel}」の ${who} があなたの返事を待っています：`,
    answer: 'ボードで返事する',
    why: 'goalcraft.ai のメニューで「メール通知」がオンになっているため、このメールが届きました。オフにすると届かなくなります。',
  },
  zh: {
    subject: (who, q) => `${who} 提问：${q}`,
    body: (who, funnel) => `${who} 在「${funnel}」中等待你的回复：`,
    answer: '在看板上回复',
    why: '你收到这封邮件，是因为在 goalcraft.ai 的菜单中勾选了“邮件通知”。取消勾选即可停止接收。',
  },
  th: {
    subject: (who, q) => `${who} ถาม: ${q}`,
    body: (who, funnel) => `${who} ใน “${funnel}” กำลังรอคำตอบจากคุณ:`,
    answer: 'ตอบบนแดชบอร์ด',
    why: 'คุณได้รับอีเมลนี้เพราะติ๊ก “แจ้งทางอีเมล” ไว้ในเมนูของ goalcraft.ai เอาติ๊กออกเพื่อหยุดรับอีเมลเหล่านี้',
  },
  pt: {
    subject: (who, q) => `${who} pergunta: ${q}`,
    body: (who, funnel) => `${who} em “${funnel}” está esperando sua resposta:`,
    answer: 'Responder no painel',
    why: 'Você recebe este e-mail porque “Avisos” está marcado no menu do goalcraft.ai. Desmarque para parar de receber.',
  },
  tr: {
    subject: (who, q) => `${who} soruyor: ${q}`,
    body: (who, funnel) => `“${funnel}” hunisindeki ${who} cevabınızı bekliyor:`,
    answer: 'Panelde cevapla',
    why: 'Bu e-postayı goalcraft.ai menüsünde “E-posta” işaretli olduğu için alıyorsunuz. Bu e-postaları durdurmak için işareti kaldırın.',
  },
  ko: {
    subject: (who, q) => `${who}의 질문: ${q}`,
    body: (who, funnel) => `“${funnel}”의 ${who}이(가) 답을 기다리고 있습니다:`,
    answer: '대시보드에서 답하기',
    why: 'goalcraft.ai 메뉴에서 “이메일 알림”이 켜져 있어 이 이메일을 받았습니다. 끄면 더 이상 받지 않습니다.',
  },
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)
const short = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s)

let transport: ReturnType<typeof nodemailer.createTransport> | null = null

// name: the agent's own name ("Супервайзер поиска работы") when it gave one, else its model's name.
export async function emailQuestion(to: string, lang: string | undefined, agent: string, funnel: string, question: string, name?: string | null) {
  const pass = Deno.env.get('SMTP_PASS')
  if (!pass) return console.warn('SMTP_PASS is not set: question emails are off')
  transport ??= nodemailer.createTransport({ host: 'smtp.improvmx.com', port: 465, secure: true, auth: { user: FROM, pass } })
  const w = WORDS[lang ?? ''] ?? WORDS.en, who = name || nameOf(agent)
  const line = question.replace(/\s+/g, ' ').trim()
  await transport.sendMail({
    from: `Goalcraft <${FROM}>`,
    to,
    subject: w.subject(who, short(line, 80)),
    text: `${w.body(who, funnel)}\n\n${question}\n\n${w.answer}: ${APP}\n\n—\n${w.why}`,
    html: `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1B1714;max-width:560px">
<p>${esc(w.body(who, funnel))}</p>
<blockquote style="margin:0 0 20px;padding:10px 14px;border-left:4px solid #F2C14E;background:#FBF6EC;white-space:pre-wrap">${esc(question)}</blockquote>
<p><a href="${APP}" style="display:inline-block;background:#F2C14E;color:#1B1714;font-weight:600;text-decoration:none;padding:10px 20px">${esc(w.answer)}</a></p>
<p style="color:#8A8075;font-size:12px;margin-top:28px">${esc(w.why)}</p></div>`,
  })
}
