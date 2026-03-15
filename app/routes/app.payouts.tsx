import { useState, useCallback } from "react";
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
  IndexTable,
  TextField,
  Select,
  Modal,
  FormLayout,
  Divider,
  EmptyState,
  useIndexResourceState,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

function payoutStatusBadge(status: string) {
  const toneMap: Record<string, any> = {
    pending: "attention",
    calculated: "info",
    sent: "success",
    confirmed: "success",
  };
  return (
    <Badge tone={toneMap[status]}>
      {status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
    </Badge>
  );
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  try {
    const payouts = await prisma.payoutTracking.findMany({
      include: {
        faculty: {
          select: { id: true, fullName: true, publicName: true, email: true },
        },
      },
      orderBy: { periodStart: "desc" },
    });

    const faculty = await prisma.faculty.findMany({
      where: { status: { in: ["active", "approved", "paused"] } },
      select: { id: true, fullName: true, publicName: true, email: true },
      orderBy: { fullName: "asc" },
    });

    return json({ payouts, faculty });
  } catch (error) {
    console.error("Payouts loader error:", error);
    return json({ payouts: [], faculty: [], error: "Failed to load payouts" });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  try {
    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    if (intent === "create") {
      const facultyId = formData.get("facultyId") as string;
      const periodStart = formData.get("periodStart") as string;
      const periodEnd = formData.get("periodEnd") as string;
      const grossRevenue = formData.get("grossRevenue") as string;
      const platformFees = formData.get("platformFees") as string;
      const teacherPayout = formData.get("teacherPayout") as string;
      const payoutMethod = formData.get("payoutMethod") as string;
      const notes = formData.get("notes") as string;

      if (!facultyId || !periodStart || !periodEnd || !grossRevenue || !teacherPayout) {
        return json({ error: "Required fields: teacher, period, gross revenue, teacher payout" }, { status: 400 });
      }

      await prisma.payoutTracking.create({
        data: {
          facultyId,
          periodStart: new Date(periodStart),
          periodEnd: new Date(periodEnd),
          grossRevenue: parseFloat(grossRevenue),
          platformFees: parseFloat(platformFees || "0"),
          teacherPayout: parseFloat(teacherPayout),
          payoutStatus: "calculated",
          payoutMethod: payoutMethod || null,
          notes: notes || null,
        },
      });

      await prisma.auditLog.create({
        data: {
          actorType: "admin",
          actorId: session.id,
          action: "payout.created",
          objectType: "payout",
          details: { facultyId, periodStart, periodEnd },
        },
      });

      return json({ success: true, message: "Payout record created" });
    }

    if (intent === "mark_sent") {
      const payoutId = formData.get("payoutId") as string;
      const payoutReference = formData.get("payoutReference") as string;

      await prisma.payoutTracking.update({
        where: { id: payoutId },
        data: {
          payoutStatus: "sent",
          payoutReference: payoutReference || null,
        },
      });

      await prisma.auditLog.create({
        data: {
          actorType: "admin",
          actorId: session.id,
          action: "payout.marked_sent",
          objectType: "payout",
          objectId: payoutId,
        },
      });

      return json({ success: true, message: "Payout marked as sent" });
    }

    if (intent === "update") {
      const payoutId = formData.get("payoutId") as string;
      const grossRevenue = formData.get("grossRevenue") as string;
      const platformFees = formData.get("platformFees") as string;
      const teacherPayout = formData.get("teacherPayout") as string;
      const payoutMethod = formData.get("payoutMethod") as string;
      const notes = formData.get("notes") as string;
      const payoutStatus = formData.get("payoutStatus") as string;

      const updateData: Record<string, any> = {};
      if (grossRevenue) updateData.grossRevenue = parseFloat(grossRevenue);
      if (platformFees !== null) updateData.platformFees = parseFloat(platformFees || "0");
      if (teacherPayout) updateData.teacherPayout = parseFloat(teacherPayout);
      if (payoutMethod !== null) updateData.payoutMethod = payoutMethod || null;
      if (notes !== null) updateData.notes = notes || null;
      if (payoutStatus) updateData.payoutStatus = payoutStatus;

      await prisma.payoutTracking.update({
        where: { id: payoutId },
        data: updateData,
      });

      return json({ success: true, message: "Payout updated" });
    }

    return json({ error: "Unknown intent" }, { status: 400 });
  } catch (error) {
    console.error("Payout action error:", error);
    return json({ error: "Action failed" }, { status: 500 });
  }
};

function generateCSV(payouts: any[]) {
  const headers = [
    "Teacher",
    "Email",
    "Period Start",
    "Period End",
    "Gross Revenue",
    "Platform Fees",
    "Teacher Payout",
    "Status",
    "Method",
    "Reference",
    "Notes",
  ];

  const rows = payouts.map((p) => [
    p.faculty?.fullName || p.faculty?.publicName || "",
    p.faculty?.email || "",
    new Date(p.periodStart).toLocaleDateString(),
    new Date(p.periodEnd).toLocaleDateString(),
    Number(p.grossRevenue).toFixed(2),
    Number(p.platformFees).toFixed(2),
    Number(p.teacherPayout).toFixed(2),
    p.payoutStatus,
    p.payoutMethod || "",
    p.payoutReference || "",
    (p.notes || "").replace(/"/g, '""'),
  ]);

  const csv =
    headers.join(",") +
    "\n" +
    rows.map((r) => r.map((c: string) => `"${c}"`).join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `payouts-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PayoutsPage() {
  const { payouts, faculty } = useLoaderData<typeof loader>() as any;
  const fetcher = useFetcher();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [sentModalOpen, setSentModalOpen] = useState(false);
  const [selectedPayoutId, setSelectedPayoutId] = useState("");

  // Create form state
  const [createForm, setCreateForm] = useState({
    facultyId: "",
    periodStart: "",
    periodEnd: "",
    grossRevenue: "",
    platformFees: "",
    teacherPayout: "",
    payoutMethod: "",
    notes: "",
  });

  const [sentReference, setSentReference] = useState("");

  const actionData = fetcher.data as any;
  const isSubmitting = fetcher.state !== "idle";

  const resourceName = { singular: "payout", plural: "payouts" };
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(payouts);

  const facultyOptions = [
    { label: "Select teacher...", value: "" },
    ...faculty.map((f: any) => ({
      label: f.fullName || f.publicName || f.email,
      value: f.id,
    })),
  ];

  const handleCreate = () => {
    fetcher.submit(
      { intent: "create", ...createForm },
      { method: "POST" },
    );
    setCreateModalOpen(false);
    setCreateForm({
      facultyId: "",
      periodStart: "",
      periodEnd: "",
      grossRevenue: "",
      platformFees: "",
      teacherPayout: "",
      payoutMethod: "",
      notes: "",
    });
  };

  const handleMarkSent = () => {
    fetcher.submit(
      {
        intent: "mark_sent",
        payoutId: selectedPayoutId,
        payoutReference: sentReference,
      },
      { method: "POST" },
    );
    setSentModalOpen(false);
    setSentReference("");
    setSelectedPayoutId("");
  };

  const rowMarkup = payouts.map((p: any, index: number) => (
    <IndexTable.Row
      id={p.id}
      key={p.id}
      position={index}
      selected={selectedResources.includes(p.id)}
    >
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="bold" as="span">
          {p.faculty?.fullName || p.faculty?.publicName || p.faculty?.email || "-"}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {new Date(p.periodStart).toLocaleDateString()} -{" "}
        {new Date(p.periodEnd).toLocaleDateString()}
      </IndexTable.Cell>
      <IndexTable.Cell>${Number(p.grossRevenue).toFixed(2)}</IndexTable.Cell>
      <IndexTable.Cell>${Number(p.platformFees).toFixed(2)}</IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd" fontWeight="bold">
          ${Number(p.teacherPayout).toFixed(2)}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{payoutStatusBadge(p.payoutStatus)}</IndexTable.Cell>
      <IndexTable.Cell>{p.payoutMethod || "-"}</IndexTable.Cell>
      <IndexTable.Cell>
        {p.payoutStatus !== "sent" && p.payoutStatus !== "confirmed" && (
          <Button
            size="slim"
            onClick={() => {
              setSelectedPayoutId(p.id);
              setSentModalOpen(true);
            }}
          >
            Mark Sent
          </Button>
        )}
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Payout Tracking"
      backAction={{ content: "Dashboard", url: "/app" }}
      primaryAction={{
        content: "Add Payout Record",
        onAction: () => setCreateModalOpen(true),
      }}
      secondaryActions={[
        {
          content: "Export CSV",
          onAction: () => generateCSV(payouts),
          disabled: payouts.length === 0,
        },
      ]}
    >
      <TitleBar title="Payout Tracking" />
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

        <Layout>
          <Layout.Section>
            <Card padding="0">
              {payouts.length === 0 ? (
                <div style={{ padding: "16px" }}>
                  <EmptyState
                    heading="No payout records"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    action={{
                      content: "Add payout record",
                      onAction: () => setCreateModalOpen(true),
                    }}
                  >
                    <p>Create payout records to track teacher compensation.</p>
                  </EmptyState>
                </div>
              ) : (
                <IndexTable
                  resourceName={resourceName}
                  itemCount={payouts.length}
                  selectedItemsCount={
                    allResourcesSelected ? "All" : selectedResources.length
                  }
                  onSelectionChange={handleSelectionChange}
                  headings={[
                    { title: "Teacher" },
                    { title: "Period" },
                    { title: "Gross Revenue" },
                    { title: "Platform Fees" },
                    { title: "Teacher Payout" },
                    { title: "Status" },
                    { title: "Method" },
                    { title: "" },
                  ]}
                  selectable={false}
                >
                  {rowMarkup}
                </IndexTable>
              )}
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>

      {/* Create Modal */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Add Payout Record"
        primaryAction={{
          content: "Create",
          onAction: handleCreate,
          disabled:
            !createForm.facultyId ||
            !createForm.periodStart ||
            !createForm.periodEnd ||
            !createForm.grossRevenue ||
            !createForm.teacherPayout,
          loading: isSubmitting,
        }}
        secondaryActions={[
          { content: "Cancel", onAction: () => setCreateModalOpen(false) },
        ]}
      >
        <Modal.Section>
          <FormLayout>
            <Select
              label="Teacher"
              options={facultyOptions}
              value={createForm.facultyId}
              onChange={(v) => setCreateForm((p) => ({ ...p, facultyId: v }))}
            />
            <FormLayout.Group>
              <TextField
                label="Period Start"
                type="date"
                value={createForm.periodStart}
                onChange={(v) => setCreateForm((p) => ({ ...p, periodStart: v }))}
                autoComplete="off"
              />
              <TextField
                label="Period End"
                type="date"
                value={createForm.periodEnd}
                onChange={(v) => setCreateForm((p) => ({ ...p, periodEnd: v }))}
                autoComplete="off"
              />
            </FormLayout.Group>
            <FormLayout.Group>
              <TextField
                label="Gross Revenue ($)"
                type="number"
                value={createForm.grossRevenue}
                onChange={(v) => setCreateForm((p) => ({ ...p, grossRevenue: v }))}
                autoComplete="off"
                prefix="$"
              />
              <TextField
                label="Platform Fees ($)"
                type="number"
                value={createForm.platformFees}
                onChange={(v) => setCreateForm((p) => ({ ...p, platformFees: v }))}
                autoComplete="off"
                prefix="$"
              />
            </FormLayout.Group>
            <TextField
              label="Teacher Payout ($)"
              type="number"
              value={createForm.teacherPayout}
              onChange={(v) => setCreateForm((p) => ({ ...p, teacherPayout: v }))}
              autoComplete="off"
              prefix="$"
            />
            <Select
              label="Payout Method"
              options={[
                { label: "Select...", value: "" },
                { label: "Bank Transfer", value: "bank_transfer" },
                { label: "PayPal", value: "paypal" },
                { label: "Check", value: "check" },
                { label: "Zelle", value: "zelle" },
                { label: "Venmo", value: "venmo" },
                { label: "Other", value: "other" },
              ]}
              value={createForm.payoutMethod}
              onChange={(v) => setCreateForm((p) => ({ ...p, payoutMethod: v }))}
            />
            <TextField
              label="Notes"
              value={createForm.notes}
              onChange={(v) => setCreateForm((p) => ({ ...p, notes: v }))}
              multiline={3}
              autoComplete="off"
            />
          </FormLayout>
        </Modal.Section>
      </Modal>

      {/* Mark Sent Modal */}
      <Modal
        open={sentModalOpen}
        onClose={() => {
          setSentModalOpen(false);
          setSentReference("");
          setSelectedPayoutId("");
        }}
        title="Mark Payout as Sent"
        primaryAction={{
          content: "Mark as Sent",
          onAction: handleMarkSent,
          loading: isSubmitting,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => {
              setSentModalOpen(false);
              setSentReference("");
            },
          },
        ]}
      >
        <Modal.Section>
          <TextField
            label="Payment Reference / Transaction ID (optional)"
            value={sentReference}
            onChange={setSentReference}
            autoComplete="off"
            placeholder="e.g. bank transfer reference number"
          />
        </Modal.Section>
      </Modal>
    </Page>
  );
}
