import bcrypt from "bcryptjs";
import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { config } from "../config";
import { prisma } from "../db";
import { accountActionLimiter, loginLimiter } from "../middleware/rateLimit";
import {
  createEmailVerificationToken,
  createPasswordResetToken,
  createUserSession,
  destroyUserSession,
  getCurrentUser,
  normalizeEmail,
  normalizeNickname,
  toPublicUser,
  usePasswordResetToken,
  verifyEmailToken
} from "../services/accountAuth";
import { sendPasswordResetEmail, sendVerificationEmail } from "../services/email";
import { logger } from "../utils/logger";

const emailSchema = z.string().trim().email().max(254);
const passwordSchema = z.string().min(10).max(128);
const nicknameSchema = z
  .string()
  .trim()
  .min(3)
  .max(24)
  .regex(/^[\p{L}\p{N}_-]+$/u, "Nickname may contain letters, numbers, _ and - only");

const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  nickname: nicknameSchema
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128)
});

const tokenSchema = z.object({
  token: z.string().min(20).max(500)
});

const resetPasswordSchema = tokenSchema.extend({
  password: passwordSchema
});

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

function asyncRoute(handler: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch(next);
  };
}

function validationError(res: Response, result: z.SafeParseError<unknown>) {
  return res.status(400).json({
    ok: false,
    error: "VALIDATION_ERROR",
    fields: result.error.flatten().fieldErrors
  });
}

export function createAuthRoutes() {
  const router = Router();

  router.post(
    "/register",
    accountActionLimiter,
    asyncRoute(async (req, res) => {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) return validationError(res, parsed);

      const emailNormalized = normalizeEmail(parsed.data.email);
      const nickname = parsed.data.nickname.trim();
      const nicknameNormalized = normalizeNickname(nickname);

      const existing = await prisma.user.findFirst({
        where: {
          OR: [{ emailNormalized }, { nicknameNormalized }]
        },
        select: { emailNormalized: true, nicknameNormalized: true }
      });

      if (existing?.emailNormalized === emailNormalized) {
        return res.status(409).json({ ok: false, error: "EMAIL_ALREADY_USED" });
      }
      if (existing?.nicknameNormalized === nicknameNormalized) {
        return res.status(409).json({ ok: false, error: "NICKNAME_ALREADY_USED" });
      }

      const passwordHash = await bcrypt.hash(parsed.data.password, config.bcryptRounds);
      const user = await prisma.user.create({
        data: {
          email: parsed.data.email.trim(),
          emailNormalized,
          nickname,
          nicknameNormalized,
          passwordHash
        }
      });

      const token = await createEmailVerificationToken(user.id);
      try {
        await sendVerificationEmail(user.email, user.nickname, token);
      } catch (error) {
        logger.error("Verification email failed after account creation", {
          userId: user.id,
          error: error instanceof Error ? error.message : String(error)
        });
        return res.status(503).json({
          ok: false,
          error: "ACCOUNT_CREATED_EMAIL_FAILED",
          accountCreated: true
        });
      }

      return res.status(201).json({ ok: true, verificationRequired: true });
    })
  );

  router.post(
    "/verify-email",
    accountActionLimiter,
    asyncRoute(async (req, res) => {
      const parsed = tokenSchema.safeParse(req.body);
      if (!parsed.success) return validationError(res, parsed);

      const verified = await verifyEmailToken(parsed.data.token);
      if (!verified) {
        return res.status(400).json({ ok: false, error: "INVALID_OR_EXPIRED_TOKEN" });
      }

      return res.json({ ok: true });
    })
  );

  router.post(
    "/resend-verification",
    accountActionLimiter,
    asyncRoute(async (req, res) => {
      const parsed = z.object({ email: emailSchema }).safeParse(req.body);
      if (!parsed.success) return validationError(res, parsed);

      const user = await prisma.user.findUnique({
        where: { emailNormalized: normalizeEmail(parsed.data.email) }
      });

      if (user && !user.emailVerifiedAt && user.status === "ACTIVE") {
        const token = await createEmailVerificationToken(user.id);
        await sendVerificationEmail(user.email, user.nickname, token);
      }

      return res.json({ ok: true });
    })
  );

  router.post(
    "/login",
    loginLimiter,
    asyncRoute(async (req, res) => {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) return validationError(res, parsed);

      const user = await prisma.user.findUnique({
        where: { emailNormalized: normalizeEmail(parsed.data.email) }
      });

      if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
        return res.status(401).json({ ok: false, error: "INVALID_CREDENTIALS" });
      }
      if (user.status !== "ACTIVE") {
        return res.status(403).json({ ok: false, error: "ACCOUNT_UNAVAILABLE" });
      }
      if (!user.emailVerifiedAt) {
        return res.status(403).json({ ok: false, error: "EMAIL_NOT_VERIFIED" });
      }

      await createUserSession(req, res, user.id);
      return res.json({
        ok: true,
        user: toPublicUser(user)
      });
    })
  );

  router.post(
    "/logout",
    asyncRoute(async (req, res) => {
      await destroyUserSession(req, res);
      return res.json({ ok: true });
    })
  );

  router.get(
    "/me",
    asyncRoute(async (req, res) => {
      const user = await getCurrentUser(req);
      return res.json({ ok: true, user: user ? toPublicUser(user) : null });
    })
  );

  router.post(
    "/forgot-password",
    accountActionLimiter,
    asyncRoute(async (req, res) => {
      const parsed = z.object({ email: emailSchema }).safeParse(req.body);
      if (!parsed.success) return validationError(res, parsed);

      const user = await prisma.user.findUnique({
        where: { emailNormalized: normalizeEmail(parsed.data.email) }
      });

      if (user && user.status === "ACTIVE") {
        const token = await createPasswordResetToken(user.id);
        await sendPasswordResetEmail(user.email, user.nickname, token);
      }

      return res.json({ ok: true });
    })
  );

  router.post(
    "/reset-password",
    accountActionLimiter,
    asyncRoute(async (req, res) => {
      const parsed = resetPasswordSchema.safeParse(req.body);
      if (!parsed.success) return validationError(res, parsed);

      const passwordHash = await bcrypt.hash(parsed.data.password, config.bcryptRounds);
      const changed = await usePasswordResetToken(parsed.data.token, passwordHash);
      if (!changed) {
        return res.status(400).json({ ok: false, error: "INVALID_OR_EXPIRED_TOKEN" });
      }

      return res.json({ ok: true });
    })
  );

  return router;
}
