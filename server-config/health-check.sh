#!/bin/bash
# A股智能分析系统 - 健康检查脚本
# 功能：每 5 分钟检查服务状态，异常时自动重启并告警
# 安装：crontab -e 添加 */5 * * * * /var/www/a-stock-analysis/scripts/health-check.sh

set -euo pipefail

# ============ 配置 ============
SERVICE_NAME="a-stock-analysis"
APP_DIR="/var/www/a-stock-analysis"
LOG_FILE="${APP_DIR}/logs/health-check.log"
WEBHOOK_URL="${FEISHU_WEBHOOK_URL:-}"  # 飞书 webhook（可选）
CHECK_INTERVAL=10  # 重试间隔（秒）
MAX_RETRIES=3      # 最大重试次数

# ============ 日志函数 ============
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# ============ 告警函数 ============
send_alert() {
    local message="$1"
    
    if [ -z "$WEBHOOK_URL" ]; then
        log "⚠️ 告警（无 webhook 配置）: $message"
        return
    fi
    
    # 飞书 webhook 格式
    curl -s -X POST "$WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{\"msg_type\":\"text\",\"content\":{\"text\":\"⚠️ ${SERVICE_NAME}: ${message}\"}}" \
        >> "$LOG_FILE" 2>&1 || true
    
    log "📢 告警已发送：$message"
}

# ============ 健康检查 ============
check_service() {
    local response
    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 http://localhost:5000/ 2>/dev/null || echo "000")
    
    if [ "$response" = "200" ]; then
        return 0
    else
        return 1
    fi
}

# ============ 重启服务 ============
restart_service() {
    log "🔄 尝试重启服务..."
    
    # 使用 systemctl 重启
    if command -v systemctl &> /dev/null; then
        systemctl restart "$SERVICE_NAME"
    else
        # 降级到 PM2
        cd "$APP_DIR"
        pm2 restart "$SERVICE_NAME" || pm2 start dist/server.js --name "$SERVICE_NAME"
    fi
    
    sleep 5
}

# ============ 主逻辑 ============
main() {
    # 创建日志目录
    mkdir -p "$(dirname "$LOG_FILE")"
    
    log "开始健康检查..."
    
    # 第一次检查
    if check_service; then
        log "✅ 服务正常 (HTTP 200)"
        exit 0
    fi
    
    log "❌ 服务异常 (HTTP 非 200)，开始重试..."
    
    # 重试机制
    for i in $(seq 1 $MAX_RETRIES); do
        log "重试 $i/$MAX_RETRIES..."
        restart_service
        
        if check_service; then
            log "✅ 重启成功 (HTTP 200)"
            send_alert "服务异常后自动重启成功"
            exit 0
        fi
        
        sleep $CHECK_INTERVAL
    done
    
    # 所有重试失败
    log "❌ 重启失败，需要人工干预"
    send_alert "服务异常且自动重启失败，请立即检查！\n\n查看日志：journalctl -u $SERVICE_NAME -n 50"
    
    exit 1
}

main "$@"
