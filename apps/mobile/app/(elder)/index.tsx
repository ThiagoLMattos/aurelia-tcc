import { localTimeOf, type AgendaItem } from '@aurelia/shared';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { friendlyError } from '@/lib/errors';
import { firstName } from '@/lib/format';
import { useAgenda, useContacts, useElderSelf, useNow, useToday } from '@/queries';
import { Layout, PatientColors, PatientTypography, Shadow } from '@/theme';
import { withTap } from '@/sound';

/** The first task of today that is still open: the one the elder should do next. */
function nextTaskOf(items: readonly AgendaItem[]): AgendaItem | undefined {
  return items.find((item) => item.status === 'now' || item.status === 'pending' || item.status === 'upcoming');
}

export default function PatientHomeScreen() {
  const router = useRouter();
  const elder = useElderSelf();
  const today = useToday(elder);
  const now = useNow(10_000);
  const agenda = useAgenda(elder.id, today);
  // Opened here so the contacts are already loaded (and kept) by the time the SOS screen needs them.
  useContacts(elder.id);

  const [year, month, day] = today.split('-');
  const dateLabel = `${day}/${month}/${year}`;
  const timeLabel = localTimeOf(now, elder.timezone);
  const next = useMemo(() => nextTaskOf(agenda.data?.items ?? []), [agenda.data]);

  let taskTitle = 'Próxima tarefa';
  let taskLine = 'Carregando…';
  if (agenda.isError) {
    taskLine = friendlyError(agenda.error);
  } else if (agenda.data) {
    if (next) taskLine = `${next.time} — ${next.name}`;
    else taskLine = agenda.data.items.length > 0 ? 'Tudo feito por hoje!' : 'Nenhuma tarefa para hoje.';
    if (!next) taskTitle = 'Tarefas de hoje';
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor={PatientColors.aureliaMain} />

      {/* Cabeçalho */}
      <View style={styles.header}>
        <Text style={styles.greetingText} numberOfLines={1} adjustsFontSizeToFit accessibilityRole="header">
          OLÁ {firstName(elder.name).toUpperCase()}
        </Text>

        {/* Hora à esquerda, data à direita */}
        <View style={styles.dateTimeRow}>
          <Text style={styles.timeText}>{timeLabel}</Text>
          <Text style={styles.dateText}>{dateLabel}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Próxima tarefa */}
        <Pressable
          style={styles.summaryCard}
          onPress={withTap(() => router.push('/(elder)/tasks'))}
          accessibilityRole="button"
          accessibilityLabel={`${taskTitle}. ${taskLine}. Toque para ver as tarefas.`}
        >
          <Text style={styles.summaryTitle}>{taskTitle}</Text>
          <Text style={styles.summaryTask}>{taskLine}</Text>
        </Pressable>

        {/* Grade de botões */}
        <View style={styles.buttonGrid}>
          <Pressable
            style={[styles.gridButton, { backgroundColor: PatientColors.sosMain }]}
            onPress={withTap(() => router.push('/(elder)/sos'))}
            accessibilityRole="button"
            accessibilityLabel="SOS. Pedir ajuda"
          >
            <MaterialCommunityIcons name="alarm-light-outline" size={64} color="#FCEBEB" />
            <Text style={styles.sosButtonText}>SOS</Text>
          </Pressable>

          <Pressable
            style={[styles.gridButton, { backgroundColor: PatientColors.tasksMain }]}
            onPress={withTap(() => router.push('/(elder)/tasks'))}
            accessibilityRole="button"
            accessibilityLabel="Tarefas"
          >
            <MaterialCommunityIcons name="list-box-outline" size={64} color="#E8F8EB" />
            <Text style={styles.tasksButtonText}>TAREFAS</Text>
          </Pressable>

          <Pressable
            style={[styles.gridButton, { backgroundColor: PatientColors.gamesMain }]}
            onPress={withTap(() => router.push('/(elder)/games'))}
            accessibilityRole="button"
            accessibilityLabel="Jogos"
          >
            <MaterialCommunityIcons name="puzzle-outline" size={64} color="#FFFFFF" />
            <Text style={styles.gamesButtonText}>JOGOS</Text>
          </Pressable>

          <Pressable
            style={[styles.gridButton, { backgroundColor: PatientColors.phoneMain }]}
            onPress={withTap(() => router.push('/(elder)/phone'))}
            accessibilityRole="button"
            accessibilityLabel="Telefone"
          >
            <Ionicons name="call" size={64} color="#E6F1FB" />
            <Text style={styles.phoneButtonText}>TELEFONE</Text>
          </Pressable>
        </View>

        {/* Botão Aurélia */}
        <Pressable
          style={[styles.aureliaButton, { backgroundColor: PatientColors.aureliaMain }]}
          onPress={withTap(() => router.push('/(elder)/assistant'))}
          accessibilityRole="button"
          accessibilityLabel="Conversar com a Aurélia"
        >
          <MaterialCommunityIcons name="chat-processing-outline" size={56} color={PatientColors.aureliaHeaderText} />
          <View style={styles.aureliaLabel}>
            <Text style={styles.aureliaButtonText}>CONVERSAR</Text>
            <Text style={styles.aureliaButtonSub}>com a Aurélia</Text>
          </View>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

// Estilos
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // Cabeçalho
  header: {
    backgroundColor: PatientColors.homeHeader,
    paddingHorizontal: 25,
    height: Layout.headerHeight,
    ...Shadow.header,
  },
  greetingText: {
    color: PatientColors.homeHeaderText,
    fontSize: 28,
    fontWeight: '500',
    marginTop: 10,
  },
  dateTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 15,
  },
  timeText: {
    color: PatientColors.homeHeaderSubtitle,
    fontSize: PatientTypography.size.common,
  },
  dateText: {
    color: PatientColors.homeHeaderSubtitle,
    fontSize: PatientTypography.size.common,
    textAlign: 'right',
  },

  // Cartão da próxima tarefa
  scrollContent: {
    padding: 25,
    gap: 37,
  },
  summaryCard: {
    backgroundColor: '#FAEEDA',
    borderColor: '#412402',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 20,
    paddingHorizontal: 16,
    gap: 8,
    minHeight: 120,
    justifyContent: 'center',
    ...Shadow.medium,
  },
  summaryTitle: {
    fontSize: PatientTypography.size.reduced,
    fontWeight: PatientTypography.weight.bold,
    color: '#412402',
  },
  summaryTask: {
    fontSize: PatientTypography.size.common,
    fontWeight: PatientTypography.weight.bold,
    color: '#000000',
  },

  // Grade de botões
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 30,
  },
  gridButton: {
    width: 150,
    height: 130,
    flexDirection: 'column',
    borderRadius: 10,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.medium,
  },
  sosButtonText: {
    color: PatientColors.sosHeaderText,
    fontSize: PatientTypography.size.header,
    fontWeight: PatientTypography.weight.bold,
  },
  tasksButtonText: {
    color: PatientColors.tasksHeaderText,
    fontSize: PatientTypography.size.backButton,
    fontWeight: PatientTypography.weight.bold,
  },
  gamesButtonText: {
    color: PatientColors.gamesHeaderText,
    fontSize: PatientTypography.size.header,
    fontWeight: PatientTypography.weight.bold,
  },
  phoneButtonText: {
    color: PatientColors.phoneHeaderText,
    fontSize: 26.9,
    fontWeight: PatientTypography.weight.bold,
  },

  // Botão Aurélia
  aureliaButton: {
    width: '100%',
    minHeight: 110,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 18,
    borderRadius: 10,
    ...Shadow.medium,
  },
  aureliaLabel: {
    alignItems: 'flex-start',
  },
  aureliaButtonText: {
    color: PatientColors.aureliaHeaderText,
    fontSize: PatientTypography.size.header,
    fontWeight: PatientTypography.weight.bold,
  },
  aureliaButtonSub: {
    color: PatientColors.aureliaSubtitle,
    fontSize: PatientTypography.size.common,
    fontWeight: PatientTypography.weight.bold,
  },
});