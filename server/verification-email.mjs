import { readFileSync } from 'node:fs';

const logo = readFileSync(new URL('./email/brand-mark.png', import.meta.url));
const logoCid = 'dse-physics-brand@ddphysics.com';

// Inline styles, presentation tables and a CID image also work without remote images.
export function verificationEmail({ from, to, code }) {
  if (!/^\d{6}$/.test(String(code))) throw new TypeError('A six-digit verification code is required.');
  const subject = 'DSE Physics 登录验证码';
  const text = `DSE Physics\nddphysics.com\n\n你的登录验证码是：${code}\n\n10 分钟内有效，请勿分享此验证码。\n如非本人操作，请忽略此邮件。\n\nhttps://ddphysics.com`;
  const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${subject}</title></head>
<body style="margin:0;padding:0;background-color:#f5f7fb;color:#172b46;font-family:Arial,'Microsoft YaHei',sans-serif;">
<div style="display:none;font-size:1px;color:#f5f7fb;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">你的 DSE Physics 登录验证码，10 分钟内有效。</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f5f7fb"><tr><td align="center" style="padding:40px 16px;">
<!--[if mso]><table role="presentation" width="520" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="max-width:520px;border:1px solid #e4e9f1;border-radius:16px;">
<tr><td style="padding:32px 28px 28px;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
<td width="44" valign="middle"><img src="cid:${logoCid}" alt="DSE Physics" width="40" height="40" style="display:block;border:0;border-radius:10px;"></td>
<td valign="middle" style="padding-left:12px;"><span style="font-size:21px;line-height:26px;font-weight:700;letter-spacing:-0.4px;color:#172b46;">DSE Physics</span><br><a href="https://ddphysics.com" style="font-size:12px;line-height:19px;letter-spacing:0.4px;color:#708095;text-decoration:none;">ddphysics.com</a></td>
</tr></table>
<h1 style="margin:34px 0 12px;font-size:23px;line-height:32px;font-weight:700;color:#172b46;">登录验证码</h1>
<p style="margin:0 0 24px;font-size:14px;line-height:24px;color:#627086;">请在 DSE Physics 登录页面输入以下验证码。</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" bgcolor="#f0f5ff" style="padding:22px 8px;border:1px solid #e0eaff;border-radius:10px;">
<span dir="ltr" style="display:inline-block;font-family:'Courier New',monospace;font-size:34px;line-height:42px;letter-spacing:6px;font-weight:700;color:#245dcc;">${code}</span>
</td></tr></table>
<p style="margin:16px 0 0;font-size:13px;line-height:22px;color:#627086;">10 分钟内有效 · 请勿分享此验证码</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="padding-top:28px;"><div style="border-top:1px solid #edf0f5;padding-top:20px;font-size:12px;line-height:20px;color:#8993a2;">如非本人操作，请忽略此邮件。</div></td></tr></table>
</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
  return {from, to, subject, text, html, attachments:[{filename:'dse-physics.png',content:logo,contentType:'image/png',cid:logoCid,contentDisposition:'inline'}]};
}
