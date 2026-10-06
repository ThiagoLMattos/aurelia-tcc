import { CAREGIVER_INVITE_TTL_HOURS } from '@aurelia/shared';
import { useEffect, useRef } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';

import { Button, Card, ErrorState, LoadingState, Screen, ScreenHeader } from '@/components';
import { friendlyError } from '@/lib/errors';
import { firstName } from '@/lib/format';
import { useCurrentElder, useIssueCaregiverInvite, useNow } from '@/queries';
import { Colors, Spacing, Typography } from '@/theme';

/** Issues an invite for another caregiver (family member, carer) and lets the caregiver send it. */
export default function InviteCaregiverScreen() {
  const elder = useCurrentElder();
  const issue = useIssueCaregiverInvite(elder.id);
  const now = useNow();
  const started = useRef(false);
  const name = firstName(elder.name);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    issue.mutate();
  }, [issue]);

  const expired = issue.data !== undefined && Date.parse(issue.data.expiresAt) <= now.getTime();

  function send(code: string) {
    void Share.share({
      message:
        `Convite para acompanhar ${name} no Aurélia: instale o app, crie sua conta de cuidador e, em "Quem você cuida?", ` +
        `toque em "Tenho um código de convite" e digite ${code}. O código vale por ${CAREGIVER_INVITE_TTL_HOURS} horas.`,
    });
  }

  return (
    <Screen scroll>
      <ScreenHeader title="Convidar cuidador" />
      <Text style={styles.lead}>
        Quem entrar com este código acompanha {name} com você: vê a rotina, o histórico e a localização, e recebe os alertas.
      </Text>

      {issue.isPending && !issue.data ? <LoadingState message="Gerando convite…" /> : null}
      {issue.isError ? <ErrorState message={friendlyError(issue.error)} onRetry={() => issue.mutate()} /> : null}

      {issue.data ? (
        <Card style={styles.codeCard}>
          <Text accessibilityLabel={`Código ${issue.data.code.split('').join(' ')}`} style={[styles.code, expired && styles.expired]}>
            {issue.data.code}
          </Text>
          <Text style={styles.timer}>{expired ? 'Convite expirado' : `Vale por ${CAREGIVER_INVITE_TTL_HOURS} horas`}</Text>
        </Card>
      ) : null}

      <View style={styles.actions}>
        {issue.data && !expired ? <Button title="Enviar convite" onPress={() => send(issue.data.code)} /> : null}
        <Button
          title="Gerar novo convite"
          variant={expired ? 'primary' : 'secondary'}
          loading={issue.isPending && issue.data !== undefined}
          onPress={() => issue.mutate()}
        />
      </View>
      <Text style={styles.hint}>
        O convite só pode ser usado uma vez. Gerar um novo cancela o anterior. Você pode remover um cuidador a qualquer momento em Perfil.
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
