/**
 * Icon component using MaterialIcons on Android/web and SF Symbols on iOS.
 * Add new icon mappings here as new screens are built.
 * SF Symbol names → https://developer.apple.com/sf-symbols/
 * Material Icon names → https://icons.expo.fyi/
 */

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

const MAPPING = {
  // ── Navigation tabs ─────────────────────────────────────────────────────
  'house.fill': 'home',
  'list.bullet': 'list',
  'clock.fill': 'access-time',
  'person.fill': 'person',

  // ── Actions & states ─────────────────────────────────────────────────────
  'chevron.left': 'chevron-left',
  'chevron.right': 'chevron-right',
  'chevron.left.forwardslash.chevron.right': 'code',
  'paperplane.fill': 'send',
  'plus': 'add',
  'plus.circle.fill': 'add-circle',
  'pencil': 'edit',
  'trash': 'delete',
  'xmark': 'close',
  'xmark.circle.fill': 'cancel',
  'checkmark': 'check',
  'checkmark.circle.fill': 'check-circle',
  'ellipsis': 'more-horiz',

  // ── Alert / status ────────────────────────────────────────────────────────
  'exclamationmark.triangle.fill': 'warning',
  'bell.fill': 'notifications',
  'bell.slash.fill': 'notifications-off',
  'lock.fill': 'lock',

  // ── Location / geo-fence ──────────────────────────────────────────────────
  'location.fill': 'location-on',
  'location.slash.fill': 'location-off',
  'map.fill': 'map',
  'mappin.circle.fill': 'place',

  // ── Communication ─────────────────────────────────────────────────────────
  'phone.fill': 'phone',
  'square.and.arrow.up': 'share',

  // ── Routine types ─────────────────────────────────────────────────────────
  'pills.fill': 'medication',
  'fork.knife': 'restaurant',
  'figure.walk': 'directions-walk',
  'star.fill': 'star',

  // ── Misc ──────────────────────────────────────────────────────────────────
  'gear': 'settings',
  'arrow.right.circle.fill': 'arrow-forward',
  'arrow.right.square': 'logout',
  'info.circle': 'info',
  'heart.fill': 'favorite',
  'shield.fill': 'shield',
  'lock.shield.fill': 'security',
  'link': 'link',
  'person.badge.plus': 'person-add',
  'person.2.fill': 'group',
  'globe': 'language',
  'questionmark.circle.fill': 'help',
  'sparkles': 'auto-awesome',
  'bubble.left.fill': 'chat',
} as IconMapping;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}

// Re-export the type so screens can type icon name props
export type { IconSymbolName };
