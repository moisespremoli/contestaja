import "server-only";
import { db } from "@/lib/db";
import { audit } from "@/modules/audit";
import { buildContext } from "@/modules/cases/derive";
import { caseDataSchema, type CaseDataInput } from "@/modules/cases/schema";
import { randomToken, sha256 } from "@/modules/crypto";
import { extractPlaceholders, fillDocx, type Placeholder } from "@/modules/docgen/engine";
import { storage } from "@/modules/storage";

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

/** Dados fictícios para testar o preenchimento antes de disponibilizar a minuta. */
export function sampleData(applicantType: "SINGULAR" | "COLETIVA", categoryCode: string): CaseDataInput {
  const base: CaseDataInput = {
    categoria: categoryCode,
    requerente: {
      tipo: "SINGULAR",
      nome: "Nome Fictício de Teste",
      nif: "123456789",
      doc_tipo: "CC",
      doc_numero: "00000000 0 ZZ0",
      doc_emitente: "República Portuguesa",
      morada: "Rua Fictícia, n.º 1",
      codigo_postal: "1000-001",
      localidade: "Lisboa",
      email: "teste@example.com",
      telefone: "910000000",
    },
    veiculo: { matricula: "AA-00-AA", marca_modelo: "Marca Modelo" },
    titular: { e_requerente: true },
    condutor: {
      identificacao: "OUTRA_PESSOA",
      nome: "Condutor Fictício",
      nif: "123456789",
      morada: "Rua do Condutor Fictício, n.º 2, 3000-001 Coimbra",
      doc_tipo: "CC",
      doc_numero: "11111111 1 ZZ1",
      doc_emitente: "República Portuguesa",
      carta_conducao: "C-000000 0",
    },
    infracao: {
      numero_auto: "000000000",
      data: "2026-01-15",
      hora: "10:45",
      local: "Local de teste",
      tipo_via: "FORA_LOCALIDADE",
      meio_detecao: "RADAR_FIXO",
      velocidade_maxima: 90,
      velocidade_registada: 112,
      velocidade_considerada: 106,
      entidade_autuante: "GNR",
      data_notificacao: "2026-02-01",
      data_rececao: "2026-02-05",
      np: "NP-000000",
      entidade_numero: "000000000",
      entidade_morada: "Morada Fictícia da Entidade, n.º 1",
      entidade_codigo_postal: "2000-001",
      entidade_localidade: "Localidade Fictícia",
    },
    adicional: { descricao: "Descrição fictícia apresentada pelo cliente.", observacoes: "Observação fictícia." },
  };
  if (applicantType === "COLETIVA") {
    return {
      ...base,
      requerente: {
        tipo: "COLETIVA",
        denominacao: "Empresa Fictícia de Teste, Lda.",
        nipc: "503504564",
        morada: "Avenida Fictícia, n.º 10",
        codigo_postal: "4000-001",
        localidade: "Porto",
        email: "empresa@example.com",
        telefone: "220000000",
      },
      representante: { nome: "Representante Fictício", nif: "123456789", cargo: "Gerente" },
    };
  }
  return base;
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
