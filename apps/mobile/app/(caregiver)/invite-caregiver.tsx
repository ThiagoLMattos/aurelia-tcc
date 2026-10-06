import { CAREGIVER_INVITE_TTL_HOURS, LABELS_PT } from '@aurelia/shared';
import { useEffect, useRef } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';

import { Button, Card, ErrorState, LoadingState, Screen, ScreenHeader } from '@/components';
import { confirm } from '@/lib/confirm';
import { friendlyError } from '@/lib/errors';
import { firstName } from '@/lib/format';
import { useCurrentElder, useIssueCaregiverInvite, useNow } from '@/queries';
import { Colors, Spacing, Typography } from '@/theme';

/** "terça, 14:30", in the phone's time zone (the invite is for the person holding it). */
function expiryLabel(iso: string): string {
  const date = new Date(iso);
  const weekday = LABELS_PT.weekdayLong[date.getDay()]?.toLowerCase() ?? '';
  return `${weekday}, ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

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
    // The invite already sent (if any) stays valid; only "Gerar novo convite" replaces it.
    issue.mutate(false);
  }, [issue]);

  const expired = issue.data !== undefined && Date.parse(issue.data.expiresAt) <= now.getTime();

  /** A new invite cancels the one already sent, so ask first while that one still works. */
  async function renew() {
    if (issue.data && !expired) {
      const ok = await confirm('Gerar novo convite', 'O convite atual deixará de valer. Quem ainda não entrou vai precisar do novo código.', 'Gerar', true);
      if (!ok) return;
    }
    issue.mutate(true);
  }

  function send(code: string, expiresAt: string) {
    void Share.share({
      message:
        `Convite para acompanhar ${name} no Aurélia: instale o app, crie sua conta de cuidador e, em "Quem você cuida?", ` +
        `toque em "Tenho um código de convite" e digite ${code}. O código vale até ${expiryLabel(expiresAt)}.`,
    });
  }

  return (
    <Screen scroll>
      <ScreenHeader title="Convidar cuidador" />
      <Text style={styles.lead}>
        Quem entrar com este código acompanha {name} com você: vê a rotina, o histórico e a localização, e recebe os alertas.
      </Text>

      {issue.isPending && !issue.data ? <LoadingState message="Gerando convite…" /> : null}
      {issue.isError ? <ErrorState message={friendlyError(issue.error)} onRetry={() => issue.mutate(false)} /> : null}

      {issue.data ? (
        <Card style={styles.codeCard}>
          <Text accessibilityLabel={`Código ${issue.data.code.split('').join(' ')}`} style={[styles.code, expired && styles.expired]}>
            {issue.data.code}
          </Text>
          <Text style={styles.timer}>{expired ? 'Convite expirado' : `Vale até ${expiryLabel(issue.data.expiresAt)}`}</Text>
        </Card>
      ) : null}

      <View style={styles.actions}>
        {issue.data && !expired ? <Button title="Enviar convite" onPress={() => send(issue.data.code, issue.data.expiresAt)} /> : null}
        <Button
          title="Gerar novo convite"
          variant={expired ? 'primary' : 'secondary'}
          loading={issue.isPending && issue.data !== undefined}
          onPress={() => void renew()}
        />
      </View>
      <Text style={styles.hint}>
        O convite vale por {CAREGIVER_INVITE_TTL_HOURS} horas e só pode ser usado uma vez. Gerar um novo cancela o anterior. Você pode remover um cuidador a qualquer momento em Perfil.
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
