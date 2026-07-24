#!/bin/bash
# WebSocket 升级部署脚本
# 用途：配置 Nginx 反向代理 + SSL 证书

set -e

DOMAIN="a-stock.xyz"
SERVER_IP="47.122.115.203"

echo "========================================="
echo "WebSocket 升级部署脚本"
echo "========================================="
echo ""

# Step 1: 检查 DNS 解析
echo "Step 1: 检查 DNS 解析..."
PING_RESULT=$(ping -c 1 $DOMAIN 2>&1 || true)
if echo "$PING_RESULT" | grep -q "$SERVER_IP"; then
    echo "✅ DNS 解析正确：$DOMAIN → $SERVER_IP"
else
    echo "❌ DNS 解析失败或未指向 $SERVER_IP"
    echo "请先在阿里云域名控制台添加 DNS 记录："
    echo "  类型：A"
    echo "  主机记录：@"
    echo "  记录值：$SERVER_IP"
    exit 1
fi
echo ""

# Step 2: 安装 certbot（如果未安装）
echo "Step 2: 检查 certbot..."
if ! command -v certbot &> /dev/null; then
    echo "安装 certbot..."
    sudo apt update
    sudo apt install -y certbot python3-certbot-nginx
    echo "✅ certbot 安装完成"
else
    echo "✅ certbot 已安装"
fi
echo ""

# Step 3: 申请 SSL 证书
echo "Step 3: 申请 SSL 证书..."
sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN --redirect
echo "✅ SSL 证书申请完成"
echo ""

# Step 4: 配置 Nginx 反向代理
echo "Step 4: 配置 Nginx 反向代理..."
NGINX_CONFIG="/etc/nginx/sites-available/a-stock-analysis"

# 备份现有配置
if [ -f "$NGINX_CONFIG" ]; then
    sudo cp "$NGINX_CONFIG" "${NGINX_CONFIG}.backup.$(date +%Y%m%d%H%M%S)"
    echo "✅ 已备份现有配置"
fi

# 创建新配置
sudo tee "$NGINX_CONFIG" > /dev/null <<'EOF'
# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name a-stock.xyz;
    return 301 https://$server_name$request_uri;
}

# HTTPS 服务器
server {
    listen 443 ssl http2;
    server_name a-stock.xyz;

    # SSL 证书
    ssl_certificate /etc/letsencrypt/live/a-stock.xyz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/a-stock.xyz/privkey.pem;
    
    # SSL 优化配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Next.js 应用（端口 3000）
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket 代理（量化实时服务，端口 8889）
    location /ws {
        proxy_pass http://localhost:8889;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket 长连接超时设置（24 小时）
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # 量化实时服务 HTTP API
    location /api/quant-live/ {
        proxy_pass http://localhost:8889/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

echo "✅ Nginx 配置已更新"
echo ""

# Step 5: 测试并重载 Nginx
echo "Step 5: 测试并重载 Nginx..."
sudo nginx -t
if [ $? -eq 0 ]; then
    sudo systemctl reload nginx
    echo "✅ Nginx 重载成功"
else
    echo "❌ Nginx 配置测试失败，请检查配置"
    exit 1
fi
echo ""

# Step 6: 验证 WebSocket 连接
echo "Step 6: 验证服务..."
echo "访问 https://$DOMAIN 测试网站"
echo "WebSocket 地址：wss://$DOMAIN/ws"
echo ""

echo "========================================="
echo "✅ 部署完成！"
echo "========================================="
echo ""
echo "下一步："
echo "1. 访问 https://$DOMAIN 测试网站"
echo "2. 打开浏览器开发者工具，检查 WebSocket 连接"
echo "3. 如果一切正常，量化实时账户功能将启用 WebSocket 推送"
echo ""
echo "证书自动续期："
echo "certbot 已配置自动续期，无需手动操作"
echo ""
