FROM node:20-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json ./
RUN npm install --omit=dev
COPY server.js ./
COPY public ./public
RUN mkdir -p /data && chown -R node:node /app /data
USER node
ENV PORT=3000
ENV DATABASE_PATH=/data/store.sqlite
EXPOSE 3000
CMD ["npm","start"]
