FROM node:18-alpine

WORKDIR /app

# 先複製 package.json 進行安裝以利用 Docker 快取
COPY server/package*.json ./server/
RUN cd server && npm install

# 複製其餘檔案
COPY . .

EXPOSE 3000

CMD ["node", "server/server.js"]
