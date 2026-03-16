// GET /api/auth/verify?token=xxx
// Validates magic link token, returns JWT
// Redirects to teacher portal SPA with token in URL fragment

import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import prisma from "../db.server";
import { verifyMagicLinkToken, createJWT } from "../lib/auth.server";
import { logAudit } from "../lib/audit.server";
import { handleCorsOptions, withCors } from "../lib/cors.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const preflight = handleCorsOptions(request);
  if (preflight) return preflight;

  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return withCors(request, redirect("/apps/faculty?error=missing_token"));
    }

    const result = await verifyMagicLinkToken(token);

    if (!result) {
      return withCors(request, redirect("/apps/faculty?error=invalid_or_expired_token"));
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

    // Redirect to teacher portal with JWT in URL hash (SPA picks it up)
    // The hash fragment is NOT sent to the server on subsequent requests
    return withCors(request, redirect(`/apps/faculty#token=${jwt}`));
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error("Verify magic link error:", error);
    return withCors(request, redirect("/apps/faculty?error=verification_failed"));
  }
}
