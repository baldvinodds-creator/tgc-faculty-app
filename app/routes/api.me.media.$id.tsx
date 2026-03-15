// PUT    /api/me/media/:id — update a media record
// DELETE /api/me/media/:id — delete a media record

import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import prisma from "../db.server";
import { requireTeacherAuth } from "../lib/auth.server";
import { logAudit } from "../lib/audit.server";

const VALID_MEDIA_TYPES = new Set([
  "photo",
  "video",
  "recording",
  "document",
  "promo_asset",
]);

const VALID_VISIBILITY = new Set(["private", "admin_only", "public"]);

export async function action({ request, params }: ActionFunctionArgs) {
  const auth = await requireTeacherAuth(request);
  const mediaId = params.id!;

  // Verify ownership
  const media = await prisma.facultyMedia.findFirst({
    where: { id: mediaId, facultyId: auth.facultyId },
  });

  if (!media) {
    return json({ error: "Not found" }, { status: 404 });
  }

  // DELETE
  if (request.method === "DELETE") {
    await prisma.facultyMedia.delete({ where: { id: mediaId } });

    await logAudit({
      actorType: "teacher",
      actorId: auth.facultyId,
      action: "media.deleted",
      objectType: "media",
      objectId: mediaId,
    });

    return json({ success: true });
  }

  // PUT
  if (request.method === "PUT") {
    const body = await request.json();

    // Validate mediaType if provided
    if (body.mediaType && !VALID_MEDIA_TYPES.has(body.mediaType)) {
      return json(
        { error: `Invalid mediaType. Must be one of: ${[...VALID_MEDIA_TYPES].join(", ")}` },
        { status: 400 },
      );
    }

    // Validate visibility if provided
    if (body.visibility && !VALID_VISIBILITY.has(body.visibility)) {
      return json(
        { error: `Invalid visibility. Must be one of: ${[...VALID_VISIBILITY].join(", ")}` },
        { status: 400 },
      );
    }

    const updated = await prisma.facultyMedia.update({
      where: { id: mediaId },
      data: {
        mediaType: body.mediaType ?? media.mediaType,
        url: body.url ?? media.url,
        label: body.label !== undefined ? body.label : media.label,
        description: body.description !== undefined ? body.description : media.description,
        visibility: body.visibility ?? media.visibility,
        sortOrder: body.sortOrder !== undefined ? body.sortOrder : media.sortOrder,
      },
    });

    await logAudit({
      actorType: "teacher",
      actorId: auth.facultyId,
      action: "media.updated",
      objectType: "media",
      objectId: mediaId,
      details: { fields: Object.keys(body) },
    });

    return json({ media: updated });
  }

  return json({ error: "Method not allowed" }, { status: 405 });
}
