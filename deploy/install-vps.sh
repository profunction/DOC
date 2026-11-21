#!/usr/bin/env bash
# 安心照顾：一台 VPS 装齐手表服务器（Traccar）+ 推送（ntfy）+ 本系统（可选）。
# 用法（Ubuntu 22.04 / 24.04，以 root 运行）：
#   curl -fsSL https://raw.githubusercontent.com/profunction/doc/claude/new-session-1skmg3/deploy/install-vps.sh -o install.sh
#   bash install.sh care.你的域名.com   # 域名要先指向这台机器的 IP
set -euo pipefail
DOMAIN="${1:-}"
[ -z "$DOMAIN" ] && { echo "用法: bash install.sh 你的域名"; exit 1; }
echo "== 1/5 安装 Docker"
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh
echo "== 2/5 下载代码"
apt-get install -y git >/dev/null 2>&1 || true
[ -d /opt/anxin ] || git clone -b claude/new-session-1skmg3 https://github.com/profunction/doc /opt/anxin
cd /opt/anxin
echo "== 3/5 生成密钥"
if [ ! -f .env ]; then
  cat > .env <<ENV
JWT_SECRET=$(openssl rand -hex 32)
DATA_KEY=$(openssl rand -hex 32)
TRACCAR_KEY=$(openssl rand -hex 16)
NTFY_TOPIC=anxin-$(openssl rand -hex 6)
NTFY_BASE_URL=https://$DOMAIN/ntfy
HOTLINE_PHONE=60123456789
SEED_DEMO=0
ADMIN_PHONE=0123456789
ADMIN_PASSWORD=$(openssl rand -hex 6)
ENV
  echo "已生成 .env，协调员初始密码见 /opt/anxin/.env 的 ADMIN_PASSWORD"
fi
TK=$(grep ^TRACCAR_KEY .env | cut -d= -f2)
sed -i "s|TRACCAR_KEY_请与.env一致|$TK|g" deploy/traccar.xml
echo "== 4/5 启动"
docker compose -f docker-compose.yml -f docker-compose.stack.yml up -d --build
echo "== 5/5 HTTPS（Caddy）"
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl >/dev/null
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg 2>/dev/null || true
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
apt-get update >/dev/null && apt-get install -y caddy >/dev/null
cat > /etc/caddy/Caddyfile <<CADDY
$DOMAIN {
    handle_path /ntfy/* { reverse_proxy localhost:8090 }
    handle_path /traccar/* { reverse_proxy localhost:8082 }
    handle { reverse_proxy localhost:8787 }
}
CADDY
systemctl restart caddy
echo
echo "完成！"
echo "  网站 / App 后端：https://$DOMAIN"
echo "  Traccar 后台：   https://$DOMAIN/traccar   （首次 admin / admin，请马上改密码）"
echo "  手表服务器地址： $DOMAIN  端口 5093（watch 协议），其他品牌见 Traccar 端口表"
echo "  ntfy 主题：      $(grep ^NTFY_TOPIC .env | cut -d= -f2)"
echo "  协调员账号：     $(grep ^ADMIN_PHONE .env | cut -d= -f2) / $(grep ^ADMIN_PASSWORD .env | cut -d= -f2)"
