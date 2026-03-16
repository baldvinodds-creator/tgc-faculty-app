// GET /api/me/tech — return tech setup (create empty if not exists)
// PUT /api/me/tech — update tech fields

import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import prisma from "../db.server";
import { requireTeacherAuth } from "../lib/auth.server";
import { logAudit } from "../lib/audit.server";
import { handleCorsOptions, withCors } from "../lib/cors.server";

const ALLOWED_FIELDS = new Set([
  "zoomLink",
  "cameraSetup",
  "microphoneSetup",
  "wifiQuality",
  "backupPlan",
  "techNotes",
]);

const VALID_WIFI_QUALITY = new Set(["excellent", "good", "fair", "poor"]);

export async function loader({ request }: LoaderFunctionArgs) {
  const preflight = handleCorsOptions(request);
  if (preflight) return preflight;

  const auth = await requireTeacherAuth(request);

  // Create empty record if not exists
  const tech = await prisma.facultyTech.upsert({
    where: { facultyId: auth.facultyId },
    create: { facultyId: auth.facultyId },
    update: {},
  });

  return withCors(request, json({ tech }));
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "PUT") {
    return withCors(request, json({ error: "Method not allowed" }, { status: 405 }));
  }

  const auth = await requireTeacherAuth(request);
  const body = await request.json();

  // Filter to only allowed fields
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (ALLOWED_FIELDS.has(key)) {
      data[key] = value;
    }
  }

  if (Object.keys(data).length === 0) {
    return withCors(request, json({ error: "No valid fields provided" }, { status: 400 }));
  }

  // Validate wifiQuality if provided
  if (data.wifiQuality && !VALID_WIFI_QUALITY.has(data.wifiQuality as string)) {
    return withCors(request, json(
      { error: `Invalid wifiQuality. Must be one of: ${[...VALID_WIFI_QUALITY].join(", ")}` },
      { status: 400 },
    ));
  }

  const tech = await prisma.facultyTech.upsert({
    where: { facultyId: auth.facultyId },
    create: {
      facultyId: auth.facultyId,
      ...data,
    },
    update: data,
  });

  await logAudit({
    actorType: "teacher",
    actorId: auth.facultyId,
    action: "tech.updated",
    objectType: "tech",
    objectId: tech.id,
    details: { fields: Object.keys(data) },
  });

  return withCors(request, json({ success: true, tech }));
}
