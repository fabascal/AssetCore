# TLS / HTTPS for AssetCore nginx

## Option A: Let's Encrypt (certbot on host)

1. Point DNS `A` record for your domain to the VPS IP.
2. Start stack with HTTP only (port 80) first:

```bash
cp .env.prod.example .env.prod
# Edit .env.prod with secrets and DOMAIN
docker compose -f docker-compose.prod.yml up -d --build
```

3. Install certbot on the host and obtain certificates:

```bash
sudo apt install certbot
sudo certbot certonly --standalone -d assetcore.example.com
```

4. Copy or symlink certs into [`certs/`](certs/) (mounted as `/etc/letsencrypt` in nginx):

```bash
mkdir -p infra/nginx/certs/live/assetcore.example.com
sudo cp /etc/letsencrypt/live/assetcore.example.com/fullchain.pem infra/nginx/certs/live/assetcore.example.com/
sudo cp /etc/letsencrypt/live/assetcore.example.com/privkey.pem infra/nginx/certs/live/assetcore.example.com/
```

5. Uncomment the HTTPS `server` block in [`assetcore.conf`](assetcore.conf) and the HTTP→HTTPS redirect.
6. Rebuild nginx: `docker compose -f docker-compose.prod.yml up -d --build nginx`

Renewal: add a cron job for `certbot renew` and reload nginx after copy.

## Option B: Custom certificates

Place `fullchain.pem` and `privkey.pem` under `infra/nginx/certs/live/<domain>/` and enable the HTTPS block in `assetcore.conf`.

## Verify

```bash
curl -I https://assetcore.example.com/api/health
```

Expect `200` with JSON `{"status":"ok","db":"ok"}`.
