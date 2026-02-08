# Gunakan Node.js versi 20 (LTS) untuk menghindari error 'File is not defined'
FROM node:20

# Instal FFmpeg
RUN apt-get update && apt-get install -y ffmpeg

WORKDIR /app

# Salin package.json
COPY package.json ./

# Instal library
RUN npm install

# Salin semua file
COPY . .

# Jalankan bot
CMD ["node", "index.js"]
