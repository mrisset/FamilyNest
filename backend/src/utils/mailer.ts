import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendInvitationEmail({
  to,
  houseName,
  invitedBy,
  link,
}: {
  to: string;
  houseName: string;
  invitedBy: string;
  link: string;
}) {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;

  await transporter.sendMail({
    from: `FamilyNest <${from}>`,
    to,
    subject: `${invitedBy} vous invite à rejoindre "${houseName}" sur FamilyNest`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1c1917;">
        <h2 style="margin: 0 0 8px;">Invitation FamilyNest</h2>
        <p style="color: #78716c; margin: 0 0 24px;">
          <strong>${invitedBy}</strong> vous invite à rejoindre la maison <strong>${houseName}</strong>.
        </p>
        <a href="${link}" style="display:inline-block; background:#1c1917; color:#fff; text-decoration:none; padding:12px 24px; border-radius:10px; font-weight:600;">
          Rejoindre la maison
        </a>
        <p style="margin: 24px 0 0; font-size: 12px; color: #a8a29e;">
          Ce lien est valable 7 jours et à usage unique.<br>
          Si vous ne souhaitez pas rejoindre cette maison, ignorez cet e-mail.
        </p>
      </div>
    `,
  });
}
