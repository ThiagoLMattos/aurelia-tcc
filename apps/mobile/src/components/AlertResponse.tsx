import { ESCALATE_AFTER_MIN, type AlertEvent } from '@aurelia/shared';
import { StyleSheet, Text, View } from 'react-native';

import { clockTime } from '@/lib/format';
import { Colors, Radius, Spacing, Typography } from '@/theme';

import { Button } from './Button';

interface AlertResponseProps {
  alert: AlertEvent | undefined;
  timezone: string;
  now: Date;
  /** True when the contacts will be texted if nobody answers: "me, then the contacts" and at least one emergency contact. */
  escalates: boolean;
  /** "Estou cuidando disso": shown only while nobody has answered. */
  action?: { title: string; onPress: () => void; loading: boolean };
}

/**
 * Where an SOS / safe-zone exit stands: who is handling it, or — while nobody is — when the emergency
 * contacts get an SMS, or that they already got one.
 */
export function AlertResponse({ alert, timezone, now, escalates, action }: AlertResponseProps) {
  if (!alert) return null;
  const { acknowledgedAt, acknowledgedBy, escalatedAt } = alert.payload;

  if (acknowledgedAt) {
    return (
      <View style={[styles.box, styles.handled]} accessibilityRole="summary">
        <Text style={[styles.title, styles.handledText]}>
          ✓ {acknowledgedBy ?? 'Um cuidador'} está cuidando disso
        </Text>
        <Text style={styles.sub}>
          Desde as {clockTime(acknowledgedAt, timezone)}.
          {escalatedAt ? ` Os contatos de emergência já tinham sido avisados às ${clockTime(escalatedAt, timezone)}.` : ''}
        </Text>
      </View>
    );
  }

  const deadline = new Date(Date.parse(alert.at) + ESCALATE_AFTER_MIN * 60_000);
  const minutesLeft = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / 60_000));

  return (
    <View style={[styles.box, escalatedAt ? styles.escalated : styles.pending]} accessibilityRole="summary">
      {escalatedAt ? (
        <>
          <Text style={[styles.title, styles.escalatedText]}>Contatos de emergência avisados por SMS</Text>
          <Text style={styles.sub}>Ninguém respondeu a tempo; o SMS saiu às {clockTime(escalatedAt, timezone)}.</Text>
        </>
      ) : escalates ? (
        <>
          <Text style={[styles.title, styles.pendingText]}>Ninguém respondeu ainda</Text>
          <Text style={styles.sub}>
            {minutesLeft > 0
              ? `Se ninguém responder até as ${clockTime(deadline.toISOString(), timezone)} (em ${minutesLeft} min), os contatos de emergência recebem um SMS.`
              : 'Os contatos de emergência estão sendo avisados por SMS.'}
          </Text>
        </>
      ) : (
        <Text style={styles.sub}>Avise os outros cuidadores que você está cuidando disso.</Text>
      )}
      {action ? <Button title={action.title} variant="secondary" onPress={action.onPress} loading={action.loading} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm, borderWidth: 1 },
  handled: { backgroundColor: Colors.successBg, borderColor: Colors.successText },
  pending: { backgroundColor: Colors.warningBg, borderColor: Colors.warningText },
  escalated: { backgroundColor: Colors.dangerBg, borderColor: Colors.dangerText },
  title: { fontSize: Typography.size.md, fontWeight: Typography.weight.semibold },
  handledText: { color: Colors.successText },
  pendingText: { color: Colors.warningText },
  escalatedText: { color: Colors.dangerText },
  sub: { fontSize: Typography.size.base, color: Colors.textPrimary, lineHeight: 20 },
});
