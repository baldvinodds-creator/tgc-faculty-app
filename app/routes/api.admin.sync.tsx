import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const source = url.searchParams.get("source"); // shopify | appointo

    const shopifyWhere: Record<string, unknown> = {};
    const appointoWhere: Record<string, unknown> = {};

    if (status) {
      shopifyWhere.syncStatus = status;
      appointoWhere.syncStatus = status;
    }

    const results: Record<string, unknown> = {};

    if (!source || source === "shopify") {
      results.shopify = await prisma.syncShopify.findMany({
        where: shopifyWhere,
        orderBy: { updatedAt: "desc" },
      });
    }

    if (!source || source === "appointo") {
      results.appointo = await prisma.syncAppointo.findMany({
        where: appointoWhere,
        orderBy: { createdAt: "desc" },
      });
    }

    return json(results);
  } catch (error) {
    console.error("List sync records error:", error);
    return json({ error: "Failed to load sync records" }, { status: 500 });
  }
}
