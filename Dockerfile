FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim
ENV NODE_ENV=production PORT=10000 DSE_DATA_DIR=/var/data
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/src/lib/knowledge-numbering.js ./src/lib/knowledge-numbering.js
COPY --from=build /app/src/lib/avatar-catalog.js ./src/lib/avatar-catalog.js
COPY --from=build /app/src/lib/textbook-downloads.json ./src/lib/textbook-downloads.json
COPY --from=build /app/src/lib/profile-review.js ./src/lib/profile-review.js
COPY --from=build /app/src/lib/mistake-analysis.js ./src/lib/mistake-analysis.js
COPY --from=build /app/assets/textbook-exercises ./assets/textbook-exercises
COPY --from=build /app/downloads/catalog.json ./downloads/catalog.json
COPY --from=build /app/site-data.js /app/textbook-data.js /app/knowledge-network-data.js /app/paper2-knowledge-data.js /app/statistics-data.js ./
COPY --from=build /app/text-papers ./text-papers
RUN mkdir -p /var/data && chown node:node /var/data
USER node
EXPOSE 10000
CMD ["node", "server/production.mjs"]
