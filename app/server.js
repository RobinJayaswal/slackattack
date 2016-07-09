// example bot
import botkit from 'botkit';

const controller = botkit.slackbot({
  debug: false,
});
// initialize slackbot
const slackbot = controller.spawn({
  token: process.env.SLACK_BOT_TOKEN,
  // this grabs the slack token we exported earlier
}).startRTM(err => {
  // start the real time message client
  if (err) { throw new Error(err); }
});

// prepare webhook
// for now we won't use this but feel free to look up slack webhooks
controller.setupWebserver(process.env.PORT || 3001, (err, webserver) => {
  controller.createWebhookEndpoints(webserver, slackbot, () => {
    if (err) { throw new Error(err); }
  });
});

// example hello response
controller.hears(['hello', 'hi', 'batman'], ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  bot.api.users.info({ user: message.user }, (err, res) => {
    if (res) {
      bot.reply(message, `Hello, ${res.user.name}!`);
    } else {
      bot.reply(message, 'Hello there!');
    }
  });
});

// reply to a direct mention - @bot hello
controller.on('direct_mention', (bot, message) => {
  // reply to _message_ by using the _bot_ object
  bot.reply(message, 'Botman at your service!!');
});

// reply to a direct message
controller.on('direct_message', (bot, message) => {
  // reply to _message_ by using the _bot_ object
  bot.reply(message, 'How can botman help you?');
});

console.log('starting bot');
