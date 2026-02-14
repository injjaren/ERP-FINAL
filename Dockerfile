FROM node:18-alpine

RUN apk add --no-cache sqlite curl

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

RUN mkdir -p database logs backups

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
