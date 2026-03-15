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
  InlineStack,
  Box,
  useIndexResourceState,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

const STATUS_TABS = [
  { id: "all", content: "All" },
  { id: "pending_review", content: "Pending Review" },
  { id: "approved", content: "Approved" },
  { id: "rejected", content: "Rejected" },
  { id: "changes_requested", content: "Changes Requested" },
];

function statusBadge(status: string) {
  const map: Record<string, { tone: any; label: string }> = {
    pending_review: { tone: "attention", label: "Pending Review" },
    approved: { tone: "success", label: "Approved" },
    rejected: { tone: "critical", label: "Rejected" },
    changes_requested: { tone: "warning", label: "Changes Requested" },
  };
  const s = map[status] || { tone: undefined, label: status };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const url = new URL(request.url);
  const status = url.searchParams.get("status");

  try {
    const where: Record<string, unknown> = {};
    if (status && status !== "all") {
      where.status = status;
    }

    const applications = await prisma.facultyApplication.findMany({
      where,
      include: {
        faculty: {
          select: {
            id: true,
            fullName: true,
            publicName: true,
            email: true,
            primaryInstrument: true,
            division: true,
            status: true,
          },
        },
      },
      orderBy: { submittedAt: "desc" },
    });

    return json({ applications });
  } catch (error) {
    console.error("Load applications error:", error);
    return json({ applications: [], error: "Failed to load applications" });
  }
};

export default function ApplicationsPage() {
  const { applications, error } = useLoaderData<typeof loader>() as any;
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

  const resourceName = { singular: "application", plural: "applications" };
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(applications);

  const rowMarkup = applications.map((app: any, index: number) => (
    <IndexTable.Row
      id={app.id}
      key={app.id}
      position={index}
      selected={selectedResources.includes(app.id)}
      onClick={() => navigate(`/app/applications/${app.id}`)}
    >
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="bold" as="span">
          {app.faculty?.fullName || app.faculty?.publicName || "Unnamed"}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{app.faculty?.email || "-"}</IndexTable.Cell>
      <IndexTable.Cell>{app.faculty?.primaryInstrument || "-"}</IndexTable.Cell>
      <IndexTable.Cell>{app.faculty?.division || "-"}</IndexTable.Cell>
      <IndexTable.Cell>
        {new Date(app.submittedAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </IndexTable.Cell>
      <IndexTable.Cell>{statusBadge(app.status)}</IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Faculty Applications"
      backAction={{ content: "Dashboard", url: "/app" }}
    >
      <TitleBar title="Faculty Applications" />
      <Layout>
        <Layout.Section>
          <Card padding="0">
            <Tabs
              tabs={STATUS_TABS}
              selected={selectedTab >= 0 ? selectedTab : 0}
              onSelect={handleTabChange}
            >
              {applications.length === 0 ? (
                <div style={{ padding: "16px" }}>
                  <EmptyState
                    heading="No applications found"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>
                      {currentStatus !== "all"
                        ? `No applications with status "${currentStatus.replace(/_/g, " ")}".`
                        : "No faculty applications have been submitted yet."}
                    </p>
                  </EmptyState>
                </div>
              ) : (
                <IndexTable
                  resourceName={resourceName}
                  itemCount={applications.length}
                  selectedItemsCount={
                    allResourcesSelected ? "All" : selectedResources.length
                  }
                  onSelectionChange={handleSelectionChange}
                  headings={[
                    { title: "Name" },
                    { title: "Email" },
                    { title: "Instrument" },
                    { title: "Division" },
                    { title: "Submitted" },
                    { title: "Status" },
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

