import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente em falta: ${name}`);
  return value;
}

export const env = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get appUrl() {
    return process.env.APP_URL ?? "http://localhost:3000";
  },
  get dataEncryptionKey() {
    return required("DATA_ENCRYPTION_KEY");
  },
  get sessionSecret() {
    return required("SESSION_SECRET");
  },
  get downloadSigningSecret() {
    return required("DOWNLOAD_SIGNING_SECRET");
  },
  get paymentWebhookSecret() {
    return required("PAYMENT_WEBHOOK_SECRET");
  },
  get storageDir() {
    return process.env.STORAGE_DIR ?? "./storage";
  },
  get pdfConverter() {
    return process.env.PDF_CONVERTER ?? "libreoffice";
  },
  get sofficePath() {
    return process.env.SOFFICE_PATH ?? "soffice";
  },
  get gotenbergUrl() {
    return process.env.GOTENBERG_URL ?? "";
  },
  get paymentProvider() {
    return process.env.PAYMENT_PROVIDER ?? "mock";
  },
  get smtpUrl() {
    return process.env.SMTP_URL ?? "";
  },
  get emailFrom() {
    return process.env.EMAIL_FROM ?? "ContestaJá <nao-responder@contestaja.pt>";
  },
  get retentionDays() {
    return Number(process.env.RETENTION_DAYS ?? "180");
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
};
