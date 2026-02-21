# Gunakan base image Node.js versi 18
FROM node:18

# 1. Instal FFmpeg secara sistem (WAJIB untuk proses upscale/merge)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# 2. Tentukan direktori kerja
WORKDIR /app

# 3. Salin package.json DAN package-lock.json (jika ada)
COPY package*.json ./

# 4. Jalankan instalasi modul (Ini yang akan menghilangkan error 'module not found')
RUN npm install

# 5. Salin seluruh sisa file proyek (termasuk index.js)
COPY . .

# 6. Jalankan aplikasi
CMD ["npm", "start"]
