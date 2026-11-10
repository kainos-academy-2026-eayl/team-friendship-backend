# downloads node
FROM node:22-alpine

# means cd /app inside the container
# sets the working directory inside the container to /app
WORKDIR /app

# copies package.json and package-lock.json to the working directory (install dependancies)
COPY package*.json ./

# installs depndancies (not husky)
RUN npm ci --ignore-scripts

# copies rest of applications
COPY . .                                                                                                                                                              

EXPOSE 3000

# Zscaler root CA is only trusted for the build step so Prisma can download its engines
RUN NODE_EXTRA_CA_CERTS=/app/certs/zscaler.pem npm run build

CMD ["npm", "start"]