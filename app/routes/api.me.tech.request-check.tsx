// POST /api/me/tech/request-check — request a tech check from admin

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

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return withCors(request, json({ error: "Method not allowed" }, { status: 405 }));
  }

  try {
    const auth = await requireTeacherAuth(request);

    const faculty = await prisma.faculty.findUniqueOrThrow({
      where: { id: auth.facultyId },
    });

    const teacherName = faculty.publicName || faculty.fullName || "Teacher";

    await sendAdminNotification("contact" as Parameters<typeof sendAdminNotification>[0], {
      teacherName,
      teacherEmail: faculty.email,
      subject: "Tech Check Request",
      message: `${teacherName} is requesting a tech check session.`,
    });

    await logAudit({
      actorType: "teacher",
      actorId: auth.facultyId,
      action: "tech.check_requested",
      objectType: "faculty",
      objectId: auth.facultyId,
    });

    return withCors(request, json({ success: true, message: "Tech check request sent to admin" }));
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error("Tech check request error:", error);
    return withCors(request, json({ error: "Failed to send tech check request" }, { status: 500 }));
  }
}
