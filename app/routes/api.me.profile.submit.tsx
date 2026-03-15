// POST /api/me/profile/submit — submit profile for initial review
// Used by approved teachers completing their profile before going active

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

  const faculty = await prisma.faculty.findUniqueOrThrow({
    where: { id: auth.facultyId },
    include: {
      profileEdits: {
        where: { status: "pending_approval" },
      },
    },
  });

  // Only approved (not yet active) teachers can use this endpoint
  if (faculty.status !== "approved") {
    return json(
      { error: "Only approved teachers can submit their profile for review" },
      { status: 400 },
    );
  }

  // Check minimum profile completeness
  if (faculty.profileCompleteness < 50) {
    return json(
      {
        error: "Profile must be at least 50% complete before submitting",
        profileCompleteness: faculty.profileCompleteness,
      },
      { status: 400 },
    );
  }

  // Check if there's already a pending profile submission
  const existingPending = await prisma.approval.findFirst({
    where: {
      objectId: auth.facultyId,
      objectType: "faculty",
      actionType: "profile_change",
      status: "pending",
    },
  });

  if (existingPending) {
    return json(
      { error: "A profile review is already pending" },
      { status: 400 },
    );
  }

  // Bundle all pending profile edits into one submission
  const pendingEdits = faculty.profileEdits;
  const allChanges: Record<string, unknown> = {};
  for (const edit of pendingEdits) {
    const changes = edit.changes as Record<string, unknown>;
    Object.assign(allChanges, changes);
  }

  // Create approval record for the full profile review
  await prisma.approval.create({
    data: {
      objectType: "faculty",
      objectId: auth.facultyId,
      actionType: "profile_change",
      status: "pending",
      submittedBy: auth.facultyId,
    },
  });

  await logAudit({
    actorType: "teacher",
    actorId: auth.facultyId,
    action: "profile.submitted_for_review",
    objectType: "faculty",
    objectId: auth.facultyId,
    details: {
      pendingEditCount: pendingEdits.length,
      changedFields: Object.keys(allChanges),
      profileCompleteness: faculty.profileCompleteness,
    },
  });

  const teacherName = faculty.publicName || faculty.fullName || "Teacher";

  await sendAdminNotification("profile_edit", {
    teacherName,
    teacherEmail: faculty.email,
  });

  return json({
    success: true,
    message: "Profile submitted for review",
    pendingEditCount: pendingEdits.length,
  });
}
