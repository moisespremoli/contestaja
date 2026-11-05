import "server-only";
import { db } from "@/lib/db";
import type { ActorType } from "@/generated/prisma/client";

export interface AuditEntry {
  actorType: ActorType;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  meta?: Record<string, unknown>;
  ip?: string | null;
}

export async function audit(entry: AuditEntry) {
  try {
    await db.auditLog.create({
      data: {
        actorType: entry.actorType,
        actorId: entry.actorId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        meta: (entry.meta ?? undefined) as object | undefined,
        ip: entry.ip ?? null,
      },
    });
  } catch (err) {
    // O registo de auditoria nunca deve derrubar a operação principal.
    console.error("[audit] falha ao registar", entry.action, err);
  }
}
