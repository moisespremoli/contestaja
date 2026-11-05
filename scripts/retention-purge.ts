/**
 * Política de conservação (RGPD): anonimiza processos cujo prazo de conservação expirou
 * e processos abandonados (sem pagamento) com mais de RETENTION_DAYS dias.
 * Agendar diariamente (cron):  npm run retention:purge
 */
import "dotenv/config";
import { rm } from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { encryptJson } from "../src/modules/crypto";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const days = Number(process.env.RETENTION_DAYS ?? "180");
const root = path.resolve(process.env.STORAGE_DIR ?? "./storage");

async function main() {
  const cutoff = new Date(Date.now() - days * 864e5);
  const cases = await db.case.findMany({
    where: {
      anonymizedAt: null,
      OR: [
        { retentionUntil: { lt: new Date() } },
        { retentionUntil: null, createdAt: { lt: cutoff }, payments: { none: { status: "CONFIRMED" } } },
      ],
    },
    select: { id: true, reference: true },
  });
  for (const c of cases) {
    await rm(path.join(root, "cases", c.id), { recursive: true, force: true });
    await db.caseFile.deleteMany({ where: { caseId: c.id } });
    await db.case.update({
      where: { id: c.id },
      data: { dataEnc: encryptJson({ anonymized: true }), displayName: "[anonimizado]", email: "anonimizado@invalid", anonymizedAt: new Date() },
    });
    await db.auditLog.create({ data: { actorType: "SYSTEM", action: "case.anonymized_retention", entityType: "Case", entityId: c.id } });
    console.log("anonimizado", c.reference);
  }
  console.log(`${cases.length} processo(s) anonimizado(s).`);
}

main().finally(() => db.$disconnect());
