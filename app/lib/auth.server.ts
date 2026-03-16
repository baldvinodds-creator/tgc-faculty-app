import crypto from "crypto";
import jwt from "jsonwebtoken";
import prisma from "../db.server";

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
const MAGIC_LINK_EXPIRY_MINUTES = parseInt(
  process.env.MAGIC_LINK_EXPIRY_MINUTES || "15",
);
const SESSION_DURATION_HOURS = parseInt(
  process.env.SESSION_DURATION_HOURS || "24",
);

export interface JWTPayload {
  facultyId: string;
  email: string;
  role: string;
  status: string;
}

// ─── Magic Link / Code ───

function generateCode(): string {
  // Generate a 6-digit numeric code (100000–999999)
  return String(100000 + crypto.randomInt(900000));
}

export async function createMagicLinkToken(email: string): Promise<{ token: string; code: string }> {
  const token = crypto.randomBytes(32).toString("hex");
  const code = generateCode();
  const expiresAt = new Date(
    Date.now() + MAGIC_LINK_EXPIRY_MINUTES * 60 * 1000,
  );

  // Find faculty by email (may not exist yet for new applicants)
  const faculty = await prisma.faculty.findUnique({ where: { email } });

  await prisma.magicLinkToken.create({
    data: {
      email,
      token,
      code,
      expiresAt,
      facultyId: faculty?.id || null,
    },
  });

  return { token, code };
}

export async function verifyCode(email: string, code: string): Promise<{
  email: string;
  facultyId: string | null;
  isNew: boolean;
} | null> {
  const record = await prisma.magicLinkToken.findFirst({
    where: {
      email: email.toLowerCase(),
      code,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!record) return null;

  // Mark as used
  await prisma.magicLinkToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  // Check if faculty exists
  const faculty = await prisma.faculty.findUnique({
    where: { email: record.email },
  });

  return {
    email: record.email,
    facultyId: faculty?.id || null,
    isNew: !faculty,
  };
}

export async function verifyMagicLinkToken(token: string): Promise<{
  email: string;
  facultyId: string | null;
  isNew: boolean;
} | null> {
  const record = await prisma.magicLinkToken.findUnique({ where: { token } });

  if (!record) return null;
  if (record.usedAt) return null;
  if (record.expiresAt < new Date()) return null;

  // Mark as used
  await prisma.magicLinkToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  // Check if faculty exists
  const faculty = await prisma.faculty.findUnique({
    where: { email: record.email },
  });

  return {
    email: record.email,
    facultyId: faculty?.id || null,
    isNew: !faculty,
  };
}

// ─── JWT ───

export function createJWT(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: `${SESSION_DURATION_HOURS}h`,
  });
}

export function verifyJWT(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

// ─── Request Auth Helper ───

export function extractJWTFromRequest(request: Request): JWTPayload | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return verifyJWT(authHeader.slice(7));
}

export async function requireTeacherAuth(
  request: Request,
): Promise<JWTPayload> {
  const payload = extractJWTFromRequest(request);
  if (!payload) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return payload;
}
