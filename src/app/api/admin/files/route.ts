import { db } from "@/lib/db";
import { clientIp } from "@/lib/request";
import { audit } from "@/modules/audit";
import { getAdmin } from "@/modules/auth/session";
import { storage } from "@/modules/storage";
import { DOCX_MIME, testFillVersion } from "@/modules/templates/service";
import { getPdfConverter } from "@/modules/pdf";

/** Downloads do painel: uploads do cliente, documentos gerados, minutas e testes de preenchimento. */
export async function GET(req: Request) {
  const admin = await getAdmin();
  if (!admin) return new Response("Não autorizado", { status: 401 });
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const id = url.searchParams.get("id") ?? "";
  const ip = await clientIp();

  const send = (data: Buffer, type: string, name: string, inline = false) =>
    new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": type,
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${name.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
      },
    });

  try {
    if (kind === "upload") {
      const f = await db.caseFile.findUniqueOrThrow({ where: { id } });
      await audit({ actorType: "ADMIN", actorId: admin.id, ip, action: "admin.file_viewed", entityType: "Case", entityId: f.caseId, meta: { fileId: id } });
      return send(await storage.get(f.storageKey), f.mimeType, f.originalName, true);
    }
    if (kind === "pdf" || kind === "docx") {
      const d = await db.generatedDocument.findUniqueOrThrow({ where: { id }, include: { case: true } });
      await audit({ actorType: "ADMIN", actorId: admin.id, ip, action: `admin.document_viewed_${kind}`, entityType: "Case", entityId: d.caseId, meta: { documentId: id } });
      return kind === "pdf"
        ? send(await storage.get(d.pdfKey), "application/pdf", `Defesa_${d.case.reference}.pdf`, true)
        : send(await storage.get(d.docxKey), DOCX_MIME, `Defesa_${d.case.reference}.docx`);
    }
    if (kind === "template") {
      const v = await db.templateVersion.findUniqueOrThrow({ where: { id }, include: { template: true } });
      return send(await storage.get(v.storageKey), DOCX_MIME, `${v.template.code}_v${v.version}.docx`);
    }
    if (kind === "test-docx" || kind === "test-pdf") {
      const r = await testFillVersion(id);
      await audit({ actorType: "ADMIN", actorId: admin.id, ip, action: "template.test_fill", entityType: "Template", entityId: r.version.templateId, meta: { version: r.version.version, missing: r.missingRequired.length, unmapped: r.unmapped } });
      const name = `TESTE_${r.version.template.code}_v${r.version.version}`;
      if (kind === "test-docx") return send(r.buffer, DOCX_MIME, `${name}.docx`);
      return send(await getPdfConverter().docxToPdf(r.buffer), "application/pdf", `${name}.pdf`, true);
    }
  } catch (err) {
    console.error("[admin/files]", err);
    return new Response(err instanceof Error ? err.message : "Erro", { status: 404 });
  }
  return new Response("Pedido inválido", { status: 400 });
}
