FROM node:20-alpine
WORKDIR /app
# FFmpeg wajib untuk menyatukan stream audio/video publik
RUN apk add --no-cache ffmpeg
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 8000
# Flag --expose-gc wajib agar Reset RAM 1 Menit berfungsi
CMD ["node", "--expose-gc", "index.js"]
