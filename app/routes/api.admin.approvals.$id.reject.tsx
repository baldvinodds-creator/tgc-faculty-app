import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  rejectApplication,
  rejectOffering,
  rejectOfferingEdit,
  rejectProfileEdit,
} from "../lib/workflows.server";

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const { session } = await authenticate.admin(request);

  const { id } = params;
  if (!id) {
    return json({ error: "Approval ID is required" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { notes } = body;

    if (!notes || typeof notes !== "string" || notes.trim().length === 0) {
      return json({ error: "Rejection notes are required" }, { status: 400 });
    }

    const approval = await prisma.approval.findUnique({ where: { id } });
    if (!approval) {
      return json({ error: "Approval not found" }, { status: 404 });
    }

    if (approval.status !== "pending") {
      return json({ error: "Approval has already been resolved" }, { status: 400 });
    }

    const reviewerId = session.id;
    const trimmedNotes = notes.trim();

    switch (approval.objectType) {
      case "faculty": {
        const application = await prisma.facultyApplication.findUnique({
          where: { facultyId: approval.objectId },
        });
        if (!application) {
          return json({ error: "Application not found for this faculty" }, { status: 404 });
        }
        await rejectApplication(application.id, reviewerId, trimmedNotes);
        break;
      }
      case "offering": {
        await rejectOffering(approval.objectId, reviewerId, trimmedNotes);
        break;
      }
      case "offering_edit": {
        await rejectOfferingEdit(approval.objectId, reviewerId, trimmedNotes);
        break;
      }
      case "profile_update": {
        await rejectProfileEdit(approval.objectId, reviewerId, trimmedNotes);
        break;
      }
      default:
        return json({ error: `Unknown approval object type: ${approval.objectType}` }, { status: 400 });
    }

    return json({ success: true });
  } catch (error) {
    console.error("Reject via approval error:", error);
    const message = error instanceof Error ? error.message : "Failed to reject";
    return json({ error: message }, { status: 500 });
  }
}
