// react-native-sherpa-onnx (Aurélia's on-phone voice) pulls in a background downloader for its own
// model download manager, which the app does not use: the voice is downloaded with react-native-fs.
// Keeping it out of the native build avoids its foreground-service permissions and code.
module.exports = {
  dependencies: {
    '@kesha-antonov/react-native-background-downloader': { platforms: { android: null, ios: null } },
  },
};
