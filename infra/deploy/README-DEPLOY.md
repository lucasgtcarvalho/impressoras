# Manual de Deploy — PrintMonitor na VPS ICP (Integrator Host)

## Requisitos

- VPS ICP contratada (4 vCPU, 6 GB RAM, 100 GB NVMe)
- Domínios: `api.seudominio.com.br` e `app.seudominio.com.br`
- Acesso SSH ao servidor

---

## Método 1: Deploy Automático (Recomendado)

Execute o script único que faz tudo:

```bash
# Acessar o VPS via SSH
ssh root@SEU_IP

# Baixar e executar o script de setup
curl -sSL https://raw.githubusercontent.com/SEU_USUARIO/impressora/main/infra/deploy/setup-vps.sh | bash
```

Ou manualmente:

```bash
# Upload dos arquivos para o VPS
scp -r ./impressora/* root@SEU_IP:/var/www/impressora/

# Acessar o VPS
ssh root@SEU_IP

# Executar setup
cd /var/www/impressora/infra/deploy
chmod +x setup-vps.sh

# Configurar variáveis (opcional)
export DOMAIN_API=api.seudominio.com.br
export DOMAIN_APP=app.seudominio.com.br

# Rodar
./setup-vps.sh
```

---

## Método 2: Deploy Manual (Passo a Passo)

### 2.1 Acessar o VPS

```bash
ssh root@SEU_IP
```

### 2.2 Instalar Docker e dependências

```bash
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | bash
apt install -y docker-compose-plugin git ufw

# Firewall
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

### 2.3 Enviar os arquivos do projeto

No **seu computador local**:

```bash
# Faça o upload de toda a pasta do projeto
scp -r ./impressora/* root@SEU_IP:/var/www/impressora/
```

### 2.4 Configurar ambiente

```bash
cd /var/www/impressora

# Gerar senhas seguras
DB_PASS=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 64)
JWT_REFRESH=$(openssl rand -base64 64)

# API .env
cat > backend/.env << EOF
NODE_ENV=production
DATABASE_URL=postgresql://impressora:${DB_PASS}@postgres:5432/impressora
REDIS_URL=redis://redis:6379
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH}
JWT_EXPIRATION=900
JWT_REFRESH_EXPIRATION=2592000
FRONTEND_URL=https://app.seudominio.com.br
PORT=3000
EOF

# Frontend .env
cat > frontend/.env.local << EOF
NEXT_PUBLIC_API_URL=https://api.seudominio.com.br/api/v1
EOF
```

### 2.5 Gerar certificado SSL temporário

```bash
mkdir -p infra/docker/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout infra/docker/ssl/key.pem \
  -out infra/docker/ssl/cert.pem \
  -subj "/CN=app.seudominio.com.br"
```

### 2.6 Subir os containers

```bash
cd /var/www/impressora/infra/docker
export DB_PASSWORD=$DB_PASS
docker compose -f docker-compose.prod.yml up -d --build
```

### 2.7 Rodar migrations e seed

```bash
# Aguardar banco ficar pronto
sleep 10

# Migrations
docker compose -f docker-compose.prod.yml exec -T api npx prisma migrate deploy

# Seed (dados iniciais)
docker compose -f docker-compose.prod.yml exec -T api npx ts-node src/database/prisma/seed.ts
```

### 2.8 Configurar SSL real (Certbot)

```bash
# Instalar Certbot
apt install -y certbot python3-certbot-nginx

# Substituir o nginx.conf temporário pelo de produção, ou já usar o Criado
# Garantir que server_name está correto no nginx.conf

# Gerar certificado REAL
certbot certonly --standalone -d api.seudominio.com.br -d app.seudominio.com.br

# Copiar certificados
cp /etc/letsencrypt/live/app.seudominio.com.br/fullchain.pem infra/docker/ssl/cert.pem
cp /etc/letsencrypt/live/app.seudominio.com.br/privkey.pem infra/docker/ssl/key.pem

# Reiniciar nginx
docker compose -f docker-compose.prod.yml restart nginx

# Auto-renovação (já vem configurada no Certbot)
certbot renew --dry-run
```

---

## Gerenciamento

### Logs

```bash
cd /var/www/impressora/infra/docker
docker compose logs -f          # Todos os serviços
docker compose logs -f api      # Apenas API
docker compose logs -f nginx    # Apenas Nginx
```

### Atualizar código

```bash
cd /var/www/impressora
git pull                              # Se estiver usando git
# OU faça upload manual dos novos arquivos

cd infra/docker
docker compose -f docker-compose.prod.yml up -d --build
```

### Backup do banco

```bash
# Backup
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U impressora impressora > backup_$(date +%Y%m%d_%H%M).sql

# Restore
cat backup.sql | docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U impressora impressora
```

### Parar tudo

```bash
cd /var/www/impressora/infra/docker
docker compose -f docker-compose.prod.yml down
```

---

## Solução de Problemas

| Problema | Causa | Solução |
|----------|-------|---------|
| API não sobe | Migration pendente | Executar `docker compose exec api npx prisma migrate deploy` |
| 502 Bad Gateway | API não responde | Verificar `docker compose logs api` |
| SSL inválido | Certificado auto-assinado | Rodar `certbot` conforme seção 2.8 |
| Porta já em uso | Apache/Nginx do sistema | `systemctl stop apache2 nginx` |
| Banco não conecta | DB_PASSWORD diferente | Verificar `.env` da API e `docker-compose.prod.yml` |

---

## Acesso Inicial

Após o deploy, acesse:

- **URL:** `https://app.seudominio.com.br`
- **E-mail:** `admin@impressora.io`
- **Senha:** `admin123`

> **IMPORTANTE:** Altere a senha do admin após o primeiro login!
