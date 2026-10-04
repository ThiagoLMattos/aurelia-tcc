// @ts-nocheck

import { Layout, PatientColors, PatientTypography, Shadow } from '@/constants/theme-elder';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { Alert, FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Lista de parentescos ─────────────────────────────────────────────────────
const RELATIONS = [
  'FILHO', 'FILHA', 'MARIDO', 'ESPOSA',
  'IRMÃO', 'IRMÃ', 'NETO', 'NETA',
  'GENRO', 'NORA', 'CUNHADO', 'CUNHADA',
  'PAI', 'MÃE', 'CUIDADOR', 'CUIDADORA',
  'MÉDICO', 'MÉDICA', 'VIZINHO', 'VIZINHA',
  'AMIGO', 'AMIGA', 'OUTRO',
];

const MAX_EMERGENCY = 5;

export default function AddContactElderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Estado
  const [contactId, setContactId] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [selectedRelation, setSelectedRelation] = useState('');
  const [customRelation, setCustomRelation] = useState('');

  // Quantidade atual de contatos de emergência
  const [emergencyCount, setEmergencyCount] = useState(0);

  // Controle dos modais
  const [showRelationList, setShowRelationList] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showEmergencySheet, setShowEmergencySheet] = useState(false);

  // Recebe o contato selecionado ao voltar de phone-elder
  useEffect(() => {
    if (params.selectedId) {
      setContactId(params.selectedId as string);
      setContactName(params.selectedName as string);
      setContactPhone(params.selectedPhone as string);
    }
  }, [params.selectedId]);

  // Carrega a quantidade atual de contatos de emergência
  useEffect(() => {
    const loadCount = async () => {
      try {
        const raw = await AsyncStorage.getItem('emergency_contacts');
        const list = raw ? JSON.parse(raw) : [];
        setEmergencyCount(list.length);
      } catch (error) {
        console.error('Erro ao carregar contatos de emergência:', error);
      }
    };
    loadCount();
  }, []);

  // Navega para phone-elder em modo de seleção
  const handleSearchContact = () => {
    router.push({
      pathname: '/phone-elder',
      params: { mode: 'select' },
    } as any);
  };

  // Seleciona parentesco
  const handleSelectRelation = (relation: string) => {
    if (relation === 'OUTRO') {
      setShowRelationList(false);
      setShowCustomInput(true);
      return;
    }
    setSelectedRelation(relation);
    setShowRelationList(false);
  };

  const handleConfirmCustom = () => {
    if (!customRelation.trim()) return;
    setSelectedRelation(customRelation.trim().toUpperCase());
    setShowCustomInput(false);
  };

  // Valida e abre confirmação
  const handleAddPress = () => {
    if (!contactName.trim()) {
      Alert.alert('Atenção', 'Selecione um contato.');
      return;
    }
    if (!selectedRelation) {
      Alert.alert('Atenção', 'Selecione um parentesco.');
      return;
    }
    setShowConfirm(true);
  };

  // Salva parentesco e abre pergunta de emergência
  const handleConfirmAdd = async () => {
    setShowConfirm(false);
    try {
      // Salva o parentesco
      await AsyncStorage.setItem(`relation_${contactId}`, selectedRelation);

      // Se esse contato já está na lista de emergência, atualiza o parentesco lá também
      const raw = await AsyncStorage.getItem('emergency_contacts');
      if (raw) {
        const list = JSON.parse(raw);
        const index = list.findIndex((c) => c.id === contactId);
        if (index !== -1) {
          list[index].relation = selectedRelation;
          await AsyncStorage.setItem('emergency_contacts', JSON.stringify(list));
        }
      }
      setShowEmergencySheet(true);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível salvar o parentesco.');
    }
  };

  // Salva como emergência
  const handleEmergencyYes = async () => {
    try {
      const raw = await AsyncStorage.getItem('emergency_contacts');
      const list = raw ? JSON.parse(raw) : [];

      if (list.length >= MAX_EMERGENCY) {
        Alert.alert('Limite atingido', `Você já tem ${MAX_EMERGENCY} contatos de emergência.`);
        setShowEmergencySheet(false);
        router.back();
        return;
      }

      if (!list.find((c) => c.id === contactId)) {
        list.push({ id: contactId, name: contactName, phone: contactPhone, relation: selectedRelation });
        await AsyncStorage.setItem('emergency_contacts', JSON.stringify(list));
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível salvar o contato de emergência.');
    } finally {
      setShowEmergencySheet(false);
      router.back();
    }
  };

  const handleEmergencyNo = () => {
    setShowEmergencySheet(false);
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor={PatientColors.phoneMain} />
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit>
          ADICIONAR PARENTESCO
        </Text>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()} activeOpacity={0.8}>
          <Text style={styles.headerButtonText}>VOLTAR</Text>
        </TouchableOpacity>
      </View>

      {/* Formulário */}
      <View style={styles.form}>

        {/* Selecionar contato */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Contato</Text>
          <TouchableOpacity style={styles.selectButton} onPress={handleSearchContact} activeOpacity={0.8}>
            <Text style={[styles.selectButtonText, !contactName && styles.selectButtonPlaceholder]}>
              {contactName || 'APERTE PARA SELECIONAR'}
            </Text>
          </TouchableOpacity>
          {contactPhone ? (
            <Text style={styles.selectedPhone}>{contactPhone}</Text>
          ) : null}
        </View>

        {/* Selecionar parentesco */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Parentesco</Text>
          <TouchableOpacity style={styles.selectButton} onPress={() => setShowRelationList(true)} activeOpacity={0.8}>
            <Text style={[styles.selectButtonText, !selectedRelation && styles.selectButtonPlaceholder]}>
              {selectedRelation || 'APERTE PARA SELECIONAR'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Botão adicionar */}
        <TouchableOpacity
          style={[styles.addButton, (!contactName || !selectedRelation) && styles.addButtonDisabled]}
          onPress={handleAddPress}
          activeOpacity={0.85}
        >
          <Text style={styles.addButtonText}>ADICIONAR</Text>
        </TouchableOpacity>

      </View>

      {/* Modal: Lista de parentescos */}
      <Modal visible={showRelationList} transparent animationType="slide" onRequestClose={() => setShowRelationList(false)}>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>LISTA DE PARENTESCOS</Text>
            <FlatList
              data={RELATIONS}
              keyExtractor={(item) => item}
              style={styles.relationList}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.relationItem} onPress={() => handleSelectRelation(item)} activeOpacity={0.8}>
                  <Text style={styles.relationItemText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.sheetButtonCancel} onPress={() => setShowRelationList(false)} activeOpacity={0.85}>
              <Text style={styles.sheetButtonCancelText}>VOLTAR</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: Parentesco customizado (OUTRO) */}
      <Modal visible={showCustomInput} transparent animationType="slide" onRequestClose={() => setShowCustomInput(false)}>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Qual o parentesco dessa pessoa?</Text>
            <TextInput
              style={styles.input}
              value={customRelation}
              onChangeText={setCustomRelation}
              placeholder="Escreva aqui!"
              placeholderTextColor="#888780"
              autoFocus
            />
            <TouchableOpacity style={styles.addButton} onPress={handleConfirmCustom} activeOpacity={0.85}>
              <Text style={styles.addButtonText}>ADICIONAR</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetButtonCancel} onPress={() => setShowCustomInput(false)} activeOpacity={0.85}>
              <Text style={styles.sheetButtonCancelText}>CANCELAR</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: Confirmação */}
      <Modal visible={showConfirm} transparent animationType="slide" onRequestClose={() => setShowConfirm(false)}>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetQuestion}>Confirma o nome e o parentesco:</Text>
            <Text style={styles.sheetContactName}>{contactName} — {selectedRelation}</Text>
            <TouchableOpacity style={styles.addButton} onPress={handleConfirmAdd} activeOpacity={0.85}>
              <Text style={styles.addButtonText}>ADICIONAR</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetButtonCancel} onPress={() => setShowConfirm(false)} activeOpacity={0.85}>
              <Text style={styles.sheetButtonCancelText}>CANCELAR</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: Contato de emergência */}
      <Modal visible={showEmergencySheet} transparent animationType="slide" onRequestClose={handleEmergencyNo}>
        <View style={styles.sheetOverlay}>
          <View style={styles.emergencySheet}>
            <Text style={styles.emergencySheetQuestion}>
              Você deseja adicionar essa pessoa como contato de emergência?
            </Text>
            {/* Contador de vagas disponíveis */}
            <Text style={styles.emergencyCounter}>
              {emergencyCount}/{MAX_EMERGENCY} contatos
            </Text>
            <Text style={styles.emergencySheetContactName}>
              {contactName} — {selectedRelation}
            </Text>
            <TouchableOpacity style={styles.emergencyButtonYes} onPress={handleEmergencyYes} activeOpacity={0.85}>
              <Text style={styles.emergencyButtonText}>SIM</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.emergencyButtonNo} onPress={handleEmergencyNo} activeOpacity={0.85}>
              <Text style={styles.emergencyButtonText}>NÃO</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// Estilos
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  // Header
  header: {
    backgroundColor: PatientColors.phoneMain,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 25,
    height: Layout.headerHeight,
    ...Shadow.header,
  },
  headerTitle: {
    color: PatientColors.phoneHeaderText,
    fontSize: PatientTypography.size.common,
    fontWeight: PatientTypography.weight.regular,
    flex: 1,
    flexShrink: 1,
  },
  headerButton: {
    backgroundColor: PatientColors.phoneHeaderButton,
    borderWidth: 1.5,
    borderColor: PatientColors.phoneHeaderBorder,
    borderRadius: 10,
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginLeft: 12,
    flexShrink: 0,
  },
  headerButtonText: {
    color: PatientColors.phoneHeaderText,
    fontSize: PatientTypography.size.backButton,
    fontWeight: PatientTypography.weight.regular,
  },

  // Formulário
  form: { padding: 24, gap: 24 },
  fieldGroup: { gap: 10 },
  fieldLabel: {
    fontSize: PatientTypography.size.reduced,
    fontWeight: PatientTypography.weight.bold,
    color: '#2C2C2A',
  },
  selectButton: {
    backgroundColor: '#F1EFE8',
    borderWidth: 1.5,
    borderColor: PatientColors.phoneMain,
    borderRadius: 10,
    paddingVertical: 18,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  selectButtonText: {
    fontSize: PatientTypography.size.minimum,
    fontWeight: PatientTypography.weight.bold,
    color: PatientColors.phoneMain,
  },
  selectButtonPlaceholder: {
    color: '#888780',
    fontWeight: PatientTypography.weight.regular,
  },
  selectedPhone: {
    fontSize: PatientTypography.size.minimum,
    color: '#5F5E5A',
    marginTop: 4,
    paddingLeft: 4,
  },
  input: {
    backgroundColor: '#F1EFE8',
    borderWidth: 1.5,
    borderColor: PatientColors.phoneFieldBorder,
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 18,
    fontSize: PatientTypography.size.minimum,
    color: '#2C2C2A',
  },
  addButton: {
    backgroundColor: PatientColors.phoneMain,
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
  },
  addButtonDisabled: { opacity: 0.4 },
  addButtonText: {
    color: PatientColors.phoneHeaderText,
    fontSize: PatientTypography.size.sheet,
    fontWeight: PatientTypography.weight.bold,
  },

  // Modais padrão (azul)
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#F1EFE8',
    borderTopWidth: 7,
    borderTopColor: PatientColors.phoneMain,
    padding: 24,
    gap: 14,
    maxHeight: '80%',
    ...Shadow.sheet,
  },
  sheetTitle: {
    fontSize: PatientTypography.size.reduced,
    fontWeight: PatientTypography.weight.bold,
    color: '#2C2C2A',
    textAlign: 'center',
  },
  sheetQuestion: {
    fontSize: PatientTypography.size.reduced,
    fontWeight: PatientTypography.weight.regular,
    color: '#2C2C2A',
    textAlign: 'center',
  },
  sheetContactName: {
    fontSize: PatientTypography.size.sheet,
    fontWeight: PatientTypography.weight.bold,
    color: '#2C2C2A',
    textAlign: 'center',
  },
  relationList: { maxHeight: 300 },
  relationItem: {
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#D3D1C7',
    alignItems: 'center',
  },
  relationItemText: {
    fontSize: PatientTypography.size.common,
    fontWeight: PatientTypography.weight.regular,
    color: '#2C2C2A',
  },
  sheetButtonCancel: {
    backgroundColor: PatientColors.phoneHeaderButton,
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
  },
  sheetButtonCancelText: {
    color: PatientColors.phoneHeaderText,
    fontSize: PatientTypography.size.sheet,
    fontWeight: PatientTypography.weight.bold,
  },

  // Modal de emergência — cores do SOS
  emergencySheet: {
    backgroundColor: PatientColors.sosBg,
    borderTopWidth: 7,
    borderTopColor: PatientColors.sosMain,
    padding: 24,
    gap: 14,
    ...Shadow.sheet,
  },
  emergencySheetQuestion: {
    fontSize: PatientTypography.size.reduced,
    fontWeight: PatientTypography.weight.regular,
    color: PatientColors.sosText,
    textAlign: 'center',
  },
  emergencyCounter: {
    fontSize: PatientTypography.size.sheet,
    fontWeight: PatientTypography.weight.bold,
    color: PatientColors.sosTextEmphasis,
    textAlign: 'center',
  },
  emergencySheetContactName: {
    fontSize: PatientTypography.size.sheet,
    fontWeight: PatientTypography.weight.bold,
    color: PatientColors.sosText,
    textAlign: 'center',
  },
  emergencyButtonYes: {
    backgroundColor: PatientColors.sosMain,
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
  },
  emergencyButtonNo: {
    backgroundColor: PatientColors.sosHeaderButton,
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
  },
  emergencyButtonText: {
    color: PatientColors.sosHeaderText,
    fontSize: PatientTypography.size.sheet,
    fontWeight: PatientTypography.weight.bold,
  },
});