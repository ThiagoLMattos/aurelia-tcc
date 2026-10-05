import { PAIRING_CODE_TTL_MIN } from '@aurelia/shared';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, ErrorState, LoadingState, Screen, ScreenHeader } from '@/components';
import { friendlyError } from '@/lib/errors';
import { firstName } from '@/lib/format';
import { useCurrentElder, useIssuePairingCode, useNow } from '@/queries';
import { Colors, Spacing, Typography } from '@/theme';

/** Issues a pairing code for the elder's phone and counts down to its expiry. */
export default function PairElderScreen() {
  const elder = useCurrentElder();
  const issue = useIssuePairingCode(elder.id);
  const now = useNow(1000);
  const started = useRef(false);
  const name = firstName(elder.name);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    issue.mutate();
  }, [issue]);

  const remainingMs = issue.data ? Date.parse(issue.data.expiresAt) - now.getTime() : 0;
  const expired = issue.data !== undefined && remainingMs <= 0;
  const minutes = Math.floor(Math.max(0, remainingMs) / 60_000);
  const seconds = Math.floor((Math.max(0, remainingMs) % 60_000) / 1000);

  return (
    <Screen scroll>
      <ScreenHeader title="Parear o celular" />
      <Text style={styles.lead}>
        Instale o Aurélia no celular de {name} e escolha “Sou o idoso”. Depois digite o código abaixo.
      </Text>

      {issue.isPending && !issue.data ? <LoadingState message="Gerando código…" /> : null}
      {issue.isError ? <ErrorState message={friendlyError(issue.error)} onRetry={() => issue.mutate()} /> : null}

      {issue.data ? (
        <Card style={styles.codeCard}>
          <Text accessibilityLabel={`Código ${issue.data.code.split('').join(' ')}`} style={[styles.code, expired && styles.expired]}>
            {issue.data.code}
          </Text>
          <Text style={styles.timer}>
            {expired ? 'Código expirado' : `Expira em ${minutes}:${String(seconds).padStart(2, '0')}`}
          </Text>
        </Card>
      ) : null}

      <View style={styles.actions}>
        <Button
          title="Gerar novo código"
          variant={expired ? 'primary' : 'secondary'}
          loading={issue.isPending && issue.data !== undefined}
          onPress={() => issue.mutate()}
        />
      </View>
      <Text style={styles.hint}>
        O código vale por {PAIRING_CODE_TTL_MIN} minutos e só pode ser usado uma vez. Parear outro celular desconecta o anterior.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { fontSize: Typography.size.base, color: Colors.textSecondary, lineHeight: 22 },
  codeCard: { alignItems: 'center', paddingVertical: Spacing.xxl },
  code: { fontSize: 48, fontWeight: '700', letterSpacing: 8, color: Colors.primary },
  expired: { color: Colors.textMuted },
  timer: { fontSize: Typography.size.base, color: Colors.textSecondary },
  actions: { gap: Spacing.md },
  hint: { fontSize: Typography.size.sm, color: Colors.textSecondary },
});
