// POST /api/me/offerings/:id/submit — submit draft offering for approval

import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import prisma from "../db.server";
import { requireTeacherAuth } from "../lib/auth.server";
import { logAudit } from "../lib/audit.server";
import { sendAdminNotification } from "../lib/email.server";
import { handleCorsOptions, withCors } from "../lib/cors.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const preflight = handleCorsOptions(request);
  if (preflight) return preflight;
  return withCors(request, json({ error: "Method not allowed" }, { status: 405 }));
}

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return withCors(request, json({ error: "Method not allowed" }, { status: 405 }));
  }

  const auth = await requireTeacherAuth(request);
  const offeringId = params.id!;

  const offering = await prisma.offering.findFirst({
    where: { id: offeringId, facultyId: auth.facultyId },
  });

  if (!offering) {
    return withCors(request, json({ error: "Not found" }, { status: 404 }));
  }

  if (offering.status !== "draft" && offering.status !== "rejected") {
    return withCors(request, json({ error: "Only draft or rejected offerings can be submitted" }, { status: 400 }));
  }

  // Validate required fields (price can be 0 for free offerings)
  if (!offering.title) {
    return withCors(request, json({ error: "Title is required before submitting" }, { status: 400 }));
  }
  if (offering.price == null) {
    return withCors(request, json({ error: "Price is required before submitting" }, { status: 400 }));
  }

  await prisma.offering.update({
    where: { id: offeringId },
    data: {
      status: "pending_approval",
      submittedAt: new Date(),
    },
  });

  await prisma.approval.create({
    data: {
      objectType: "offering",
      objectId: offeringId,
      actionType: "new_offering",
      status: "pending",
      submittedBy: auth.facultyId,
    },
  });

  await logAudit({
    actorType: "teacher",
    actorId: auth.facultyId,
    action: "offering.submitted",
    objectType: "offering",
    objectId: offeringId,
  });

  const faculty = await prisma.faculty.findUniqueOrThrow({
    where: { id: auth.facultyId },
  });

  await sendAdminNotification("offering", {
    teacherName: faculty.publicName || faculty.fullName || "Teacher",
    teacherEmail: faculty.email,
  });

  return withCors(request, json({ success: true }));
}
