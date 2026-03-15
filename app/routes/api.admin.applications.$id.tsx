import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  await authenticate.admin(request);

  const { id } = params;
  if (!id) {
    return json({ error: "Application ID is required" }, { status: 400 });
  }

  try {
    const applicationBase = await prisma.facultyApplication.findUnique({
      where: { id },
      include: {
        faculty: {
          include: {
            offerings: { select: { id: true, title: true, offeringType: true, status: true } },
          },
        },
      },
    });

    if (!applicationBase) {
      return json({ error: "Application not found" }, { status: 404 });
    }

    const [adminComments, approvals] = await Promise.all([
      prisma.adminComment.findMany({
        where: { objectId: applicationBase.faculty.id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.approval.findMany({
        where: { objectType: "faculty", objectId: applicationBase.faculty.id },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const application = {
      ...applicationBase,
      faculty: { ...applicationBase.faculty, adminComments, approvals },
    };

    return json({ application });
  } catch (error) {
    console.error("Application detail error:", error);
    return json({ error: "Failed to load application" }, { status: 500 });
  }
}
