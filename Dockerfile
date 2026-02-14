# Gunakan Node.js versi 20
FROM node:20-slim

# Install FFMPEG dan Python
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    python-is-python3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp secara global
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install library node
RUN npm install

# Copy semua file bot
COPY . .

# Port Koyeb
EXPOSE 8000

# Jalankan bot
CMD ["node", "index.js"]
