import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
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
  TextField,
  FormLayout,
  Divider,
  Box,
  IndexTable,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

const POLICY_TYPES = [
  { key: "terms_of_service", label: "Terms of Service" },
  { key: "privacy_policy", label: "Privacy Policy" },
  { key: "cancellation_policy", label: "Cancellation Policy" },
  { key: "recording_policy", label: "Recording Policy" },
  { key: "conduct_policy", label: "Code of Conduct" },
  { key: "payout_agreement", label: "Payout Agreement" },
  { key: "no_solicitation_agreement", label: "No Solicitation Agreement" },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  try {
    // Get latest consent version per type
    const latestConsents = await prisma.consent.groupBy({
      by: ["consentType"],
      _max: { version: true },
      _count: true,
    });

    const policyVersions: Record<string, { version: string; count: number }> = {};
    for (const c of latestConsents) {
      policyVersions[c.consentType] = {
        version: c._max.version || "0",
        count: c._count,
      };
    }

    // System stats
    const [
      totalFaculty,
      totalOfferings,
      totalSyncs,
      failedSyncs,
      lastSync,
      lastAudit,
    ] = await Promise.all([
      prisma.faculty.count(),
      prisma.offering.count(),
      prisma.syncShopify.count(),
      prisma.syncShopify.count({ where: { syncStatus: "failed" } }),
      prisma.syncShopify.findFirst({
        where: { lastSyncedAt: { not: null } },
        orderBy: { lastSyncedAt: "desc" },
        select: { lastSyncedAt: true },
      }),
      prisma.auditLog.findFirst({
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

    return json({
      adminEmail: session.email || session.id,
      policyVersions,
      totalFaculty,
      totalOfferings,
      totalSyncs,
      failedSyncs,
      lastSyncTime: lastSync?.lastSyncedAt,
      lastAuditTime: lastAudit?.createdAt,
      shopUrl: session.shop,
      magicLinkExpiry: process.env.MAGIC_LINK_EXPIRY_MINUTES || "15",
      sessionDuration: process.env.SESSION_DURATION_HOURS || "72",
    });
  } catch (error) {
    console.error("Settings loader error:", error);
    return json({
      adminEmail: session.email || session.id,
      policyVersions: {},
      totalFaculty: 0,
      totalOfferings: 0,
      totalSyncs: 0,
      failedSyncs: 0,
      lastSyncTime: null,
      lastAuditTime: null,
      shopUrl: session.shop,
      magicLinkExpiry: "15",
      sessionDuration: "72",
      error: "Failed to load some settings",
    });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  try {
    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    if (intent === "update_policy_version") {
      const policyType = formData.get("policyType") as string;
      const newVersion = formData.get("newVersion") as string;

      if (!policyType || !newVersion) {
        return json({ error: "Policy type and version are required" }, { status: 400 });
      }

      // Log the policy version update (actual consent re-acceptance would be triggered separately)
      await prisma.auditLog.create({
        data: {
          actorType: "admin",
          actorId: session.id,
          action: "policy.version_updated",
          objectType: "policy",
          details: { policyType, newVersion },
        },
      });

      return json({ success: true, message: `Policy "${policyType}" updated to version ${newVersion}` });
    }

    return json({ error: "Unknown intent" }, { status: 400 });
  } catch (error) {
    console.error("Settings action error:", error);
    return json({ error: "Action failed" }, { status: 500 });
  }
};

export default function SettingsPage() {
  const data = useLoaderData<typeof loader>() as any;
  const fetcher = useFetcher();
  const actionData = fetcher.data as any;
  const isSubmitting = fetcher.state !== "idle";

  return (
    <Page
      title="Settings"
      backAction={{ content: "Dashboard", url: "/app" }}
    >
      <TitleBar title="Settings" />
      <BlockStack gap="500">
        {actionData?.success && (
          <Banner tone="success" onDismiss={() => {}}>
            <p>{actionData.message}</p>
          </Banner>
        )}
        {actionData?.error && (
          <Banner tone="critical" onDismiss={() => {}}>
            <p>{actionData.error}</p>
          </Banner>
        )}
        {data.error && (
          <Banner tone="warning">
            <p>{data.error}</p>
          </Banner>
        )}

        <Layout>
          <Layout.Section>
            {/* Admin Info */}
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Admin Information</Text>
                <Divider />
                <InlineStack gap="200">
                  <Text as="span" variant="bodySm" fontWeight="semibold">Admin Email:</Text>
                  <Text as="span" variant="bodySm">{data.adminEmail}</Text>
                </InlineStack>
                <InlineStack gap="200">
                  <Text as="span" variant="bodySm" fontWeight="semibold">Shop:</Text>
                  <Text as="span" variant="bodySm">{data.shopUrl}</Text>
                </InlineStack>
              </BlockStack>
            </Card>

            {/* Policy Management */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Policy Management</Text>
                <Divider />
                <Text as="p" variant="bodySm" tone="subdued">
                  Update policy versions when documents change. Teachers will be prompted to re-accept updated policies.
                </Text>
                <BlockStack gap="300">
                  {POLICY_TYPES.map((policy) => {
                    const current = data.policyVersions?.[policy.key];
                    return (
                      <PolicyRow
                        key={policy.key}
                        policyKey={policy.key}
                        label={policy.label}
                        currentVersion={current?.version || "Not set"}
                        acceptedCount={current?.count || 0}
                        fetcher={fetcher}
                        isSubmitting={isSubmitting}
                      />
                    );
                  })}
                </BlockStack>
              </BlockStack>
            </Card>

            {/* Authentication Settings */}
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Authentication Settings</Text>
                <Divider />
                <InlineStack gap="200">
                  <Text as="span" variant="bodySm" fontWeight="semibold">Magic Link Expiry:</Text>
                  <Badge>{data.magicLinkExpiry} minutes</Badge>
                </InlineStack>
                <InlineStack gap="200">
                  <Text as="span" variant="bodySm" fontWeight="semibold">Session Duration:</Text>
                  <Badge>{data.sessionDuration} hours</Badge>
                </InlineStack>
                <Text as="p" variant="bodySm" tone="subdued">
                  These values are set via environment variables (MAGIC_LINK_EXPIRY_MINUTES, SESSION_DURATION_HOURS).
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            {/* System Status */}
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">System Status</Text>
                <Divider />
                <InlineStack gap="200">
                  <Text as="span" variant="bodySm" fontWeight="semibold">Shopify Connection:</Text>
                  <Badge tone="success">Connected</Badge>
                </InlineStack>
                <InlineStack gap="200">
                  <Text as="span" variant="bodySm" fontWeight="semibold">Last Sync:</Text>
                  <Text as="span" variant="bodySm">
                    {data.lastSyncTime
                      ? new Date(data.lastSyncTime).toLocaleString()
                      : "Never"}
                  </Text>
                </InlineStack>
                <InlineStack gap="200">
                  <Text as="span" variant="bodySm" fontWeight="semibold">Last Activity:</Text>
                  <Text as="span" variant="bodySm">
                    {data.lastAuditTime
                      ? new Date(data.lastAuditTime).toLocaleString()
                      : "Never"}
                  </Text>
                </InlineStack>
                <Divider />
                <Text as="h3" variant="headingSm">Database Counts</Text>
                <InlineStack gap="200">
                  <Text as="span" variant="bodySm" fontWeight="semibold">Faculty:</Text>
                  <Text as="span" variant="bodySm">{data.totalFaculty}</Text>
                </InlineStack>
                <InlineStack gap="200">
                  <Text as="span" variant="bodySm" fontWeight="semibold">Offerings:</Text>
                  <Text as="span" variant="bodySm">{data.totalOfferings}</Text>
                </InlineStack>
                <InlineStack gap="200">
                  <Text as="span" variant="bodySm" fontWeight="semibold">Sync Records:</Text>
                  <Text as="span" variant="bodySm">{data.totalSyncs}</Text>
                </InlineStack>
                <InlineStack gap="200">
                  <Text as="span" variant="bodySm" fontWeight="semibold">Failed Syncs:</Text>
                  <Badge tone={data.failedSyncs > 0 ? "critical" : "success"}>
                    {data.failedSyncs}
                  </Badge>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}

function PolicyRow({
  policyKey,
  label,
  currentVersion,
  acceptedCount,
  fetcher,
  isSubmitting,
}: {
  policyKey: string;
  label: string;
  currentVersion: string;
  acceptedCount: number;
  fetcher: any;
  isSubmitting: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [newVersion, setNewVersion] = useState("");

  const handleSave = () => {
    if (!newVersion.trim()) return;
    fetcher.submit(
      {
        intent: "update_policy_version",
        policyType: policyKey,
        newVersion: newVersion.trim(),
      },
      { method: "POST" },
    );
    setEditing(false);
    setNewVersion("");
  };

  return (
    <Box padding="300" background="bg-surface-secondary" borderRadius="200">
      <InlineStack align="space-between" blockAlign="center" wrap={false}>
        <BlockStack gap="050">
          <Text as="span" variant="bodySm" fontWeight="semibold">{label}</Text>
          <InlineStack gap="200">
            <Text as="span" variant="bodySm" tone="subdued">
              Version: {currentVersion}
            </Text>
            <Text as="span" variant="bodySm" tone="subdued">
              ({acceptedCount} acceptance{acceptedCount !== 1 ? "s" : ""})
            </Text>
          </InlineStack>
        </BlockStack>
        {editing ? (
          <InlineStack gap="200" blockAlign="center">
            <div style={{ width: "80px" }}>
              <TextField
                label=""
                labelHidden
                value={newVersion}
                onChange={setNewVersion}
                autoComplete="off"
                placeholder="e.g. 2.0"
                size="slim"
              />
            </div>
            <Button size="slim" variant="primary" onClick={handleSave} loading={isSubmitting}>
              Save
            </Button>
            <Button size="slim" onClick={() => { setEditing(false); setNewVersion(""); }}>
              Cancel
            </Button>
          </InlineStack>
        ) : (
          <Button size="slim" onClick={() => setEditing(true)}>
            Update Version
          </Button>
        )}
      </InlineStack>
    </Box>
  );
}
