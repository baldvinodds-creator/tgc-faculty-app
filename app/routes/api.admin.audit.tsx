import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);

  try {
    const url = new URL(request.url);
    const actorType = url.searchParams.get("actorType");
    const action = url.searchParams.get("action");
    const objectType = url.searchParams.get("objectType");
    const dateFrom = url.searchParams.get("dateFrom");
    const dateTo = url.searchParams.get("dateTo");
    const take = Math.min(parseInt(url.searchParams.get("take") || "50", 10), 200);
    const skip = parseInt(url.searchParams.get("skip") || "0", 10);

    const where: Record<string, unknown> = {};

    if (actorType) {
      where.actorType = actorType;
    }

    if (action) {
      where.action = { contains: action };
    }

    if (objectType) {
      where.objectType = objectType;
    }

    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date> = {};
      if (dateFrom) {
        createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        createdAt.lte = new Date(dateTo);
      }
      where.createdAt = createdAt;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return json({ logs, total, take, skip });
  } catch (error) {
    console.error("Audit log error:", error);
    return json({ error: "Failed to load audit logs" }, { status: 500 });
  }
}
