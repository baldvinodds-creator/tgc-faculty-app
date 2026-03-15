// POST /api/me/headshot — upload headshot (V1: accept URL string)

import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import prisma from "../db.server";
import { requireTeacherAuth } from "../lib/auth.server";
import { logAudit } from "../lib/audit.server";
import { sendAdminNotification } from "../lib/email.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const auth = await requireTeacherAuth(request);
  const body = await request.json();

  if (!body.url || typeof body.url !== "string") {
    return json({ error: "url is required and must be a string" }, { status: 400 });
  }

  // Validate URL format
  try {
    new URL(body.url);
  } catch {
    return json({ error: "Invalid URL format" }, { status: 400 });
  }

  // headshotUrl is a gated (public) field, so create a pending edit
  const pendingEdit = await prisma.profileEdit.create({
    data: {
      facultyId: auth.facultyId,
      status: "pending_approval",
      changes: { headshotUrl: body.url },
    },
  });

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
    action: "headshot.submitted",
    objectType: "faculty",
    objectId: auth.facultyId,
    details: { editId: pendingEdit.id },
  });

  const faculty = await prisma.faculty.findUniqueOrThrow({
    where: { id: auth.facultyId },
  });

  await sendAdminNotification("profile_edit", {
    teacherName: faculty.publicName || faculty.fullName || "Teacher",
    teacherEmail: faculty.email,
  });

  return json({
    success: true,
    pendingEdit: { id: pendingEdit.id },
    message: "Headshot submitted for approval",
  });
}
