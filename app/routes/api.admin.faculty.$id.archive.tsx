import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { logAudit } from "../lib/audit.server";

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const { session } = await authenticate.admin(request);

  const { id } = params;
  if (!id) {
    return json({ error: "Faculty ID is required" }, { status: 400 });
  }

  try {
    const faculty = await prisma.faculty.findUnique({ where: { id } });
    if (!faculty) {
      return json({ error: "Faculty not found" }, { status: 404 });
    }

    await prisma.faculty.update({
      where: { id },
      data: { status: "archived", profilePublished: false },
    });

    await logAudit({
      actorType: "admin",
      actorId: session.id,
      action: "faculty.archived",
      objectType: "faculty",
      objectId: id,
    });

    return json({ success: true });
  } catch (error) {
    console.error("Archive faculty error:", error);
    const message = error instanceof Error ? error.message : "Failed to archive faculty";
    return json({ error: message }, { status: 500 });
  }
}
