FROM node:20-alpine
WORKDIR /app
# Instal FFmpeg untuk penggabungan video & audio berkualitas tinggi
RUN apk add --no-cache ffmpeg
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 8000
# WAJIB: Flag ini untuk mengaktifkan fitur Reset RAM
CMD ["node", "--expose-gc", "index.js"]
