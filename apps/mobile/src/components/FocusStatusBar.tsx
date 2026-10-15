import { useIsFocused } from '@react-navigation/native';
import { StatusBar, type StatusBarStyle } from 'expo-status-bar';

/**
 * Status bar style for one screen, applied only while that screen is focused. Tabs and stacked screens
 * stay mounted, and a plain `<StatusBar>` keeps winning by mount order, so the icons would stay white
 * over a white header (or dark over a coloured one) after switching screens.
 */
export function FocusStatusBar({ style }: { style: StatusBarStyle }) {
  return useIsFocused() ? <StatusBar style={style} /> : null;
}
