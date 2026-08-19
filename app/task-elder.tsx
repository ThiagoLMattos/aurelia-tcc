// @ts-nocheck

import { Layout, PatientColors, PatientTypography, Shadow } from '@/constants/theme-elder';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

// Dados falsos — substituir pela API do cuidador depois
const MOCK_TASKS = [
  {
    id: '1',
    name: 'Omeprazol',
    description: 'Tomar 1 cápsula em jejum',
    time: '07:00',
    done: false,
  },
  {
    id: '2',
    name: 'Caminhada',
    description: 'Caminhar por 20 minutos no parque',
    time: '08:30',
    done: false,
  },
  {
    id: '3',
    name: 'Café da manhã',
    description: 'Tomar café com pão e fruta',
    time: '09:00',
    done: false,
  },
  {
    id: '4',
    name: 'Losartana',
    description: 'Tomar 1 comprimido com água',
    time: '12:00',
    done: false,
  },
  {
    id: '5',
    name: 'Almoço',
    description: 'Almoçar com a família',
    time: '12:30',
    done: false,
  },
  {
    id: '6',
    name: 'Repouso',
    description: 'Descansar por 30 minutos',
    time: '14:00',
    done: false,
  },
  {
    id: '7',
    name: 'Metformina',
    description: 'Tomar 1 comprimido após o jantar',
    time: '19:00',
    done: false,
  },
];

// Componente principal
export default function TarefasIdosoScreen() {
  const router = useRouter();

  const [tasks, setTasks] = useState(MOCK_TASKS);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showConfirmSheet, setShowConfirmSheet] = useState(false);

  const handleConcluirPress = (task) => {
    setSelectedTask(task);
    setShowConfirmSheet(true);
  };

  const handleConfirm = () => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === selectedTask.id ? { ...t, done: true } : t
      )
    );
    setShowConfirmSheet(false);
    setSelectedTask(null);
  };

  const handleCancel = () => {
    setShowConfirmSheet(false);
    setSelectedTask(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor={PatientColors.tasksMain} />
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>TAREFAS</Text>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Text style={styles.headerButtonText}>VOLTAR</Text>
        </TouchableOpacity>
      </View>

      {/* Lista de tarefas */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {tasks.map((task) => (
          <View
            key={task.id}
            style={[styles.taskCard, task.done && styles.taskCardDone]}
          >
            {/* Linha superior: nome + botão */}
            <View style={styles.cardHeader}>
              <Text style={[styles.taskName, task.done && styles.taskNameDone]}>
                {task.id}. {task.name}
              </Text>

              <TouchableOpacity
                style={[
                  styles.concludeButton,
                  task.done && styles.concludeButtonDone,
                ]}
                onPress={() => !task.done && handleConcluirPress(task)}
                activeOpacity={task.done ? 1 : 0.8}
                disabled={task.done}
              >
                <Text style={styles.concludeButtonText}>
                  {task.done ? 'FEITO ✓' : 'CONCLUIR'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Linha inferior: descrição */}
            <Text style={styles.taskDescription} numberOfLines={2}>
              {task.time} — {task.description}
            </Text>
          </View>
        ))}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Aba de confirmação (Modal) */}
      <Modal
        visible={showConfirmSheet}
        transparent
        animationType="slide"
        onRequestClose={handleCancel}
      >
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>

            <Text style={styles.sheetQuestion}>
              Você já concluiu a tarefa?
            </Text>

            <Text style={styles.sheetTaskName}>
              {selectedTask?.id} — {selectedTask?.name.toUpperCase()}
            </Text>

            <TouchableOpacity
              style={styles.sheetButtonConfirm}
              onPress={handleConfirm}
              activeOpacity={0.85}
            >
              <Text style={styles.sheetButtonConfirmText}>CONCLUÍ</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetButtonCancel}
              onPress={handleCancel}
              activeOpacity={0.85}
            >
              <Text style={styles.sheetButtonCancelText}>CANCELAR</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Estilos
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // Header
  header: {
    backgroundColor: PatientColors.tasksMain,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 25,
    height: Layout.headerHeight,
    zIndex: 1,
    ...Shadow.header,
  },
  headerTitle: {
    color: PatientColors.tasksHeaderText,
    fontSize: PatientTypography.size.header,
    fontWeight: PatientTypography.weight.regular,
  },
  headerButton: {
    backgroundColor: PatientColors.tasksHeaderButton,
    borderWidth: 1.5,
    borderColor: PatientColors.tasksBorder,
    borderRadius: 10,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  headerButtonText: {
    color: PatientColors.tasksHeaderText,
    fontSize: PatientTypography.size.backButton,
    fontWeight: PatientTypography.weight.regular,
  },

  // Lista
  scrollContent: {
    paddingHorizontal: 0,
  },
  taskCard: {
    borderWidth: 0.5,
    borderColor: '#2C2C2C',
    paddingVertical: 20,
    paddingHorizontal: 16,
    flexDirection: 'column',
    gap: 12,
  },
  taskCardDone: {
    backgroundColor: '#F1EFE8',
    borderColor: PatientColors.tasksDoneIcon,
    opacity: 0.7,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  taskName: {
    flex: 1,
    fontSize: PatientTypography.size.common,
    fontWeight: PatientTypography.weight.regular,
    color: '#2C2C2C',
  },
  taskNameDone: {
    textDecorationLine: 'line-through',
    color: '#888780',
  },
  taskDescription: {
    fontSize: PatientTypography.size.minimum,
    fontWeight: PatientTypography.weight.bold,
    color: '#2C2C2C',
    lineHeight: 18 * 1.7,
    width: '100%',
  },
  concludeButton: {
    backgroundColor: PatientColors.tasksHeaderButton,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PatientColors.tasksBorder,
    minWidth: 140,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.soft,
  },
  concludeButtonDone: {
    backgroundColor: PatientColors.tasksDoneIcon,
    borderColor: PatientColors.tasksDoneIcon,
  },
  concludeButtonText: {
    color: PatientColors.tasksHeaderText,
    fontSize: PatientTypography.size.reduced,
    fontWeight: PatientTypography.weight.bold,
  },

  // Aba de confirmação
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
  },
  sheet: {
    backgroundColor: '#F1EFE8',
    borderTopWidth: 7,
    borderTopColor: PatientColors.tasksMain,
    padding: 24,
    gap: 16,
    ...Shadow.sheet,
  },
  sheetQuestion: {
    fontSize: PatientTypography.size.reduced,
    fontWeight: PatientTypography.weight.regular,
    color: '#2C2C2C',
    textAlign: 'center',
  },
  sheetTaskName: {
    fontSize: PatientTypography.size.sheet,
    fontWeight: PatientTypography.weight.bold,
    color: '#2C2C2C',
    textAlign: 'center',
  },
  sheetButtonConfirm: {
    backgroundColor: PatientColors.tasksMain,
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
  },
  sheetButtonConfirmText: {
    color: PatientColors.tasksHeaderText,
    fontSize: PatientTypography.size.sheet,
    fontWeight: PatientTypography.weight.bold,
  },
  sheetButtonCancel: {
    backgroundColor: PatientColors.tasksHeaderButton,
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
  },
  sheetButtonCancelText: {
    color: PatientColors.tasksHeaderText,
    fontSize: PatientTypography.size.sheet,
    fontWeight: PatientTypography.weight.bold,
  },
});