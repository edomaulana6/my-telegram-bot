FROM node:18-bullseye

# Update System & Install Python (Wajib untuk yt-dlp)
RUN apt-get update && apt-get install -y python3 python3-pip curl ffmpeg && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Download yt-dlp versi TERBARU langsung dari source resmi
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app
COPY package.json .
RUN npm install
COPY . .

# Jalankan dengan expose-gc untuk fitur Riset RAM 1 Menit
CMD ["node", "--expose-gc", "--max-old-space-size=450", "index.js"]
