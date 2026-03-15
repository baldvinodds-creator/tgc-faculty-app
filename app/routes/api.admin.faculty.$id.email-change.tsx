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
    const body = await request.json();
    const { newEmail } = body;

    if (!newEmail || typeof newEmail !== "string") {
      return json({ error: "New email is required" }, { status: 400 });
    }

    const trimmedEmail = newEmail.trim().toLowerCase();

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return json({ error: "Invalid email format" }, { status: 400 });
    }

    const faculty = await prisma.faculty.findUnique({ where: { id } });
    if (!faculty) {
      return json({ error: "Faculty not found" }, { status: 404 });
    }

    // Check for duplicate
    const existing = await prisma.faculty.findUnique({ where: { email: trimmedEmail } });
    if (existing && existing.id !== id) {
      return json({ error: "Email is already in use by another faculty member" }, { status: 409 });
    }

    const oldEmail = faculty.email;

    await prisma.faculty.update({
      where: { id },
      data: { email: trimmedEmail },
    });

    await logAudit({
      actorType: "admin",
      actorId: session.id,
      action: "faculty.email_changed",
      objectType: "faculty",
      objectId: id,
      details: { oldEmail, newEmail: trimmedEmail },
    });

    return json({ success: true, oldEmail, newEmail: trimmedEmail });
  } catch (error) {
    console.error("Email change error:", error);
    const message = error instanceof Error ? error.message : "Failed to change email";
    return json({ error: message }, { status: 500 });
  }
}
