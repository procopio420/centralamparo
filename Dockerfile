FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json server.js ./
COPY public ./public
COPY docs/auditoria-rj143 ./docs/auditoria-rj143
ENV NODE_ENV=production
CMD ["node", "server.js"]
