// Approval Workflow Engine — the 4 core workflows
// 1. Teacher application
// 2. New offering
// 3. Edit to live offering
// 4. Profile update

import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import prisma from "../db.server";
import { logAudit } from "./audit.server";
import {
  sendApplicationApprovedEmail,
  sendApplicationRejectedEmail,
  sendChangesRequestedEmail,
  sendOfferingApprovedEmail,
  sendProfileUpdateApprovedEmail,
  sendAdminNotification,
} from "./email.server";
import { provisionFaculty, provisionOffering, syncFacultyProfile } from "./provisioning.server";
import { UPDATE_PRODUCT, SET_METAFIELDS } from "./shopify-graphql.server";

// ═══════════════════════════════════════════════════════════════
// WORKFLOW 1: Teacher Application
// ═══════════════════════════════════════════════════════════════

export async function approveApplication(
  applicationId: string,
  reviewerId: string,
  admin: AdminApiContext,
) {
  const application = await prisma.facultyApplication.findUniqueOrThrow({
    where: { id: applicationId },
    include: { faculty: true },
  });

  // Update application
  await prisma.facultyApplication.update({
    where: { id: applicationId },
    data: { status: "approved", reviewedAt: new Date(), reviewerId },
  });

  // Update faculty status
  await prisma.faculty.update({
    where: { id: application.facultyId },
    data: { status: "approved" },
  });

  // Update approval record
  await prisma.approval.updateMany({
    where: {
      objectId: application.facultyId,
      objectType: "faculty",
      actionType: "new_application",
      status: "pending",
    },
    data: { status: "approved", reviewedBy: reviewerId, resolvedAt: new Date() },
  });

  await logAudit({
    actorType: "admin",
    actorId: reviewerId,
    action: "application.approved",
    objectType: "faculty",
    objectId: application.facultyId,
  });

  // Run provisioning chain
  const provisionResult = await provisionFaculty(application.facultyId, admin);

  // Send email
  await sendApplicationApprovedEmail(
    application.faculty.email,
    application.faculty.publicName || application.faculty.fullName || "Teacher",
  );

  return provisionResult;
}

export async function rejectApplication(
  applicationId: string,
  reviewerId: string,
  notes: string,
) {
  const application = await prisma.facultyApplication.findUniqueOrThrow({
    where: { id: applicationId },
    include: { faculty: true },
  });

  await prisma.facultyApplication.update({
    where: { id: applicationId },
    data: { status: "rejected", reviewedAt: new Date(), reviewerId, reviewNotes: notes },
  });

  await prisma.faculty.update({
    where: { id: application.facultyId },
    data: { status: "rejected" },
  });

  await prisma.approval.updateMany({
    where: {
      objectId: application.facultyId,
      objectType: "faculty",
      actionType: "new_application",
      status: "pending",
    },
    data: { status: "rejected", reviewedBy: reviewerId, reviewNotes: notes, resolvedAt: new Date() },
  });

  await logAudit({
    actorType: "admin",
    actorId: reviewerId,
    action: "application.rejected",
    objectType: "faculty",
    objectId: application.facultyId,
    details: { notes },
  });

  await sendApplicationRejectedEmail(
    application.faculty.email,
    application.faculty.publicName || application.faculty.fullName || "Teacher",
    notes,
  );
}

export async function requestApplicationChanges(
  applicationId: string,
  reviewerId: string,
  notes: string,
) {
  const application = await prisma.facultyApplication.findUniqueOrThrow({
    where: { id: applicationId },
    include: { faculty: true },
  });

  await prisma.facultyApplication.update({
    where: { id: applicationId },
    data: { status: "changes_requested", reviewedAt: new Date(), reviewerId, reviewNotes: notes },
  });

  await prisma.faculty.update({
    where: { id: application.facultyId },
    data: { status: "changes_requested" },
  });

  await prisma.approval.updateMany({
    where: {
      objectId: application.facultyId,
      objectType: "faculty",
      actionType: "new_application",
      status: "pending",
    },
    data: { status: "changes_requested", reviewedBy: reviewerId, reviewNotes: notes, resolvedAt: new Date() },
  });

  await logAudit({
    actorType: "admin",
    actorId: reviewerId,
    action: "application.changes_requested",
    objectType: "faculty",
    objectId: application.facultyId,
    details: { notes },
  });

  await sendChangesRequestedEmail(
    application.faculty.email,
    application.faculty.publicName || application.faculty.fullName || "Teacher",
    "application",
    notes,
  );
}

// ═══════════════════════════════════════════════════════════════
// WORKFLOW 2: New Offering Approval
// ═══════════════════════════════════════════════════════════════

export async function approveOffering(
  offeringId: string,
  reviewerId: string,
  admin: AdminApiContext,
  publishImmediately = true,
) {
  const offering = await prisma.offering.findUniqueOrThrow({
    where: { id: offeringId },
    include: { faculty: true },
  });

  await prisma.approval.updateMany({
    where: {
      objectId: offeringId,
      objectType: "offering",
      status: "pending",
    },
    data: { status: "approved", reviewedBy: reviewerId, resolvedAt: new Date() },
  });

  await logAudit({
    actorType: "admin",
    actorId: reviewerId,
    action: publishImmediately ? "offering.approved_and_published" : "offering.approved",
    objectType: "offering",
    objectId: offeringId,
  });

  // Run provisioning chain
  const provisionResult = await provisionOffering(offeringId, admin, publishImmediately);

  if (publishImmediately) {
    await sendOfferingApprovedEmail(
      offering.faculty.email,
      offering.faculty.publicName || offering.faculty.fullName || "Teacher",
      offering.title || offering.offeringType,
    );
  }

  return provisionResult;
}

export async function rejectOffering(
  offeringId: string,
  reviewerId: string,
  notes: string,
) {
  await prisma.offering.update({
    where: { id: offeringId },
    data: { status: "draft" },
  });

  await prisma.approval.updateMany({
    where: {
      objectId: offeringId,
      objectType: "offering",
      status: "pending",
    },
    data: { status: "rejected", reviewedBy: reviewerId, reviewNotes: notes, resolvedAt: new Date() },
  });

  const offering = await prisma.offering.findUniqueOrThrow({
    where: { id: offeringId },
    include: { faculty: true },
  });

  // Add admin comment so teacher can see the feedback
  await prisma.adminComment.create({
    data: {
      objectType: "offering",
      objectId: offeringId,
      authorId: reviewerId,
      comment: notes,
      visibleToTeacher: true,
    },
  });

  await logAudit({
    actorType: "admin",
    actorId: reviewerId,
    action: "offering.rejected",
    objectType: "offering",
    objectId: offeringId,
    details: { notes },
  });

  await sendChangesRequestedEmail(
    offering.faculty.email,
    offering.faculty.publicName || offering.faculty.fullName || "Teacher",
    "offering",
    notes,
  );
}

// ═══════════════════════════════════════════════════════════════
// WORKFLOW 3: Offering Edit Approval
// ═══════════════════════════════════════════════════════════════

export async function approveOfferingEdit(
  editId: string,
  reviewerId: string,
  admin: AdminApiContext,
) {
  const edit = await prisma.offeringEdit.findUniqueOrThrow({
    where: { id: editId },
    include: { offering: { include: { faculty: true } } },
  });

  // Apply changes to the offering
  const changes = edit.changes as Record<string, unknown>;
  await prisma.offering.update({
    where: { id: edit.offeringId },
    data: changes,
  });

  // Mark edit as approved
  await prisma.offeringEdit.update({
    where: { id: editId },
    data: { status: "approved", reviewedAt: new Date(), reviewerId },
  });

  await prisma.approval.updateMany({
    where: {
      objectId: editId,
      objectType: "offering_edit",
      status: "pending",
    },
    data: { status: "approved", reviewedBy: reviewerId, resolvedAt: new Date() },
  });

  // Sync approved changes to the Shopify product
  const syncRecord = await prisma.syncShopify.findFirst({
    where: { objectId: edit.offeringId, objectType: "offering_product" },
  });

  if (syncRecord?.shopifyObjectId) {
    try {
      const teacherName =
        edit.offering.faculty.publicName ||
        edit.offering.faculty.fullName ||
        "Teacher";

      // Build product update fields from the changes
      const productUpdate: Record<string, unknown> = {
        id: syncRecord.shopifyObjectId,
      };

      if (changes.title != null) {
        productUpdate.title = `${teacherName} — ${changes.title}`;
      }
      if (changes.description != null) {
        productUpdate.bodyHtml = changes.description as string;
      }

      // Apply product-level updates (title / description)
      if (productUpdate.title || productUpdate.bodyHtml) {
        const updateResult = await admin.graphql(UPDATE_PRODUCT, {
          variables: { product: productUpdate },
        });
        const updateData = await updateResult.json();
        const updateErrors =
          updateData.data?.productUpdate?.userErrors;
        if (updateErrors?.length > 0) {
          throw new Error(
            `ProductUpdate: ${updateErrors.map((e: { message: string }) => e.message).join(", ")}`,
          );
        }
      }

      // Update variant price if price changed
      if (changes.price != null) {
        // Fetch the first variant ID so we can update its price
        const variantQueryResult = await admin.graphql(
          `#graphql
          query GetProductVariants($id: ID!) {
            product(id: $id) {
              variants(first: 1) {
                edges { node { id } }
              }
            }
          }`,
          { variables: { id: syncRecord.shopifyObjectId } },
        );
        const variantData = await variantQueryResult.json();
        const firstVariant =
          variantData.data?.product?.variants?.edges?.[0]?.node;

        if (firstVariant) {
          const variantUpdateResult = await admin.graphql(
            `#graphql
            mutation UpdateVariantPrice($input: ProductVariantInput!) {
              productVariantUpdate(input: $input) {
                productVariant { id price }
                userErrors { field message }
              }
            }`,
            {
              variables: {
                input: {
                  id: firstVariant.id,
                  price: String(changes.price),
                },
              },
            },
          );
          const variantUpdateData = await variantUpdateResult.json();
          const variantErrors =
            variantUpdateData.data?.productVariantUpdate?.userErrors;
          if (variantErrors?.length > 0) {
            throw new Error(
              `VariantUpdate: ${variantErrors.map((e: { message: string }) => e.message).join(", ")}`,
            );
          }
        }
      }

      // Update metafields for any other changed fields
      const metafieldMap: Record<string, { key: string; type: string }> = {
        offeringType: { key: "offering_type", type: "single_line_text_field" },
        level: { key: "level", type: "single_line_text_field" },
        format: { key: "format", type: "single_line_text_field" },
        durationMinutes: { key: "duration_minutes", type: "number_integer" },
        capacity: { key: "capacity", type: "number_integer" },
      };

      const metafields: Array<{
        ownerId: string;
        namespace: string;
        key: string;
        type: string;
        value: string;
      }> = [];

      for (const [field, mapping] of Object.entries(metafieldMap)) {
        if (changes[field] != null) {
          metafields.push({
            ownerId: syncRecord.shopifyObjectId,
            namespace: "tgc_offering",
            key: mapping.key,
            type: mapping.type,
            value: String(changes[field]),
          });
        }
      }

      if (metafields.length > 0) {
        await admin.graphql(SET_METAFIELDS, {
          variables: { metafields },
        });
      }

      // Mark sync record as synced
      await prisma.syncShopify.update({
        where: { id: syncRecord.id },
        data: { syncStatus: "synced", lastSyncedAt: new Date(), lastError: null },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      await prisma.syncShopify.update({
        where: { id: syncRecord.id },
        data: {
          syncStatus: "failed",
          lastError: errorMessage,
          retryCount: { increment: 1 },
        },
      });
      // Don't fail the whole approval — the edit is applied, sync can be retried
    }
  } else if (syncRecord) {
    // Product exists in sync table but no Shopify ID yet — mark for later sync
    await prisma.syncShopify.update({
      where: { id: syncRecord.id },
      data: { syncStatus: "needs_update" },
    });
  }

  await logAudit({
    actorType: "admin",
    actorId: reviewerId,
    action: "offering_edit.approved",
    objectType: "offering",
    objectId: edit.offeringId,
    details: { editId, changes },
  });

  return { success: true };
}

export async function rejectOfferingEdit(
  editId: string,
  reviewerId: string,
  notes: string,
) {
  const edit = await prisma.offeringEdit.findUniqueOrThrow({
    where: { id: editId },
    include: { offering: { include: { faculty: true } } },
  });

  await prisma.offeringEdit.update({
    where: { id: editId },
    data: { status: "rejected", reviewedAt: new Date(), reviewerId, reviewNotes: notes },
  });

  await prisma.approval.updateMany({
    where: {
      objectId: editId,
      objectType: "offering_edit",
      status: "pending",
    },
    data: { status: "rejected", reviewedBy: reviewerId, reviewNotes: notes, resolvedAt: new Date() },
  });

  await logAudit({
    actorType: "admin",
    actorId: reviewerId,
    action: "offering_edit.rejected",
    objectType: "offering",
    objectId: edit.offeringId,
    details: { editId, notes },
  });
}

// ═══════════════════════════════════════════════════════════════
// WORKFLOW 4: Profile Update Approval
// ═══════════════════════════════════════════════════════════════

export async function approveProfileEdit(
  editId: string,
  reviewerId: string,
  admin: AdminApiContext,
) {
  const edit = await prisma.profileEdit.findUniqueOrThrow({
    where: { id: editId },
    include: { faculty: true },
  });

  // Apply changes to the faculty record
  const changes = edit.changes as Record<string, unknown>;
  await prisma.faculty.update({
    where: { id: edit.facultyId },
    data: changes,
  });

  // Mark edit as approved
  await prisma.profileEdit.update({
    where: { id: editId },
    data: { status: "approved", reviewedAt: new Date(), reviewerId },
  });

  await prisma.approval.updateMany({
    where: {
      objectId: editId,
      objectType: "profile_update",
      status: "pending",
    },
    data: { status: "approved", reviewedBy: reviewerId, resolvedAt: new Date() },
  });

  // Sync to Shopify metaobject
  await syncFacultyProfile(edit.facultyId, admin);

  await logAudit({
    actorType: "admin",
    actorId: reviewerId,
    action: "profile_edit.approved",
    objectType: "faculty",
    objectId: edit.facultyId,
    details: { editId, changes },
  });

  await sendProfileUpdateApprovedEmail(
    edit.faculty.email,
    edit.faculty.publicName || edit.faculty.fullName || "Teacher",
  );

  return { success: true };
}

export async function rejectProfileEdit(
  editId: string,
  reviewerId: string,
  notes: string,
) {
  const edit = await prisma.profileEdit.findUniqueOrThrow({
    where: { id: editId },
    include: { faculty: true },
  });

  await prisma.profileEdit.update({
    where: { id: editId },
    data: { status: "rejected", reviewedAt: new Date(), reviewerId, reviewNotes: notes },
  });

  await prisma.approval.updateMany({
    where: {
      objectId: editId,
      objectType: "profile_update",
      status: "pending",
    },
    data: { status: "rejected", reviewedBy: reviewerId, reviewNotes: notes, resolvedAt: new Date() },
  });

  await logAudit({
    actorType: "admin",
    actorId: reviewerId,
    action: "profile_edit.rejected",
    objectType: "faculty",
    objectId: edit.facultyId,
    details: { editId, notes },
  });
}

// ═══════════════════════════════════════════════════════════════
// Profile Completeness Calculator
// ═══════════════════════════════════════════════════════════════

export function calculateProfileCompleteness(faculty: {
  publicName?: string | null;
  shortBio?: string | null;
  longBio?: string | null;
  headshotUrl?: string | null;
  primaryInstrument?: string | null;
  division?: string | null;
  country?: string | null;
  city?: string | null;
  timezone?: string | null;
  credentials?: string | null;
  teachingLanguages?: string[];
  specialties?: string[];
  phone?: string | null;
}): number {
  const checks = [
    { field: "publicName", weight: 15 },
    { field: "shortBio", weight: 15 },
    { field: "longBio", weight: 10 },
    { field: "headshotUrl", weight: 15 },
    { field: "primaryInstrument", weight: 10 },
    { field: "division", weight: 5 },
    { field: "country", weight: 5 },
    { field: "timezone", weight: 5 },
    { field: "credentials", weight: 5 },
    { field: "phone", weight: 5 },
  ];

  const arrayChecks = [
    { field: "teachingLanguages", weight: 5 },
    { field: "specialties", weight: 5 },
  ];

  let score = 0;
  for (const check of checks) {
    const value = faculty[check.field as keyof typeof faculty];
    if (value != null && value !== "") {
      score += check.weight;
    }
  }

  for (const check of arrayChecks) {
    const value = faculty[check.field as keyof typeof faculty] as string[] | undefined;
    if (value && value.length > 0) {
      score += check.weight;
    }
  }

  return Math.min(score, 100);
}
