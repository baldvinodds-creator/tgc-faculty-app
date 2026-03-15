import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  approveApplication,
  approveOffering,
  approveOfferingEdit,
  approveProfileEdit,
} from "../lib/workflows.server";

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const { admin, session } = await authenticate.admin(request);

  const { id } = params;
  if (!id) {
    return json({ error: "Approval ID is required" }, { status: 400 });
  }

  try {
    const approval = await prisma.approval.findUnique({ where: { id } });
    if (!approval) {
      return json({ error: "Approval not found" }, { status: 404 });
    }

    if (approval.status !== "pending") {
      return json({ error: "Approval has already been resolved" }, { status: 400 });
    }

    const reviewerId = session.id;
    let result: unknown;

    switch (approval.objectType) {
      case "faculty": {
        // Find the application for this faculty
        const application = await prisma.facultyApplication.findUnique({
          where: { facultyId: approval.objectId },
        });
        if (!application) {
          return json({ error: "Application not found for this faculty" }, { status: 404 });
        }
        result = await approveApplication(application.id, reviewerId, admin);
        break;
      }
      case "offering": {
        result = await approveOffering(approval.objectId, reviewerId, admin);
        break;
      }
      case "offering_edit": {
        result = await approveOfferingEdit(approval.objectId, reviewerId, admin);
        break;
      }
      case "profile_update": {
        result = await approveProfileEdit(approval.objectId, reviewerId, admin);
        break;
      }
      default:
        return json({ error: `Unknown approval object type: ${approval.objectType}` }, { status: 400 });
    }

    return json({ success: true, result });
  } catch (error) {
    console.error("Approve via approval error:", error);
    const message = error instanceof Error ? error.message : "Failed to approve";
    return json({ error: message }, { status: 500 });
  }
}
