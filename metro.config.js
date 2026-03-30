const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);

if (!config.resolver.assetExts.includes('html')) {
  config.resolver.assetExts.push('html');
}

module.exports = config;
