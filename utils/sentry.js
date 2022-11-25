require( 'dotenv/config');
const Sentry = require( '@sentry/node');
// Importing @sentry/tracing patches the global hub for tracing to work.
//const Tracing = require( '@sentry/tracing');

Sentry.init({
  dsn: process.env.SENTRY_DSN_COWLLECTOR,

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0
});

module.exports = Sentry;
