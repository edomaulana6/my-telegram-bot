# Menggunakan Node.js versi ringan (Alpine Linux)
FROM node:20-alpine

# Instalasi tools esensial dalam satu baris (agar cepat)
RUN apk add --no-cache python3 ffmpeg curl

WORKDIR /app

# Copy daftar belanjaan saja dulu (pemanfaatan cache)
COPY package.json ./

# Instalasi tanpa membuat file sampah
RUN npm install --production && npm cache clean --force

# Baru copy sisa kode (index.js)
COPY . .

# Jalankan mesin Luna
CMD ["node", "index.js"]
