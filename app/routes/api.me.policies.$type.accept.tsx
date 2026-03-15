// POST /api/me/policies/:type/accept — accept a policy

import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import prisma from "../db.server";
import { requireTeacherAuth } from "../lib/auth.server";
import { logAudit } from "../lib/audit.server";

const VALID_POLICY_TYPES = new Set([
  "terms_of_service",
  "privacy_policy",
  "cancellation_policy",
  "recording_policy",
  "conduct_policy",
  "payout_agreement",
  "no_solicitation_agreement",
]);

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const auth = await requireTeacherAuth(request);
  const consentType = params.type!;

  if (!VALID_POLICY_TYPES.has(consentType)) {
    return json(
      { error: `Invalid policy type. Must be one of: ${[...VALID_POLICY_TYPES].join(", ")}` },
      { status: 400 },
    );
  }

  const body = await request.json();

  if (!body.version) {
    return json({ error: "version is required" }, { status: 400 });
  }

  // Extract IP address from request headers
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;

  const consent = await prisma.consent.create({
    data: {
      facultyId: auth.facultyId,
      consentType,
      version: body.version,
      ipAddress,
    },
  });

  await logAudit({
    actorType: "teacher",
    actorId: auth.facultyId,
    action: "policy.accepted",
    objectType: "consent",
    objectId: consent.id,
    details: { consentType, version: body.version },
    ipAddress: ipAddress || undefined,
  });

  return json({ success: true, consent });
}
