const { google } = require('googleapis');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class ClaudeEmailAgent {
  constructor() {
    this.gmail = null;
    this.oAuth2Client = null;
    this.userEmail = null;
    this.dailyEmailCount = 0;
    this.lastResetDate = new Date().toDateString();
    this.maxDailyEmails = 450; // Conservative limit under Gmail's 500
  }

  async init() {
    try {
      // Load credentials from existing location
      const credentialsPath = path.join(__dirname, 'credentials.json');
      const credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));
      const { client_secret, client_id, redirect_uris } = credentials.installed;
      
      this.oAuth2Client = new google.auth.OAuth2(
        client_id, 
        client_secret, 
        redirect_uris[0]
      );

      // Load token from secure location
      const tokenPath = path.join(os.homedir(), '.config', 'gmail-api', 'gmail-oauth-token.json');
      const token = JSON.parse(await fs.readFile(tokenPath, 'utf8'));
      this.oAuth2Client.setCredentials(token);

      // Set up Gmail API
      this.gmail = google.gmail({ version: 'v1', auth: this.oAuth2Client });
      
      // Get user's email address
      const profile = await this.gmail.users.getProfile({ userId: 'me' });
      this.userEmail = profile.data.emailAddress;
      
      console.log(`Claude Email Agent initialized for ${this.userEmail}`);
      return true;
    } catch (error) {
      console.error('Failed to initialize:', error.message);
      return false;
    }
  }

  async checkEmails() {
    try {
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: 'is:unread subject:CLAUDE -from:me'
      });

      if (response.data.messages && response.data.messages.length > 0) {
        console.log(`Found ${response.data.messages.length} new command(s)`);
        
        for (const message of response.data.messages) {
          await this.processEmail(message.id);
        }
      }
    } catch (error) {
      console.error('Error checking emails:', error.message);
    }
  }

  async processEmail(messageId) {
    try {
      const message = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId
      });

      const headers = message.data.payload.headers;
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const from = headers.find(h => h.name === 'From')?.value || '';
      const fromEmail = from.match(/<(.+?)>/)?.[1] || from;
      
      // Skip processing emails from ourselves
      if (fromEmail === this.userEmail) {
        console.log(`Skipping email from self: ${fromEmail}`);
        await this.gmail.users.messages.modify({
          userId: 'me',
          id: messageId,
          resource: {
            removeLabelIds: ['UNREAD']
          }
        });
        return;
      }
      
      console.log(`Processing command from ${fromEmail}`);
      
      // Mark as read immediately to prevent reprocessing
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        resource: {
          removeLabelIds: ['UNREAD']
        }
      });
      
      // Extract body text
      let bodyText = '';
      const parts = message.data.payload.parts || [message.data.payload];
      
      for (const part of parts) {
        if (part.mimeType === 'text/plain' && part.body.data) {
          bodyText = Buffer.from(part.body.data, 'base64').toString();
          break;
        }
      }

      // Parse command from email
      const command = this.parseCommand(subject, bodyText);
      
      if (command) {
        const result = await this.executeCommand(command);
        await this.sendReply(fromEmail, command, result);
        console.log(`Command executed for ${fromEmail}`);
      }

    } catch (error) {
      console.error('Error processing email:', error.message);
    }
  }

  parseCommand(subject, body) {
    // Check if this is a Claude Code request
    if (subject.toLowerCase().includes('claude:')) {
      // Use the entire body as the command for Claude Code
      return body.trim();
    }
    
    return null;
  }

  async executeCommand(command) {
    // Check if this is an email sending request
    const emailPattern = /(?:send|email|write)\s+(?:an?\s+)?(?:email|message)\s+to\s+([^\s]+@[^\s]+)\s+(?:saying?|with|that says?|to say)\s+"([^"]+)"/i;
    const simpleEmailPattern = /(?:send|email)\s+"([^"]+)"\s+to\s+([^\s]+@[^\s]+)/i;
    const selfEmailPattern = /(?:send|email)\s+(?:me\s+)?(?:an?\s+)?(?:email|message)\s+(?:saying?|with|that says?|to say)\s+"([^"]+)"/i;
    
    let match = command.match(emailPattern);
    let recipient = null;
    let emailContent = null;
    
    if (match) {
      recipient = match[1];
      emailContent = match[2];
    } else if ((match = command.match(simpleEmailPattern))) {
      emailContent = match[1];
      recipient = match[2];
    } else if ((match = command.match(selfEmailPattern))) {
      recipient = this.userEmail;
      emailContent = match[1];
    }
    
    if (recipient && emailContent) {
      console.log(`Detected email request: sending "${emailContent}" to ${recipient}`);
      return await this.sendDirectEmail(recipient, emailContent);
    }
    
    // Otherwise, send command to Claude Code CLI
    console.log('Sending command to Claude Code...');
    
    // Use Claude Code CLI to process the command with proxychains4 for network access
    // The command will be piped to Claude through stdin
    const claudePath = '/home/timlihk/.npm-global/bin/claude';
    const claudeCommand = `echo "${command.replace(/"/g, '\\"').replace(/\n/g, '\\n')}" | proxychains4 ${claudePath}`;
    
    return await this.runCommand(claudeCommand);
  }

  async sendDirectEmail(recipient, content) {
    if (!this.checkDailyLimit()) {
      return `Daily email limit reached (${this.maxDailyEmails}). Email not sent to ${recipient}`;
    }

    try {
      const subject = `Message from Claude Email Agent`;
      
      // Create email in Gmail format
      const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
      const messageParts = [
        `To: ${recipient}`,
        `From: ${this.userEmail}`,
        'Content-Type: text/plain; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: ${utf8Subject}`,
        '',
        content
      ];

      const raw = Buffer.from(messageParts.join('\n'))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      await this.gmail.users.messages.send({
        userId: 'me',
        resource: { raw }
      });

      this.incrementEmailCount();
      return `Email sent to ${recipient}: "${content}"`;
    } catch (error) {
      console.error('Error sending email:', error.message);
      if (error.message.includes('Quota exceeded') || error.message.includes('limit')) {
        return `Gmail API quota exceeded. Please wait until tomorrow to send more emails.`;
      }
      return `Failed to send email: ${error.message}`;
    }
  }

  async runCommand(cmd) {
    return new Promise((resolve) => {
      // Increase timeout for Claude commands which might take longer
      exec(cmd, { 
        timeout: 120000,  // 2 minutes timeout
        maxBuffer: 10 * 1024 * 1024  // 10MB buffer for larger responses
      }, (error, stdout, stderr) => {
        if (error) {
          resolve(`Error: ${error.message}`);
        } else if (stderr) {
          resolve(`Warning: ${stderr}\n${stdout}`);
        } else {
          resolve(stdout || 'Command executed successfully');
        }
      });
    });
  }

  async sendReply(to, originalCommand, result) {
    if (!this.checkDailyLimit()) {
      console.log(`Daily email limit reached (${this.maxDailyEmails}). Reply not sent to ${to}`);
      return;
    }

    try {
      // Truncate command for subject if too long
      const truncatedCommand = originalCommand.length > 50 
        ? originalCommand.substring(0, 47) + '...' 
        : originalCommand;
      
      const subject = `Re: CLAUDE: ${truncatedCommand}`;
      
      // Clean up result - remove proxychains warnings and excessive whitespace
      let cleanResult = result
        .replace(/\[proxychains\][^\n]*\n/g, '')
        .replace(/Warning: [^\n]*proxychains[^\n]*\n/g, '')
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .trim();
      
      // Truncate result if too long for email
      if (cleanResult.length > 10000) {
        cleanResult = cleanResult.substring(0, 9500) + '\n\n[Response truncated - exceeded email size limit]';
      }
      
      const message = [
        `Command: ${originalCommand}`,
        '',
        cleanResult,
        '',
        `Claude Agent - ${new Date().toISOString()}`
      ].join('\n');

      // Create email in Gmail format
      const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
      const messageParts = [
        `To: ${to}`,
        `From: ${this.userEmail}`,
        'Content-Type: text/plain; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: ${utf8Subject}`,
        '',
        message
      ];

      const raw = Buffer.from(messageParts.join('\n'))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      await this.gmail.users.messages.send({
        userId: 'me',
        resource: { raw }
      });

      this.incrementEmailCount();

    } catch (error) {
      console.error('Error sending reply:', error.message);
      if (error.message.includes('Quota exceeded') || error.message.includes('limit')) {
        console.log('Gmail API quota exceeded. Please wait until tomorrow to send more emails.');
      }
    }
  }

  checkDailyLimit() {
    const today = new Date().toDateString();
    
    // Reset counter if it's a new day
    if (this.lastResetDate !== today) {
      this.dailyEmailCount = 0;
      this.lastResetDate = today;
    }
    
    return this.dailyEmailCount < this.maxDailyEmails;
  }

  incrementEmailCount() {
    this.dailyEmailCount++;
    console.log(`Daily email count: ${this.dailyEmailCount}/${this.maxDailyEmails}`);
  }

  async start() {
    if (!await this.init()) {
      console.error('Failed to initialize. Exiting.');
      process.exit(1);
    }

    // Check emails every 60 seconds
    setInterval(() => {
      this.checkEmails();
    }, 60000);

    // Initial check
    this.checkEmails();
    
    console.log('Claude Email Agent is running. Checking for commands every 60 seconds...');
  }
}

// Start the agent
const agent = new ClaudeEmailAgent();
agent.start();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down Claude Email Agent...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down Claude Email Agent...');
  process.exit(0);
});