FROM node:16

# Install FFmpeg
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package.json dan package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy kode aplikasi
COPY . .

# Expose port
EXPOSE 3000

# Jalankan aplikasi
CMD ["node", "index.js"]
