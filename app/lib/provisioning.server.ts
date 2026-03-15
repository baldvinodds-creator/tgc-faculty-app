// Provisioning Chains — triggered when admin approves faculty or offerings
// Each chain is a series of steps tracked in sync_shopify.sync_steps

import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import prisma from "../db.server";
import { logAudit } from "./audit.server";
import {
  UPSERT_FACULTY_METAOBJECT,
  CREATE_COLLECTION,
  SET_METAFIELDS,
  CREATE_PRODUCT,
  ADD_PRODUCTS_TO_COLLECTION,
  buildFacultyMetaobjectFields,
  buildOfferingProductInput,
  GET_PUBLICATIONS,
} from "./shopify-graphql.server";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ═══════════════════════════════════════════════════════════════
// CHAIN 1: Faculty Approval Provisioning
// Triggered when admin approves a faculty application
// ═══════════════════════════════════════════════════════════════

export async function provisionFaculty(
  facultyId: string,
  admin: AdminApiContext,
) {
  const faculty = await prisma.faculty.findUniqueOrThrow({
    where: { id: facultyId },
  });

  const slug = slugify(faculty.publicName || faculty.fullName || faculty.email);
  const steps: Record<string, boolean> = {};

  // Create or find sync record
  let syncRecord = await prisma.syncShopify.findFirst({
    where: { objectId: facultyId, objectType: "faculty_metaobject" },
  });

  if (!syncRecord) {
    syncRecord = await prisma.syncShopify.create({
      data: {
        objectType: "faculty_metaobject",
        objectId: facultyId,
        shopifyObjectType: "metaobject",
        syncStatus: "pending",
      },
    });
  }

  try {
    // Step 1: Create Shopify metaobject
    const metaobjectFields = buildFacultyMetaobjectFields({
      ...faculty,
      collectionHandle: slug,
    });

    const metaobjectResult = await admin.graphql(UPSERT_FACULTY_METAOBJECT, {
      variables: {
        handle: {
          type: "$app:tgc_faculty",
          handle: slug,
        },
        metaobject: {
          fields: metaobjectFields,
        },
      },
    });

    const metaobjectData = await metaobjectResult.json();
    const metaobject = metaobjectData.data?.metaobjectUpsert?.metaobject;
    const metaobjectErrors = metaobjectData.data?.metaobjectUpsert?.userErrors;

    if (metaobjectErrors?.length > 0) {
      throw new Error(`Metaobject: ${metaobjectErrors.map((e: { message: string }) => e.message).join(", ")}`);
    }

    steps.metaobject_created = true;

    await prisma.syncShopify.update({
      where: { id: syncRecord.id },
      data: {
        shopifyObjectId: metaobject.id,
        shopifyHandle: metaobject.handle,
        syncSteps: steps,
      },
    });

    await logAudit({
      actorType: "system",
      action: "shopify.metaobject_created",
      objectType: "faculty",
      objectId: facultyId,
      details: { shopifyId: metaobject.id, handle: metaobject.handle },
    });

    // Step 2: Create Shopify collection
    const collectionResult = await admin.graphql(CREATE_COLLECTION, {
      variables: {
        input: {
          title: faculty.publicName || faculty.fullName || faculty.email,
          descriptionHtml: faculty.shortBio || "",
          templateSuffix: "faculty",
        },
      },
    });

    const collectionData = await collectionResult.json();
    const collection = collectionData.data?.collectionCreate?.collection;
    const collectionErrors = collectionData.data?.collectionCreate?.userErrors;

    if (collectionErrors?.length > 0) {
      throw new Error(`Collection: ${collectionErrors.map((e: { message: string }) => e.message).join(", ")}`);
    }

    steps.collection_created = true;

    // Create collection sync record
    await prisma.syncShopify.create({
      data: {
        objectType: "faculty_collection",
        objectId: facultyId,
        shopifyObjectType: "collection",
        shopifyObjectId: collection.id,
        shopifyHandle: collection.handle,
        syncStatus: "synced",
        lastSyncedAt: new Date(),
      },
    });

    await logAudit({
      actorType: "system",
      action: "shopify.collection_created",
      objectType: "faculty",
      objectId: facultyId,
      details: { shopifyId: collection.id, handle: collection.handle },
    });

    // Step 3: Write collection metafields
    await admin.graphql(SET_METAFIELDS, {
      variables: {
        metafields: [
          {
            ownerId: collection.id,
            namespace: "tgc_faculty",
            key: "faculty_id",
            type: "single_line_text_field",
            value: facultyId,
          },
          {
            ownerId: collection.id,
            namespace: "tgc_faculty",
            key: "faculty_metaobject_handle",
            type: "single_line_text_field",
            value: metaobject.handle,
          },
          {
            ownerId: collection.id,
            namespace: "tgc_faculty",
            key: "division",
            type: "single_line_text_field",
            value: faculty.division || "",
          },
          {
            ownerId: collection.id,
            namespace: "tgc_faculty",
            key: "primary_instrument",
            type: "single_line_text_field",
            value: faculty.primaryInstrument || "",
          },
          {
            ownerId: collection.id,
            namespace: "tgc_faculty",
            key: "accepting_students",
            type: "boolean",
            value: faculty.acceptingStudents ? "true" : "false",
          },
        ],
      },
    });

    steps.collection_metafields_written = true;

    // Step 4: Update metaobject with collection handle
    // Already done via the upsert fields above

    steps.metaobject_linked = true;

    // Step 5: Flag Appointo setup needed
    await prisma.syncAppointo.create({
      data: {
        objectType: "faculty_team_member",
        objectId: facultyId,
        syncStatus: "pending",
        configurationNotes: "Needs manual Appointo team member setup",
      },
    });

    steps.appointo_flagged = true;

    // Update final sync status
    await prisma.syncShopify.update({
      where: { id: syncRecord.id },
      data: {
        syncStatus: "synced",
        lastSyncedAt: new Date(),
        syncSteps: steps,
        lastError: null,
      },
    });

    return { success: true, steps };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await prisma.syncShopify.update({
      where: { id: syncRecord.id },
      data: {
        syncStatus: "failed",
        lastError: errorMessage,
        syncSteps: steps,
        retryCount: { increment: 1 },
      },
    });

    await logAudit({
      actorType: "system",
      action: "shopify.provisioning_failed",
      objectType: "faculty",
      objectId: facultyId,
      details: { error: errorMessage, stepsCompleted: steps },
    });

    return { success: false, error: errorMessage, steps };
  }
}

// ═══════════════════════════════════════════════════════════════
// CHAIN 2: Offering Approval Provisioning
// Triggered when admin approves an offering
// ═══════════════════════════════════════════════════════════════

export async function provisionOffering(
  offeringId: string,
  admin: AdminApiContext,
  publishImmediately = true,
) {
  const offering = await prisma.offering.findUniqueOrThrow({
    where: { id: offeringId },
    include: { faculty: true },
  });

  const faculty = offering.faculty;

  // Find the faculty's collection
  const collectionSync = await prisma.syncShopify.findFirst({
    where: { objectId: faculty.id, objectType: "faculty_collection" },
  });

  const facultyHandle = slugify(faculty.publicName || faculty.fullName || faculty.email);
  const steps: Record<string, boolean> = {};

  // Create sync record
  let syncRecord = await prisma.syncShopify.findFirst({
    where: { objectId: offeringId, objectType: "offering_product" },
  });

  if (!syncRecord) {
    syncRecord = await prisma.syncShopify.create({
      data: {
        objectType: "offering_product",
        objectId: offeringId,
        shopifyObjectType: "product",
        syncStatus: "pending",
      },
    });
  }

  try {
    // Step 1: Create Shopify product
    const productInput = buildOfferingProductInput(offering, faculty, facultyHandle);

    // Build variants from durations_offered if present
    let variants: Array<{ title: string; price: string }> = [];
    if (offering.durationsOffered && Array.isArray(offering.durationsOffered)) {
      variants = (offering.durationsOffered as Array<{ minutes: number; price: number }>).map((d) => ({
        title: `${d.minutes}-minute session`,
        price: String(d.price),
      }));
    } else if (offering.offeringType === "masterclass" && offering.performerSeats) {
      variants = [
        { title: "Performer", price: String(offering.price) },
        ...(offering.observerSeats
          ? [{ title: "Observer", price: String(Number(offering.price) * 0.5) }]
          : []),
      ];
    }

    if (variants.length === 0) {
      variants = [{ title: "Default", price: String(offering.price) }];
    }

    const productResult = await admin.graphql(CREATE_PRODUCT, {
      variables: {
        product: {
          ...productInput,
          status: publishImmediately ? "ACTIVE" : "DRAFT",
          variants: variants.map((v) => ({
            title: v.title,
            price: v.price,
          })),
        },
      },
    });

    const productData = await productResult.json();
    const product = productData.data?.productCreate?.product;
    const productErrors = productData.data?.productCreate?.userErrors;

    if (productErrors?.length > 0) {
      throw new Error(`Product: ${productErrors.map((e: { message: string }) => e.message).join(", ")}`);
    }

    steps.product_created = true;

    await prisma.syncShopify.update({
      where: { id: syncRecord.id },
      data: {
        shopifyObjectId: product.id,
        shopifyHandle: product.handle,
        syncSteps: steps,
      },
    });

    await logAudit({
      actorType: "system",
      action: "shopify.product_created",
      objectType: "offering",
      objectId: offeringId,
      details: { shopifyId: product.id, handle: product.handle },
    });

    // Step 2: Write product metafields
    await admin.graphql(SET_METAFIELDS, {
      variables: {
        metafields: [
          {
            ownerId: product.id,
            namespace: "tgc_offering",
            key: "faculty_id",
            type: "single_line_text_field",
            value: faculty.id,
          },
          {
            ownerId: product.id,
            namespace: "tgc_offering",
            key: "faculty_handle",
            type: "single_line_text_field",
            value: facultyHandle,
          },
          {
            ownerId: product.id,
            namespace: "tgc_offering",
            key: "offering_type",
            type: "single_line_text_field",
            value: offering.offeringType,
          },
          {
            ownerId: product.id,
            namespace: "tgc_offering",
            key: "level",
            type: "single_line_text_field",
            value: offering.level || "",
          },
          {
            ownerId: product.id,
            namespace: "tgc_offering",
            key: "format",
            type: "single_line_text_field",
            value: offering.format || "",
          },
          {
            ownerId: product.id,
            namespace: "tgc_offering",
            key: "app_offering_id",
            type: "single_line_text_field",
            value: offeringId,
          },
          {
            ownerId: product.id,
            namespace: "tgc_offering",
            key: "duration_minutes",
            type: "number_integer",
            value: String(offering.durationMinutes || 60),
          },
          {
            ownerId: product.id,
            namespace: "tgc_offering",
            key: "capacity",
            type: "number_integer",
            value: String(offering.capacity || 0),
          },
        ],
      },
    });

    steps.metafields_written = true;

    // Step 3: Add product to teacher's collection
    if (collectionSync?.shopifyObjectId) {
      await admin.graphql(ADD_PRODUCTS_TO_COLLECTION, {
        variables: {
          id: collectionSync.shopifyObjectId,
          productIds: [product.id],
        },
      });

      steps.added_to_collection = true;
    }

    // Step 4: Update offering status
    const newStatus = publishImmediately ? "live" : "approved";
    await prisma.offering.update({
      where: { id: offeringId },
      data: {
        status: newStatus,
        approvedAt: new Date(),
        publishedAt: publishImmediately ? new Date() : null,
      },
    });

    steps.status_updated = true;

    // Step 5: Flag Appointo setup
    await prisma.syncAppointo.create({
      data: {
        objectType: "offering_product",
        objectId: offeringId,
        syncStatus: "pending",
        configurationNotes: "Needs Appointo product configuration",
      },
    });

    steps.appointo_flagged = true;

    // Update final sync status
    await prisma.syncShopify.update({
      where: { id: syncRecord.id },
      data: {
        syncStatus: "synced",
        lastSyncedAt: new Date(),
        syncSteps: steps,
        lastError: null,
      },
    });

    return { success: true, steps, productId: product.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await prisma.syncShopify.update({
      where: { id: syncRecord.id },
      data: {
        syncStatus: "failed",
        lastError: errorMessage,
        syncSteps: steps,
        retryCount: { increment: 1 },
      },
    });

    return { success: false, error: errorMessage, steps };
  }
}

// ═══════════════════════════════════════════════════════════════
// CHAIN 3: Profile Publish Provisioning
// Sync profile changes to Shopify metaobject
// ═══════════════════════════════════════════════════════════════

export async function syncFacultyProfile(
  facultyId: string,
  admin: AdminApiContext,
) {
  const faculty = await prisma.faculty.findUniqueOrThrow({
    where: { id: facultyId },
  });

  const syncRecord = await prisma.syncShopify.findFirst({
    where: { objectId: facultyId, objectType: "faculty_metaobject" },
  });

  if (!syncRecord?.shopifyObjectId) {
    return { success: false, error: "No Shopify metaobject found for this faculty" };
  }

  try {
    const fields = buildFacultyMetaobjectFields(faculty);

    await admin.graphql(
      `#graphql
      mutation UpdateFacultyMetaobject($id: ID!, $metaobject: MetaobjectUpdateInput!) {
        metaobjectUpdate(id: $id, metaobject: $metaobject) {
          metaobject { id }
          userErrors { field message }
        }
      }`,
      {
        variables: {
          id: syncRecord.shopifyObjectId,
          metaobject: { fields },
        },
      },
    );

    // Also update collection description if it changed
    const collectionSync = await prisma.syncShopify.findFirst({
      where: { objectId: facultyId, objectType: "faculty_collection" },
    });

    if (collectionSync?.shopifyObjectId) {
      await admin.graphql(
        `#graphql
        mutation UpdateCollection($input: CollectionInput!) {
          collectionUpdate(input: $input) {
            collection { id }
            userErrors { field message }
          }
        }`,
        {
          variables: {
            input: {
              id: collectionSync.shopifyObjectId,
              title: faculty.publicName || faculty.fullName || "",
              descriptionHtml: faculty.shortBio || "",
            },
          },
        },
      );
    }

    await prisma.syncShopify.update({
      where: { id: syncRecord.id },
      data: {
        syncStatus: "synced",
        lastSyncedAt: new Date(),
        lastError: null,
      },
    });

    await logAudit({
      actorType: "system",
      action: "shopify.profile_synced",
      objectType: "faculty",
      objectId: facultyId,
    });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (syncRecord) {
      await prisma.syncShopify.update({
        where: { id: syncRecord.id },
        data: { syncStatus: "failed", lastError: errorMessage },
      });
    }

    return { success: false, error: errorMessage };
  }
}

// ═══════════════════════════════════════════════════════════════
// Offering Pause/Resume — sync product status to Shopify
// ═══════════════════════════════════════════════════════════════

export async function syncOfferingStatus(
  offeringId: string,
  status: "ACTIVE" | "DRAFT",
  admin: AdminApiContext,
) {
  const syncRecord = await prisma.syncShopify.findFirst({
    where: { objectId: offeringId, objectType: "offering_product" },
  });

  if (!syncRecord?.shopifyObjectId) {
    return { success: false, error: "No Shopify product found" };
  }

  try {
    await admin.graphql(
      `#graphql
      mutation UpdateProductStatus($input: ProductInput!) {
        productUpdate(input: $input) {
          product { id status }
          userErrors { field message }
        }
      }`,
      {
        variables: {
          input: {
            id: syncRecord.shopifyObjectId,
            status,
          },
        },
      },
    );

    await prisma.syncShopify.update({
      where: { id: syncRecord.id },
      data: { syncStatus: "synced", lastSyncedAt: new Date() },
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
