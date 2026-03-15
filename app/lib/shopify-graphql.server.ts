// Shopify Admin GraphQL operations for TGC Faculty App
// All mutations use the authenticated admin session from the Shopify app framework

import type { AdminApiContext } from "@shopify/shopify-app-remix/server";

// ─── Metaobject Definition (run once on install) ───

export const CREATE_METAOBJECT_DEFINITION = `#graphql
  mutation CreateTGCFacultyDefinition {
    metaobjectDefinitionCreate(definition: {
      name: "TGC Faculty"
      type: "$app:tgc_faculty"
      access: {
        admin: MERCHANT_READ_WRITE
        storefront: PUBLIC_READ
      }
      capabilities: {
        publishable: { enabled: true }
        renderable: { enabled: true }
        onlineStore: { enabled: true }
      }
      displayNameKey: "public_name"
      fieldDefinitions: [
        { key: "public_name", name: "Public Name", type: "single_line_text_field" }
        { key: "slug", name: "Slug", type: "single_line_text_field" }
        { key: "short_bio", name: "Short Bio", type: "multi_line_text_field" }
        { key: "long_bio", name: "Long Bio", type: "rich_text_field" }
        { key: "headshot", name: "Headshot", type: "file_reference" }
        { key: "primary_instrument", name: "Primary Instrument", type: "single_line_text_field" }
        { key: "division", name: "Division", type: "single_line_text_field" }
        { key: "specialties", name: "Specialties", type: "single_line_text_field" }
        { key: "languages", name: "Languages", type: "single_line_text_field" }
        { key: "country", name: "Country", type: "single_line_text_field" }
        { key: "timezone", name: "Timezone", type: "single_line_text_field" }
        { key: "credentials", name: "Credentials", type: "multi_line_text_field" }
        { key: "accepting_students", name: "Accepting Students", type: "boolean" }
        { key: "featured", name: "Featured", type: "boolean" }
        { key: "website_url", name: "Website", type: "url" }
        { key: "intro_video_url", name: "Intro Video", type: "url" }
        { key: "social_instagram", name: "Instagram", type: "single_line_text_field" }
        { key: "social_youtube", name: "YouTube", type: "single_line_text_field" }
        { key: "collection_handle", name: "Collection Handle", type: "single_line_text_field" }
        { key: "faculty_app_id", name: "App Faculty ID", type: "single_line_text_field" }
      ]
    }) {
      metaobjectDefinition {
        id
        type
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// ─── Faculty Metaobject CRUD ───

export const UPSERT_FACULTY_METAOBJECT = `#graphql
  mutation UpsertFacultyMetaobject($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
    metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
      metaobject {
        id
        handle
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const UPDATE_FACULTY_METAOBJECT = `#graphql
  mutation UpdateFacultyMetaobject($id: ID!, $metaobject: MetaobjectUpdateInput!) {
    metaobjectUpdate(id: $id, metaobject: $metaobject) {
      metaobject {
        id
        handle
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// ─── Publishable (metaobject visibility) ───

export const PUBLISH_METAOBJECT = `#graphql
  mutation PublishMetaobject($id: ID!, $input: [PublicationInput!]!) {
    publishablePublish(id: $id, input: $input) {
      publishable {
        availablePublicationsCount {
          count
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const UNPUBLISH_METAOBJECT = `#graphql
  mutation UnpublishMetaobject($id: ID!, $input: [PublicationInput!]!) {
    publishableUnpublish(id: $id, input: $input) {
      publishable {
        availablePublicationsCount {
          count
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// ─── Collection (teacher hub) ───

export const CREATE_COLLECTION = `#graphql
  mutation CreateCollection($input: CollectionInput!) {
    collectionCreate(input: $input) {
      collection {
        id
        handle
        title
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const UPDATE_COLLECTION = `#graphql
  mutation UpdateCollection($input: CollectionInput!) {
    collectionUpdate(input: $input) {
      collection {
        id
        handle
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const ADD_PRODUCTS_TO_COLLECTION = `#graphql
  mutation AddProductsToCollection($id: ID!, $productIds: [ID!]!) {
    collectionAddProducts(id: $id, productIds: $productIds) {
      collection {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// ─── Product (offering) ───

export const CREATE_PRODUCT = `#graphql
  mutation CreateProduct($product: ProductCreateInput!, $media: [CreateMediaInput!]) {
    productCreate(product: $product, media: $media) {
      product {
        id
        handle
        title
        variants(first: 10) {
          edges {
            node {
              id
              title
              price
            }
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const UPDATE_PRODUCT = `#graphql
  mutation UpdateProduct($product: ProductInput!) {
    productUpdate(input: $product) {
      product {
        id
        handle
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// ─── Metafields ───

export const SET_METAFIELDS = `#graphql
  mutation SetMetafields($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        id
        namespace
        key
        value
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// ─── File Upload ───

export const CREATE_FILE = `#graphql
  mutation CreateFile($files: [FileCreateInput!]!) {
    fileCreate(files: $files) {
      files {
        id
        alt
        ... on MediaImage {
          image {
            url
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// ─── Queries ───

export const GET_METAOBJECT_DEFINITION = `#graphql
  query GetMetaobjectDefinition($type: String!) {
    metaobjectDefinitionByType(type: $type) {
      id
      type
      name
    }
  }
`;

export const GET_COLLECTIONS = `#graphql
  query GetCollections($first: Int!, $query: String) {
    collections(first: $first, query: $query) {
      edges {
        node {
          id
          handle
          title
          productsCount {
            count
          }
          metafields(first: 10) {
            edges {
              node {
                namespace
                key
                value
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const GET_PRODUCTS = `#graphql
  query GetProducts($first: Int!, $query: String) {
    products(first: $first, query: $query) {
      edges {
        node {
          id
          handle
          title
          productType
          vendor
          tags
          status
          variants(first: 10) {
            edges {
              node {
                id
                title
                price
              }
            }
          }
          metafields(first: 10) {
            edges {
              node {
                namespace
                key
                value
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const GET_PUBLICATIONS = `#graphql
  query GetPublications {
    publications(first: 10) {
      edges {
        node {
          id
          name
        }
      }
    }
  }
`;

// ─── Helper: build faculty metaobject fields from database record ───

export function buildFacultyMetaobjectFields(faculty: {
  publicName?: string | null;
  shortBio?: string | null;
  longBio?: string | null;
  primaryInstrument?: string | null;
  division?: string | null;
  specialties?: string[];
  teachingLanguages?: string[];
  country?: string | null;
  timezone?: string | null;
  credentials?: string | null;
  acceptingStudents?: boolean;
  featured?: boolean;
  websiteUrl?: string | null;
  introVideoUrl?: string | null;
  socialInstagram?: string | null;
  socialYoutube?: string | null;
  id?: string;
  collectionHandle?: string;
}) {
  const fields: Array<{ key: string; value: string }> = [];

  const add = (key: string, value: string | null | undefined) => {
    if (value != null && value !== "") {
      fields.push({ key, value });
    }
  };

  add("public_name", faculty.publicName);
  add("short_bio", faculty.shortBio);
  add("long_bio", faculty.longBio);
  add("primary_instrument", faculty.primaryInstrument);
  add("division", faculty.division);
  add("specialties", faculty.specialties?.join(", "));
  add("languages", faculty.teachingLanguages?.join(", "));
  add("country", faculty.country);
  add("timezone", faculty.timezone);
  add("credentials", faculty.credentials);
  add("accepting_students", faculty.acceptingStudents ? "true" : "false");
  add("featured", faculty.featured ? "true" : "false");
  add("website_url", faculty.websiteUrl);
  add("intro_video_url", faculty.introVideoUrl);
  add("social_instagram", faculty.socialInstagram);
  add("social_youtube", faculty.socialYoutube);
  add("collection_handle", faculty.collectionHandle);
  add("faculty_app_id", faculty.id);

  return fields;
}

// ─── Helper: build product input from offering ───

export function buildOfferingProductInput(
  offering: {
    title?: string | null;
    description?: string | null;
    offeringType: string;
    level?: string | null;
    format?: string | null;
    durationsOffered?: unknown;
    price: unknown;
  },
  faculty: {
    publicName?: string | null;
    division?: string | null;
  },
  facultyHandle: string,
) {
  const title = `${faculty.publicName || "Teacher"} — ${offering.title || offering.offeringType}`;

  const tags = [
    `faculty:${facultyHandle}`,
    `type:lesson`,
    offering.offeringType ? `lesson:${offering.offeringType.replace("_", "-")}` : null,
    offering.level ? `level:${offering.level}` : null,
    faculty.division ? `division:${faculty.division.toLowerCase()}` : null,
    offering.format ? `format:${offering.format}` : null,
  ].filter(Boolean) as string[];

  return {
    title,
    bodyHtml: offering.description || "",
    productType: offering.offeringType,
    vendor: "The Global Conservatory",
    tags,
    status: "ACTIVE",
  };
}
