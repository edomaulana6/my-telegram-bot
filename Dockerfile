# Gunakan image Node.js versi 18
FROM node:18

# Instal FFmpeg di dalam server
RUN apt-get update && apt-get install -y ffmpeg

# Tentukan folder kerja
WORKDIR /app

# Salin package.json
COPY package.json ./

# Instal library (tanpa perlu package-lock.json)
RUN npm install

# Salin semua kode bot ke server
COPY . .

# Jalankan bot
CMD ["node", "index.js"]
