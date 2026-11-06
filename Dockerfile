# Imagem de produção: Next.js + LibreOffice (conversão DOCX → PDF)
FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends libreoffice-writer-nogui fonts-liberation fonts-dejavu-core ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .
# Durante o build não há base de dados: páginas que a consultam têm alternativa.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate \
  && DATABASE_URL="postgresql://build:build@localhost:5432/build" npm run build

ENV NODE_ENV=production \
    SOFFICE_PATH=/usr/bin/soffice \
    STORAGE_DIR=/data/storage \
    PORT=3000
EXPOSE 3000

# Migrações e dados iniciais (idempotente) antes de arrancar.
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts && npx next start -H 0.0.0.0 -p ${PORT:-3000}"]
