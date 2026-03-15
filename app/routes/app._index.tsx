import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  Badge,
  Banner,
  Button,
  BlockStack,
  InlineStack,
  InlineGrid,
  Box,
  Divider,
  Link,
  Icon,
  Spinner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { ensureMetaobjectDefinition } from "../lib/setup.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  // Ensure metaobject definition exists on every admin load (idempotent, fast check)
  try {
    await ensureMetaobjectDefinition(admin);
  } catch (e) {
    console.error("Metaobject definition check failed:", e);
  }

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
      recentAuditLogs,
    ] = await Promise.all([
      prisma.facultyApplication.count({ where: { status: "pending_review" } }),
      prisma.offering.count({ where: { status: "pending_approval" } }),
      prisma.offeringEdit.count({ where: { status: "pending_approval" } }),
      prisma.profileEdit.count({ where: { status: "pending_approval" } }),
      prisma.syncShopify.count({ where: { syncStatus: "failed" } }),
      prisma.faculty.count({ where: { status: "active" } }),
      prisma.offering.count({ where: { status: "live" } }),
      prisma.faculty.count({ where: { status: "suspended" } }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    return json({
      pendingApplications,
      pendingOfferings,
      pendingOfferingEdits,
      pendingProfileUpdates,
      pendingEditsTotal: pendingOfferingEdits + pendingProfileUpdates,
      failedSyncs,
      totalActiveFaculty,
      totalLiveOfferings,
      suspendedCount,
      recentAuditLogs,
    });
  } catch (error) {
    console.error("Dashboard loader error:", error);
    return json({
      pendingApplications: 0,
      pendingOfferings: 0,
      pendingOfferingEdits: 0,
      pendingProfileUpdates: 0,
      pendingEditsTotal: 0,
      failedSyncs: 0,
      totalActiveFaculty: 0,
      totalLiveOfferings: 0,
      suspendedCount: 0,
      recentAuditLogs: [],
      error: "Failed to load dashboard data",
    });
  }
};

function StatCard({
  title,
  value,
  tone,
  linkTo,
  linkText,
}: {
  title: string;
  value: number;
  tone?: "success" | "warning" | "critical" | "info";
  linkTo?: string;
  linkText?: string;
}) {
  const navigate = useNavigate();
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="p" variant="bodySm" tone="subdued">
          {title}
        </Text>
        <InlineStack align="space-between" blockAlign="end">
          <Text as="p" variant="headingXl" fontWeight="bold">
            {value}
          </Text>
          {tone && value > 0 && (
            <Badge tone={tone}>{value > 0 ? "Action needed" : "Clear"}</Badge>
          )}
        </InlineStack>
        {linkTo && linkText && (
          <Button variant="plain" onClick={() => navigate(linkTo)}>
            {linkText}
          </Button>
        )}
      </BlockStack>
    </Card>
  );
}

function formatAction(action: string): string {
  return action
    .replace(/\./g, " > ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Dashboard() {
  const data = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const hasUrgentItems =
    data.pendingApplications > 0 ||
    data.failedSyncs > 0 ||
    data.suspendedCount > 0;

  return (
    <Page>
      <TitleBar title="TGC Faculty Admin" />
      <BlockStack gap="500">
        {(data as any).error && (
          <Banner tone="critical">
            <p>Some dashboard data could not be loaded. Please refresh the page.</p>
          </Banner>
        )}

        {hasUrgentItems && (
          <Banner tone="warning" title="Items need your attention">
            <BlockStack gap="200">
              {data.pendingApplications > 0 && (
                <p>
                  {data.pendingApplications} application(s) awaiting review
                </p>
              )}
              {data.failedSyncs > 0 && (
                <p>{data.failedSyncs} sync(s) have failed</p>
              )}
              {data.suspendedCount > 0 && (
                <p>{data.suspendedCount} faculty member(s) are suspended</p>
              )}
            </BlockStack>
          </Banner>
        )}

        {/* Priority Actions */}
        <Layout>
          <Layout.Section>
            <Text as="h2" variant="headingMd">
              Priority Actions
            </Text>
          </Layout.Section>
        </Layout>

        <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
          <StatCard
            title="Pending Applications"
            value={data.pendingApplications}
            tone={data.pendingApplications > 0 ? "warning" : undefined}
            linkTo="/app/applications?status=pending_review"
            linkText="Review applications"
          />
          <StatCard
            title="Pending Offering Approvals"
            value={data.pendingOfferings}
            tone={data.pendingOfferings > 0 ? "warning" : undefined}
            linkTo="/app/offerings?status=pending_approval"
            linkText="Review offerings"
          />
          <StatCard
            title="Pending Edit Approvals"
            value={data.pendingEditsTotal}
            tone={data.pendingEditsTotal > 0 ? "info" : undefined}
            linkTo="/app/approvals"
            linkText="Review edits"
          />
          <StatCard
            title="Failed Syncs"
            value={data.failedSyncs}
            tone={data.failedSyncs > 0 ? "critical" : undefined}
            linkTo="/app/sync?status=failed"
            linkText="View failed syncs"
          />
        </InlineGrid>

        {/* Overview Stats */}
        <Layout>
          <Layout.Section>
            <Text as="h2" variant="headingMd">
              Platform Overview
            </Text>
          </Layout.Section>
        </Layout>

        <InlineGrid columns={{ xs: 1, sm: 3 }} gap="400">
          <StatCard
            title="Active Faculty"
            value={data.totalActiveFaculty}
            linkTo="/app/faculty?status=active"
            linkText="View faculty"
          />
          <StatCard
            title="Live Offerings"
            value={data.totalLiveOfferings}
            linkTo="/app/offerings?status=live"
            linkText="View offerings"
          />
          <StatCard
            title="Suspended Faculty"
            value={data.suspendedCount}
            tone={data.suspendedCount > 0 ? "critical" : undefined}
            linkTo="/app/faculty?status=suspended"
            linkText="View suspended"
          />
        </InlineGrid>

        {/* Recent Activity */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">
                    Recent Activity
                  </Text>
                  <Button variant="plain" onClick={() => navigate("/app/audit")}>
                    View all
                  </Button>
                </InlineStack>
                <Divider />
                {data.recentAuditLogs.length === 0 ? (
                  <Text as="p" variant="bodySm" tone="subdued">
                    No recent activity
                  </Text>
                ) : (
                  <BlockStack gap="300">
                    {data.recentAuditLogs.map((log: any) => (
                      <Box key={log.id} paddingBlockEnd="200">
                        <InlineStack align="space-between" wrap={false}>
                          <BlockStack gap="050">
                            <InlineStack gap="200" blockAlign="center">
                              <Badge
                                tone={
                                  log.actorType === "admin"
                                    ? "info"
                                    : log.actorType === "system"
                                      ? "attention"
                                      : undefined
                                }
                              >
                                {log.actorType}
                              </Badge>
                              <Text as="span" variant="bodySm" fontWeight="semibold">
                                {formatAction(log.action)}
                              </Text>
                            </InlineStack>
                            {log.objectType && (
                              <Text as="span" variant="bodySm" tone="subdued">
                                {log.objectType} {log.objectId ? `(${log.objectId.substring(0, 8)}...)` : ""}
                              </Text>
                            )}
                          </BlockStack>
                          <Text as="span" variant="bodySm" tone="subdued">
                            {formatTimestamp(log.createdAt)}
                          </Text>
                        </InlineStack>
                      </Box>
                    ))}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
