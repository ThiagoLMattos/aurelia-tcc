import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontSizes, palette, Spacing, type Role } from '@/theme';

/** Back chevron + title for pushed screens (the same chevron the custom caregiver headers use). */
export function ScreenHeader({ title, role = 'caregiver' }: { title: string; role?: Role }) {
  const router = useRouter();
  const colors = palette[role];
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Voltar"
        hitSlop={12}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      >
        <IconSymbol name="chevron.left" size={22} color={colors.text} />
      </Pressable>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text, fontSize: fontSizes[role].title }]}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  title: { fontWeight: '700', flex: 1 },
});
