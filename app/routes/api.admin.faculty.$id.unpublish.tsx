import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { logAudit } from "../lib/audit.server";

const PUBLISHABLE_UNPUBLISH = `#graphql
  mutation PublishableUnpublish($id: ID!, $input: [PublicationInput!]!) {
    publishableUnpublish(id: $id, input: $input) {
      publishable { ... on Metaobject { id status } }
      userErrors { field message }
    }
  }
`;

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const { admin, session } = await authenticate.admin(request);

  const { id } = params;
  if (!id) {
    return json({ error: "Faculty ID is required" }, { status: 400 });
  }

  try {
    const faculty = await prisma.faculty.findUnique({ where: { id } });
    if (!faculty) {
      return json({ error: "Faculty not found" }, { status: 404 });
    }

    await prisma.faculty.update({
      where: { id },
      data: { profilePublished: false },
    });

    const syncRecord = await prisma.syncShopify.findFirst({
      where: { objectId: id, objectType: "faculty_metaobject" },
    });

    if (syncRecord?.shopifyObjectId) {
      const pubResult = await admin.graphql(
        `#graphql
        query GetPublications {
          publications(first: 10) {
            nodes { id name }
          }
        }`,
      );
      const pubData = await pubResult.json();
      const onlineStore = pubData.data?.publications?.nodes?.find(
        (p: { name: string }) => p.name === "Online Store",
      );

      if (onlineStore) {
        const result = await admin.graphql(PUBLISHABLE_UNPUBLISH, {
          variables: {
            id: syncRecord.shopifyObjectId,
            input: [{ publicationId: onlineStore.id }],
          },
        });

        const data = await result.json();
        const errors = data.data?.publishableUnpublish?.userErrors;
        if (errors?.length > 0) {
          console.error("Unpublish errors:", errors);
        }
      }

      await prisma.syncShopify.update({
        where: { id: syncRecord.id },
        data: { syncStatus: "synced", lastSyncedAt: new Date() },
      });
    }

    await logAudit({
      actorType: "admin",
      actorId: session.id,
      action: "faculty.unpublished",
      objectType: "faculty",
      objectId: id,
    });

    return json({ success: true });
  } catch (error) {
    console.error("Unpublish faculty error:", error);
    const message = error instanceof Error ? error.message : "Failed to unpublish faculty";
    return json({ error: message }, { status: 500 });
  }
}
