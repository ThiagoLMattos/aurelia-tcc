// Native build settings for react-native-sherpa-onnx (Aurélia's on-phone voice).
// - FFmpeg is only for converting audio formats, which the app never does; leaving it out keeps the
//   APK much smaller.
// - Phones only: arm64 and 32-bit arm. The x86 builds exist for emulators on Intel PCs and would add
//   the speech engine twice more to the APK.
const { withGradleProperties } = require('expo/config-plugins');

const PROPERTIES = {
  sherpaOnnxDisableFfmpeg: 'true',
  reactNativeArchitectures: 'arm64-v8a,armeabi-v7a',
};

module.exports = function withSherpaOnnx(config) {
  return withGradleProperties(config, (gradle) => {
    for (const [key, value] of Object.entries(PROPERTIES)) {
      gradle.modResults = gradle.modResults.filter((item) => !(item.type === 'property' && item.key === key));
      gradle.modResults.push({ type: 'property', key, value });
    }
    return gradle;
  });
};
