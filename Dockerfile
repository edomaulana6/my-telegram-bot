# Menggunakan Node.js versi 18 slim sebagai base
FROM node:18-slim

# Install dependencies sistem yang diperlukan
# Python3 & Pip untuk yt-dlp, FFmpeg untuk pengolahan video
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-full \
    ffmpeg \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp secara resmi melalui github release
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Set direktori kerja di dalam container
WORKDIR /app

# Copy daftar library terlebih dahulu (untuk optimasi cache)
COPY package*.json ./

# Install hanya library produksi (hemat space)
RUN npm install --production

# Copy seluruh file project ke dalam container
COPY . .

# Expose port untuk Health Check Koyeb (Default 8000)
EXPOSE 8000

# Perintah menjalankan bot
CMD ["node", "index.js"]
