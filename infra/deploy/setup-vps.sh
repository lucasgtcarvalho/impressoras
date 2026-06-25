#!/bin/bash
set -e

# ============================================================
# PRINTMONITOR - SCRIPT DE SETUP PARA VPS ICP (Integrator Host)
# ============================================================
# Uso: chmod +x setup-vps.sh && ./setup-vps.sh
# ============================================================

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }
info() { echo -e "${BLUE}[i]${NC} $1"; }

echo ""
echo "=============================================="
echo "  PRINTMONITOR - SETUP VPS"
echo "  Stack: Node 20 + PostgreSQL 16 + Redis 7"
echo "=============================================="
echo ""

# ----------------------------
# 1. VARIÁVEIS DE CONFIGURAÇÃO
# ----------------------------
DOMAIN_API="${DOMAIN_API:-api.seudominio.com.br}"
DOMAIN_APP="${DOMAIN_APP:-app.seudominio.com.br}"
DB_PASSWORD="${DB_PASSWORD:-$(openssl rand -base64 32)}"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -base64 64)}"
JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-$(openssl rand -base64 64)}"
INSTALL_DIR="${INSTALL_DIR:-/var/www/impressora}"
GIT_REPO="${GIT_REPO:-}"  # Deixe vazio se já fez upload dos arquivos

# ----------------------------
# 2. VALIDAÇÃO
# ----------------------------
if [ "$EUID" -ne 0 ]; then
    err "Execute como root (use sudo su)"
    exit 1
fi

echo ""
info "Configurações:"
info "  Domínio API:       $DOMAIN_API"
info "  Domínio App:       $DOMAIN_APP"
info "  Diretório:         $INSTALL_DIR"
echo ""

# ----------------------------
# 3. INSTALAR DEPENDÊNCIAS DO SISTEMA
# ----------------------------
info "Instalando dependências do sistema..."
apt update && apt upgrade -y
apt install -y \
    curl \
    git \
    ufw \
    htop \
    nload \
    openssl \
    certbot \
    python3-certbot-nginx

# ----------------------------
# 4. INSTALAR DOCKER
# ----------------------------
if ! command -v docker &> /dev/null; then
    info "Instalando Docker..."
    curl -fsSL https://get.docker.com | bash
    systemctl enable docker
    systemctl start docker
    log "Docker instalado: $(docker --version)"
else
    log "Docker já instalado: $(docker --version)"
fi

# ----------------------------
# 5. INSTALAR DOCKER COMPOSE PLUGIN
# ----------------------------
if ! docker compose version &> /dev/null; then
    info "Instalando Docker Compose..."
    apt install -y docker-compose-plugin
    log "Docker Compose instalado: $(docker compose version)"
else
    log "Docker Compose já instalado: $(docker compose version)"
fi

# ----------------------------
# 6. CONFIGURAR FIREWALL
# ----------------------------
info "Configurando firewall..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
log "Firewall configurado (portas 22, 80, 443)"

# ----------------------------
# 7. CLONAR / COPIAR PROJETO
# ----------------------------
if [ ! -d "$INSTALL_DIR" ]; then
    mkdir -p "$INSTALL_DIR"
    if [ -n "$GIT_REPO" ]; then
        info "Clonando repositório..."
        git clone "$GIT_REPO" "$INSTALL_DIR"
    else
        warn "GIT_REPO não definido. Copie os arquivos manualmente para $INSTALL_DIR"
        warn "Exemplo: scp -r ./impressora/* root@SEU_IP:$INSTALL_DIR"
        mkdir -p "$INSTALL_DIR/backend" "$INSTALL_DIR/frontend" "$INSTALL_DIR/infra"
    fi
else
    log "Diretório $INSTALL_DIR já existe"
fi

cd "$INSTALL_DIR"

# ----------------------------
# 8. CRIAR ARQUIVOS DE CONFIGURAÇÃO
# ----------------------------
info "Criando arquivos de configuração..."

# .env da API
cat > "$INSTALL_DIR/backend/.env" << EOF
NODE_ENV=production
DATABASE_URL=postgresql://impressora:${DB_PASSWORD}@postgres:5432/impressora
REDIS_URL=redis://redis:6379
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_EXPIRATION=900
JWT_REFRESH_EXPIRATION=2592000
FRONTEND_URL=https://${DOMAIN_APP}
PORT=3000
EOF
log ".env da API criado"

# .env do Frontend
cat > "$INSTALL_DIR/frontend/.env.local" << EOF
NEXT_PUBLIC_API_URL=https://${DOMAIN_API}/api/v1
EOF
log ".env do Frontend criado"

# ----------------------------
# 9. CRIAR DOCKERFILE DO BACKEND
# ----------------------------
cat > "$INSTALL_DIR/backend/Dockerfile" << 'DOCKERFILE'
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
DOCKERFILE
log "Dockerfile do Backend criado"

# ----------------------------
# 10. CRIAR DOCKERFILE DO FRONTEND
# ----------------------------
cat > "$INSTALL_DIR/frontend/Dockerfile" << 'DOCKERFILE'
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3001
CMD ["npm", "start"]
DOCKERFILE
log "Dockerfile do Frontend criado"

# ----------------------------
# 11. CRIAR NGINX CONFIG
# ----------------------------
mkdir -p "$INSTALL_DIR/infra/docker/ssl"

cat > "$INSTALL_DIR/infra/docker/nginx.conf" << 'NGINX'
upstream api {
    server api:3000;
}

upstream frontend {
    server frontend:3001;
}

# Frontend (app.seudominio.com.br)
server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name _;

    ssl_certificate     /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    client_max_body_size 50M;

    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /_next/static {
        proxy_pass http://frontend;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }

    location /api/v1 {
        proxy_pass http://api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        proxy_connect_timeout 10s;
    }
}
NGINX
log "Nginx config criado"

# ----------------------------
# 12. CRIAR DOCKER COMPOSE DE PRODUÇÃO
# ----------------------------
cat > "$INSTALL_DIR/infra/docker/docker-compose.prod.yml" << 'COMPOSE'
version: "3.8"

services:
  postgres:
    image: postgres:16-alpine
    container_name: impressora-postgres
    environment:
      POSTGRES_DB: impressora
      POSTGRES_USER: impressora
      POSTGRES_PASSWORD: ${DB_PASSWORD:-impressora123}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: always
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U impressora"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: impressora-redis
    volumes:
      - redis_data:/data
    restart: always
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build:
      context: ../../backend
      dockerfile: Dockerfile
    container_name: impressora-api
    env_file: ../../backend/.env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: always

  frontend:
    build:
      context: ../../frontend
      dockerfile: Dockerfile
    container_name: impressora-frontend
    env_file: ../../frontend/.env.local
    depends_on:
      - api
    restart: always

  nginx:
    image: nginx:alpine
    container_name: impressora-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - api
      - frontend
    restart: always

volumes:
  postgres_data:
  redis_data:
COMPOSE
log "Docker Compose de produção criado"

# ----------------------------
# 13. GERAR SSL SELF-SIGNED TEMPORÁRIO
# ----------------------------
info "Gerando certificado SSL temporário..."
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$INSTALL_DIR/infra/docker/ssl/key.pem" \
    -out "$INSTALL_DIR/infra/docker/ssl/cert.pem" \
    -subj "/CN=$DOMAIN_APP" 2>/dev/null
log "SSL auto-assinado gerado (substitua pelo Certbot depois)"

# ----------------------------
# 14. BUILD E START DOS CONTAINERS
# ----------------------------
info "Fazendo build e subindo containers..."
cd "$INSTALL_DIR/infra/docker"

export DB_PASSWORD
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d

log "Containers rodando!"

# ----------------------------
# 15. EXECUTAR MIGRATIONS E SEED
# ----------------------------
info "Aguardando PostgreSQL ficar pronto..."
sleep 10

info "Executando migrations..."
docker compose -f docker-compose.prod.yml exec -T api npx prisma migrate deploy || {
    warn "Migration falhou. Tentando novamente em 10s..."
    sleep 10
    docker compose -f docker-compose.prod.yml exec -T api npx prisma migrate deploy
}

info "Populando dados iniciais (seed)..."
docker compose -f docker-compose.prod.yml exec -T api npx ts-node src/database/prisma/seed.ts || {
    warn "Seed falhou (pode ignorar se já foi executado antes)"
}

log "Migrations e seed concluídos!"

# ----------------------------
# 16. STATUS FINAL
# ----------------------------
echo ""
echo "=============================================="
echo -e "${GREEN}  SETUP CONCLUÍDO COM SUCESSO!${NC}"
echo "=============================================="
echo ""
echo -e "  Acesse: ${BLUE}https://$DOMAIN_APP${NC}"
echo -e "  API:    ${BLUE}https://$DOMAIN_API${NC}"
echo ""
echo -e "  ${YELLOW}Login padrão:${NC}"
echo "    E-mail: admin@impressora.io"
echo "    Senha:  admin123"
echo ""
echo -e "  ${YELLOW}Banco de dados:${NC}"
echo "    Usuário: impressora"
echo "    Senha:   $DB_PASSWORD"
echo ""
echo -e "  ${YELLOW}Comandos úteis:${NC}"
echo "    docker compose logs -f          # Ver logs"
echo "    docker compose ps               # Status"
echo "    docker compose restart api      # Reiniciar API"
echo "    docker compose down && docker compose up -d  # Rebuild total"
echo ""
echo -e "  ${YELLOW}SSL (substituir certificado auto-assinado):${NC}"
echo "    certbot --nginx -d $DOMAIN_API -d $DOMAIN_APP"
echo "    cp /etc/letsencrypt/live/$DOMAIN_APP/fullchain.pem infra/docker/ssl/cert.pem"
echo "    cp /etc/letsencrypt/live/$DOMAIN_APP/privkey.pem   infra/docker/ssl/key.pem"
echo "    docker compose restart nginx"
echo ""
echo "=============================================="
