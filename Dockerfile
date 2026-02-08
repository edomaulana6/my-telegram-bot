# Gunakan Node.js versi 20 yang stabil
FROM node:20

# Update sistem dan instal FFmpeg, Python, dan Curl
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Instal yt-dlp versi terbaru langsung dari sumbernya
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
RUN chmod a+rx /usr/local/bin/yt-dlp

# Set direktori kerja
WORKDIR /app

# Salin file package.json dan instal dependensi
COPY package.json ./
RUN npm install

# Salin seluruh kode bot
COPY . .

# Jalankan bot
CMD ["node", "index.js"]
