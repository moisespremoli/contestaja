/**
 * Seed de desenvolvimento: admin inicial, categoria "Excesso de velocidade"
 * e duas minutas de TESTE (pessoa singular / pessoa coletiva).
 *   npm run db:seed
 */
import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { extractPlaceholders } from "../src/modules/docgen/engine";
import { TEST_MAPPINGS_PC, TEST_MAPPINGS_PS } from "../fixtures/test-mappings";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@contestaja.local";
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password || password.length < 10) throw new Error("Defina SEED_ADMIN_PASSWORD (mín. 10 caracteres) no .env");
  await db.adminUser.upsert({
    where: { email },
    update: {},
    create: { email, name: "Administrador", role: "ADMIN", passwordHash: await bcrypt.hash(password, 12) },
  });

  const category = await db.infractionCategory.upsert({
    where: { code: "EXCESSO_VELOCIDADE" },
    update: {},
    create: {
      code: "EXCESSO_VELOCIDADE",
      name: "Excesso de velocidade",
      description: "Contraordenações por excesso de velocidade.",
      defenseDeadlineDays: 15,
      priceCents: 2900,
    },
  });

  // Cupão de testes reais: 100% de desconto, conclui o pedido sem gateway.
  // `update: {}` — se for desativado/alterado no painel, o seed não o reativa.
  await db.coupon.upsert({
    where: { code: "CONTESTATESTE" },
    update: {},
    create: {
      code: "CONTESTATESTE",
      percentOff: 100,
      isTest: true,
      note: "Testes internos (100%). Desativar ou limitar antes da abertura ao público.",
    },
  });

  const templates = [
    {
      code: "TESTE-VEL-PS",
      internalName: "[TESTE] Excesso de velocidade — pessoa singular",
      applicantType: "SINGULAR" as const,
      file: "TESTE-VEL-PS.docx",
      mappings: TEST_MAPPINGS_PS,
    },
    {
      code: "TESTE-VEL-PC",
      internalName: "[TESTE] Excesso de velocidade — pessoa coletiva",
      applicantType: "COLETIVA" as const,
      file: "TESTE-VEL-PC.docx",
      mappings: TEST_MAPPINGS_PC,
    },
  ];

  for (const t of templates) {
    if (await db.template.findUnique({ where: { code: t.code } })) continue;
    const template = await db.template.create({
      data: {
        code: t.code,
        internalName: t.internalName,
        categoryId: category.id,
        applicantType: t.applicantType,
        processType: "DEFESA_ESCRITA",
        competentEntity: "Autoridade Nacional de Segurança Rodoviária [TESTE]",
        groundsSummary: "MINUTA DE TESTE — sem fundamentos jurídicos. Substituir pela minuta validada.",
        conditions: {
          all: [{ field: "requerente.tipo", op: "eq", value: t.applicantType }],
          any: [],
        },
        status: "ACTIVE",
        isTest: true,
      },
    });
    const buf = await readFile(path.resolve("fixtures/templates", t.file));
    const key = `templates/${template.id}/v1-seed.docx`;
    const full = path.resolve(process.env.STORAGE_DIR ?? "./storage", key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, buf, { mode: 0o600 });
    const version = await db.templateVersion.create({
      data: {
        templateId: template.id,
        version: 1,
        storageKey: key,
        originalFilename: t.file,
        sha256: createHash("sha256").update(buf).digest("hex"),
        placeholders: extractPlaceholders(buf) as unknown as object,
        notes: "Versão de teste gerada automaticamente.",
        mappings: { create: t.mappings.map((m) => ({ ...m, defaultValue: m.defaultValue ?? null })) },
      },
    });
    await db.template.update({ where: { id: template.id }, data: { currentVersionId: version.id } });
    console.log(`✓ minuta ${t.code} criada`);
  }
  console.log(`✓ admin: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
