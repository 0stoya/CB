import { createHmac } from "crypto";
import type { EmailDeliveryKind } from "@prisma/client";
import nodemailer from "nodemailer";
import { config } from "../config";
import { prisma } from "../db";
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

const emailHealth = {
  configured: Boolean(transporter),
  lastCheckedAt: null as Date | null,
  lastCheckOk: null as boolean | null,
  lastCheckError: null as string | null,
  lastSentAt: null as Date | null,
  lastFailedAt: null as Date | null
};

function accountUrl(path: string, token: string) {
  const url = new URL(path, config.publicAppUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

function recipientHash(email: string) {
  return createHmac("sha256", config.sessionSecret)
    .update(email.trim().toLowerCase())
    .digest("hex");
}

function safeError(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 500);
}

async function recordDelivery(input: {
  kind: EmailDeliveryKind;
  to: string;
  status: "PREVIEW" | "SENT" | "FAILED";
  providerMessageId?: string | null;
  errorMessage?: string | null;
}) {
  try {
    await prisma.emailDelivery.create({
      data: {
        kind: input.kind,
        recipientHash: recipientHash(input.to),
        status: input.status,
        providerMessageId: input.providerMessageId?.slice(0, 500) || null,
        errorMessage: input.errorMessage?.slice(0, 500) || null,
        completedAt: new Date()
      }
    });
  } catch (error) {
    logger.warn("Unable to persist email delivery outcome", { error: safeError(error) });
  }
}

async function sendAccountEmail(args: {
  kind: EmailDeliveryKind;
  to: string;
  subject: string;
  text: string;
  html: string;
  developmentUrl: string;
}) {
  if (!transporter) {
    if (config.nodeEnv === "production") {
      const error = new Error("SMTP is not configured");
      emailHealth.lastFailedAt = new Date();
      await recordDelivery({
        kind: args.kind,
        to: args.to,
        status: "FAILED",
        errorMessage: error.message
      });
      throw error;
    }

    logger.info("Account email preview", {
      toHash: recipientHash(args.to).slice(0, 12),
      subject: args.subject,
      url: args.developmentUrl
    });
    await recordDelivery({ kind: args.kind, to: args.to, status: "PREVIEW" });
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: config.smtpFrom,
      to: args.to,
      subject: args.subject,
      text: args.text,
      html: args.html
    });
    emailHealth.lastSentAt = new Date();
    await recordDelivery({
      kind: args.kind,
      to: args.to,
      status: "SENT",
      providerMessageId: typeof info.messageId === "string" ? info.messageId : null
    });
  } catch (error) {
    const message = safeError(error);
    emailHealth.lastFailedAt = new Date();
    await recordDelivery({
      kind: args.kind,
      to: args.to,
      status: "FAILED",
      errorMessage: message
    });
    throw error;
  }
}

export function getEmailHealth() {
  return { ...emailHealth };
}

export async function verifyEmailTransport() {
  emailHealth.lastCheckedAt = new Date();
  if (!transporter) {
    emailHealth.lastCheckOk = false;
    emailHealth.lastCheckError = "SMTP_NOT_CONFIGURED";
    return { ...emailHealth };
  }

  try {
    await transporter.verify();
    emailHealth.lastCheckOk = true;
    emailHealth.lastCheckError = null;
  } catch (error) {
    emailHealth.lastCheckOk = false;
    emailHealth.lastCheckError = safeError(error);
  }
  return { ...emailHealth };
}

export async function sendVerificationEmail(to: string, nickname: string, token: string) {
  const url = accountUrl("/konto/weryfikacja", token);

  await sendAccountEmail({
    kind: "EMAIL_VERIFICATION",
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
    kind: "PASSWORD_RESET",
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
