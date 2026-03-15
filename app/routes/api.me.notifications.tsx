// GET /api/me/notifications — admin comments and pending approval statuses

import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import prisma from "../db.server";
import { requireTeacherAuth } from "../lib/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const auth = await requireTeacherAuth(request);

  // Gather all object IDs belonging to this teacher
  const offerings = await prisma.offering.findMany({
    where: { facultyId: auth.facultyId },
    select: { id: true },
  });
  const offeringIds = offerings.map((o) => o.id);

  const profileEdits = await prisma.profileEdit.findMany({
    where: { facultyId: auth.facultyId },
    select: { id: true },
  });
  const profileEditIds = profileEdits.map((e) => e.id);

  const offeringEdits = await prisma.offeringEdit.findMany({
    where: { facultyId: auth.facultyId },
    select: { id: true },
  });
  const offeringEditIds = offeringEdits.map((e) => e.id);

  const allObjectIds = [
    auth.facultyId,
    ...offeringIds,
    ...profileEditIds,
    ...offeringEditIds,
  ];

  // Fetch admin comments visible to this teacher
  const comments = await prisma.adminComment.findMany({
    where: {
      objectId: { in: allObjectIds },
      visibleToTeacher: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Fetch pending approval statuses for this teacher's items
  const pendingApprovals = await prisma.approval.findMany({
    where: {
      objectId: { in: allObjectIds },
      status: "pending",
    },
    orderBy: { createdAt: "desc" },
  });

  return json({ comments, pendingApprovals });
}
