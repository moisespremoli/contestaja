import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);

export interface PdfConverter {
  docxToPdf(docx: Buffer): Promise<Buffer>;
}

/** LibreOffice headless. Cada conversão usa um perfil isolado para permitir concorrência. */
export function libreOfficeConverter(soffice = process.env.SOFFICE_PATH ?? "soffice"): PdfConverter {
  return {
    async docxToPdf(docx) {
      const dir = await mkdtemp(path.join(tmpdir(), "cj-pdf-"));
      try {
        const input = path.join(dir, "documento.docx");
        await writeFile(input, docx);
        await run(
          soffice,
          [
            `-env:UserInstallation=${pathToFileURL(path.join(dir, "profile")).href}`,
            "--headless",
            "--norestore",
            "--convert-to",
            "pdf:writer_pdf_Export",
            "--outdir",
            dir,
            input,
          ],
          { timeout: 120_000 },
        );
        return await readFile(path.join(dir, "documento.pdf"));
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  };
}

/** Gotenberg (https://gotenberg.dev) — recomendado em produção, num contentor separado. */
export function gotenbergConverter(baseUrl: string): PdfConverter {
  return {
    async docxToPdf(docx) {
      const form = new FormData();
      form.append("files", new Blob([new Uint8Array(docx)]), "documento.docx");
      const res = await fetch(`${baseUrl.replace(/\/$/, "")}/forms/libreoffice/convert`, { method: "POST", body: form });
      if (!res.ok) throw new Error(`Gotenberg respondeu ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    },
  };
}

export function getPdfConverter(): PdfConverter {
  if (process.env.PDF_CONVERTER === "gotenberg") {
    if (!process.env.GOTENBERG_URL) throw new Error("GOTENBERG_URL não definido");
    return gotenbergConverter(process.env.GOTENBERG_URL);
  }
  return libreOfficeConverter();
}
