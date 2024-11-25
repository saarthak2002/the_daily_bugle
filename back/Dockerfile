FROM node:latest
WORKDIR /app
COPY package.json package.json
COPY package-lock.json package-lock.json
RUN npm install
COPY server.js .
CMD ["node", "server.js"]
EXPOSE 3010
