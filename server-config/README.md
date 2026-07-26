# 服务器配置说明

本文档说明如何在服务器（47.122.115.203）上配置 systemd 服务和健康检查。

## 快速开始

### 1. 复制配置文件到服务器

```bash
# 从本地复制（或直接在服务器上创建）
scp server-config/* root@47.122.115.203:/var/www/a-stock-analysis/scripts/
```

### 2. 配置 systemd 服务

```bash
# 复制服务文件到 systemd 目录
sudo cp /var/www/a-stock-analysis/scripts/a-stock-analysis.service /etc/systemd/system/

# 重新加载 systemd
sudo systemctl daemon-reload

# 启用开机自启
sudo systemctl enable a-stock-analysis

# 启动服务
sudo systemctl start a-stock-analysis

# 查看状态
sudo systemctl status a-stock-analysis

# 查看日志
sudo journalctl -u a-stock-analysis -f
```

### 3. 配置健康检查

```bash
# 赋予执行权限
chmod +x /var/www/a-stock-analysis/scripts/health-check.sh

# 创建日志目录
mkdir -p /var/www/a-stock-analysis/logs

# 添加 crontab（每 5 分钟检查一次）
crontab -e
# 添加以下行：
*/5 * * * * /var/www/a-stock-analysis/scripts/health-check.sh
```

### 4. 配置飞书告警（可选）

编辑 `/var/www/a-stock-analysis/scripts/health-check.sh`，设置 webhook：

```bash
WEBHOOK_URL="https://open.feishu.cn/open-apis/bot/v2/hook/your-webhook-id"
```

或在 crontab 中设置环境变量：

```bash
*/5 * * * * FEISHU_WEBHOOK_URL="https://..." /var/www/a-stock-analysis/scripts/health-check.sh
```

### 5. 替换部署脚本

```bash
# 备份旧脚本
cp /var/www/a-stock-analysis/deploy.sh /var/www/a-stock-analysis/deploy.sh.bak

# 使用新脚本
cp /var/www/a-stock-analysis/scripts/deploy.sh /var/www/a-stock-analysis/deploy.sh
chmod +x /var/www/a-stock-analysis/deploy.sh
```

## 常用命令

### 服务管理

```bash
# 启动
sudo systemctl start a-stock-analysis

# 停止
sudo systemctl stop a-stock-analysis

# 重启
sudo systemctl restart a-stock-analysis

# 查看状态
sudo systemctl status a-stock-analysis

# 查看日志（实时）
sudo journalctl -u a-stock-analysis -f

# 查看最近 100 行日志
sudo journalctl -u a-stock-analysis -n 100

# 查看今天的日志
sudo journalctl -u a-stock-analysis --since today
```

### 健康检查

```bash
# 手动执行健康检查
/var/www/a-stock-analysis/scripts/health-check.sh

# 查看健康检查日志
tail -f /var/www/a-stock-analysis/logs/health-check.log

# 查看 crontab
crontab -l
```

### 部署

```bash
cd /var/www/a-stock-analysis
./deploy.sh
```

## 故障排查

### 服务无法启动

```bash
# 查看详细错误日志
sudo journalctl -u a-stock-analysis -n 100 --no-pager

# 手动启动测试
cd /var/www/a-stock-analysis
PORT=5000 node dist/server.js
```

### 502 Bad Gateway

```bash
# 1. 检查服务状态
sudo systemctl status a-stock-analysis

# 2. 检查端口监听
ss -tulnp | grep 5000

# 3. 检查 Nginx 配置
sudo nginx -t
sudo systemctl status nginx

# 4. 重启服务
sudo systemctl restart a-stock-analysis
sudo systemctl restart nginx
```

### 内存不足

```bash
# 查看内存使用
free -h

# 查看服务内存限制
sudo systemctl show a-stock-analysis | grep Memory

# 调整内存限制（编辑 service 文件）
sudo nano /etc/systemd/system/a-stock-analysis.service
# 修改 MemoryMax=2G 为更大值
sudo systemctl daemon-reload
sudo systemctl restart a-stock-analysis
```

## PM2 备选方案

如果不想使用 systemd，可以使用 PM2：

```bash
# 安装 PM2（如果未安装）
npm install -g pm2

# 使用 ecosystem 配置启动
cd /var/www/a-stock-analysis
pm2 start scripts/ecosystem.config.js

# 保存进程列表（开机自启）
pm2 save
pm2 startup

# 查看日志
pm2 logs a-stock-analysis
```

## 文件清单

```
server-config/
├── a-stock-analysis.service    # systemd 服务配置
├── health-check.sh             # 健康检查脚本
├── ecosystem.config.js         # PM2 配置（备选）
├── deploy.sh                   # 部署脚本
└── README.md                   # 本文档
```

## 注意事项

1. **systemd vs PM2**：推荐使用 systemd，更稳定且与系统集成更好
2. **日志轮转**：systemd 日志由 journald 管理，会自动轮转
3. **权限**：确保服务以正确的用户运行（当前配置为 root）
4. **防火墙**：确保 5000 端口对 Nginx 开放（通常 localhost 即可）
5. **Nginx 配置**：确保 Nginx 反向代理到 `http://localhost:5000`
