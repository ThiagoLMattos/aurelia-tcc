// @ts-nocheck

import { Stack, useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { Layout, PatientColors, PatientTypography, Shadow } from '@/constants/theme-elder';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Ionicons from '@expo/vector-icons/Ionicons';

// Data dinâmica — atualiza automaticamente todo dia
const today = new Date().toLocaleDateString('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

// Dados falsos — substituir pela API do cuidador depois

// Adendos:
// O nome deve ter no máximo 15 caracteres, se não estraga o header e fica poluído.
// Nessa lista de tarefas temos que pensar em uma forma de fazer sentido, então pensei em adicionar
// pro cuidador uma forma dele poder adicionar 7 tarefas como "importantes".
const PATIENT_DATA = {
  name: 'Maria Aparecida',
  date: today,
  tasks: [
    { id: '1', name: 'Omeprazol', time: '07:00' },
    { id: '2', name: 'Caminhada', time: '08:30' },
    { id: '3', name: 'Café da manhã', time: '09:00' },
    { id: '4', name: 'Losartana', time: '12:00' },
    { id: '5', name: 'Almoço', time: '12:30' },
    { id: '6', name: 'Repouso', time: '14:00' },
    { id: '7', name: 'Metformina', time: '19:00' },
  ],
};

export default function PatientHomeScreen() {
  const router = useRouter();

  // Relógio em tempo real — sincroniza com o horário do sistema, atualiza a cada 10s
  const [currentTime, setCurrentTime] = useState(
    new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(
        new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      );
    }, 10000);
    return () => clearInterval(interval); // limpa ao sair da tela
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor={PatientColors.aureliaMain} />
      <Stack.Screen options={{ headerShown: false }} />

      {/* Cabeçalho */}
      <View style={styles.header}>
        <Text style={styles.greetingText}>
          OLÁ {PATIENT_DATA.name.toUpperCase()}
        </Text>

        {/* Hora à esquerda, data à direita */}
        <View style={styles.dateTimeRow}>
          <Text style={styles.timeText}>{currentTime}</Text>
          <Text style={styles.dateText}>{PATIENT_DATA.date}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Cartão de resumo */}
        <View style={styles.summaryCard}>
          {PATIENT_DATA.tasks.slice(0, 7).map((task) => (
            <View key={task.id} style={styles.taskRow}>
              <Text style={styles.taskName}>{task.id} - {task.name}</Text>
              <Text style={styles.dots} numberOfLines={1} ellipsizeMode="clip">
                ....................................................................................................
              </Text>
              <Text style={styles.taskTime}>{task.time}</Text>
            </View>
          ))}
        </View>

        {/* Grade de botões */}
        <View style={styles.buttonGrid}>

          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.gridButton, { backgroundColor: PatientColors.sosMain }]}
            onPress={() => router.push('/sos-elder' as any)}
          >
            <MaterialCommunityIcons name="alarm-light-outline" size={64} color="#FCEBEB" />
            <Text style={styles.sosButtonText}>SOS</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.gridButton, { backgroundColor: PatientColors.tasksMain }]}
            onPress={() => router.push('/task-elder' as any)}
          >
            <MaterialCommunityIcons name="list-box-outline" size={64} color="#E8F8EB" />
            <Text style={styles.tasksButtonText}>TAREFAS</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.gridButton, { backgroundColor: PatientColors.gamesMain }]}
            onPress={() => router.push('/games-elder' as any)}
          >
            <MaterialCommunityIcons name="puzzle-outline" size={64} color="#FFFFFF" />
            <Text style={styles.gamesButtonText}>JOGOS</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.gridButton, { backgroundColor: PatientColors.phoneMain }]}
            onPress={() => router.push('/phone-elder' as any)}
          >
            <Ionicons name="call" size={64} color="#E6F1FB" />
            <Text style={styles.phoneButtonText}>TELEFONE</Text>
          </TouchableOpacity>

        </View>

        {/* Botão Aurélia */}
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.aureliaButton, { backgroundColor: PatientColors.aureliaMain }]}
          onPress={() => router.push('/aurelia' as any)}
        >
          <View style={styles.avatarCircle}>
            <Image source={require('@/assets/images/LogoAvatar.png')} style={styles.avatarImage} resizeMode="contain" />
          </View>
          <Text style={styles.aureliaButtonText}>CONVERSAR COM AURÉLIA</Text>
        </TouchableOpacity>

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
    right: 15,
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

  // Cartão de resumo
  scrollContent: {
    padding: 25,
    gap: 37,
  },
  summaryCard: {
    backgroundColor: '#FAEEDA',
    borderColor: '#412402',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 200,
    ...Shadow.medium,
  },
  taskRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginVertical: 1,
  },
  taskName: {
    fontSize: PatientTypography.size.minimum,
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
    fontSize: PatientTypography.size.minimum,
    fontWeight: 'bold',
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
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 15,
    borderRadius: 10,
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
  avatarImage: {
    width: 45,
    height: 45,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aureliaButtonText: {
    color: PatientColors.aureliaHeaderText,
    fontSize: PatientTypography.size.reduced,
    fontWeight: PatientTypography.weight.bold,
  },
});