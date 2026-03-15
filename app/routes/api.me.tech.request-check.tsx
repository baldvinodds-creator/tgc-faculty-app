// POST /api/me/tech/request-check — request a tech check from admin

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

  return json({ success: true, message: "Tech check request sent to admin" });
}
