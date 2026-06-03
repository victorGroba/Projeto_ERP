# 🚀 Deploy na VPS (Docker + Cloudflare)

Guia para subir o **C.A. BI Dashboard** na sua VPS Ubuntu com Docker, atrás do Cloudflare.
O app roda em **container único**: o backend Express serve a API **e** o frontend buildado na mesma origem (sem CORS, sem nginx separado).

---

## 1. Pré-requisitos na VPS

- Docker + Docker Compose instalados (você já tem)
- Um subdomínio no Cloudflare apontando pra VPS, ex: `bi.suaempresa.com.br`

---

## 2. Enviar o projeto para a VPS

Opção A — via git (recomendado):
```bash
git clone <seu-repositorio> ca-bi-dashboard
cd ca-bi-dashboard
```

Opção B — via scp (se não usa git):
```bash
# do seu PC, na pasta do projeto:
scp -r . usuario@IP_DA_VPS:/home/usuario/ca-bi-dashboard
```

> ⚠️ O `.env` **não** vai pelo git (está no `.gitignore`). Veja o passo 3.

---

## 3. Configurar o `.env`

Na VPS, dentro da pasta do projeto:
```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Preencha:
- `JWT_SECRET` → gere um forte: `openssl rand -hex 32`
- `CONTA_AZUL_CLIENT_ID_RJ` e `CONTA_AZUL_CLIENT_SECRET_RJ` → do portal de dev da Conta Azul
- Os tokens (`ACCESS_TOKEN`/`REFRESH_TOKEN`) pode deixar **vazios** — você conecta depois pela tela de Configurações.

No `docker-compose.yml`, ajuste o admin inicial:
```yaml
- ADMIN_EMAIL=seu-email@empresa.com.br
- ADMIN_PASSWORD=uma-senha-forte
```

---

## 4. Subir o container

```bash
docker compose up -d --build
```

Acompanhe os logs:
```bash
docker compose logs -f
```
Você deve ver: `🚀 API rodando na porta 3001` e `📦 Servindo frontend estático`.

Teste local na VPS:
```bash
curl http://localhost:3001/api/health
# {"status":"ok",...}
```

---

## 5. Expor pelo Cloudflare

No painel do Cloudflare → **DNS**:
- Adicione um registro **A**: `bi` → IP da VPS (proxy laranja ligado ✅)

No seu reverse proxy da VPS (Traefik/Nginx que você já usa pros outros projetos),
aponte `bi.suaempresa.com.br` → `localhost:3001` (ou a rede do container).

Exemplo Nginx:
```nginx
server {
    server_name bi.suaempresa.com.br;
    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

O SSL é resolvido pelo Cloudflare (modo **Full**). Não precisa de Certbot se o Cloudflare estiver com proxy ligado.

---

## 6. Primeiro acesso

1. Acesse `https://bi.suaempresa.com.br`
2. Login com o `ADMIN_EMAIL` / `ADMIN_PASSWORD` definidos no compose
3. Vá em **Configurações → Reconectar Conta Azul** e faça o fluxo OAuth
4. Vá em **Importação CSV → Carga Completa (2 anos)** para puxar os dados

---

## 7. Atualizar o app (deploys futuros)

```bash
git pull            # ou reenvie os arquivos
docker compose up -d --build
```

Os dados (SQLite) ficam no volume `ca-bi-data` e **não se perdem** entre deploys.

---

## Comandos úteis

```bash
docker compose ps                       # status
docker compose logs -f                  # logs ao vivo
docker compose restart                  # reinicia
docker compose down                     # para (mantém o volume/dados)
docker exec -it ca-bi-dashboard sh      # shell dentro do container
```

---

## Observações importantes

- **Tokens da Conta Azul:** o app é de *desenvolvimento* no portal, então o refresh token expira em alguns dias. Quando isso acontecer, é só reconectar pela tela de **Configurações**. Para uso permanente sem reconectar, solicite a **promoção do app para produção** no portal da Conta Azul.
- **Banco:** SQLite em volume. Os dados são 100% re-sincronizáveis da API, então mesmo perdendo o volume, um "Carga Completa" reconstrói tudo.
- **Backup simples:** `docker run --rm -v ca-bi-data:/data -v $(pwd):/backup alpine tar czf /backup/bi-backup.tar.gz /data`
