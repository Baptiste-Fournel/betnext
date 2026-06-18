# syntax=docker/dockerfile:1
#
# Image du BACK BetNext (NestJS). Une SEULE image sert les DEUX services Railway :
#   - API     : `node dist/main.js`          (commande par défaut, ci-dessous)
#   - worker  : `node dist/pricing.main.js`   (surcharge la start command du service worker)
# Les migrations TypeORM sont jouées AU BOOT de l'API (PersistenceModule, migrationsRun:true) :
# aucune release command séparée n'est requise. Railway injecte les variables d'env (PORT, etc.)
# que l'app lit via process.env — pas de --env-file.

# ---- builder : compile le TypeScript en dist/ ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# ---- runtime : dépendances de prod + dist compilé ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist

# Port HTTP de l'API (Railway injecte PORT ; l'app l'écoute, défaut 3000). Le worker n'écoute pas.
EXPOSE 3000
CMD ["node", "dist/main.js"]
