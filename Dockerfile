# Menggunakan Node.js versi LTS yang stabil
FROM node:18-slim

# Install FFmpeg dan dependencies sistem
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set direktori kerja
WORKDIR /app

# Copy package.json dan install library
COPY package*.json ./
RUN npm install --production

# Copy seluruh kode sumber
COPY . .

# Port sesuai dengan yang ada di kode Node.js (8000)
EXPOSE 8000

# Jalankan bot
CMD ["node", "index.js"]
