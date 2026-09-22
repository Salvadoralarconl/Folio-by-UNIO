FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends libreoffice-calc fonts-liberation && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY converter.mjs /app/converter.mjs
EXPOSE 1422
CMD ["node","/app/converter.mjs"]
