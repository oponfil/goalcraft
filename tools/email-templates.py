"""Builds the sign-in emails in supabase/templates/ in every site language. Supabase Auth has one
template per email, so each holds all languages and picks one by the person's language: the site's
language at sign-up (the login page sends it) or the one saved in their account since. English when
none is known. Run it after changing a text here, then
apply the files to the project's Auth settings (Management API PATCH config/auth: the magic link
and confirmation content, and subject.txt as both subjects). Auth caches email bodies for a few minutes."""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent

# subject, heading, text, button, why (with {email}), questions.
TEXT = {
    'en': ('Your Goalcraft sign-in link', 'Sign in to Goalcraft',
           'Use the button below to sign in to your Goalcraft dashboard, where your AI agents report progress on your goals. The link works once and expires in an hour.',
           'Sign in to Goalcraft',
           "You received this email because someone asked to sign in to Goalcraft with {email}. If it wasn't you, you can ignore it: nothing happens without the link.",
           'Questions? Write to'),
    'ru': ('Ссылка для входа в Goalcraft', 'Вход в Goalcraft',
           'Нажмите кнопку ниже, чтобы войти в дашборд Goalcraft, где ваши ИИ-агенты показывают, как продвигаются ваши цели. Ссылка работает один раз и действует час.',
           'Войти в Goalcraft',
           'Вы получили это письмо, потому что кто-то попросил войти в Goalcraft с адресом {email}. Если это были не вы, просто не обращайте внимания: без ссылки ничего не произойдёт.',
           'Вопросы? Пишите на'),
    'zh': ('你的 Goalcraft 登录链接', '登录 Goalcraft',
           '点击下面的按钮登录 Goalcraft 看板，你的 AI 智能体会在那里汇报目标进展。该链接只能使用一次，一小时后失效。',
           '登录 Goalcraft',
           '你收到这封邮件，是因为有人请求用 {email} 登录 Goalcraft。如果不是你本人，可以忽略这封邮件：没有这个链接什么都不会发生。',
           '有问题？请写信至'),
    'th': ('ลิงก์เข้าสู่ระบบ Goalcraft ของคุณ', 'เข้าสู่ระบบ Goalcraft',
           'กดปุ่มด้านล่างเพื่อเข้าสู่แดชบอร์ด Goalcraft ที่เอเจนต์ AI ของคุณรายงานความคืบหน้าของเป้าหมาย ลิงก์ใช้ได้ครั้งเดียวและหมดอายุในหนึ่งชั่วโมง',
           'เข้าสู่ระบบ Goalcraft',
           'คุณได้รับอีเมลนี้เพราะมีคนขอเข้าสู่ระบบ Goalcraft ด้วย {email} ถ้าไม่ใช่คุณ ไม่ต้องสนใจอีเมลนี้ได้เลย: ไม่มีอะไรเกิดขึ้นหากไม่ใช้ลิงก์',
           'มีคำถาม? เขียนถึง'),
    'es': ('Tu enlace para entrar en Goalcraft', 'Entra en Goalcraft',
           'Usa el botón de abajo para entrar en tu panel de Goalcraft, donde tus agentes de IA informan del avance de tus metas. El enlace funciona una vez y caduca en una hora.',
           'Entrar en Goalcraft',
           'Recibiste este correo porque alguien pidió entrar en Goalcraft con {email}. Si no fuiste tú, puedes ignorarlo: sin el enlace no pasa nada.',
           '¿Preguntas? Escribe a'),
    'vi': ('Liên kết đăng nhập Goalcraft của bạn', 'Đăng nhập Goalcraft',
           'Bấm nút bên dưới để đăng nhập bảng điều khiển Goalcraft, nơi các tác tử AI của bạn báo cáo tiến độ mục tiêu. Liên kết chỉ dùng được một lần và hết hạn sau một giờ.',
           'Đăng nhập Goalcraft',
           'Bạn nhận được email này vì có người yêu cầu đăng nhập Goalcraft bằng {email}. Nếu không phải bạn, bạn có thể bỏ qua: không có gì xảy ra nếu không dùng liên kết.',
           'Có câu hỏi? Hãy viết cho'),
    'ja': ('Goalcraft のログインリンク', 'Goalcraft にログイン',
           '下のボタンから Goalcraft のダッシュボードにログインしてください。AI エージェントが目標の進み具合を報告しています。リンクは 1 回だけ使え、1 時間で無効になります。',
           'Goalcraft にログイン',
           'このメールは、誰かが {email} で Goalcraft へのログインを求めたため届きました。心当たりがなければ無視してください。リンクを使わなければ何も起きません。',
           'ご質問は'),
}
# Japanese puts the verb after the address.
AFTER = {'ja': ' までどうぞ。'}

PAGE = '''<!doctype html>
<html lang="{lang}">
<body style="margin:0;padding:0;background:#f4ede1;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1b1714">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4ede1;padding:32px 16px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:8px;padding:32px">
<tr><td style="font-size:22px;font-weight:700;letter-spacing:2px;padding-bottom:24px">GOALCRAFT</td></tr>
<tr><td style="font-size:18px;font-weight:600;padding-bottom:12px">{heading}</td></tr>
<tr><td style="font-size:15px;line-height:22px;padding-bottom:24px">{text}</td></tr>
<tr><td style="padding-bottom:24px"><a href="https://goalcraft.ai/auth/v1/verify?token={{{{ .TokenHash }}}}&type={type}&redirect_to={{{{ .RedirectTo }}}}" style="display:inline-block;background:#f2c14e;color:#1b1714;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:6px">{button}</a></td></tr>
<tr><td style="font-size:13px;line-height:20px;color:#6b6460;padding-bottom:8px">{why}</td></tr>
<tr><td style="font-size:13px;line-height:20px;color:#6b6460">{questions} <a href="mailto:support@goalcraft.ai" style="color:#6b6460">support@goalcraft.ai</a>{after} Goalcraft &middot; <a href="https://goalcraft.ai" style="color:#6b6460">goalcraft.ai</a></td></tr>
</table>
</td></tr>
</table>
</body>
</html>
'''

# The person's language, English when the account has none.
PICK = '{{ $l := or .Data.lang "en" }}'


def branches(render):
    """English last, as the fallback for any language not listed."""
    others = [l for l in TEXT if l != 'en']
    out = PICK + ''.join(('{{ if' if i == 0 else '{{ else if') + f' eq $l "{l}" }}}}' + render(l) for i, l in enumerate(others))
    return out + '{{ else }}' + render('en') + '{{ end }}'


def page(kind, l):
    subject, heading, text, button, why, questions = TEXT[l]
    return PAGE.format(lang=l, heading=heading, text=text, type=kind, button=button,
                       why=why.format(email='{{ .Email }}'), questions=questions, after=AFTER.get(l, '.'))


SUBJECT = branches(lambda l: TEXT[l][0])

if __name__ == '__main__':
    for name, kind in [('magic_link', 'magiclink'), ('confirmation', 'signup')]:
        (ROOT / 'supabase' / 'templates' / f'{name}.html').write_text(branches(lambda l: page(kind, l)))
    (ROOT / 'supabase' / 'templates' / 'subject.txt').write_text(SUBJECT + '\n')
    print('written')
