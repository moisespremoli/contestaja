/**
 * Ativa o callback ifthenpay para cada método configurado (API /v2/callback/activation).
 * Requer IFTHENPAY_BACKOFFICE_KEY, IFTHENPAY_ANTI_PHISHING_KEY, APP_URL (https público) e as chaves dos métodos.
 *   npm run ifthenpay:callback
 */
import "dotenv/config";

const boKey = process.env.IFTHENPAY_BACKOFFICE_KEY;
const apKey = process.env.IFTHENPAY_ANTI_PHISHING_KEY;
const appUrl = process.env.APP_URL ?? "";
if (!boKey || !apKey || !appUrl.startsWith("https://")) {
  console.error("Defina IFTHENPAY_BACKOFFICE_KEY, IFTHENPAY_ANTI_PHISHING_KEY e APP_URL (https) no .env");
  process.exit(1);
}

const base = `${appUrl}/api/payments/ifthenpay/callback?key=[ANTI_PHISHING_KEY]`;
const targets = [
  { paymentMethod: "MB", paymentKey: process.env.IFTHENPAY_MB_KEY, urlCb: `${base}&orderId=[ORDER_ID]&amount=[AMOUNT]&requestId=[REQUEST_ID]&entity=[ENTITY]&reference=[REFERENCE]&payment_datetime=[PAYMENT_DATETIME]` },
  { paymentMethod: "MBWAY", paymentKey: process.env.IFTHENPAY_MBWAY_KEY, urlCb: `${base}&orderId=[ORDER_ID]&amount=[AMOUNT]&requestId=[REQUEST_ID]&payment_datetime=[PAYMENT_DATETIME]` },
  { paymentMethod: "CCARD", paymentKey: process.env.IFTHENPAY_CCARD_KEY, urlCb: `${base}&id=[ORDER_ID]&amount=[AMOUNT]&payment_datetime=[PAYMENT_DATETIME]&payment_method=[PAYMENT_METHOD]` },
];

async function main() {
  for (const t of targets) {
    if (!t.paymentKey) continue;
    const res = await fetch("https://api.ifthenpay.com/v2/callback/activation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ boKey, paymentMethod: t.paymentMethod, paymentKey: t.paymentKey, apKey, urlCb: t.urlCb }),
    });
    console.log(`${t.paymentMethod}: HTTP ${res.status} — ${await res.text()}`);
  }
}

main();
