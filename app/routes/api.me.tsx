// GET /api/me — returns current teacher's profile
// PUT /api/me/profile — update profile (gated fields go to pending)

import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import prisma from "../db.server";
import { requireTeacherAuth } from "../lib/auth.server";
import { logAudit } from "../lib/audit.server";
import { calculateProfileCompleteness } from "../lib/workflows.server";
import { sendAdminNotification } from "../lib/email.server";
import { handleCorsOptions, withCors } from "../lib/cors.server";

// Fields that require admin approval (public-facing)
const GATED_FIELDS = new Set([
  "publicName",
  "shortBio",
  "longBio",
  "headshotUrl",
  "credentials",
  "institutions",
  "awards",
  "specialties",
  "primaryInstrument",
  "division",
  "country",
  "city",
  "teachingLanguages",
  "websiteUrl",
  "socialInstagram",
  "socialYoutube",
  "socialLinkedin",
  "socialTwitter",
  "socialOther",
  "introVideoUrl",
]);

// Fields teachers can edit freely (internal data)
const FREE_FIELDS = new Set([
  "phone",
  "timezone",
  "zoomLink",
  "acceptingStudents",
]);

export async function loader({ request }: LoaderFunctionArgs) {
  const preflight = handleCorsOptions(request);
  if (preflight) return preflight;

  const auth = await requireTeacherAuth(request);

  const faculty = await prisma.faculty.findUniqueOrThrow({
    where: { id: auth.facultyId },
    include: {
      application: true,
      availability: true,
      tech: true,
      offerings: {
        select: { id: true, title: true, status: true, offeringType: true },
      },
      profileEdits: {
        where: { status: "pending_approval" },
      },
    },
  });

  return withCors(request, json({ faculty }));
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "PUT") {
    return withCors(request, json({ error: "Method not allowed" }, { status: 405 }));
  }

  const auth = await requireTeacherAuth(request);
  const body = await request.json();

  const freeUpdates: Record<string, unknown> = {};
  const gatedChanges: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(body)) {
    if (FREE_FIELDS.has(key)) {
      freeUpdates[key] = value;
    } else if (GATED_FIELDS.has(key)) {
      gatedChanges[key] = value;
    }
    // Ignore unknown fields
  }

  // Apply free fields immediately
  if (Object.keys(freeUpdates).length > 0) {
    const faculty = await prisma.faculty.update({
      where: { id: auth.facultyId },
      data: freeUpdates,
    });

    // Recalculate completeness
    const completeness = calculateProfileCompleteness(faculty);
    await prisma.faculty.update({
      where: { id: auth.facultyId },
      data: { profileCompleteness: completeness },
    });
  }

  // Create pending edit for gated fields
  let pendingEdit = null;
  if (Object.keys(gatedChanges).length > 0) {
    pendingEdit = await prisma.profileEdit.create({
      data: {
        facultyId: auth.facultyId,
        status: "pending_approval",
        changes: gatedChanges,
      },
    });

    // Create approval record
    await prisma.approval.create({
      data: {
        objectType: "profile_update",
        objectId: pendingEdit.id,
        actionType: "profile_change",
        status: "pending",
        submittedBy: auth.facultyId,
      },
    });

    await logAudit({
      actorType: "teacher",
      actorId: auth.facultyId,
      action: "profile.edit_submitted",
      objectType: "faculty",
      objectId: auth.facultyId,
      details: { fields: Object.keys(gatedChanges) },
    });

    const faculty = await prisma.faculty.findUniqueOrThrow({
      where: { id: auth.facultyId },
    });

    await sendAdminNotification("profile_edit", {
      teacherName: faculty.publicName || faculty.fullName || "Teacher",
      teacherEmail: faculty.email,
    });
  }

  return withCors(request, json({
    success: true,
    freeFieldsUpdated: Object.keys(freeUpdates),
    pendingEdit: pendingEdit
      ? { id: pendingEdit.id, fields: Object.keys(gatedChanges) }
      : null,
  }));
}
