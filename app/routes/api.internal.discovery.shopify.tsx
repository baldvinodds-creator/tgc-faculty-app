// POST /api/internal/discovery/shopify
// Queries the Shopify store to find all existing collections and products
// related to faculty, for matching during import.
//
// Returns:
// - collections: all collections (with metafields, product counts)
// - products: products tagged with faculty:* or typed as lessons
// - matches: suggested faculty→Shopify object matches

import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { logAudit } from "../lib/audit.server";
import prisma from "../db.server";

interface ShopifyCollection {
  id: string;
  handle: string;
  title: string;
  productsCount: number;
  metafields: Array<{ namespace: string; key: string; value: string }>;
}

interface ShopifyProduct {
  id: string;
  handle: string;
  title: string;
  productType: string;
  vendor: string;
  tags: string[];
  status: string;
  variants: Array<{ id: string; title: string; price: string }>;
  metafields: Array<{ namespace: string; key: string; value: string }>;
}

const GET_COLLECTIONS_PAGINATED = `#graphql
  query GetCollections($first: Int!, $after: String) {
    collections(first: $first, after: $after) {
      edges {
        node {
          id
          handle
          title
          productsCount { count }
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

const GET_PRODUCTS_PAGINATED = `#graphql
  query GetProducts($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, query: $query) {
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

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
  const { admin } = await authenticate.admin(request);

  const body = await request.json().catch(() => ({}));
  const maxPages = (body as { maxPages?: number }).maxPages || 10;

  // ─── Fetch all collections ───
  const collections: ShopifyCollection[] = [];
  let hasNext = true;
  let cursor: string | null = null;
  let pages = 0;

  while (hasNext && pages < maxPages) {
    const variables: Record<string, unknown> = { first: 50 };
    if (cursor) variables.after = cursor;

    const result = await admin.graphql(GET_COLLECTIONS_PAGINATED, { variables });
    const data = await result.json();
    const edges = data.data?.collections?.edges || [];
    const pageInfo = data.data?.collections?.pageInfo;

    for (const edge of edges) {
      const node = edge.node;
      collections.push({
        id: node.id,
        handle: node.handle,
        title: node.title,
        productsCount: node.productsCount?.count || 0,
        metafields: (node.metafields?.edges || []).map(
          (e: { node: { namespace: string; key: string; value: string } }) => e.node,
        ),
      });
    }

    hasNext = pageInfo?.hasNextPage || false;
    cursor = pageInfo?.endCursor || null;
    pages++;
  }

  // ─── Fetch lesson/faculty-related products ───
  const products: ShopifyProduct[] = [];
  hasNext = true;
  cursor = null;
  pages = 0;

  // Search for products that are lessons or tagged with faculty
  const productQueries = [
    'tag:type\\:lesson',
    'product_type:private_lesson OR product_type:masterclass OR product_type:group_class',
    'vendor:"The Global Conservatory"',
  ];

  for (const query of productQueries) {
    hasNext = true;
    cursor = null;
    pages = 0;

    while (hasNext && pages < maxPages) {
      const variables: Record<string, unknown> = { first: 50, query };
      if (cursor) variables.after = cursor;

      const result = await admin.graphql(GET_PRODUCTS_PAGINATED, { variables });
      const data = await result.json();
      const edges = data.data?.products?.edges || [];
      const pageInfo = data.data?.products?.pageInfo;

      for (const edge of edges) {
        const node = edge.node;
        // Deduplicate by ID
        if (products.some((p) => p.id === node.id)) continue;

        products.push({
          id: node.id,
          handle: node.handle,
          title: node.title,
          productType: node.productType,
          vendor: node.vendor,
          tags: node.tags || [],
          status: node.status,
          variants: (node.variants?.edges || []).map(
            (e: { node: { id: string; title: string; price: string } }) => e.node,
          ),
          metafields: (node.metafields?.edges || []).map(
            (e: { node: { namespace: string; key: string; value: string } }) => e.node,
          ),
        });
      }

      hasNext = pageInfo?.hasNextPage || false;
      cursor = pageInfo?.endCursor || null;
      pages++;
    }
  }

  // ─── Build match suggestions ───
  // Get all faculty from the database
  const faculty = await prisma.faculty.findMany({
    select: {
      id: true,
      email: true,
      fullName: true,
      publicName: true,
      primaryInstrument: true,
    },
  });

  const matches: Array<{
    facultyId: string;
    facultyName: string;
    facultyEmail: string;
    suggestedCollection: { id: string; title: string; handle: string } | null;
    suggestedProducts: Array<{ id: string; title: string; type: string; tags: string[] }>;
    confidence: string;
  }> = [];

  for (const f of faculty) {
    const name = (f.publicName || f.fullName || "").toLowerCase();
    if (!name) continue;

    // Find collection by name match
    const nameParts = name.split(" ").filter((p) => p.length > 2);
    let bestCollection: ShopifyCollection | null = null;
    let bestScore = 0;

    for (const col of collections) {
      const colTitle = col.title.toLowerCase();
      let score = 0;
      for (const part of nameParts) {
        if (colTitle.includes(part)) score++;
      }
      // Check metafield match
      const facultyIdMeta = col.metafields.find(
        (m) => m.namespace === "tgc_faculty" && m.key === "faculty_id",
      );
      if (facultyIdMeta?.value === f.id) {
        score = 100; // Exact match
      }

      if (score > bestScore) {
        bestScore = score;
        bestCollection = col;
      }
    }

    // Find products by tag or name match
    const matchedProducts: Array<{ id: string; title: string; type: string; tags: string[] }> = [];
    for (const prod of products) {
      // Check faculty tag
      const facultyTag = prod.tags.find((t) => t.startsWith("faculty:"));
      if (facultyTag) {
        const tagHandle = facultyTag.replace("faculty:", "");
        const nameHandle = name.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        if (tagHandle === nameHandle || tagHandle.includes(nameHandle)) {
          matchedProducts.push({
            id: prod.id,
            title: prod.title,
            type: prod.productType,
            tags: prod.tags,
          });
          continue;
        }
      }

      // Check title match
      const prodTitle = prod.title.toLowerCase();
      const nameMatches = nameParts.filter((part) => prodTitle.includes(part));
      if (nameMatches.length >= Math.max(1, nameParts.length - 1)) {
        matchedProducts.push({
          id: prod.id,
          title: prod.title,
          type: prod.productType,
          tags: prod.tags,
        });
      }

      // Check metafield match
      const appMeta = prod.metafields.find(
        (m) => m.namespace === "tgc_offering" && m.key === "faculty_id",
      );
      if (appMeta?.value === f.id) {
        if (!matchedProducts.some((mp) => mp.id === prod.id)) {
          matchedProducts.push({
            id: prod.id,
            title: prod.title,
            type: prod.productType,
            tags: prod.tags,
          });
        }
      }
    }

    const confidence =
      bestScore >= 100 ? "exact" :
      bestScore >= nameParts.length ? "high" :
      bestScore > 0 ? "medium" : "none";

    if (bestScore > 0 || matchedProducts.length > 0) {
      matches.push({
        facultyId: f.id,
        facultyName: f.publicName || f.fullName || f.email,
        facultyEmail: f.email,
        suggestedCollection: bestCollection
          ? { id: bestCollection.id, title: bestCollection.title, handle: bestCollection.handle }
          : null,
        suggestedProducts: matchedProducts,
        confidence,
      });
    }
  }

  await logAudit({
    actorType: "system",
    action: "discovery.shopify_scan",
    details: {
      collectionsFound: collections.length,
      productsFound: products.length,
      matchesSuggested: matches.length,
    },
  });

  return json({
    collections: collections.length,
    products: products.length,
    matches,
    // Include raw data for the admin to review
    allCollections: collections.map((c) => ({
      id: c.id,
      handle: c.handle,
      title: c.title,
      productsCount: c.productsCount,
    })),
    allProducts: products.map((p) => ({
      id: p.id,
      handle: p.handle,
      title: p.title,
      productType: p.productType,
      tags: p.tags,
      status: p.status,
    })),
  });
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error("Discovery Shopify scan error:", error);
    return json({ error: "Failed to scan Shopify store" }, { status: 500 });
  }
}
