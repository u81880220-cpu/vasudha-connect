const app = require("./app.json");

module.exports = ({ config }) => {
  const base = { ...app.expo, ...config };
  const androidMapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;

  // react-native-maps 1.20.1 does not ship its Expo config plugin.
  // Configure the Android Maps SDK key through Expo's supported app config.
  const android = { ...(base.android || {}) };
  if (androidMapsKey) {
    android.config = {
      ...(android.config || {}),
      googleMaps: {
        ...((android.config && android.config.googleMaps) || {}),
        apiKey: androidMapsKey
      }
    };
  }

  return { ...base, android };
};
