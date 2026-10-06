import { Image } from 'react-native';

/** The Aurélia "A", on a transparent background. */
export function Logo({ size = 72 }: { size?: number }) {
  return (
    <Image
      source={require('../../assets/images/logo.png')}
      style={{ width: size, height: size, alignSelf: 'center' }}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="Aurélia"
    />
  );
}
