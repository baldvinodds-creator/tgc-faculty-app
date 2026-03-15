import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);

  try {
    const [
      pendingApplications,
      pendingOfferings,
      pendingOfferingEdits,
      pendingProfileUpdates,
      failedSyncs,
      totalActiveFaculty,
      totalLiveOfferings,
      suspendedCount,
    ] = await Promise.all([
      prisma.facultyApplication.count({ where: { status: "pending_review" } }),
      prisma.offering.count({ where: { status: "pending_approval" } }),
      prisma.offeringEdit.count({ where: { status: "pending_approval" } }),
      prisma.profileEdit.count({ where: { status: "pending_approval" } }),
      prisma.syncShopify.count({ where: { syncStatus: "failed" } }),
      prisma.faculty.count({ where: { status: "active" } }),
      prisma.offering.count({ where: { status: "live" } }),
      prisma.faculty.count({ where: { status: "suspended" } }),
    ]);

    return json({
      pendingApplications,
      pendingOfferings,
      pendingOfferingEdits,
      pendingProfileUpdates,
      failedSyncs,
      totalActiveFaculty,
      totalLiveOfferings,
      suspendedCount,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return json({ error: "Failed to load dashboard stats" }, { status: 500 });
  }
}
