// GET /api/me/comments — all admin comments visible to this teacher

import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import prisma from "../db.server";
import { requireTeacherAuth } from "../lib/auth.server";
import { handleCorsOptions, withCors } from "../lib/cors.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const preflight = handleCorsOptions(request);
  if (preflight) return preflight;

  try {
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

    const comments = await prisma.adminComment.findMany({
      where: {
        objectId: { in: allObjectIds },
        visibleToTeacher: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return withCors(request, json({ comments }));
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error("Load comments error:", error);
    return withCors(request, json({ error: "Failed to load comments" }, { status: 500 }));
  }
}
