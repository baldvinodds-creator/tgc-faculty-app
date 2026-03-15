// Runs on first app install to create the tgc_faculty metaobject definition
// Idempotent — checks if definition exists before creating

import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import {
  CREATE_METAOBJECT_DEFINITION,
  GET_METAOBJECT_DEFINITION,
} from "./shopify-graphql.server";
import { logAudit } from "./audit.server";

export async function ensureMetaobjectDefinition(admin: AdminApiContext) {
  // Check if definition already exists
  const checkResult = await admin.graphql(GET_METAOBJECT_DEFINITION, {
    variables: { type: "$app:tgc_faculty" },
  });

  const checkData = await checkResult.json();

  if (checkData.data?.metaobjectDefinitionByType) {
    return {
      exists: true,
      id: checkData.data.metaobjectDefinitionByType.id,
    };
  }

  // Create it
  const createResult = await admin.graphql(CREATE_METAOBJECT_DEFINITION);
  const createData = await createResult.json();

  const definition = createData.data?.metaobjectDefinitionCreate?.metaobjectDefinition;
  const errors = createData.data?.metaobjectDefinitionCreate?.userErrors;

  if (errors?.length > 0) {
    console.error("Failed to create metaobject definition:", errors);
    return { exists: false, errors };
  }

  await logAudit({
    actorType: "system",
    action: "setup.metaobject_definition_created",
    details: { definitionId: definition.id, type: definition.type },
  });

  return { exists: true, id: definition.id, created: true };
}
