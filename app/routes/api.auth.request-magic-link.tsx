// POST /api/auth/request-magic-link
// Body: { email }
// Sends a magic link email. Creates faculty record if new applicant.

import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import prisma from "../db.server";
import { createMagicLinkToken } from "../lib/auth.server";
import { sendMagicLinkEmail } from "../lib/email.server";
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

  const body = await request.json();
  const email = body.email?.trim()?.toLowerCase();

  if (!email || !email.includes("@")) {
    return withCors(request, json({ error: "Valid email required" }, { status: 400 }));
  }

  // Check if faculty exists
  const faculty = await prisma.faculty.findUnique({ where: { email } });
  const isNew = !faculty;

  // If new, create a faculty record as applicant
  if (isNew) {
    await prisma.faculty.create({
      data: {
        email,
        status: "applicant",
        role: "teacher",
      },
    });
  }

  // Generate and send magic link
  const token = await createMagicLinkToken(email);
  await sendMagicLinkEmail(email, token, isNew);

  return withCors(request, json({
    success: true,
    message: "Check your email for a login link.",
    isNew,
  }));
}
