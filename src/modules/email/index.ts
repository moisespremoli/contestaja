import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";
import { env } from "@/lib/env";

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Envia via SMTP; sem SMTP_URL grava o email em storage/outbox (desenvolvimento). */
export async function sendMail(mail: Mail) {
  if (env.smtpUrl) {
    const transport = nodemailer.createTransport(env.smtpUrl);
    await transport.sendMail({ from: env.emailFrom, ...mail });
    return;
  }
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "unix" });
  const info = await transport.sendMail({ from: env.emailFrom, ...mail });
  const dir = path.resolve(env.storageDir, "outbox");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}.eml`);
  await writeFile(file, info.message as Buffer);
  console.info(`[email] (dev) "${mail.subject}" para ${mail.to} gravado em ${file}`);
}

const shell = (title: string, body: string) => `<!doctype html><html lang="pt"><body style="margin:0;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;padding:32px">
<tr><td style="font-size:18px;font-weight:bold;color:#0b1f3a">ContestaJá</td></tr>
<tr><td style="padding-top:16px;font-size:20px;font-weight:bold">${title}</td></tr>
<tr><td style="padding-top:12px;font-size:15px;line-height:1.6">${body}</td></tr>
<tr><td style="padding-top:24px;font-size:12px;color:#64748b;line-height:1.5">
Este documento é uma minuta personalizada preparada com base nos dados que nos forneceu. Verifique todos os dados antes de assinar.
A apresentação da defesa e o cumprimento dos prazos legais são da sua responsabilidade. A preparação do documento não garante o deferimento da defesa.
</td></tr></table></td></tr></table></body></html>`;

export function documentReadyEmail(opts: { reference: string; link: string; expiresHours: number }): Omit<Mail, "to"> {
  return {
    subject: `O seu documento está pronto — processo ${opts.reference}`,
    text: `O documento do processo ${opts.reference} está pronto.\n\nDescarregue-o em: ${opts.link}\n(link válido durante ${opts.expiresHours} horas; depois pode pedir um novo na sua área do processo).\n\nVerifique todos os dados, imprima, assine e apresente dentro do prazo legal.`,
    html: shell(
      "O seu documento está pronto",
      `<p>O documento do processo <b>${opts.reference}</b> foi gerado.</p>
       <p><a href="${opts.link}" style="display:inline-block;background:#0b1f3a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Descarregar PDF</a></p>
       <p style="font-size:13px;color:#475569">Link válido durante ${opts.expiresHours} horas. Depois pode obter um novo na sua área do processo.</p>
       <p><b>Próximos passos:</b> confirme todos os dados, imprima, assine e apresente a defesa à entidade indicada, dentro do prazo legal.</p>`,
    ),
  };
}

export function caseCreatedEmail(opts: { reference: string; link: string }): Omit<Mail, "to"> {
  return {
    subject: `Processo ${opts.reference} criado`,
    text: `Criámos o seu processo ${opts.reference}. Acompanhe-o em: ${opts.link}`,
    html: shell(
      "Processo criado",
      `<p>Recebemos os dados do seu processo <b>${opts.reference}</b>.</p>
       <p>Pode acompanhar o estado e concluir o pagamento na sua área privada:</p>
       <p><a href="${opts.link}" style="color:#0b1f3a">${opts.link}</a></p>
       <p style="font-size:13px;color:#475569">Guarde este link — é pessoal e dá acesso ao seu processo.</p>`,
    ),
  };
}
