FROM node:18-alpine

# Set UTF-8 locale so all system calls, SQLite I/O, and native modules
# default to UTF-8. Required for correct Arabic text handling.
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8
ENV DOCKER=true

RUN apk add --no-cache sqlite curl icu-data-full

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

RUN mkdir -p database logs backups

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
