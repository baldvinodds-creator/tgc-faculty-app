// POST /api/internal/setup
// Creates the tgc_faculty metaobject definition if it doesn't exist
// Also runs a health check on the Shopify connection
// Idempotent — safe to call multiple times

import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { ensureMetaobjectDefinition } from "../lib/setup.server";
import { logAudit } from "../lib/audit.server";
import { GET_PUBLICATIONS } from "../lib/shopify-graphql.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const { admin } = await authenticate.admin(request);

  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
  };

  // Step 1: Ensure metaobject definition
  try {
    const metaobjectResult = await ensureMetaobjectDefinition(admin);
    results.metaobjectDefinition = metaobjectResult;
  } catch (error) {
    results.metaobjectDefinition = {
      exists: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  // Step 2: Health check — verify we can query the store
  try {
    const pubResult = await admin.graphql(GET_PUBLICATIONS);
    const pubData = await pubResult.json();
    const publications = (pubData.data?.publications?.edges || []).map(
      (e: { node: { id: string; name: string } }) => ({
        id: e.node.id,
        name: e.node.name,
      }),
    );
    results.shopifyConnection = {
      healthy: true,
      publications,
    };
  } catch (error) {
    results.shopifyConnection = {
      healthy: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  // Step 3: Check database connectivity
  try {
    const { default: prisma } = await import("../db.server");
    const facultyCount = await prisma.faculty.count();
    const offeringCount = await prisma.offering.count();
    const syncCount = await prisma.syncShopify.count();

    results.database = {
      healthy: true,
      counts: {
        faculty: facultyCount,
        offerings: offeringCount,
        syncRecords: syncCount,
      },
    };
  } catch (error) {
    results.database = {
      healthy: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  await logAudit({
    actorType: "system",
    action: "setup.health_check",
    details: results,
  });

  return json(results);
}
