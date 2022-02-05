const Sentry = require('@sentry/node');
// or use es6 import statements
// import * as Sentry from '@sentry/node';

const Tracing = require('@sentry/tracing');
// or use es6 import statements
// import * as Tracing from '@sentry/tracing';

Sentry.init({
  dsn: `${process.env.DSN_SENTRY_URL}`,

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,
});

module.exports = Sentry;
