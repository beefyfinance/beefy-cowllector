require('dotenv').config();
const { default: axios } = require('axios');

/**
 * Send message to Beefy channels
 * @param {object}
 * @returns Axios Response object
 */
const send = async ({
  type = 'info',
  title = 'this is a title',
  message = 'this is a message',
  platforms = ['discord'],
}) => {
  try {
    let res = await axios.post(
      `https://beefy-broadcast.herokuapp.com/broadcasts?apikey=${process.env.BEEFY_BROADCAST_API_KEY}`,
      {
        type,
        title,
        message,
        platforms,
      }
    );
    return res;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  send,
};
