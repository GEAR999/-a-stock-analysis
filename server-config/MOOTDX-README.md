# mootdx 服务配置说明

本文档说明如何在服务器（47.122.115.203）上配置 mootdx 的 systemd 服务和健康检查。

## 快速开始

### 1. 复制配置文件到服务器

```bash
# 从 GitHub 拉取最新代码
cd /var/www/a-stock-analysis
git pull origin main

# 复制服务文件到 systemd 目录
sudo cp server-config/mootdx.service /etc/systemd/system/
```

### 2. 配置 systemd 服务

```bash
# 重新加载 systemd
sudo systemctl daemon-reload

# 启用开机自启
sudo systemctl enable mootdx

# 启动服务
sudo systemctl start mootdx

# 查看状态
sudo systemctl status mootdx

# 查看日志
sudo journalctl -u mootdx -f
```

### 3. 验证服务

```bash
# 测试健康检查接口
curl -s "http://localhost:8888/health" | python3 -m json.tool

# 测试 K 线接口
curl -s "http://localhost:8888/api/kline?code=600549&period=day&count=3" | python3 -m json.tool
```

### 4. 配置健康检查（可选）

```bash
# 复制健康检查脚本
sudo cp server-config/mootdx-health-check.sh /opt/mootdx-server/health-check.sh
sudo chmod +x /opt/mootdx-server/health-check.sh

# 创建日志目录
sudo mkdir -p /opt/mootdx-server/logs

# 添加 crontab（每 5 分钟检查一次）
sudo crontab -e
# 添加以下行：
*/5 * * * * /opt/mootdx-server/health-check.sh
```

### 5. 配置飞书告警（可选）

编辑 crontab，添加 webhook 环境变量：

```bash
sudo crontab -e
# 改为：
*/5 * * * * FEISHU_WEBHOOK_URL="https://open.feishu.cn/open-apis/bot/v2/hook/your-webhook-id" /opt/mootdx-server/health-check.sh
```

---

## 常用命令

### 服务管理

```bash
# 启动
sudo systemctl start mootdx

# 停止
sudo systemctl stop mootdx

# 重启
sudo systemctl restart mootdx

# 查看状态
sudo systemctl status mootdx

# 查看日志（实时）
sudo journalctl -u mootdx -f

# 查看最近 100 行日志
sudo journalctl -u mootdx -n 100

# 查看今天的日志
sudo journalctl -u mootdx --since today
```

### 健康检查

```bash
# 手动执行健康检查
/opt/mootdx-server/health-check.sh

# 查看健康检查日志
tail -f /opt/mootdx-server/logs/health-check.log

# 查看 crontab
sudo crontab -l
```

---

## 故障排查

### 服务无法启动

```bash
# 查看详细错误日志
sudo journalctl -u mootdx -n 100 --no-pager

# 手动启动测试
cd /opt/mootdx-server
./venv/bin/python main.py
```

### 端口被占用

```bash
# 查找占用 8888 端口的进程
ss -tulnp | grep 8888

# 停止旧进程
sudo kill -9 <PID>

# 重新启动
sudo systemctl start mootdx
```

### 依赖缺失

```bash
# 进入虚拟环境
cd /opt/mootdx-server
source venv/bin/activate

# 检查依赖
pip list

# 重新安装依赖
pip install -r requirements.txt
```

### 内存不足

```bash
# 查看内存使用
free -h

# 查看服务内存限制
sudo systemctl show mootdx | grep Memory

# 调整内存限制（编辑 service 文件）
sudo nano /etc/systemd/system/mootdx.service
# 修改 MemoryMax=512M 为更大值
sudo systemctl daemon-reload
sudo systemctl restart mootdx
```

---

## 与主服务的协同

### 启动顺序（可选）

如果希望 mootdx 先于主服务启动，可以修改主服务配置：

```bash
sudo nano /etc/systemd/system/a-stock-analysis.service
```

添加依赖：

```ini
[Unit]
Description=A股智能分析系统
After=network.target mootdx.service
Wants=mootdx.service
```

重新加载：

```bash
sudo systemctl daemon-reload
sudo systemctl restart a-stock-analysis
```

### 统一健康检查

可以将两个服务的健康检查合并到一个脚本中：

```bash
# /var/www/a-stock-analysis/scripts/check-all.sh
#!/bin/bash

# 检查主服务
curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:5000/ || echo "主服务异常"

# 检查 mootdx
curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:8888/health || echo "mootdx 异常"
```

---

## 文件清单

```
server-config/
├── a-stock-analysis.service    # 主服务 systemd 配置
├── mootdx.service              # mootdx systemd 配置
── health-check.sh             # 主服务健康检查脚本
├── mootdx-health-check.sh      # mootdx 健康检查脚本
├── ecosystem.config.js         # PM2 配置（备选）
├── deploy.sh                   # 部署脚本
└── README.md                   # 主服务配置说明
```

---

## 注意事项

1. **Python 路径**：确保 `/opt/mootdx-server/venv/bin/python` 存在
2. **工作目录**：确保 `/opt/mootdx-server/` 存在且包含 `main.py`
3. **端口冲突**：确保 8888 端口未被其他服务占用
4. **权限**：当前配置以 root 用户运行，如需降权可修改 `User=` 字段
5. **日志轮转**：systemd 日志由 journald 管理，会自动轮转
6. **防火墙**：确保 8888 端口对主服务开放（通常 localhost 即可）

---

## 性能优化（可选）

### 限制 CPU 使用

```ini
[Service]
# 限制 CPU 使用率为 50%
CPUQuota=50%
```

### 限制文件描述符

```ini
[Service]
# 最大文件描述符数
LimitNOFILE=65535
```

### 优雅重启

```ini
[Service]
# 发送 SIGTERM 后等待 10 秒，然后发送 SIGKILL
KillSignal=SIGTERM
KillTimeout=10s
```

---

## 监控告警（进阶）

### Prometheus 指标（可选）

如果 mootdx 支持 metrics 接口，可以添加 Prometheus 监控：

```bash
# 安装 node_exporter
sudo apt install prometheus-node-exporter

# 配置 Prometheus 抓取
# /etc/prometheus/prometheus.yml
scrape_configs:
  - job_name: 'mootdx'
    static_configs:
      - targets: ['localhost:8888']
```

### Grafana 仪表盘（可选）

使用 Grafana 可视化监控数据，创建仪表盘显示：
- 服务状态（up/down）
- 响应时间
- 请求量
- 内存使用

---

## 总结

通过 systemd 配置，mootdx 服务获得：
- ✅ 开机自启
- ✅ 崩溃自动重启（5 秒）
- ✅ 统一日志管理
- ✅ 内存限制保护
- ✅ 健康检查（可选）
- ✅ 告警通知（可选）

与主服务架构保持一致，便于统一管理和维护。
