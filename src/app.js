require('dotenv').config();
const { App } = require('@slack/bolt');
const registerDevopsCommands = require('./commands/devops');
const registerDeploymentHandlers = require('./handlers/deployment');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

registerDevopsCommands(app);
registerDeploymentHandlers(app);

(async () => {
  await app.start(process.env.PORT || 3000);
  console.log(`Bolt app running on port ${process.env.PORT || 3000}`);
})();
