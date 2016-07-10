// example bot
import botkit from 'botkit';
import Yelp from 'yelp';
import nodeGeocoder from 'node-geocoder';
import Forecast from 'forecast';

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

// initialize yelp
// this initializer, and all yelp calls made throughout this file, are based
// significantly off of https://github.com/olalonde/node-yelp
// it creates a module for making Yelp API calls
const yelp = new Yelp({
  consumer_key: 'tCrVjW4Nw_YjqciFYUoOVA',
  consumer_secret: process.env.YELP_CONSUMER_SECRET,
  token: 'yLsp_ObWvmZ-n8JIkv6lKvKxFpmITMCp',
  token_secret: process.env.YELP_TOKEN_SECRET,
});


// initialize geocoder to find lat and long of a human address
// this initialization, and all calls using NodeGeocoder throughout this file,
// are based off of the example code provided by its creator at https://www.npmjs.com/package/node-geocoder
const options = {
  provider: 'google',
  httpAdapter: 'https', // Default
  apiKey: process.env.GOOGLE_GEOCODE_KEY,
  formatter: null,
};
const geocoder = nodeGeocoder(options);

// Initialize forecast module. This initialization and subsequent uses of it
// to get weather reports is based off of code at https://www.npmjs.com/package/forecast
const forecast = new Forecast({
  service: 'forecast.io',
  key: process.env.SKY_FORECAST_KEY,
  units: 'degree', // Only the first letter is parsed
  cache: true,      // Cache API requests?
  ttl: {            // How long to cache requests. Uses syntax from moment.js: http://momentjs.com/docs/#/durations/creating/
    minutes: 27,
    seconds: 45,
  },
});


// prepare webhook
// for now we won't use this but feel free to look up slack webhooks
controller.setupWebserver(process.env.PORT || 3001, (err, webserver) => {
  controller.createWebhookEndpoints(webserver, slackbot, () => {
    if (err) { throw new Error(err); }
  });
});

// example hello response
controller.hears(['hello', 'hi', 'howdy'], ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  bot.api.users.info({ user: message.user }, (err, res) => {
    if (res) {
      bot.reply(message, `Hello, ${res.user.name}!`);
    } else {
      bot.reply(message, 'Hello there!');
    }
  });
});

// FOOD CONVERSATION
// the function below, and the followup conversation functions, are based largely on code
// provided by 'howdyai' by their repositories at
// https://github.com/howdyai/botkit/blob/master/examples/convo_bot.js and https://github.com/howdyai/botkit
// the code provides a way to carry on a directed conversation.
controller.hears(['hungry'], ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  function confirmHunger(response, convo) {
    convo.ask('Would you like food recommendations near you?', [
      {
        pattern: bot.utterances.yes,
        callback(resp, conv) {
          convo.say('Well I would probably use Google');
          getFoodType(resp, conv);
          convo.next();
        },
      },
      {
        pattern: bot.utterances.no,
        callback(resp, conv) {
          convo.say('No? Well ask me anytime, I\'ll be around here somewhere!');
          convo.next();
        },
      },
      {
        default: true,
        callback(resp, conv) {
          convo.say('I\'ll take that as a no? Well, ask anytime!');
          convo.next();
        },
      },
    ]);
  }

  function getFoodType(response, convo) {
    convo.ask('Just kidding! What type of food are you interested in?', (resp, conv) => {
      conv.say('Okay.');
      getLocation(resp, conv);
      conv.next();
    });
  }

  function getLocation(foodResponse, convo) {
    convo.ask('Where are you?', (locationResponse, conv) => {
      conv.say('Ok! One sec. Pulling up results');

      // the following function call is based off the code provided at
      // https://github.com/olalonde/node-yelp
      // it makes a call to the yelp api using the yelp module from olalande
      yelp.search({ term: foodResponse.text, location: locationResponse.text, radius_filter: 8000 })
        .then((data) => {
          let openCount = 0;
          let highestRated = null;
          data.businesses.forEach((b) => {
            if (!b.isClosed) {
              openCount++;
              highestRated = (highestRated == null || b.rating > highestRated.rating) ? b : highestRated;
            }
          });

          conv.say(`There are ${openCount} currently open businesses near you matching your search for
             ${foodResponse.text}.`);

          // the following message with attachments construction is based off of code
          // https://api.slack.com/docs/message-attachments
          // it constructs a formatted slack message with attachments
          const topRatedMessage = {
            attachments: [
              {
                title: `<${highestRated.url}|${highestRated.name}>`,
                text: `${highestRated.snippet_text}`,
                pretext: `*${highestRated.name}* recieved the highest average rating of *${highestRated.rating}*`,
                image_url: `${highestRated.image_url}`,
                mrkdwn_in: [
                  'title',
                  'text',
                  'pretext',
                ],
                color: '#CCFFCC',
              },
            ],
          };

          conv.say(topRatedMessage);
          convo.next();
        })
        .catch((err) => {
          convo.say('There appears to be an error in querying Yelp. Sorry!');
          convo.next();
          console.error(err);
        });
    });
  }

  bot.startConversation(message, confirmHunger);
});

// WEATHER CONVERSATION
// the function below, and the followup conversation functions, are based largely on code
// provided by 'howdyai' by their repositories at
// https://github.com/howdyai/botkit/blob/master/examples/convo_bot.js and https://github.com/howdyai/botkit
// the code provides a way to carry on a directed conversation.
controller.hears(['weather', 'sun(.*)', 'rain(.*)', 'snow(.*)'], ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  function confirmWeather(response, convo) {
    convo.ask('Would you like a weather report?', [
      {
        pattern: bot.utterances.yes,
        callback(resp, conv) {
          getLocation(resp, conv);
          convo.next();
        },
      },
      {
        pattern: bot.utterances.no,
        callback(resp, conv) {
          convo.say('No? Good luck out there!');
          convo.next();
        },
      },
      {
        default: true,
        callback(resp, conv) {
          convo.say('I\'ll take that as a no? Well, ask anytime!');
          convo.next();
        },
      },
    ]);
  }

  function getLocation(response, convo) {
    convo.ask('Where are you?', (locationResponse, conv) => {
      conv.say('Ok! One sec. Pulling up results');

      // geocode call is based off of code at https://www.npmjs.com/package/node-geocoder
      // takes human address and returns lat and long
      geocoder.geocode(locationResponse.text)
        .then((res) => {
          console.log(res);
          // forecast call based off of code at https://www.npmjs.com/package/forecast
          // takes lat and long and returns weather report
          forecast.get([res[0].latitude, res[0].longitude], (err, weather) => {
            // the following message with attachments construction is based off of code
            // https://api.slack.com/docs/message-attachments
            // it constructs a formatted slack message with attachments
            const weatherMessage = {
              attachments: [
                {
                  title: `Weather Report For ${locationResponse.text}`,
                  fields: [
                    {
                      title: 'Conditions',
                      value: `${weather.currently.summary}`,
                      short: true,
                    },
                    {
                      title: 'Temperature',
                      value: `${weather.currently.temperature} f`,
                      short: true,
                    },
                    {
                      title: 'Chance of Rain',
                      value: `${weather.currently.precipProbability * 100}%`,
                      short: true,
                    },
                    {
                      title: 'Wind Speed',
                      value: `${weather.currently.windSpeed * 0.621371} mph`,
                      short: true,
                    },
                  ],
                  color: '#FFCC00',
                },
              ],
            };

            conv.say(weatherMessage);
            convo.next();
          });
        })
        .catch((err) => {
          console.log(err);
        });
    });
  }

  bot.startConversation(message, confirmWeather);
});

// respond to help
controller.hears(['help'], ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  controller.reply('Want to know about the weather outside or anywhere in the world? Simply ask me something like \'How\'s the weather?\', and I\'ll get you a full report!');
  controller.reply('Hungry? Tell me! Let me know \'I\'m hungry\', for example, and I\'ll help you find just what you\'re looking for');
});

// reply to a direct mention - @bot hello
controller.on('direct_mention', (bot, message) => {
  // reply to _message_ by using the _bot_ object
  bot.reply(message, 'robot-robin is at your service, but I can\'t understand everything! Tell me \'help\' to hear what I can do.');
});

// reply to a direct message
controller.on('direct_message', (bot, message) => {
  // reply to _message_ by using the _bot_ object
  bot.reply(message, 'robot-robin is at your service, but I can\'t understand everything! Tell me \'help\' to hear what I can do. https://media4.giphy.com/media/3o7WTrvW0BNBaHrF4c/200.gif');
});


controller.on('outgoing_webhook', (bot, message) => {
  // reply to _message_ by using the _bot_ object
  const response = {
    text: 'Just a quick sip of coffee and I\'ll be ready http://giphy.com/gifs/coffee-gif-brockurealities-DrJm6F9poo4aA',
    unfurl_links: true,
    unfurl_media: true,
  };
  bot.replyPublic(message, response);
});

console.log('starting bot');
