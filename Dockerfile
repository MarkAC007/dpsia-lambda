FROM node:20-alpine

WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy bundled server
COPY dist/server.js ./

ENV NODE_ENV=production
ENV PORT=3000
ENV SECRETS_BACKEND=env

EXPOSE 3000

CMD ["node", "server.js"]
