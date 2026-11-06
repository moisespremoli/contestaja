import "server-only";
import { db } from "@/lib/db";
import { audit } from "@/modules/audit";
import { buildContext } from "@/modules/cases/derive";
import { caseDataSchema } from "@/modules/cases/schema";
import { randomToken, sha256 } from "@/modules/crypto";
import { extractPlaceholders, fillDocx, type Placeholder } from "@/modules/docgen/engine";
import { storage } from "@/modules/storage";
import { sampleData } from "./sample";

export { sampleData };

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Carrega uma nova versão DOCX. Não a torna corrente — isso exige teste e ação expressa. */
export async function addTemplateVersion(templateId: string, file: { name: string; data: Buffer }, notes: string | null, adminId: string) {
  const placeholders = extractPlaceholders(file.data);
  const last = await db.templateVersion.findFirst({
    where: { templateId },
    orderBy: { version: "desc" },
    include: { mappings: true },
  });
  const version = (last?.version ?? 0) + 1;
  const key = `templates/${templateId}/v${version}-${randomToken(6)}.docx`;
  await storage.put(key, file.data);

  const created = await db.templateVersion.create({
    data: {
      templateId,
      version,
      storageKey: key,
      originalFilename: file.name,
      sha256: sha256(file.data),
      placeholders: placeholders as unknown as object,
      notes,
      createdById: adminId,
    },
  });

  // Reaproveita mapeamentos da versão anterior para marcadores que se mantêm.
  if (last) {
    const names = new Set(placeholders.map((p) => p.name));
    const carry = last.mappings.filter((m) => names.has(m.placeholder));
    if (carry.length) {
      await db.templateFieldMapping.createMany({
        data: carry.map((m) => ({
          templateVersionId: created.id,
          placeholder: m.placeholder,
          sourcePath: m.sourcePath,
          format: m.format,
          required: m.required,
          defaultValue: m.defaultValue,
        })),
      });
    }
  }
  await audit({ actorType: "ADMIN", actorId: adminId, action: "template.version_uploaded", entityType: "Template", entityId: templateId, meta: { version, sha256: created.sha256, placeholders: placeholders.length } });
  return created;
}

export async function versionReadiness(versionId: string) {
  const v = await db.templateVersion.findUniqueOrThrow({ where: { id: versionId }, include: { mappings: true } });
  const placeholders = v.placeholders as unknown as Placeholder[];
  const mapped = new Set(v.mappings.map((m) => m.placeholder));
  const unmapped = placeholders.filter((p) => !mapped.has(p.name)).map((p) => p.name);
  return { ready: unmapped.length === 0, unmapped };
}

export async function makeVersionCurrent(templateId: string, versionId: string, adminId: string) {
  const v = await db.templateVersion.findUniqueOrThrow({ where: { id: versionId } });
  if (v.templateId !== templateId) throw new Error("Versão não pertence a esta minuta");
  const { ready, unmapped } = await versionReadiness(versionId);
  if (!ready) throw new Error(`Existem marcadores sem mapeamento: ${unmapped.join(", ")}`);
  await db.template.update({ where: { id: templateId }, data: { currentVersionId: versionId } });
  await audit({ actorType: "ADMIN", actorId: adminId, action: "template.version_current", entityType: "Template", entityId: templateId, meta: { version: v.version } });
}

export async function testFillVersion(versionId: string) {
  const v = await db.templateVersion.findUniqueOrThrow({
    where: { id: versionId },
    include: { mappings: true, template: { include: { category: true } } },
  });
  const data = caseDataSchema.parse(sampleData(v.template.applicantType, v.template.category.code));
  const ctx = {
    ...buildContext(data, { defenseDeadlineDays: v.template.category.defenseDeadlineDays }),
    minuta: { entidade_competente: v.template.competentEntity, codigo: v.template.code, versao: v.version },
  };
  const original = await storage.get(v.storageKey);
  return { ...fillDocx(original, v.mappings, ctx), version: v };
}
