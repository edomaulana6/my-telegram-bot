FROM node:18-bullseye

# Install Python3, FFMPEG, dan buat simbolik link 'python'
RUN apt-get update && apt-get install -y python3 python3-pip curl ffmpeg && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Download yt-dlp TERBARU
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app
COPY package.json .
RUN npm install
COPY . .

CMD ["node", "--expose-gc", "--max-old-space-size=450", "index.js"]
