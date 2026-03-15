import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const offeringType = url.searchParams.get("type");
    const take = Math.min(parseInt(url.searchParams.get("take") || "50", 10), 100);
    const skip = parseInt(url.searchParams.get("skip") || "0", 10);

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (offeringType) {
      where.offeringType = offeringType;
    }

    const [offerings, total] = await Promise.all([
      prisma.offering.findMany({
        where,
        include: {
          faculty: {
            select: {
              id: true,
              fullName: true,
              publicName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      prisma.offering.count({ where }),
    ]);

    return json({ offerings, total, take, skip });
  } catch (error) {
    console.error("List offerings error:", error);
    return json({ error: "Failed to load offerings" }, { status: 500 });
  }
}
