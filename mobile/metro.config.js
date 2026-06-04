const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('ttf', 'otf', 'TTF', 'OTF');

module.exports = config;
