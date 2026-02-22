FROM node:18-alpine

# Install tools yang dibutuhkan (Sangat Ringan)
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    py3-pip \
    && pip3 install --no-cache-dir yt-dlp

WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .

CMD ["node", "bot.js"]
