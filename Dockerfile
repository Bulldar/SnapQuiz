FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server.js index.html ./
ENV NODE_ENV=production
EXPOSE 10000
CMD ["node", "server.js"]
