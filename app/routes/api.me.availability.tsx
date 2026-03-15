// GET  /api/me/availability — return availability preferences
// PUT  /api/me/availability — create or update availability preferences

import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import prisma from "../db.server";
import { requireTeacherAuth } from "../lib/auth.server";
import { logAudit } from "../lib/audit.server";

const ALLOWED_FIELDS = new Set([
  "timezone",
  "weeklyHours",
  "blockedDates",
  "seasonalNotes",
  "leadTimeHours",
  "bufferMinutes",
  "maxSessionsPerDay",
  "acceptingStudents",
  "pauseMode",
  "pauseReason",
  "notesForAdmin",
]);

export async function loader({ request }: LoaderFunctionArgs) {
  const auth = await requireTeacherAuth(request);

  const availability = await prisma.availabilityPreferences.findUnique({
    where: { facultyId: auth.facultyId },
  });

  return json({ availability: availability || null });
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "PUT") {
    return json({ error: "Method not allowed" }, { status: 405 });
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
    return json({ error: "No valid fields provided" }, { status: 400 });
  }

  // Upsert availability preferences
  const availability = await prisma.availabilityPreferences.upsert({
    where: { facultyId: auth.facultyId },
    create: {
      facultyId: auth.facultyId,
      ...data,
    },
    update: data,
  });

  // When pauseMode changes, also update faculty.acceptingStudents
  if ("pauseMode" in data) {
    const newAccepting = !data.pauseMode;
    await prisma.faculty.update({
      where: { id: auth.facultyId },
      data: { acceptingStudents: newAccepting },
    });
  }

  await logAudit({
    actorType: "teacher",
    actorId: auth.facultyId,
    action: "availability.updated",
    objectType: "availability",
    objectId: availability.id,
    details: { fields: Object.keys(data) },
  });

  return json({ success: true, availability });
}
