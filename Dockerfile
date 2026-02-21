FROM node:20-bullseye

# Instalasi FFmpeg terbaru untuk video jernih & bersuara
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .

# Buka port 8000 untuk Health Check Koyeb
EXPOSE 8000

CMD ["node", "index.js"]
