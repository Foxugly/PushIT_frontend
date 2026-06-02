// Karma config wired via angular.json `karmaConfig`. Its purpose is to add the
// `json-summary` coverage reporter so scripts/check-coverage.mjs can read
// coverage/pushit-frontend/coverage-summary.json (the @angular/build:karma
// builder's default only emits html + text-summary, never the JSON the gate
// needs).
//
// IMPORTANT: when `karmaConfig` is set, @angular/build:karma uses an EMPTY base
// and expects this file to supply frameworks/plugins/coverageReporter in full.
// The block below therefore mirrors the builder's built-in config
// (getBuiltInKarmaConfig in @angular/build) plus the extra `json-summary`
// reporter. Keep it in sync if you upgrade @angular/build. `--browsers` from the
// CLI (e.g. ChromeHeadless in test:ci) overrides `browsers` here.
const path = require('node:path');

module.exports = (config) => {
  config.set({
    basePath: '',
    frameworks: ['jasmine'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
    ],
    jasmineHtmlReporter: {
      suppressAll: true, // removes the duplicated traces
    },
    coverageReporter: {
      dir: path.join(__dirname, 'coverage/pushit-frontend'),
      subdir: '.',
      reporters: [{ type: 'html' }, { type: 'text-summary' }, { type: 'json-summary' }],
    },
    reporters: ['progress', 'kjhtml'],
    browsers: ['Chrome'],
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--headless', '--disable-gpu', '--disable-dev-shm-usage'],
      },
    },
    restartOnFileChange: true,
  });
};
