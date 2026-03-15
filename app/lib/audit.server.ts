import prisma from "../db.server";

export async function logAudit(params: {
  actorType: "teacher" | "admin" | "system";
  actorId?: string;
  action: string;
  objectType?: string;
  objectId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}) {
  await prisma.auditLog.create({
    data: {
      actorType: params.actorType,
      actorId: params.actorId || null,
      action: params.action,
      objectType: params.objectType || null,
      objectId: params.objectId || null,
      details: params.details || undefined,
      ipAddress: params.ipAddress || null,
    },
  });
}
