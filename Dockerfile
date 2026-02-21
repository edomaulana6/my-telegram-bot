# Menggunakan Node.js versi 18 berbasis Debian Bullseye agar FFmpeg stabil
FROM node:18-bullseye

# 1. Update sistem dan Instal FFmpeg untuk proses Upscale & Merge
# Ini sangat krusial agar perintah spawn('ffmpeg') tidak error
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# 2. Tentukan direktori kerja di dalam server
WORKDIR /app

# 3. Salin konfigurasi package untuk instalasi library
COPY package*.json ./

# 4. Instal semua library (telegraf, ytdl-core, axios)
RUN npm install --production

# 5. Salin kode utama (index.js) dan file lainnya ke dalam server
COPY . .

# 6. Jalankan bot dengan perintah start
CMD ["node", "index.js"]
