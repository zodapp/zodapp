# AWS（ECS Fargate）で動かすサーバーのイメージ。中身は `pnpm build:server` の出力だけ。
# Docker Hub の回数の制限を避けるため、ECR Public の公式イメージを使う
FROM public.ecr.aws/docker/library/node:22-slim
WORKDIR /app
COPY dist-server/ ./
ENV NODE_ENV=production
EXPOSE 4000
USER node
CMD ["node", "--enable-source-maps", "main.mjs"]
