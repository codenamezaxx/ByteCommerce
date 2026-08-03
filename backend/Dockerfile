# PLACEHOLDER: refine to multi-stage in P10.1
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 5000

CMD ["node", "server.js"]
