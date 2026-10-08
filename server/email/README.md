# Verification email branding

`../verification-email.mjs` builds both HTML and plain-text email, with the PNG logo embedded via CID. The sender remains the configured `SMTP_FROM`; SMTP credentials and transport security are unchanged. `brand-mark.svg` is the editable source for `brand-mark.png`.

The local SMTP entry point (`server/dev.mjs`) uses this template. The isolated preview server continues to show local verification codes without sending mail.

Run `node scripts/preview-verification-email.mjs` after a build to create the local sample at `/verification-email-preview.html` (dummy code `123456`, no email sent). This preview is not part of the production build.

Production synchronization is pending explicit publishing authorization. At that time, copy the template and PNG to the release server and replace only the `sendMail` message object in `server/production.mjs` with `verificationEmail({from:env.SMTP_FROM,to:email,code})`; preserve its SMTP configuration and all production security settings.
