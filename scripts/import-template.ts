/**
 * Importa uma minuta (DOCX + metadados + mapeamentos) a partir de um ficheiro JSON de especificação.
 * Alternativa em linha de comandos ao painel admin. A minuta é criada INATIVA (ou recebe nova versão,
 * que não fica corrente) — a ativação faz-se no painel, após teste e registo da validação jurídica.
 *
 *   npm run template:import -- minutas-privadas/IDC-PS-01.json [--current]
 * Com --current a nova versão passa a corrente (a minuta mantém o estado ativo/inativo).
 */
import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { extractPlaceholders, type FieldMapping } from "../src/modules/docgen/engine";

interface Spec {
  docx: string;
  categoryCode: string;
  code: string;
  internalName: string;
  applicantType: "SINGULAR" | "COLETIVA";
  processType: string;
  competentEntity: string;
  groundsSummary?: string;
  priority?: number;
  requiresReview?: boolean;
  conditions: { all: unknown[]; any?: unknown[] };
  mappings: FieldMapping[];
  notes?: string;
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const specPath = process.argv[2];
  if (!specPath) throw new Error("Indique o ficheiro de especificação JSON");
  const spec = JSON.parse(await readFile(specPath, "utf8")) as Spec;
  const buf = await readFile(path.resolve(path.dirname(specPath), spec.docx));

  const placeholders = extractPlaceholders(buf);
  const mapped = new Set(spec.mappings.map((m) => m.placeholder));
  const unmapped = placeholders.filter((p) => !mapped.has(p.name)).map((p) => p.name);
  const unknown = [...mapped].filter((m) => !placeholders.some((p) => p.name === m));
  if (unmapped.length || unknown.length) {
    throw new Error(`Mapeamento incompleto. Sem mapeamento: [${unmapped}] · Inexistentes no DOCX: [${unknown}]`);
  }

  const category = await db.infractionCategory.findUniqueOrThrow({ where: { code: spec.categoryCode } });
  const meta = {
    internalName: spec.internalName,
    categoryId: category.id,
    applicantType: spec.applicantType,
    processType: spec.processType,
    competentEntity: spec.competentEntity,
    groundsSummary: spec.groundsSummary ?? null,
    priority: spec.priority ?? 0,
    requiresReview: spec.requiresReview ?? false,
    conditions: { all: spec.conditions.all, any: spec.conditions.any ?? [] } as object,
  };
  const existing = await db.template.findUnique({ where: { code: spec.code } });
  const template = existing
    ? await db.template.update({ where: { id: existing.id }, data: meta })
    : await db.template.create({ data: { ...meta, code: spec.code, status: "INACTIVE", isTest: false } });

  const last = await db.templateVersion.findFirst({ where: { templateId: template.id }, orderBy: { version: "desc" } });
  const sha256 = createHash("sha256").update(buf).digest("hex");
  if (last?.sha256 === sha256) {
    console.log(`= ${spec.code}: DOCX idêntico à v${last.version}; apenas metadados atualizados.`);
    return;
  }
  const version = (last?.version ?? 0) + 1;
  const key = `templates/${template.id}/v${version}-${randomBytes(4).toString("hex")}.docx`;
  const full = path.resolve(process.env.STORAGE_DIR ?? "./storage", key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, buf, { mode: 0o600 });

  const created = await db.templateVersion.create({
    data: {
      templateId: template.id,
      version,
      storageKey: key,
      originalFilename: path.basename(spec.docx),
      sha256,
      placeholders: placeholders as unknown as object,
      notes: spec.notes ?? "Importada por script.",
      mappings: { create: spec.mappings.map((m) => ({ ...m, defaultValue: m.defaultValue ?? null })) },
    },
  });
  if (!template.currentVersionId || process.argv.includes("--current")) await db.template.update({ where: { id: template.id }, data: { currentVersionId: created.id } });
  await db.auditLog.create({
    data: { actorType: "SYSTEM", action: "template.imported", entityType: "Template", entityId: template.id, meta: { code: spec.code, version, sha256 } },
  });
  console.log(`✓ ${spec.code} v${version} importada (${placeholders.length} marcadores). Estado: ${template.status}.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
