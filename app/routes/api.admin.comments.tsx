import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { logAudit } from "../lib/audit.server";

const VALID_OBJECT_TYPES = new Set(["faculty", "offering", "offering_edit", "profile_edit"]);

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const { session } = await authenticate.admin(request);

  try {
    const body = await request.json();
    const { objectType, objectId, comment, visibleToTeacher } = body;

    if (!objectType || !VALID_OBJECT_TYPES.has(objectType)) {
      return json({
        error: `objectType is required and must be one of: ${[...VALID_OBJECT_TYPES].join(", ")}`,
      }, { status: 400 });
    }

    if (!objectId || typeof objectId !== "string") {
      return json({ error: "objectId is required" }, { status: 400 });
    }

    if (!comment || typeof comment !== "string" || comment.trim().length === 0) {
      return json({ error: "Comment text is required" }, { status: 400 });
    }

    const adminComment = await prisma.adminComment.create({
      data: {
        objectType,
        objectId,
        authorId: session.id,
        comment: comment.trim(),
        visibleToTeacher: visibleToTeacher !== false, // default true
      },
    });

    await logAudit({
      actorType: "admin",
      actorId: session.id,
      action: "comment.created",
      objectType,
      objectId,
      details: { visibleToTeacher: adminComment.visibleToTeacher },
    });

    return json({ success: true, comment: adminComment }, { status: 201 });
  } catch (error) {
    console.error("Create comment error:", error);
    const message = error instanceof Error ? error.message : "Failed to create comment";
    return json({ error: message }, { status: 500 });
  }
}
