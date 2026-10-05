import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fontSizes, palette, Spacing, type Role } from '@/theme';

/** Back arrow + title for pushed screens. */
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
        <Text style={[styles.back, { color: colors.primary }]}>‹</Text>
      </Pressable>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text, fontSize: fontSizes[role].title }]}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  back: { fontSize: 36, lineHeight: 36, fontWeight: '300' },
  title: { fontWeight: '700', flex: 1 },
});
