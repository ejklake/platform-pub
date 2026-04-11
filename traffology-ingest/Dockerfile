FROM node:20-alpine
WORKDIR /app
COPY tsconfig.base.json ./
COPY shared/ shared/
COPY traffology-ingest/ traffology-ingest/
RUN cd shared && npm install && cd ../traffology-ingest && npm install
RUN ln -sf /app/shared /app/traffology-ingest/shared
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
RUN chown -R app:app /app
USER app
EXPOSE 3005
CMD ["./traffology-ingest/node_modules/.bin/tsx", "traffology-ingest/src/index.ts"]
