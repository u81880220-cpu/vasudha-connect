const app = require("./app.json");

module.exports = ({ config }) => {
  const base = { ...app.expo, ...config };
  const plugins = Array.isArray(base.plugins) ? [...base.plugins] : [];
  const hasMaps = plugins.some((plugin) => Array.isArray(plugin) && plugin[0] === "react-native-maps");
  if (!hasMaps) {
    plugins.push([
      "react-native-maps",
      {
        androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY || ""
      }
    ]);
  }
  return { ...base, plugins };
};
