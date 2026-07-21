import nodemailer from "nodemailer";
import { config } from "../config";
import { logger } from "../utils/logger";

const transporter = config.smtpHost
  ? nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth:
        config.smtpUser && config.smtpPassword
          ? { user: config.smtpUser, pass: config.smtpPassword }
          : undefined
    })
  : null;

function accountUrl(path: string, token: string) {
  const url = new URL(path, config.publicAppUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

async function sendAccountEmail(args: {
  to: string;
  subject: string;
  text: string;
  html: string;
  developmentUrl: string;
}) {
  if (!transporter) {
    if (config.nodeEnv === "production") {
      throw new Error("SMTP is not configured");
    }

    logger.info("Account email preview", {
      to: args.to,
      subject: args.subject,
      url: args.developmentUrl
    });
    return;
  }

  await transporter.sendMail({
    from: config.smtpFrom,
    to: args.to,
    subject: args.subject,
    text: args.text,
    html: args.html
  });
}

export async function sendVerificationEmail(to: string, nickname: string, token: string) {
  const url = accountUrl("/konto/weryfikacja", token);

  await sendAccountEmail({
    to,
    subject: "Potwierdź adres e-mail w Chati",
    developmentUrl: url,
    text: `Cześć ${nickname}, potwierdź swój adres e-mail: ${url}. Link wygaśnie po ${config.emailVerificationHours} godzinach.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#111827">
        <h1 style="font-size:24px">Potwierdź adres e-mail</h1>
        <p>Cześć ${escapeHtml(nickname)},</p>
        <p>Kliknij poniżej, aby aktywować konto Chati.</p>
        <p><a href="${url}" style="display:inline-block;background:#006AFF;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700">Potwierdź e-mail</a></p>
        <p style="color:#64748B;font-size:13px">Link wygaśnie po ${config.emailVerificationHours} godzinach.</p>
      </div>
    `
  });
}

export async function sendPasswordResetEmail(to: string, nickname: string, token: string) {
  const url = accountUrl("/konto/reset-hasla", token);

  await sendAccountEmail({
    to,
    subject: "Reset hasła w Chati",
    developmentUrl: url,
    text: `Cześć ${nickname}, ustaw nowe hasło: ${url}. Link wygaśnie po ${config.passwordResetMinutes} minutach.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#111827">
        <h1 style="font-size:24px">Ustaw nowe hasło</h1>
        <p>Cześć ${escapeHtml(nickname)},</p>
        <p>Otrzymaliśmy prośbę o zmianę hasła do Twojego konta Chati.</p>
        <p><a href="${url}" style="display:inline-block;background:#006AFF;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700">Ustaw nowe hasło</a></p>
        <p style="color:#64748B;font-size:13px">Link wygaśnie po ${config.passwordResetMinutes} minutach. Jeżeli to nie Ty, zignoruj tę wiadomość.</p>
      </div>
    `
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    };
    return entities[character] ?? character;
  });
}
