# Claude Email Agent

## Overview
An automated Gmail agent that monitors your inbox for commands, executes them using Claude AI, and sends results back via email.

## Features
- **Claude AI Integration**: Full access to Claude's capabilities via email
- **Automated Monitoring**: Checks inbox every 60 seconds for new commands
- **Direct Email Sending**: Send emails to anyone using natural language
- **Rate Limiting**: Respects Gmail quotas (450 emails/day)
- **Auto-start on Boot**: Configured as systemd service

## How to Use

### Send Claude AI Commands
Send an email to yourself with subject starting with `CLAUDE:`

Examples:
- `Subject: CLAUDE: explain quantum computing`
- `Subject: CLAUDE: write a Python script`
- `Subject: CLAUDE: analyze this data` (include data in email body)

The entire email body will be sent to Claude as context for your request.

### Send Emails via Claude
Include these patterns in your email body:
- `send email to user@example.com saying "your message"`
- `email "message content" to recipient@example.com`
- `send me an email saying "reminder text"`

### Service Management

```bash
# Check service status
sudo systemctl status claude-email-agent

# View real-time logs
sudo journalctl -u claude-email-agent -f

# View application logs
tail -100 ~/claude-email-agent/agent.log

# Restart service
sudo systemctl restart claude-email-agent

# Stop service
sudo systemctl stop claude-email-agent

# Start service
sudo systemctl start claude-email-agent
```

## File Structure

```
~/claude-email-agent/
├── claude-email-agent.js     # Main agent script
├── credentials.json          # Google OAuth2 credentials
├── claude-email-agent.service # Systemd service file
├── setup-service.sh          # Service installer
├── log-rotation.sh           # Log management
├── agent.log                 # Application logs
├── agent-error.log           # Error logs
└── README.md                 # This file

~/.config/gmail-api/
└── gmail-oauth-token.json   # OAuth2 access token
```

## Technical Details

### Email Processing
- **Filter**: `is:unread subject:CLAUDE -from:me`
- **Self-email Prevention**: Ignores emails from your own address
- **Claude Integration**: Uses Claude CLI with proxychains4
- **Response Limit**: 10KB max (truncated if larger)
- **Execution Timeout**: 2 minutes per command

### Security
- OAuth2 token stored securely at `~/.config/gmail-api/`
- Service runs as non-root user
- Commands properly escaped to prevent injection
- Daily email limit prevents abuse

## Troubleshooting

### Agent Not Receiving Emails
1. Check service is running: `sudo systemctl status claude-email-agent`
2. Check logs: `tail -100 ~/claude-email-agent/agent.log`
3. Verify email subject format: must include `CLAUDE:`
4. Ensure email is unread and not from yourself

### Agent Not Starting
1. Check for errors: `sudo journalctl -u claude-email-agent -n 50`
2. Verify token exists: `ls ~/.config/gmail-api/`
3. Ensure service is enabled: `sudo systemctl enable claude-email-agent`

### Re-authenticate Gmail
1. Delete token: `rm ~/.config/gmail-api/gmail-oauth-token.json`
2. Re-run authentication manually
3. Restart service: `sudo systemctl restart claude-email-agent`

### Claude Commands Not Working
1. Test Claude CLI: `echo "test" | proxychains4 claude`
2. Check Claude installation: `which claude`
3. Verify proxychains4 configuration

## Performance Notes
- Checks emails every 60 seconds
- Daily limit: 450 emails (under Gmail's 500)
- Logs rotate at 10MB
- Keeps 3 compressed backup logs

## Quick Test
Send yourself an email with:
- Subject: `CLAUDE: what is 2+2?`
- Body: (can be empty or add context)

You should receive a reply within 1-2 minutes with Claude's response.

## Important Commands
```bash
# View recent commands processed
grep "Processing command" ~/claude-email-agent/agent.log | tail -10

# Check daily email count
grep "Daily email count" ~/claude-email-agent/agent.log | tail -1

# Monitor errors
tail -f ~/claude-email-agent/agent-error.log
```

---
Created: August 2025