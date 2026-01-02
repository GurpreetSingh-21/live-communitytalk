const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');
const path = require('path'); // <-- 1. Add this line

const config = getDefaultConfig(__dirname);


config.resolver.alias = {
  ...(config.resolver.alias || {}), 
  'tslib': path.resolve(__dirname, 'node_modules/tslib/tslib.js'),
};

// 3. Pass the modified config to withNativeWind
module.exports = withNativeWind(config, { input: './global.css' });