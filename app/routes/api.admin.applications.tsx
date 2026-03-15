import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");

    const where: Record<string, unknown> = {};
    if (status) {
      where.status = status;
    }

    const applications = await prisma.facultyApplication.findMany({
      where,
      include: {
        faculty: {
          select: {
            id: true,
            fullName: true,
            publicName: true,
            email: true,
            primaryInstrument: true,
            division: true,
            status: true,
          },
        },
      },
      orderBy: { submittedAt: "desc" },
    });

    return json({ applications });
  } catch (error) {
    console.error("List applications error:", error);
    return json({ error: "Failed to load applications" }, { status: 500 });
  }
}
