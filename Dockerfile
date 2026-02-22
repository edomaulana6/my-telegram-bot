# Gunakan Alpine Linux sebagai base image paling ringan di dunia (Hanya ~5MB)
FROM node:18-alpine

# Install dependencies sistem (FFmpeg dan Python3)
# --no-cache memastikan tidak ada file sampah installer yang tersisa di image
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    py3-pip \
    && pip3 install --no-cache-dir --break-system-packages yt-dlp

# Tentukan direktori kerja di dalam kontainer
WORKDIR /app

# Salin package.json terlebih dahulu untuk efisiensi caching layer Docker
COPY package*.json ./

# Install hanya library produksi (menghindari devDependencies yang berat)
RUN npm install --production

# Salin seluruh kode (bot.js, dll) ke dalam kontainer
COPY . .

# Jalankan bot menggunakan node
CMD ["node", "bot.js"]
