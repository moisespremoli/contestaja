# ContestaJá — Arquitetura e plano de implementação

> Plataforma de preparação de contestações de contraordenações rodoviárias (Portugal),
> construída **exclusivamente** a partir de uma biblioteca privada de minutas jurídicas
> validadas. A plataforma **não redige** fundamentos jurídicos: seleciona, preenche e converte.

---

## 1. Análise da arquitetura proposta

| Decisão | Escolha | Motivo |
|---|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript | Um único deploy com site público, área do cliente, admin e API. |
| Base de dados | PostgreSQL + Prisma 7 (`@prisma/adapter-pg`) | Relacional, JSONB para condições/dados dinâmicos, migrações versionadas. |
| UI | Tailwind CSS v4 | Design system leve, mobile-first. |
| Preenchimento DOCX | `docxtemplater` + `pizzip` | Substitui `{{MARCADORES}}` preservando estilos, cabeçalhos, rodapés, numeração; suporta secções condicionais. |
| DOCX → PDF | LibreOffice headless (local) ou Gotenberg (HTTP, produção em contentor) | Fidelidade de layout muito superior a conversores HTML. |
| Pagamentos | Interface `PaymentProvider` + provider `mock` (dev). Adaptador real a plugar (easypay / ifthenpay / Eupago / SIBS) | MB WAY, Multibanco e cartão são todos suportados por estes gateways PT. |
| Email | Nodemailer (SMTP) com fallback para ficheiros `.eml` em dev | Independente de fornecedor (Postmark, SES, Brevo, Resend via SMTP). |
| Armazenamento | Interface `Storage` com implementação em disco privado (`storage/`, fora de `public/`) | Substituível por S3/R2 com URLs assinadas. |
| Autenticação admin | Email + password (bcrypt) + sessão JWT em cookie `httpOnly` (jose) | Sem dependências externas; papéis `ADMIN` / `OPERADOR`. |
| Acesso do cliente | Token aleatório (256 bits) por processo, guardado em hash | Cliente não precisa de conta; link privado. |
| IA | Não utilizada na v1. Ponto de extensão previsto apenas para *interpretação* (ex.: OCR do auto) — nunca para gerar texto jurídico. | Requisito de negócio. |

### Separação de módulos

```
Website público  ─┐
Aplicação cliente ─┼─► Server Actions / Route Handlers ─► Módulos de domínio (src/modules/*)
Painel admin     ─┘                                       ├─ selection  (motor de seleção)
                                                          ├─ docgen     (motor de preenchimento DOCX)
                                                          ├─ pdf        (conversão)
                                                          ├─ payments   (gateway)
                                                          ├─ cases      (orquestração/estados)
                                                          ├─ storage, email, audit, crypto
```

Os módulos de domínio **não importam nada de React/Next** — são testáveis isoladamente (Vitest).

## 2. Estrutura de pastas

```
prisma/
  schema.prisma            modelos
  seed.ts                  admin inicial, categoria, minutas de TESTE
scripts/
  build-test-templates.ts  gera os DOCX de teste (claramente identificados)
  retention-purge.ts       política de conservação/eliminação RGPD
fixtures/templates/        DOCX de teste gerados
storage/                   (git-ignored) ficheiros privados: minutas, uploads, documentos
src/
  app/
    (public)/              landing, privacidade, termos
    contestar/             formulário multi-etapa
    p/[token]/             área privada do processo (estado, pagamento, download)
    admin/                 painel administrativo (protegido por proxy.ts + verificação no servidor)
    api/                   webhooks de pagamento, downloads assinados, uploads
  components/              UI partilhada
  modules/
    fields/catalog.ts      catálogo de campos da plataforma (fonte para o mapeamento)
    cases/                 schema zod do formulário, criação, transições de estado
    selection/             motor de seleção de minutas
    docgen/                motor de preenchimento DOCX
    pdf/                   conversores
    payments/              providers
    storage/ email/ audit/ crypto/ auth/
  generated/prisma         cliente Prisma (gerado)
```

## 3. Modelo de dados (resumo)

- **AdminUser** — utilizadores do painel (`ADMIN`, `OPERADOR`).
- **InfractionCategory** — categorias de infração (v1: `EXCESSO_VELOCIDADE`). Novas categorias = novo registo, sem código.
- **Template** (minuta) — código, nome interno, categoria, **tipo de requerente** (`SINGULAR`/`COLETIVA`), tipo de processo, entidade competente, fundamentos aplicáveis (descritivo), **condições de utilização** (JSON de regras), prioridade, estado, `isTest`, `requiresReview`, validação jurídica (quem/quando), versão corrente.
- **TemplateVersion** — ficheiro DOCX original (hash SHA-256), número de versão, marcadores detetados, notas. Versões são imutáveis.
- **TemplateFieldMapping** — por versão: `{{MARCADOR}}` → caminho da plataforma (`requerente.nome`), formato (texto, data por extenso, hora, maiúsculas…), obrigatório, valor por omissão.
- **Case** (processo) — referência pública, estado, categoria, tipo de requerente, **dados do formulário encriptados (AES-256-GCM)**, nome/email para listagem, versão de minuta selecionada, rasto da seleção, consentimentos, data-limite de conservação, hash do token de acesso.
- **CaseFile** — uploads (notificação, documentos complementares).
- **Payment** — provider, método, valor, estado, referências (entidade/referência MB), payload bruto.
- **GeneratedDocument** — DOCX e PDF gerados, versão da minuta usada, hash, campos em falta.
- **AuditLog** — histórico de operações (cliente, admin, sistema), incluindo acessos a documentos.

Estados do processo: `FORM_STARTED → FORM_COMPLETED → AWAITING_PAYMENT → PAYMENT_CONFIRMED → (AWAITING_REVIEW) → DOCUMENT_GENERATED → DELIVERED`, ou `REJECTED_NO_TEMPLATE`.

## 4. Motor de seleção de minutas

Entrada: dados normalizados do processo (`categoria`, `requerente.tipo`, papel do requerente face ao veículo, condutor identificado, entidade autuante, local, velocidades…).

1. **Filtro rígido**: minutas `ACTIVE`, da mesma categoria, **com o mesmo tipo de requerente** e com versão corrente. Nunca há fallback entre singular/coletiva.
2. **Legitimidade processual** (regras explícitas, configuráveis por condição): o requerente tem de ser o titular, o condutor ou o representante legal da entidade titular; caso contrário → análise manual.
3. **Condições da minuta**: JSON `{ "all": [ { "field": "...", "op": "eq|neq|in|gt|gte|lt|lte|exists|notExists", "value": ... } ], "any": [...] }` avaliado sobre os dados do processo.
4. **Desempate**: maior `priority`. Se houver empate no topo → **ambiguidade → análise manual** (nunca escolhe aleatoriamente).
5. Resultado: `SELECTED` | `NO_TEMPLATE` | `AMBIGUOUS` | `LEGITIMACY_ISSUE`, com rasto completo (cada minuta avaliada e o motivo da exclusão) guardado no processo.

Alteração manual pelo admin é possível, mas exige confirmação explícita e fica registada no `AuditLog`; uma minuta de outro tipo de requerente exige uma segunda confirmação expressa.

## 5. Motor de preenchimento DOCX

1. Carrega o DOCX original da versão (imutável).
2. Constrói o contexto a partir dos **mapeamentos** (`{{NOME_COMPLETO}}` ← `requerente.nome`), aplicando formatadores (`date_long` → "5 de novembro de 2026", `time`, `upper`, `nif`, …).
3. Variáveis booleanas derivadas (catálogo `flags.*`) controlam **parágrafos condicionais previamente aprovados**: `{{#CONDUTOR_DIFERENTE}}…{{/CONDUTOR_DIFERENTE}}`. O texto desses parágrafos vive na minuta — o sistema apenas o inclui/exclui.
4. `docxtemplater` substitui em corpo, cabeçalhos e rodapés, preservando estilos, numeração e campos de paginação.
5. Validação: marcadores obrigatórios vazios ou marcadores sem mapeamento ⇒ geração bloqueada com lista dos campos em falta.
6. O DOCX final e o PDF são guardados com hash; a versão da minuta usada fica ligada ao documento.

## 6. Integrações externas

| Integração | Dev | Produção |
|---|---|---|
| PostgreSQL | local (Homebrew) | gerido (Neon, Supabase, RDS, Railway) |
| Conversão PDF | LibreOffice local (`soffice`) | Gotenberg em contentor ou LibreOffice na imagem |
| Pagamentos | `mock` com página de simulação | easypay / ifthenpay / Eupago / SIBS (MB WAY, Multibanco, cartão) via webhook assinado |
| Email | ficheiros `.eml` em `storage/outbox` | SMTP transacional |
| Armazenamento | disco privado | S3/R2 com encriptação em repouso |

## 7. Plano por fases

| Fase | Conteúdo | Estado |
|---|---|---|
| 0 | Fundações: projeto, Prisma, schema, seed, módulos de crypto/storage/audit | ✅ |
| 1 | Motores de seleção e preenchimento + testes unitários + minutas de TESTE | ✅ |
| 2 | Landing page, formulário multi-etapa (singular/coletiva, titular/condutor), uploads, consentimentos | ✅ |
| 3 | Pagamento (provider mock + interface), webhook, geração DOCX→PDF, links seguros, email | ✅ |
| 4 | Painel admin: login, dashboard, processos, minutas (upload, versões, mapeamento, teste), auditoria | ✅ |
| 5 | Gateway de pagamento real, SMTP real, S3, deploy | a seguir |
| 6 | Minutas reais validadas, revisão jurídica do fluxo, testes E2E, hardening (rate-limit, CSP) | a seguir |
| 7 | Novas categorias (estacionamento, álcool, telemóvel…) — apenas dados + minutas | futuro |

## Regras jurídicas codificadas

- Nenhuma página promete anulação ou sucesso.
- O cliente confirma, antes de pagar, que vai verificar os dados, que a assinatura e apresentação são da sua responsabilidade e que os prazos devem ser confirmados.
- O PDF não contém assinatura; contém linha para assinatura manual.
- A plataforma não submete nada em nome do cliente.
- Minutas marcadas `isTest` mostram aviso "MINUTA DE TESTE" e não devem ser ativadas em produção (o painel avisa).
