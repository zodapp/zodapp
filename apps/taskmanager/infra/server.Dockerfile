# AWS（ECS Fargate）で動かすサーバーのイメージ。中身は `pnpm build:server` の出力だけ。
FROM node:22-slim
WORKDIR /app
COPY dist-server/ ./
ENV NODE_ENV=production
EXPOSE 4000
USER node
CMD ["node", "--enable-source-maps", "main.mjs"]
