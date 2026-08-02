#!/bin/bash
# A股智能分析系统 - 部署脚本（systemd 版本）
# 用法：./deploy.sh
# 
# 功能：
# 1. 拉取最新代码
# 2. 安装依赖
# 3. 构建生产版本
# 4. 重启 systemd 服务
# 5. 验证服务状态

set -euo pipefail

APP_DIR="/var/www/a-stock-analysis"
SERVICE_NAME="a-stock-analysis"
LOG_FILE="${APP_DIR}/logs/deploy.log"

# ============ 日志函数 ============
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# ============ 错误处理 ============
error_exit() {
    log "❌ $1"
    log "查看服务日志：journalctl -u $SERVICE_NAME -n 50"
    exit 1
}

# ============ 主流程 ============
main() {
    mkdir -p "${APP_DIR}/logs"
    
    log "=========================================="
    log "开始部署 A股智能分析系统"
    log "=========================================="
    
    # 1. 拉取最新代码
    log "=== 1. 拉取最新代码 ==="
    cd "$APP_DIR"
    git fetch origin main || error_exit "git fetch 失败"
    git reset --hard origin/main || error_exit "git reset 失败"
    log "✅ 代码已更新到最新版本"
    
    # 2. 安装依赖
    log "=== 2. 安装依赖 ==="
    pnpm install --frozen-lockfile || error_exit "pnpm install 失败"
    log "✅ 依赖安装完成"
    
    # 3. 构建
    log "=== 3. 构建生产版本 ==="
    pnpm build || error_exit "pnpm build 失败"
    log "✅ 构建完成"
    
    # 4. 重启服务
    log "=== 4. 重启服务 ==="
    if command -v systemctl &> /dev/null; then
        systemctl restart "$SERVICE_NAME" || error_exit "systemctl restart 失败"
        log "✅ systemd 服务已重启"
    else
        log "⚠️ 未检测到 systemctl，尝试 PM2..."
        pm2 restart "$SERVICE_NAME" || pm2 start dist/server.js --name "$SERVICE_NAME"
        log "✅ PM2 服务已重启"
    fi
    
    # 5. 等待服务启动（通过 journalctl 确认服务日志）
    log "=== 5. 等待服务启动 ==="
    local retries=15
    local success=false
    
    for i in $(seq 1 $retries); do
        # 方法1：检查 journalctl 日志中出现 "Server listening"
        if journalctl -u "$SERVICE_NAME" --since "30 seconds ago" -n 5 2>/dev/null | grep -q "Server listening"; then
            log "✅ 服务启动成功 (通过日志确认)"
            success=true
            break
        fi
        
        # 方法2：备选，尝试 HTTP 检测
        local http_status
        http_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:5000/api/ping 2>/dev/null || echo "000")
        if [ "$http_status" = "200" ]; then
            log "✅ 服务启动成功 (HTTP 200)"
            success=true
            break
        fi
        
        # 307 也视为服务运行中（中间件重定向）
        if [ "$http_status" = "307" ]; then
            log "⏳ 服务已启动，等待中间件初始化... ($i/$retries)"
        else
            log "等待服务启动... ($i/$retries, HTTP $http_status)"
        fi
        sleep 2
    done
    
    if [ "$success" = false ]; then
        error_exit "服务启动失败，请检查日志"
    fi
    
    # 7. 显示服务状态
    log "=== 7. 服务状态 ==="
    if command -v systemctl &> /dev/null; then
        systemctl status "$SERVICE_NAME" --no-pager | head -20
    else
        pm2 list
    fi
    
    log "=========================================="
    log "✅ 部署完成！"
    log "访问地址：https://a-stock.xyz"
    log "=========================================="
}

main "$@"
