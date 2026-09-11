#!/bin/bash
# LongH AI Workbench 服务启动与守护脚本
# 功能：自动检测依赖、启动服务、崩溃自动重启、端口占用自动清理

SERVER_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_FILE="$SERVER_DIR/server.js"
LOG_FILE="$SERVER_DIR/data/server.log"
PID_FILE="$SERVER_DIR/data/server.pid"
PORT=3001

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
  echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# 检查依赖是否安装
check_deps() {
  if [ ! -d "$SERVER_DIR/node_modules" ]; then
    log "${YELLOW}检测到 node_modules 不存在，正在安装依赖...${NC}"
    cd "$SERVER_DIR" && npm install 2>&1 | tee -a "$LOG_FILE"
    if [ $? -eq 0 ]; then
      log "${GREEN}依赖安装成功${NC}"
    else
      log "${RED}依赖安装失败，请手动执行 npm install${NC}"
      exit 1
    fi
  fi
}

# 检查端口是否被占用，占用则杀掉
free_port() {
  local pid=$(lsof -ti:$PORT 2>/dev/null || fuser $PORT/tcp 2>/dev/null || echo "")
  if [ -n "$pid" ]; then
    log "${YELLOW}端口 $PORT 被进程 $pid 占用，正在释放...${NC}"
    kill -9 $pid 2>/dev/null
    sleep 1
    log "${GREEN}端口已释放${NC}"
  fi
}

# 检查服务是否在运行
is_running() {
  if [ -f "$PID_FILE" ]; then
    local pid=$(cat "$PID_FILE")
    if kill -0 $pid 2>/dev/null; then
      return 0
    else
      rm -f "$PID_FILE"
      return 1
    fi
  fi
  return 1
}

# 启动服务
start_server() {
  check_deps
  free_port
  
  log "${GREEN}正在启动 LongH AI Workbench 服务器...${NC}"
  
  cd "$SERVER_DIR"
  nohup node server.js >> "$LOG_FILE" 2>&1 &
  local pid=$!
  echo $pid > "$PID_FILE"
  
  # 等待服务启动
  sleep 2
  
  # 验证服务是否启动成功
  if kill -0 $pid 2>/dev/null; then
    local count=0
    while [ $count -lt 10 ]; do
      if curl -s http://localhost:$PORT/api/health > /dev/null 2>&1; then
        log "${GREEN}✓ 服务器启动成功！PID: $pid，端口: $PORT${NC}"
        return 0
      fi
      sleep 1
      count=$((count + 1))
    done
  fi
  
  log "${RED}✗ 服务器启动失败，请检查日志: $LOG_FILE${NC}"
  return 1
}

# 停止服务
stop_server() {
  if is_running; then
    local pid=$(cat "$PID_FILE")
    log "${YELLOW}正在停止服务器 (PID: $pid)...${NC}"
    kill $pid 2>/dev/null
    sleep 1
    if kill -0 $pid 2>/dev/null; then
      kill -9 $pid 2>/dev/null
    fi
    rm -f "$PID_FILE"
    log "${GREEN}服务器已停止${NC}"
  else
    log "${YELLOW}服务器未在运行${NC}"
  fi
  free_port
}

# 守护模式：监控服务，崩溃自动重启
daemon_mode() {
  log "${GREEN}启动守护模式，服务崩溃将自动重启${NC}"
  
  while true; do
    if ! is_running; then
      log "${RED}检测到服务已停止，正在重新启动...${NC}"
      start_server
    fi
    
    # 健康检查
    if ! curl -s http://localhost:$PORT/api/health > /dev/null 2>&1; then
      log "${YELLOW}健康检查失败，等待重试...${NC}"
      sleep 3
      if ! curl -s http://localhost:$PORT/api/health > /dev/null 2>&1; then
        log "${RED}连续健康检查失败，重启服务...${NC}"
        stop_server
        sleep 1
        start_server
      fi
    fi
    
    sleep 5
  done
}

# 主逻辑
case "${1:-start}" in
  start)
    if is_running; then
      log "${YELLOW}服务器已在运行 (PID: $(cat $PID_FILE))${NC}"
      exit 0
    fi
    start_server
    ;;
  stop)
    stop_server
    ;;
  restart)
    stop_server
    sleep 1
    start_server
    ;;
  status)
    if is_running; then
      log "${GREEN}运行中 - PID: $(cat $PID_FILE)${NC}"
      curl -s http://localhost:$PORT/api/health 2>/dev/null && echo "" || echo "健康检查失败"
    else
      log "${RED}未运行${NC}"
    fi
    ;;
  daemon)
    if is_running; then
      log "${YELLOW}服务器已在运行，进入守护监控模式${NC}"
    else
      start_server
    fi
    daemon_mode
    ;;
  log)
    tail -f "$LOG_FILE"
    ;;
  *)
    echo "用法: $0 {start|stop|restart|status|daemon|log}"
    echo ""
    echo "  start    - 启动服务器"
    echo "  stop     - 停止服务器"
    echo "  restart  - 重启服务器"
    echo "  status   - 查看运行状态"
    echo "  daemon   - 守护模式（崩溃自动重启）"
    echo "  log      - 查看实时日志"
    exit 1
    ;;
esac
