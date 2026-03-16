// GET  /api/me/media — list all media for this teacher
// POST /api/me/media — create new media record

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

  const auth = await requireTeacherAuth(request);

  const media = await prisma.facultyMedia.findMany({
    where: { facultyId: auth.facultyId },
    orderBy: { sortOrder: "asc" },
  });

  return withCors(request, json({ media }));
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return withCors(request, json({ error: "Method not allowed" }, { status: 405 }));
  }

  const auth = await requireTeacherAuth(request);
  const body = await request.json();

  // Validate required fields
  if (!body.url) {
    return withCors(request, json({ error: "url is required" }, { status: 400 }));
  }

  const mediaType = body.mediaType || "photo";
  if (!VALID_MEDIA_TYPES.has(mediaType)) {
    return withCors(request, json(
      { error: `Invalid mediaType. Must be one of: ${[...VALID_MEDIA_TYPES].join(", ")}` },
      { status: 400 },
    ));
  }

  const visibility = body.visibility || "private";
  if (!VALID_VISIBILITY.has(visibility)) {
    return withCors(request, json(
      { error: `Invalid visibility. Must be one of: ${[...VALID_VISIBILITY].join(", ")}` },
      { status: 400 },
    ));
  }

  const media = await prisma.facultyMedia.create({
    data: {
      facultyId: auth.facultyId,
      mediaType,
      url: body.url,
      label: body.label || null,
      description: body.description || null,
      visibility,
      sortOrder: body.sortOrder ?? null,
    },
  });

  await logAudit({
    actorType: "teacher",
    actorId: auth.facultyId,
    action: "media.created",
    objectType: "media",
    objectId: media.id,
    details: { mediaType, visibility },
  });

  return withCors(request, json({ media }, { status: 201 }));
}
