// @ts-nocheck

import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import HomeButton from '@/components/HomeButton';
import { Layout, PatientColors, PatientTypography, Shadow } from '@/constants/theme';

// ─── Dados falsos — substituir pela API do cuidador depois ───────────────────
const PATIENT_DATA = {
  name: 'Maria Aparecida',
  date: '22/07/2026',
  tasks: [
    { id: '1', name: ' - Omeprazol',     time: '07:00' },
    { id: '2', name: ' - Caminhada',     time: '08:30' },
    { id: '3', name: ' - Café da manhã', time: '09:00' },
    { id: '4', name: ' - Losartana',     time: '12:00' },
    { id: '5', name: ' - Almoço',        time: '12:30' },
    { id: '6', name: ' - Repouso',       time: '14:00' },
    { id: '7', name: ' - Metformina',    time: '19:00' },
  ],
};

export default function PatientHomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.greetingText}>
          OLÁ {PATIENT_DATA.name.toUpperCase()}
        </Text>
        <Text style={styles.dateText}>{PATIENT_DATA.date}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Card resumo ── */}
        <View style={styles.summaryCard}>
          {PATIENT_DATA.tasks.slice(0, 7).map((task) => (
            <View key={task.id} style={styles.taskRow}>
              <Text style={styles.taskName}>{task.id}{task.name}</Text>
              <Text style={styles.dots} numberOfLines={1} ellipsizeMode="clip">
                ....................................................................................................
              </Text>
              <Text style={styles.taskTime}>{task.time}</Text>
            </View>
          ))}
        </View>

        {/* ── Grade de 4 botões ── */}
        <View style={styles.buttonGrid}>

          <HomeButton
            backgroundColor={PatientColors.sosMain}
            onPress={() => router.push('/sos' as any)}
            customStyle={styles.gridButtonAdjustment}
          >
            <Image source={require('@/assets/images/Emergencia_icon.png')} />
            <Text style={styles.sosButtonText}>SOS</Text>
          </HomeButton>

          <HomeButton
            backgroundColor={PatientColors.tasksMain}
            onPress={() => router.push('/tarefa-idoso' as any)}
            customStyle={styles.gridButtonAdjustment}
          >
            <Image source={require('@/assets/images/Tarefas_icon.png')} />
            <Text style={styles.tasksButtonText}>TAREFAS</Text>
          </HomeButton>

          <HomeButton
            backgroundColor={PatientColors.gamesMain}
            onPress={() => router.push('/jogos-idoso' as any)}
            customStyle={styles.gridButtonAdjustment}
          >
            <Image source={require('@/assets/images/Jogos_icon.png')} />
            <Text style={styles.gamesButtonText}>JOGOS</Text>
          </HomeButton>

          <HomeButton
            backgroundColor={PatientColors.phoneMain}
            onPress={() => router.push('/telefone' as any)}
            customStyle={styles.gridButtonAdjustment}
          >
            <Image source={require('@/assets/images/Telefone_icon.png')} />
            <Text style={styles.phoneButtonText}>TELEFONE</Text>
          </HomeButton>

        </View>

        {/* ── Botão Aurélia ── */}
        <HomeButton
          backgroundColor={PatientColors.aureliaMain}
          onPress={() => router.push('/aurelia' as any)}
          customStyle={styles.aureliaButtonAdjustment}
        >
          <View style={styles.avatarCircle}>
            <Image source={require('@/assets/images/LogoAvatar.png')} />
          </View>
          <Text style={styles.aureliaButtonText}>CONVERSAR COM AURÉLIA</Text>
        </HomeButton>

      </ScrollView>
    </View>
  );
}

// ─── Estilos ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // ── Header — mantido como estava ────────────────────────────────────────────
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
    right: 15,
    marginTop: 10,
  },
  dateText: {
    color: PatientColors.homeHeaderSubtitle,
    fontSize: PatientTypography.size.common,
    textAlign: 'right',
    marginTop: 15,
  },

  // ── Card resumo — mantido como estava ───────────────────────────────────────
  scrollContent: {
    padding: 25,
    gap: 40,
  },
  summaryCard: {
    backgroundColor: '#FAEEDA',
    borderColor: '#412402',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 225,
    ...Shadow.medium,
  },
  taskRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginVertical: 1,
  },
  taskName: {
    fontSize: PatientTypography.size.reduced,
    fontWeight: 'bold',
    color: '#000000',
  },
  dots: {
    flex: 1,
    color: '#A09580',
    fontSize: PatientTypography.size.minimum,
    letterSpacing: 2,
    marginHorizontal: 6,
    overflow: 'hidden',
  },
  taskTime: {
    fontSize: PatientTypography.size.reduced,
    fontWeight: 'bold',
    color: '#000000',
  },

  // ── Grade de botões ─────────────────────────────────────────────────────────
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 35,
  },
  gridButtonAdjustment: {
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
    fontSize: 28,
    fontWeight: PatientTypography.weight.bold,
  },

  // ── Botão Aurélia ───────────────────────────────────────────────────────────
  aureliaButtonAdjustment: {
    width: '100%',
    paddingVertical: 16,
    gap: 15,
    borderRadius: 10,
    marginTop: 5,
    ...Shadow.medium,
  },
  avatarCircle: {
    width: 35,
    height: 35,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aureliaButtonText: {
    color: PatientColors.aureliaHeaderText,
    fontSize: PatientTypography.size.reduced,
    fontWeight: PatientTypography.weight.bold,
  },
});