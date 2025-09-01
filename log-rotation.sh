#!/bin/bash

LOG_DIR="/home/timlihk/claude-email-agent"
LOG_FILE="$LOG_DIR/agent.log"
MAX_SIZE=10485760  # 10MB in bytes

# Check if log file exists and get its size
if [ -f "$LOG_FILE" ]; then
    SIZE=$(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE" 2>/dev/null)
    
    if [ "$SIZE" -gt "$MAX_SIZE" ]; then
        echo "Rotating log file (current size: $SIZE bytes)"
        
        # Keep only last 1000 lines and create backup
        tail -n 1000 "$LOG_FILE" > "$LOG_FILE.tmp"
        mv "$LOG_FILE" "$LOG_FILE.backup.$(date +%Y%m%d_%H%M%S)"
        mv "$LOG_FILE.tmp" "$LOG_FILE"
        
        # Compress old backup if it exists
        if [ -f "$LOG_FILE.backup."* ]; then
            gzip "$LOG_FILE.backup."* 2>/dev/null || true
        fi
        
        # Keep only last 3 compressed backups
        ls -t "$LOG_DIR"/agent.log.backup.*.gz 2>/dev/null | tail -n +4 | xargs rm -f 2>/dev/null || true
        
        echo "Log rotation completed"
    fi
fi