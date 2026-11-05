import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { clientIp, rateLimit } from "@/lib/request";
import { consentSchema } from "@/modules/cases/schema";
import { createCase, type UploadedFile } from "@/modules/cases/service";
import { caseCreatedEmail, sendMail } from "@/modules/email";
import { env } from "@/lib/env";

const MAX_FILE = 10 * 1024 * 1024;
const ACCEPT = new Set(["application/pdf", "image/jpeg", "image/png"]);

/** Assinaturas mágicas — não confiar apenas no Content-Type do browser. */
function sniff(buf: Buffer): string | null {
  if (buf.subarray(0, 4).toString() === "%PDF") return "application/pdf";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  return null;
}

async function readFiles(form: FormData): Promise<UploadedFile[] | string> {
  const out: UploadedFile[] = [];
  const entries: [UploadedFile["kind"], FormDataEntryValue][] = [
    ...form.getAll("notificacao").slice(0, 1).map((v) => ["NOTIFICATION", v] as [UploadedFile["kind"], FormDataEntryValue]),
    ...form.getAll("documentos").slice(0, 5).map((v) => ["SUPPORTING", v] as [UploadedFile["kind"], FormDataEntryValue]),
  ];
  for (const [kind, v] of entries) {
    if (!(v instanceof File) || v.size === 0) continue;
    if (v.size > MAX_FILE) return "Cada ficheiro pode ter no máximo 10 MB.";
    const data = Buffer.from(await v.arrayBuffer());
    const type = sniff(data);
    if (!type || !ACCEPT.has(type)) return "Apenas são aceites ficheiros PDF, JPG ou PNG.";
    out.push({ kind, name: v.name, type, data });
  }
  return out;
}

export async function POST(req: Request) {
  const ip = await clientIp();
  if (!rateLimit(`cases:${ip}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Demasiados pedidos. Tente mais tarde." }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const consent = consentSchema.safeParse(JSON.parse(String(form.get("consent") ?? "{}")));
  if (!consent.success) return NextResponse.json({ error: "É necessário aceitar os termos, a privacidade e os avisos." }, { status: 400 });

  const files = await readFiles(form);
  if (typeof files === "string") return NextResponse.json({ error: files }, { status: 400 });

  try {
    const data = JSON.parse(String(form.get("data") ?? "{}"));
    const { case: created, token } = await createCase(data, files, { type: "CLIENT", ip });
    const link = `${env.appUrl}/p/${token}`;
    sendMail({ to: created.email, ...caseCreatedEmail({ reference: created.reference, link }) }).catch((e) =>
      console.error("[email] falha ao enviar confirmação", e),
    );
    return NextResponse.json({ token, reference: created.reference });
  } catch (err) {
    if (err instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const i of err.issues) fieldErrors[i.path.join(".")] ??= i.message;
      return NextResponse.json({ error: "Existem dados inválidos. Reveja o formulário.", fieldErrors }, { status: 422 });
    }
    console.error("[api/cases]", err);
    return NextResponse.json({ error: "Não foi possível criar o processo." }, { status: 500 });
  }
}
