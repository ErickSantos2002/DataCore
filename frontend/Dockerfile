# Etapa 1: build
FROM node:20-alpine AS builder

WORKDIR /app

# Copia os arquivos necessários
COPY package*.json ./
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY tailwind.config.js ./
COPY postcss.config.js ./
COPY . .

# Instala as dependências e compila o projeto
RUN npm install && npm run build

# Etapa 2: imagem final com Nginx
FROM nginx:alpine

# Remove config padrão e adiciona sua
COPY --from=builder /app/dist /usr/share/nginx/html

# Remove configuração padrão do Nginx
RUN rm /etc/nginx/conf.d/default.conf

# Adiciona sua configuração personalizada do Nginx
COPY traefik/nginx.conf /etc/nginx/conf.d/default.conf

# Exponha a porta padrão do Nginx
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
