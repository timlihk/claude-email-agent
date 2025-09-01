#!/bin/bash

# Claude Email Agent Launcher

PID_FILE="$HOME/.config/gmail-api/agent.pid"

case "$1" in
  start)
    if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
      echo "Agent is already running (PID: $(cat $PID_FILE))"
    else
      echo "Starting Claude Email Agent..."
      nohup node ~/claude-email-agent/claude-email-agent.js 60 > ~/claude-email-agent/agent.log 2>&1 &
      echo $! > "$PID_FILE"
      echo "Agent started (PID: $!)"
      echo "Check logs: tail -f ~/claude-email-agent/agent.log"
    fi
    ;;
  
  stop)
    if [ -f "$PID_FILE" ]; then
      PID=$(cat "$PID_FILE")
      if kill -0 "$PID" 2>/dev/null; then
        kill "$PID"
        rm "$PID_FILE"
        echo "Agent stopped"
      else
        echo "Agent not running"
        rm "$PID_FILE"
      fi
    else
      echo "Agent not running"
    fi
    ;;
  
  status)
    if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
      echo "Agent is running (PID: $(cat $PID_FILE))"
      echo "Recent activity:"
      tail -5 ~/claude-email-agent/agent.log
    else
      echo "Agent is not running"
    fi
    ;;
  
  logs)
    tail -f ~/claude-email-agent/agent.log
    ;;
  
  *)
    echo "Usage: $0 {start|stop|status|logs}"
    echo "  start  - Start the email agent"
    echo "  stop   - Stop the email agent"
    echo "  status - Check if agent is running"
    echo "  logs   - View agent logs"
    exit 1
    ;;
esac