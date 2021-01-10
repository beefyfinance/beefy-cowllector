const { Webhook } = require('discord-webhook-node');

require('dotenv').config();

const hook = new Webhook(
  `https://discord.com/api/webhooks/793925398077505547/${process.env.DISCORD_BOT_KEY}`
);

const sendMessage = message => hook.send(message);

module.exports = { sendMessage };
