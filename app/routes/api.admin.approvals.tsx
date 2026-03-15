import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);

  try {
    const url = new URL(request.url);
    const type = url.searchParams.get("type"); // faculty | offering | offering_edit | profile_update
    const status = url.searchParams.get("status") || "pending";

    const where: Record<string, unknown> = { status };

    if (type) {
      where.objectType = type;
    }

    const approvals = await prisma.approval.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    // Enrich with related object data
    const enriched = await Promise.all(
      approvals.map(async (approval) => {
        let relatedData: Record<string, unknown> = {};

        try {
          switch (approval.objectType) {
            case "faculty": {
              const faculty = await prisma.faculty.findUnique({
                where: { id: approval.objectId },
                select: {
                  id: true,
                  fullName: true,
                  publicName: true,
                  email: true,
                  primaryInstrument: true,
                  division: true,
                  status: true,
                },
              });
              relatedData = { faculty };
              break;
            }
            case "offering": {
              const offering = await prisma.offering.findUnique({
                where: { id: approval.objectId },
                select: {
                  id: true,
                  title: true,
                  offeringType: true,
                  status: true,
                  price: true,
                  faculty: {
                    select: { id: true, fullName: true, publicName: true, email: true },
                  },
                },
              });
              relatedData = { offering };
              break;
            }
            case "offering_edit": {
              const edit = await prisma.offeringEdit.findUnique({
                where: { id: approval.objectId },
                include: {
                  offering: {
                    select: {
                      id: true,
                      title: true,
                      offeringType: true,
                      faculty: {
                        select: { id: true, fullName: true, publicName: true, email: true },
                      },
                    },
                  },
                },
              });
              relatedData = { offeringEdit: edit };
              break;
            }
            case "profile_update": {
              const profileEdit = await prisma.profileEdit.findUnique({
                where: { id: approval.objectId },
                include: {
                  faculty: {
                    select: { id: true, fullName: true, publicName: true, email: true },
                  },
                },
              });
              relatedData = { profileEdit };
              break;
            }
          }
        } catch {
          // Related object may have been deleted
          relatedData = { _error: "Related object not found" };
        }

        return { ...approval, ...relatedData };
      }),
    );

    return json({ approvals: enriched });
  } catch (error) {
    console.error("List approvals error:", error);
    return json({ error: "Failed to load approvals" }, { status: 500 });
  }
}
