import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { clientIp } from "@/lib/request";
import { audit } from "@/modules/audit";
import { verifyToken } from "@/modules/crypto";
import { storage } from "@/modules/storage";

/** Download através de link assinado e temporário. Cada acesso fica registado. */
export async function GET(_req: Request, ctx: RouteContext<"/api/download/[token]">) {
  const { token } = await ctx.params;
  const payload = verifyToken(env.downloadSigningSecret, token);
  if (!payload) return new Response("Link inválido ou expirado. Peça um novo na sua área do processo.", { status: 410 });

  const { d, k } = JSON.parse(payload) as { d: string; k: "pdf" | "docx" };
  const doc = await db.generatedDocument.findUnique({ where: { id: d }, include: { case: true } });
  if (!doc || doc.case.anonymizedAt) return new Response("Documento indisponível.", { status: 404 });

  const key = k === "docx" ? doc.docxKey : doc.pdfKey;
  let file: Buffer;
  try {
    file = await storage.get(key);
  } catch {
    return new Response("Documento indisponível.", { status: 404 });
  }
  await audit({ actorType: "CLIENT", ip: await clientIp(), action: `document.downloaded_${k}`, entityType: "Case", entityId: doc.caseId, meta: { documentId: doc.id } });

  const filename = `Defesa_${doc.case.reference}.${k}`;
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": k === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
