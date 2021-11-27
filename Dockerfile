FROM node:17-alpine
LABEL maintainer="feature86@gmx.net"

RUN apk add --update --no-cache ffmpeg exiftool bash curl

# Node heap size 6gb (for mono repo build)
ENV NODE_OPTIONS="--max-old-space-size=6144"


RUN mkdir /hls
WORKDIR /hls

COPY . /hls

RUN yarn install
RUN yarn global add pm2

EXPOSE 5000

CMD yarn start
