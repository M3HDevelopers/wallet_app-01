module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'react' }],
      'expo-router/babel',
    ],
    plugins: ['react-native-reanimated/plugin'],
  };
};
