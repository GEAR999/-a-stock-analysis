# 量化实时账户服务部署指南

## 1. 登录阿里云服务器

```bash
ssh root@47.122.115.203
```

## 2. 创建服务目录

```bash
mkdir -p /opt/quant-live-service
cd /opt/quant-live-service
```

## 3. 上传代码

从本地上传（在本地执行）：
```bash
scp -r quant-live-service/* root@47.122.115.203:/opt/quant-live-service/
```

或在服务器上直接创建文件（复制 index.js 和 package.json 内容）

## 4. 安装依赖

```bash
cd /opt/quant-live-service
npm install
```

## 5. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，确认 DATABASE_URL 和 MOOTDX_URL 正确
nano .env
```

## 6. 安装 PM2（进程管理）

```bash
npm install -g pm2
```

## 7. 启动服务

```bash
pm2 start index.js --name quant-live-service
pm2 save
pm2 startup  # 设置开机自启
```

## 8. 验证服务

```bash
# 检查服务状态
pm2 status

# 查看日志
pm2 logs quant-live-service

# 测试 HTTP API
curl http://localhost:8889/api/accounts

# 测试 WebSocket（需要 wscat 工具）
npm install -g wscat
wscat -c ws://localhost:8889
```

## 9. 防火墙确认

确保 8889 端口已在阿里云安全组开放（你说已经放行了）

## 10. 查看日志

```bash
# 实时日志
pm2 logs quant-live-service

# 最近 100 行
pm2 logs quant-live-service --lines 100
```

## 服务管理命令

```bash
# 重启服务
pm2 restart quant-live-service

# 停止服务
pm2 stop quant-live-service

# 查看状态
pm2 status

# 查看监控
pm2 monit
```

## 注意事项

1. **Node.js 版本**：需要 18+，检查：`node --version`
2. **mootdx 服务**：确保 8888 端口的 mootdx 服务正在运行
3. **Neon 数据库**：确保 DATABASE_URL 正确，网络可达
4. **交易时间**：Cron 任务只在交易时间（工作日 9:30-11:30, 13:00-15:00）执行
5. **日志轮转**：PM2 默认日志会增长，建议配置 logrotate

## 故障排查

```bash
# 服务没启动
pm2 start index.js --name quant-live-service

# 端口被占用
lsof -i:8889
kill -9 <PID>

# 数据库连接失败
# 检查 .env 中的 DATABASE_URL 是否正确
# 检查服务器能否访问 Neon（公网）

# mootdx 连接失败
curl http://localhost:8888/health
```
