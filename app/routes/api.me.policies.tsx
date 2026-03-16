// GET /api/me/policies — return policy types with teacher's consent status

import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import prisma from "../db.server";
import { requireTeacherAuth } from "../lib/auth.server";
import { handleCorsOptions, withCors } from "../lib/cors.server";

const POLICY_TYPES = [
  {
    type: "terms_of_service",
    label: "Terms of Service",
    currentVersion: "1.0",
  },
  {
    type: "privacy_policy",
    label: "Privacy Policy",
    currentVersion: "1.0",
  },
  {
    type: "cancellation_policy",
    label: "Cancellation Policy",
    currentVersion: "1.0",
  },
  {
    type: "recording_policy",
    label: "Recording Policy",
    currentVersion: "1.0",
  },
  {
    type: "conduct_policy",
    label: "Code of Conduct",
    currentVersion: "1.0",
  },
  {
    type: "payout_agreement",
    label: "Payout Agreement",
    currentVersion: "1.0",
  },
  {
    type: "no_solicitation_agreement",
    label: "No Solicitation Agreement",
    currentVersion: "1.0",
  },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const preflight = handleCorsOptions(request);
  if (preflight) return preflight;

  try {
    const auth = await requireTeacherAuth(request);

    // Get all consents for this teacher
    const consents = await prisma.consent.findMany({
      where: { facultyId: auth.facultyId },
      orderBy: { acceptedAt: "desc" },
    });

    // Build a map of latest consent per type
    const latestConsents = new Map<
      string,
      { version: string; acceptedAt: Date }
    >();
    for (const consent of consents) {
      if (!latestConsents.has(consent.consentType)) {
        latestConsents.set(consent.consentType, {
          version: consent.version,
          acceptedAt: consent.acceptedAt,
        });
      }
    }

    // Build response with status for each policy type
    const policies = POLICY_TYPES.map((policy) => {
      const latest = latestConsents.get(policy.type);
      return {
        type: policy.type,
        label: policy.label,
        currentVersion: policy.currentVersion,
        acceptedVersion: latest?.version || null,
        acceptedAt: latest?.acceptedAt || null,
        needsAcceptance: !latest || latest.version !== policy.currentVersion,
      };
    });

    return withCors(request, json({ policies }));
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error("Load policies error:", error);
    return withCors(request, json({ error: "Failed to load policies" }, { status: 500 }));
  }
}
