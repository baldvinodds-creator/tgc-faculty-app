// Single offering endpoints
// GET    /api/me/offerings/:id — get offering detail
// PUT    /api/me/offerings/:id — update offering (draft: direct, live: creates edit)
// DELETE /api/me/offerings/:id — delete draft offering

import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import prisma from "../db.server";
import { requireTeacherAuth } from "../lib/auth.server";
import { logAudit } from "../lib/audit.server";
import { sendAdminNotification } from "../lib/email.server";
import { handleCorsOptions, withCors } from "../lib/cors.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const preflight = handleCorsOptions(request);
  if (preflight) return preflight;

  const auth = await requireTeacherAuth(request);

  const offeringBase = await prisma.offering.findFirst({
    where: { id: params.id!, facultyId: auth.facultyId },
    include: {
      edits: { orderBy: { submittedAt: "desc" } },
    },
  });

  if (!offeringBase) {
    return withCors(request, json({ error: "Not found" }, { status: 404 }));
  }

  const adminComments = await prisma.adminComment.findMany({
    where: { objectType: "offering", objectId: offeringBase.id, visibleToTeacher: true },
    orderBy: { createdAt: "desc" },
  });

  const offering = { ...offeringBase, adminComments };

  return withCors(request, json({ offering }));
}

export async function action({ request, params }: ActionFunctionArgs) {
  const auth = await requireTeacherAuth(request);
  const offeringId = params.id!;

  const offering = await prisma.offering.findFirst({
    where: { id: offeringId, facultyId: auth.facultyId },
  });

  if (!offering) {
    return withCors(request, json({ error: "Not found" }, { status: 404 }));
  }

  // DELETE — only drafts
  if (request.method === "DELETE") {
    if (offering.status !== "draft") {
      return withCors(request, json({ error: "Can only delete draft offerings" }, { status: 400 }));
    }

    await prisma.offering.delete({ where: { id: offeringId } });

    await logAudit({
      actorType: "teacher",
      actorId: auth.facultyId,
      action: "offering.deleted",
      objectType: "offering",
      objectId: offeringId,
    });

    return withCors(request, json({ success: true }));
  }

  // PUT — update
  if (request.method === "PUT") {
    const body = await request.json();

    if (offering.status === "draft" || offering.status === "rejected") {
      // Direct edit on drafts
      await prisma.offering.update({
        where: { id: offeringId },
        data: {
          title: body.title ?? offering.title,
          description: body.description ?? offering.description,
          topic: body.topic ?? offering.topic,
          level: body.level ?? offering.level,
          ageGroups: body.ageGroups ?? offering.ageGroups,
          format: body.format ?? offering.format,
          durationMinutes: body.durationMinutes ?? offering.durationMinutes,
          price: body.price ?? offering.price,
          capacity: body.capacity ?? offering.capacity,
          prerequisites: body.prerequisites ?? offering.prerequisites,
          recordingAllowed: body.recordingAllowed ?? offering.recordingAllowed,
          replayAllowed: body.replayAllowed ?? offering.replayAllowed,
          materialsRequired: body.materialsRequired ?? offering.materialsRequired,
          oneTime: body.oneTime ?? offering.oneTime,
          recurringRule: body.recurringRule ?? offering.recurringRule,
          proposedSchedule: body.proposedSchedule ?? offering.proposedSchedule,
          seriesLength: body.seriesLength ?? offering.seriesLength,
          termName: body.termName ?? offering.termName,
          syllabus: body.syllabus ?? offering.syllabus,
          performerSeats: body.performerSeats ?? offering.performerSeats,
          observerSeats: body.observerSeats ?? offering.observerSeats,
          eventType: body.eventType ?? offering.eventType,
          durationsOffered: body.durationsOffered ?? offering.durationsOffered,
        },
      });

      return withCors(request, json({ success: true, mode: "direct" }));
    }

    if (offering.status === "live" || offering.status === "approved") {
      // Create pending edit for live offerings
      const changes: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(body)) {
        if (value !== undefined && value !== (offering as Record<string, unknown>)[key]) {
          changes[key] = value;
        }
      }

      if (Object.keys(changes).length === 0) {
        return withCors(request, json({ success: true, mode: "no_changes" }));
      }

      const edit = await prisma.offeringEdit.create({
        data: {
          offeringId,
          facultyId: auth.facultyId,
          status: "pending_approval",
          changes,
        },
      });

      await prisma.approval.create({
        data: {
          objectType: "offering_edit",
          objectId: edit.id,
          actionType: "edit_offering",
          status: "pending",
          submittedBy: auth.facultyId,
        },
      });

      await logAudit({
        actorType: "teacher",
        actorId: auth.facultyId,
        action: "offering_edit.submitted",
        objectType: "offering",
        objectId: offeringId,
        details: { editId: edit.id, fields: Object.keys(changes) },
      });

      const faculty = await prisma.faculty.findUniqueOrThrow({
        where: { id: auth.facultyId },
      });

      await sendAdminNotification("offering_edit", {
        teacherName: faculty.publicName || faculty.fullName || "Teacher",
        teacherEmail: faculty.email,
      });

      return withCors(request, json({ success: true, mode: "pending_edit", editId: edit.id }));
    }

    return withCors(request, json({ error: "Cannot edit offering in current status" }, { status: 400 }));
  }

  return withCors(request, json({ error: "Method not allowed" }, { status: 405 }));
}
