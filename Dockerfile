FROM node:22-alpine AS build

COPY kainos-zscaler.crt /usr/local/share/ca-certificates/kainos-zscaler.crt
RUN cat /usr/local/share/ca-certificates/kainos-zscaler.crt >> /etc/ssl/certs/ca-certificates.crt \
    && apk add --no-cache ca-certificates \
    && update-ca-certificates
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/kainos-zscaler.crt

WORKDIR /app

COPY . .

ENV HUSKY=0

RUN npm ci && npm run build && npm prune --omit=dev

FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV HUSKY=0
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/kainos-zscaler.crt

COPY --from=build /usr/local/share/ca-certificates/kainos-zscaler.crt /usr/local/share/ca-certificates/kainos-zscaler.crt
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]