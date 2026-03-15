import { useState, useCallback } from "react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useSearchParams } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  Badge,
  IndexTable,
  Tabs,
  EmptyState,
  BlockStack,
  useIndexResourceState,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

const STATUS_TABS = [
  { id: "all", content: "All" },
  { id: "pending_approval", content: "Pending Approval" },
  { id: "live", content: "Live" },
  { id: "approved", content: "Approved" },
  { id: "draft", content: "Draft" },
  { id: "paused", content: "Paused" },
  { id: "suspended", content: "Suspended" },
  { id: "archived", content: "Archived" },
];

function offeringStatusBadge(status: string) {
  const toneMap: Record<string, any> = {
    live: "success",
    approved: "info",
    pending_approval: "attention",
    draft: undefined,
    paused: "attention",
    suspended: "critical",
    archived: undefined,
    rejected: "critical",
  };
  return (
    <Badge tone={toneMap[status]}>
      {status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
    </Badge>
  );
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "";

  try {
    const where: Record<string, unknown> = {};
    if (status && status !== "all") {
      where.status = status;
    }

    const offerings = await prisma.offering.findMany({
      where,
      include: {
        faculty: {
          select: {
            id: true,
            fullName: true,
            publicName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return json({ offerings });
  } catch (error) {
    console.error("Offerings list error:", error);
    return json({ offerings: [], error: "Failed to load offerings" });
  }
};

export default function OfferingsPage() {
  const { offerings } = useLoaderData<typeof loader>() as any;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentStatus = searchParams.get("status") || "all";
  const selectedTab = STATUS_TABS.findIndex((t) => t.id === currentStatus);

  const handleTabChange = useCallback(
    (index: number) => {
      const tab = STATUS_TABS[index];
      if (tab.id === "all") {
        setSearchParams({});
      } else {
        setSearchParams({ status: tab.id });
      }
    },
    [setSearchParams],
  );

  const resourceName = { singular: "offering", plural: "offerings" };
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(offerings);

  const rowMarkup = offerings.map((o: any, index: number) => (
    <IndexTable.Row
      id={o.id}
      key={o.id}
      position={index}
      selected={selectedResources.includes(o.id)}
      onClick={() => navigate(`/app/offerings/${o.id}`)}
    >
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="bold" as="span">
          {o.title || "Untitled"}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {o.faculty?.fullName || o.faculty?.publicName || "-"}
      </IndexTable.Cell>
      <IndexTable.Cell>
        {o.offeringType?.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) || "-"}
      </IndexTable.Cell>
      <IndexTable.Cell>${Number(o.price).toFixed(2)}</IndexTable.Cell>
      <IndexTable.Cell>{offeringStatusBadge(o.status)}</IndexTable.Cell>
      <IndexTable.Cell>
        {o.submittedAt
          ? new Date(o.submittedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : new Date(o.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Offerings Management"
      backAction={{ content: "Dashboard", url: "/app" }}
    >
      <TitleBar title="Offerings Management" />
      <Layout>
        <Layout.Section>
          <Card padding="0">
            <Tabs
              tabs={STATUS_TABS}
              selected={selectedTab >= 0 ? selectedTab : 0}
              onSelect={handleTabChange}
            >
              {offerings.length === 0 ? (
                <div style={{ padding: "16px" }}>
                  <EmptyState
                    heading="No offerings found"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>
                      {currentStatus !== "all"
                        ? `No offerings with status "${currentStatus.replace(/_/g, " ")}".`
                        : "No offerings have been created yet."}
                    </p>
                  </EmptyState>
                </div>
              ) : (
                <IndexTable
                  resourceName={resourceName}
                  itemCount={offerings.length}
                  selectedItemsCount={
                    allResourcesSelected ? "All" : selectedResources.length
                  }
                  onSelectionChange={handleSelectionChange}
                  headings={[
                    { title: "Title" },
                    { title: "Teacher" },
                    { title: "Type" },
                    { title: "Price" },
                    { title: "Status" },
                    { title: "Submitted" },
                  ]}
                  selectable={false}
                >
                  {rowMarkup}
                </IndexTable>
              )}
            </Tabs>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
