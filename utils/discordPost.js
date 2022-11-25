// use strict
require( 'dotenv/config');
const axios = require( "axios");

const DISCORD_WEBHOOK = process.env.PLATFORM_DISCORD_WEBHOOK_URL || "https://discord.com/api/webhooks/914674522173632592/amo5u4RC02l6tpu5tuwQaaH0kij-N8O7335gT336hICkcHMltk7ke6PIDh4CuqahqZJi";


const sendMessage = async ( {username = "Messenger Cow",
															title, message, type = "info",
															avatar = "https://raw.githubusercontent.com/beefyfinance/beefy-broadcast-api/main/src/images/messenger_cow.png"}) => {
  let params = {username, content: `**${title}**\n${message}\n‎`,
								avatar_url: avatar};

  switch (type) {
    case "warning":
      params.content = "⚠️ WARNING -> " + params.content;
      break;
    case "error":
      params.content = "🔥 ERROR -> " + params.content;
      break;
    default:
      params.content = "ℹ️ INFO -> " + params.content;
  }

  try {
    let response = await axios.post( DISCORD_WEBHOOK, params);
    return response.status.ok;
  } catch (error) {
    throw error;
  }
};


module.exports = {
  sendMessage
};
