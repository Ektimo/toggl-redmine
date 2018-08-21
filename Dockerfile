FROM node:8
WORKDIR /app
COPY package.json /app

RUN npm install

COPY tsconfig.json /app
COPY src /app/src
COPY typings /app/typings

COPY config.json /app

RUN npm run build

CMD node ./built/main.js syncCron
