# ContestaJá

Plataforma portuguesa de preparação de contestações de multas por excesso de velocidade, construída
**exclusivamente** a partir de uma biblioteca privada de minutas jurídicas validadas.

O cliente preenche um formulário → o motor seleciona a minuta adequada → o cliente paga →
o sistema preenche o DOCX, converte para PDF e entrega-o por link seguro e email.

Arquitetura, modelo de dados, motores e plano por fases: [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## Requisitos

- Node.js 22+ (testado com 24)
- PostgreSQL 14+
- LibreOffice (conversão DOCX → PDF) — `brew install --cask libreoffice` — ou um servidor Gotenberg

## Arranque local

```bash
npm install
cp .env.example .env        # preencher DATABASE_URL e gerar os segredos (openssl rand -base64 32)
npx prisma migrate dev      # cria as tabelas
npm run templates:build     # gera as minutas DOCX de TESTE em fixtures/templates
npm run db:seed             # admin inicial + categoria + 2 minutas de TESTE
npm run dev
```

- Site: http://localhost:3000
- Formulário: http://localhost:3000/contestar
- Painel: http://localhost:3000/admin (credenciais `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` do `.env`)

Com `PAYMENT_PROVIDER=mock`, a área do processo mostra um link **[Desenvolvimento] Simular resposta do gateway**
que envia um webhook assinado, tal como um gateway real.

Sem `SMTP_URL`, os emails são gravados em `storage/outbox/*.eml`.

## Pagamentos ifthenpay

1. Pedir à ifthenpay as chaves MB KEY, MBWAY KEY e CCARD KEY (e chaves de teste para sandbox) e a BACKOFFICE KEY.
2. No `.env`: `PAYMENT_PROVIDER="ifthenpay"`, as chaves, uma `IFTHENPAY_ANTI_PHISHING_KEY` aleatória e `APP_URL` público em https.
3. Ativar os callbacks: `npm run ifthenpay:callback` (ou pedir à ifthenpay, indicando os URLs abaixo).

| Endpoint | Função |
|---|---|
| `GET /api/payments/ifthenpay/callback?key=[ANTI_PHISHING_KEY]&orderId=[ORDER_ID]&amount=[AMOUNT]&requestId=[REQUEST_ID]…` | Confirmação de pagamento (todos os métodos); valida chave anti-phishing e valor |
| `POST /api/payments/ifthenpay/notification` | Estado final MB WAY (pago/recusado/expirado), assinatura HMAC-SHA256 com a MB WAY Key |
| `GET /api/payments/ifthenpay/return` | Regresso do cliente após cartão; valida a assinatura `sk` |

Enquanto o cliente aguarda na página do processo, o estado MB WAY é também consultado ativamente.
Sandbox de cartão: 4012 0010 3714 1112 · CVC 212 · 12/27.

## Scripts

| Comando | Descrição |
|---|---|
| `npm test` | Testes unitários (validadores, motor de seleção, motor de preenchimento) |
| `npm run typecheck` | Verificação TypeScript |
| `npm run build` | Build de produção |
| `npm run db:seed` | Dados iniciais de desenvolvimento |
| `npm run ifthenpay:callback` | Ativa os callbacks ifthenpay |
| `npm run retention:purge` | Política RGPD de conservação/eliminação (agendar diariamente) |

## Minutas

- Marcadores: `{{NOME_COMPLETO}}`; parágrafos condicionais aprovados: `{{#CONDICAO}}…{{/CONDICAO}}`.
- No painel (**Minutas**): carregar DOCX → mapear cada marcador a um campo da plataforma → definir condições
  de utilização → **Testar (PDF)** com dados fictícios → tornar versão corrente → registar validação jurídica → ativar.
- Versões são imutáveis; uma versão já usada em processos não pode ter o mapeamento alterado.
- As minutas `TESTE-VEL-PS` / `TESTE-VEL-PC` são **apenas de teste** (sem fundamentos jurídicos). Desative-as
  antes de abrir o serviço ao público.

## Regras de negócio garantidas pelo código

- Nunca se usa uma minuta de pessoa singular num processo de pessoa coletiva (ou vice-versa) sem validação expressa no painel.
- Sem minuta compatível → nenhuma contestação genérica; o cliente é informado e não paga.
- Empate entre minutas → análise manual (nunca escolha arbitrária).
- O documento só é gerado após confirmação do pagamento via webhook autenticado.
- Os dados do processo são encriptados (AES-256-GCM); documentos em armazenamento privado; downloads por link assinado e temporário; acessos auditados.
