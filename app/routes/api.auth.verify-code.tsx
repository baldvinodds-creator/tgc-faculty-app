// POST /api/auth/verify-code
// Body: { email, code }
// Validates a 6-digit code, returns JWT

import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import prisma from "../db.server";
import { verifyCode, createJWT } from "../lib/auth.server";
import { logAudit } from "../lib/audit.server";
import { handleCorsOptions, withCors } from "../lib/cors.server";

// Handle OPTIONS preflight
export async function loader({ request }: LoaderFunctionArgs) {
  const preflight = handleCorsOptions(request);
  if (preflight) return preflight;
  return json({ error: "Method not allowed" }, { status: 405 });
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return withCors(request, json({ error: "Method not allowed" }, { status: 405 }));
  }

  try {
    const body = await request.json();
    const email = body.email?.trim()?.toLowerCase();
    const code = body.code?.trim();

    if (!email || !code) {
      return withCors(request, json({ error: "Email and code are required" }, { status: 400 }));
    }

    const result = await verifyCode(email, code);

    if (!result) {
      return withCors(request, json({ error: "Invalid or expired code. Please try again." }, { status: 401 }));
    }

    // Get or create faculty record
    let faculty = await prisma.faculty.findUnique({
      where: { email: result.email },
    });

    if (!faculty) {
      faculty = await prisma.faculty.create({
        data: {
          email: result.email,
          status: "applicant",
          role: "teacher",
        },
      });
    }

    // Create JWT
    const jwt = createJWT({
      facultyId: faculty.id,
      email: faculty.email,
      role: faculty.role,
      status: faculty.status,
    });

    await logAudit({
      actorType: "teacher",
      actorId: faculty.id,
      action: "auth.login",
      objectType: "faculty",
      objectId: faculty.id,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return withCors(request, json({
      success: true,
      token: jwt,
      faculty: {
        id: faculty.id,
        email: faculty.email,
        status: faculty.status,
        role: faculty.role,
      },
    }));
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error("Verify code error:", error);
    return withCors(request, json({ error: "Verification failed. Please try again." }, { status: 500 }));
  }
}
