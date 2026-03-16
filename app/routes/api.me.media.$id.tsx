// PUT    /api/me/media/:id — update a media record
// DELETE /api/me/media/:id — delete a media record

import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import prisma from "../db.server";
import { requireTeacherAuth } from "../lib/auth.server";
import { logAudit } from "../lib/audit.server";
import { handleCorsOptions, withCors } from "../lib/cors.server";

const VALID_MEDIA_TYPES = new Set([
  "photo",
  "video",
  "recording",
  "document",
  "promo_asset",
]);

const VALID_VISIBILITY = new Set(["private", "admin_only", "public"]);

export async function loader({ request }: LoaderFunctionArgs) {
  const preflight = handleCorsOptions(request);
  if (preflight) return preflight;
  return withCors(request, json({ error: "Method not allowed" }, { status: 405 }));
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const auth = await requireTeacherAuth(request);
    const mediaId = params.id!;

    // Verify ownership
    const media = await prisma.facultyMedia.findFirst({
      where: { id: mediaId, facultyId: auth.facultyId },
    });

    if (!media) {
      return withCors(request, json({ error: "Not found" }, { status: 404 }));
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

      return withCors(request, json({ success: true }));
    }

    // PUT
    if (request.method === "PUT") {
      const body = await request.json();

      // Validate mediaType if provided
      if (body.mediaType && !VALID_MEDIA_TYPES.has(body.mediaType)) {
        return withCors(request, json(
          { error: `Invalid mediaType. Must be one of: ${[...VALID_MEDIA_TYPES].join(", ")}` },
          { status: 400 },
        ));
      }

      // Validate visibility if provided
      if (body.visibility && !VALID_VISIBILITY.has(body.visibility)) {
        return withCors(request, json(
          { error: `Invalid visibility. Must be one of: ${[...VALID_VISIBILITY].join(", ")}` },
          { status: 400 },
        ));
      }

      // If teacher wants to change visibility to "public", gate it
      const requestedVisibility = body.visibility ?? media.visibility;
      const needsApproval = body.visibility === "public" && media.visibility !== "public";
      const effectiveVisibility = needsApproval ? "admin_only" : requestedVisibility;

      const updated = await prisma.facultyMedia.update({
        where: { id: mediaId },
        data: {
          mediaType: body.mediaType ?? media.mediaType,
          url: body.url ?? media.url,
          label: body.label !== undefined ? body.label : media.label,
          description: body.description !== undefined ? body.description : media.description,
          visibility: effectiveVisibility,
          sortOrder: body.sortOrder !== undefined ? body.sortOrder : media.sortOrder,
        },
      });

      // Create approval request if teacher wants public visibility
      if (needsApproval) {
        await prisma.approval.create({
          data: {
            objectType: "media",
            objectId: mediaId,
            actionType: "media_public",
            status: "pending",
            submittedBy: auth.facultyId,
          },
        });
      }

      await logAudit({
        actorType: "teacher",
        actorId: auth.facultyId,
        action: "media.updated",
        objectType: "media",
        objectId: mediaId,
        details: { fields: Object.keys(body), needsApproval },
      });

      return withCors(request, json({
        media: updated,
        pendingApproval: needsApproval,
        message: needsApproval ? "Public visibility pending admin approval" : undefined,
      }));
    }

    return withCors(request, json({ error: "Method not allowed" }, { status: 405 }));
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error("Media action error:", error);
    return withCors(request, json({ error: "Failed to process media request" }, { status: 500 }));
  }
}
