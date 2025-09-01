#!/bin/bash

# Claude Email Agent Service Setup Script

echo "Setting up Claude Email Agent as a system service..."

# Create the service file
cat > /tmp/claude-email-agent.service << 'EOF'
[Unit]
Description=Claude Email Agent
After=network.target

[Service]
Type=simple
User=timlihk
WorkingDirectory=/home/timlihk/claude-email-agent
ExecStart=/usr/bin/node /home/timlihk/claude-email-agent/claude-email-agent.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
StandardOutput=append:/home/timlihk/claude-email-agent/agent.log
StandardError=append:/home/timlihk/claude-email-agent/agent-error.log

[Install]
WantedBy=multi-user.target
EOF

# Copy to systemd directory
sudo cp /tmp/claude-email-agent.service /etc/systemd/system/

# Reload systemd daemon
sudo systemctl daemon-reload

# Enable the service to start on boot
sudo systemctl enable claude-email-agent

# Start the service
sudo systemctl start claude-email-agent

# Check status
sudo systemctl status claude-email-agent

echo ""
echo "Service setup complete!"
echo ""
echo "Useful commands:"
echo "  Check status:  sudo systemctl status claude-email-agent"
echo "  View logs:     sudo journalctl -u claude-email-agent -f"
echo "  Stop service:  sudo systemctl stop claude-email-agent"
echo "  Start service: sudo systemctl start claude-email-agent"
echo "  Restart:       sudo systemctl restart claude-email-agent"
echo "  Disable:       sudo systemctl disable claude-email-agent"