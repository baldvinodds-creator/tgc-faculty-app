import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { logAudit } from "../lib/audit.server";
import { provisionFaculty, provisionOffering } from "../lib/provisioning.server";

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const { admin, session } = await authenticate.admin(request);

  const { id } = params;
  if (!id) {
    return json({ error: "Sync record ID is required" }, { status: 400 });
  }

  try {
    const syncRecord = await prisma.syncShopify.findUnique({ where: { id } });
    if (!syncRecord) {
      return json({ error: "Sync record not found" }, { status: 404 });
    }

    // Reset sync record for retry
    await prisma.syncShopify.update({
      where: { id },
      data: {
        syncStatus: "pending",
        lastError: null,
        syncSteps: undefined,
      },
    });

    await logAudit({
      actorType: "admin",
      actorId: session.id,
      action: "sync.retry",
      objectType: syncRecord.objectType,
      objectId: syncRecord.objectId,
      details: { syncRecordId: id, previousRetryCount: syncRecord.retryCount },
    });

    // Re-run the provisioning chain based on object type
    let result: unknown;

    switch (syncRecord.objectType) {
      case "faculty_metaobject":
      case "faculty_collection": {
        result = await provisionFaculty(syncRecord.objectId, admin);
        break;
      }
      case "offering_product": {
        // Determine if it should publish based on the offering's current status
        const offering = await prisma.offering.findUnique({
          where: { id: syncRecord.objectId },
        });
        const publishImmediately = offering?.status === "live";
        result = await provisionOffering(syncRecord.objectId, admin, publishImmediately);
        break;
      }
      default:
        return json({ error: `Unknown sync object type: ${syncRecord.objectType}` }, { status: 400 });
    }

    return json({ success: true, result });
  } catch (error) {
    console.error("Sync retry error:", error);
    const message = error instanceof Error ? error.message : "Failed to retry sync";
    return json({ error: message }, { status: 500 });
  }
}
