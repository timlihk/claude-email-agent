const { authorize, listMessages, sendEmail } = require('../gmail-setup.js');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

class EmailAgent {
  constructor() {
    this.auth = null;
  }

  async initialize() {
    console.log('Initializing Email Agent...');
    try {
      this.auth = await authorize();
      console.log('Email Agent ready!\n');
      return true;
    } catch (error) {
      console.error('Failed to initialize:', error);
      return false;
    }
  }

  async checkEmails(query = null) {
    if (!this.auth) {
      console.error('Not authenticated. Please initialize first.');
      return;
    }

    console.log('Checking emails...');
    await listMessages(this.auth);
  }

  async composeEmail() {
    if (!this.auth) {
      console.error('Not authenticated. Please initialize first.');
      return;
    }

    return new Promise((resolve) => {
      rl.question('To: ', (to) => {
        rl.question('Subject: ', (subject) => {
          rl.question('Message: ', async (message) => {
            try {
              await sendEmail(this.auth, to, subject, message);
              console.log('Email sent successfully!');
            } catch (error) {
              console.error('Failed to send email:', error);
            }
            resolve();
          });
        });
      });
    });
  }

  async interactiveMode() {
    console.log('\n=== Email Agent Interactive Mode ===');
    console.log('Commands:');
    console.log('  1 - Check emails');
    console.log('  2 - Compose email');
    console.log('  3 - Exit\n');

    const askCommand = () => {
      rl.question('Enter command (1-3): ', async (answer) => {
        switch(answer) {
          case '1':
            await this.checkEmails();
            askCommand();
            break;
          case '2':
            await this.composeEmail();
            askCommand();
            break;
          case '3':
            console.log('Goodbye!');
            rl.close();
            break;
          default:
            console.log('Invalid command. Please enter 1, 2, or 3.');
            askCommand();
        }
      });
    };

    askCommand();
  }
}

async function main() {
  const agent = new EmailAgent();
  
  if (await agent.initialize()) {
    await agent.interactiveMode();
  } else {
    console.log('Failed to start Email Agent');
    rl.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = EmailAgent;