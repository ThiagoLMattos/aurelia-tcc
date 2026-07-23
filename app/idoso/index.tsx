// @ts-nocheck

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { Stack, useRouter } from 'expo-router';

// Importação dos tokens de tema e do componente customizado de botão
import { PatientColors, Shadow } from '@/constants/theme';
import HomeButton from '@/components/components_idoso/BotaoHome';

// Dados simulados para a interface de tarefas do paciente
const PATIENT_DATA = {
  name: 'Maria Aparecida',
  date: '22/07/2026',
  tasks: [
    { id: '1', name: ' - Omeprazol', time: '14:00' },
    { id: '2', name: ' - Tarefa', time: '00:00' },
    { id: '3', name: ' - Tarefa', time: '00:00' },
    { id: '4', name: ' - Tarefa', time: '00:00' },
    { id: '5', name: ' - Tarefa', time: '00:00' },
    { id: '6', name: ' - Tarefa', time: '00:00' },
    { id: '7', name: ' - Tarefa', time: '00:00' },
  ]
};

export default function PatientHomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Cabeçalho verde com nome e data */}
      <View style={styles.header}>
        <Text style={styles.greetingText}>
          OLÁ {PATIENT_DATA.name.toUpperCase()}
        </Text>
        <Text style={styles.dateText}>{PATIENT_DATA.date}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Cartão de resumo das tarefas (fundo creme) */}
        <View style={styles.summaryCard}>
          {PATIENT_DATA.tasks.slice(0, 7).map((task) => (
            <View key={task.id} style={styles.taskRow}>
              <Text style={styles.taskName}>{task.id}{task.name}</Text>
              
              {/* Pontilhado dinâmico estilo sumário */}
              <Text style={styles.dots} numberOfLines={1} ellipsizeMode="clip">
                ....................................................................................................
              </Text>
              
              <Text style={styles.taskTime}>{task.time}</Text>
            </View>
          ))}
        </View>

        {/* Grade de 4 botões usando o componente HomeButton */}
        <View style={styles.buttonGrid}>
          
          {/* Botão SOS */}
          <HomeButton 
            backgroundColor={PatientColors.sosMain} 
            onPress={() => router.push('/sos' as any)}
            customStyle={styles.gridButtonAdjustment}
          >
            <Image 
              source={require('@/assets/images/Emergencia_icon.png')} 
            />
            <Text style={styles.sosButtonText}>SOS</Text>
          </HomeButton>

          {/* Botão Tarefas */}
          <HomeButton 
            backgroundColor={PatientColors.tasksMain} 
            onPress={() => router.push('/tarefas' as any)}
            customStyle={styles.gridButtonAdjustment}
          >
            <Image 
              source={require('@/assets/images/Tarefas_icon.png')} 
            />
            <Text style={styles.tasksButtonText}>TAREFAS</Text>
          </HomeButton>

          {/* Botão Jogos */}
          <HomeButton 
            backgroundColor={PatientColors.gamesMain} 
            onPress={() => router.push('/jogos' as any)}
            customStyle={styles.gridButtonAdjustment}
          >
            <Image 
              source={require('@/assets/images/Jogos_icon.png')} 
            />
            <Text style={styles.gamesButtonText}>JOGOS</Text>
          </HomeButton>

          {/* Botão Telefone */}
          <HomeButton 
            backgroundColor={PatientColors.phoneMain} 
            onPress={() => router.push('/telefone' as any)}
            customStyle={styles.gridButtonAdjustment}
          >
            <Image 
              source={require('@/assets/images/Telefone_icon.png')} 
            />
            <Text style={styles.phoneButtonText}>TELEFONE</Text>
          </HomeButton>

        </View>

        {/* Botão da assistente Aurélia na parte inferior */}
        <HomeButton 
          backgroundColor={PatientColors.aureliaMain} 
          onPress={() => router.push('/aurelia' as any)}
          customStyle={styles.aureliaButtonAdjustment}
        >
          <View style={styles.avatarCircle}>
            <Image 
              source={require('@/assets/images/LogoAvatar.png')} 
            />
          </View>
          <Text style={styles.aureliaButtonText}>CONVERSAR COM AURÉLIA</Text>
        </HomeButton>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    backgroundColor: PatientColors.homeHeader,
    paddingTop: 30,
    paddingBottom: 12,
    paddingHorizontal: 25,
    ...Shadow.header,
  },
  greetingText: {
    color: PatientColors.homeHeaderText,
    fontSize: 28,
    fontWeight: '500',
    right: 15,
    bottom: 15,
  },
  dateText: {
    color: PatientColors.homeHeaderSubtitle,
    fontSize: 24,
    textAlign: 'right',
    marginTop: 5,
  },
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },
  dots: {
    flex: 1,
    color: '#A09580',
    fontSize: 18,
    letterSpacing: 2,
    marginHorizontal: 6,
    overflow: 'hidden',
  },
  taskTime: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },
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
    fontSize: 32,
    fontWeight: 'bold',
  },
  tasksButtonText: {
    color: PatientColors.tasksHeaderText,
    fontSize: 30,
    fontWeight: 'bold',
  },
  gamesButtonText: {
    color: PatientColors.gamesHeaderText,
    fontSize: 32,
    fontWeight: 'bold',
  },
  phoneButtonText: {
    color: PatientColors.phoneHeaderText,
    fontSize: 27,
    fontWeight: 'bold',
  },
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
    fontSize: 20,
    fontWeight: 'bold',
  },
});