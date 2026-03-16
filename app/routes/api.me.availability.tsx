// GET  /api/me/availability — return availability preferences
// PUT  /api/me/availability — create or update availability preferences

import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import prisma from "../db.server";
import { requireTeacherAuth } from "../lib/auth.server";
import { logAudit } from "../lib/audit.server";
import { handleCorsOptions, withCors } from "../lib/cors.server";

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
  const preflight = handleCorsOptions(request);
  if (preflight) return preflight;

  try {
    const auth = await requireTeacherAuth(request);

    const availability = await prisma.availabilityPreferences.findUnique({
      where: { facultyId: auth.facultyId },
    });

    return withCors(request, json({ availability: availability || null }));
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error("Load availability error:", error);
    return withCors(request, json({ error: "Failed to load availability" }, { status: 500 }));
  }
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "PUT") {
    return withCors(request, json({ error: "Method not allowed" }, { status: 405 }));
  }

  try {
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

    return withCors(request, json({ success: true, availability }));
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error("Update availability error:", error);
    return withCors(request, json({ error: "Failed to update availability" }, { status: 500 }));
  }
}
