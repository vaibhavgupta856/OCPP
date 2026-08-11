# Massive Mobility Charging Simulator — production image
FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json* ./
COPY client/package.json client/package-lock.json* ./client/

RUN npm install && npm install --prefix client

COPY . .

RUN npm run build

# --- runtime ---
FROM node:20-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY server ./server
COPY --from=build /app/client/dist ./client/dist

EXPOSE 8787

CMD ["node", "server/index.js"]
