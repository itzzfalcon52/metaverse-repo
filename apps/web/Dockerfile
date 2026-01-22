FROM node:20-alpine

WORKDIR /app

COPY . .
COPY ../../packages ./packages

RUN npm install
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
