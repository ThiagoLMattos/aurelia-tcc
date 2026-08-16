// @ts-nocheck
import { Layout, PatientColors, PatientTypography, Shadow } from '@/constants/theme-elder';
import { Stack, useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useState, useCallback } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Image,
  Linking, Modal, StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Contacts from 'expo-contacts';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function PhoneElderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // ── Modo de seleção — ativado quando vem de add-contact-elder ────────────
  const isSelectMode = params.mode === 'select';

  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState(null);
  const [showConfirmSheet, setShowConfirmSheet] = useState(false);

  // ── Carrega contatos do dispositivo e parentescos salvos ──────────────────
  const loadDeviceContacts = async () => {
    try {
      setLoading(true);
      const { status } = await Contacts.requestPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permissão Negada', 'Precisamos de acesso aos seus contatos.');
        setLoading(false);
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers],
      });

      if (data && data.length > 0) {
        const formattedContacts = await Promise.all(
          data
            .filter((item) => item.phoneNumbers && item.phoneNumbers.length > 0)
            .map(async (item) => {
              const relation = await AsyncStorage.getItem(`relation_${item.id}`) || '';
              return {
                id: item.id,
                name: item.name || `${item.firstName || ''} ${item.lastName || ''}`.trim() || 'Contato Sem Nome',
                phone: item.phoneNumbers[0].number,
                relation,
              };
            })
        );
        setContacts(formattedContacts);
      } else {
        Alert.alert('Nenhum contato', 'Nenhum contato encontrado no seu dispositivo.');
      }
    } catch (error) {
      console.error('Erro ao carregar contatos:', error);
      Alert.alert('Erro', 'Ocorreu um erro ao carregar os contatos.');
    } finally {
      setLoading(false);
    }
  };

  // ── Recarrega ao voltar para a tela ──────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      loadDeviceContacts();
    }, [])
  );

  // ── Toque no contato — comportamento diferente por modo ───────────────────
    const handleContactPress = (contact) => {
      if (isSelectMode) {
        // Substitui a tela atual passando os dados como params
        router.replace({
          pathname: '/add-contact-elder',
          params: {
            selectedId: contact.id,
            selectedName: contact.name,
            selectedPhone: contact.phone,
          },
        } as any);
        return;
      }
      setSelectedContact(contact);
      setShowConfirmSheet(true);
    };

  const handleCall = () => {
    if (!selectedContact) return;
    const cleanPhone = selectedContact.phone.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${cleanPhone}`);
    setShowConfirmSheet(false);
    setSelectedContact(null);
  };

  const handleCancel = () => {
    setShowConfirmSheet(false);
    setSelectedContact(null);
  };

  // ── Renderização do item da lista ─────────────────────────────────────────
  const renderContactItem = ({ item: contact }) => (
    <TouchableOpacity
      style={styles.contactCard}
      onPress={() => handleContactPress(contact)}
      activeOpacity={0.8}
    >
      <View style={styles.avatar}>
        <Image
          source={require('@/assets/images/ContatoTelefone.png')}
          style={styles.avatarImage}
          resizeMode="cover"
        />
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>
          {contact.name}{contact.relation ? ` — ${contact.relation}` : ''}
        </Text>
        <Text style={styles.contactPhone}>{contact.phone}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor={PatientColors.phoneMain} />
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Header — título muda conforme o modo ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit>
          {isSelectMode ? 'SELECIONAR CONTATO' : 'TELEFONE'}
        </Text>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()} activeOpacity={0.8}>
          <Text style={styles.headerButtonText}>VOLTAR</Text>
        </TouchableOpacity>
      </View>

      {/* ── Lista de contatos ── */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PatientColors.phoneMain} />
          <Text style={styles.loadingText}>Carregando contatos...</Text>
        </View>
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(item) => item.id}
          renderItem={renderContactItem}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Nenhum contato disponível.</Text>
            </View>
          }
        />
      )}

      {/* ── Footer — só aparece no modo normal ── */}
      {!isSelectMode && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.footerButton}
            onPress={() => router.push('/add-contact-elder' as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.footerButtonText}>+ ADICIONAR PARENTESCO</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Aba de confirmação de ligação — só no modo normal ── */}
      <Modal visible={showConfirmSheet} transparent animationType="slide" onRequestClose={handleCancel}>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetQuestion}>Certeza que deseja ligar para:</Text>
            <Text style={styles.sheetContactName}>
              {selectedContact?.name}{selectedContact?.relation ? ` — ${selectedContact?.relation}` : ''}
            </Text>
            <TouchableOpacity style={styles.sheetButtonCall} onPress={handleCall} activeOpacity={0.85}>
              <Text style={styles.sheetButtonCallText}>LIGAR</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetButtonCancel} onPress={handleCancel} activeOpacity={0.85}>
              <Text style={styles.sheetButtonCancelText}>VOLTAR</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Estilos ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PatientColors.phoneMain },

  // ── Header ──────────────────────────────────────────────────────────────────
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
    fontSize: PatientTypography.size.header,
    fontWeight: PatientTypography.weight.regular,
    flexShrink: 1,
  },
  headerButton: {
    backgroundColor: PatientColors.phoneHeaderButton,
    borderWidth: 1.5,
    borderColor: PatientColors.phoneHeaderBorder,
    borderRadius: 10,
    paddingVertical: 20,
    paddingHorizontal: 20,
    flexShrink: 0,
  },
  headerButtonText: {
    color: PatientColors.phoneHeaderText,
    fontSize: PatientTypography.size.backButton,
    fontWeight: PatientTypography.weight.regular,
  },

  // ── Carregamento e vazio ─────────────────────────────────────────────────────
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: PatientTypography.size.common, color: '#2C2C2C' },
  emptyContainer: { padding: 32, alignItems: 'center' },
  emptyText: { fontSize: PatientTypography.size.common, color: '#666666' },

  // ── Lista ────────────────────────────────────────────────────────────────────
  scrollContent: { paddingHorizontal: 0, paddingBottom: 16 },
  contactCard: {
    borderWidth: 0.5,
    borderColor: PatientColors.phoneFieldBorder,
    backgroundColor: "#FFFFFF",
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: { width: 100, height: 100 },
  avatarImage: { width: '100%', height: '100%' },
  contactInfo: { flex: 1 },
  contactName: {
    fontSize: PatientTypography.size.common,
    fontWeight: PatientTypography.weight.bold,
    color: '#2C2C2C',
    marginBottom: 4,
  },
  contactPhone: {
    fontSize: PatientTypography.size.reduced,
    fontWeight: PatientTypography.weight.bold,
    color: '#2C2C2C',
  },

  // ── Footer ───────────────────────────────────────────────────────────────────
  footer: {
    backgroundColor: PatientColors.phoneMain,
    padding: 16,
    borderTopWidth: 0.5,
    borderTopColor: '#D3D1C7',
  },
  footerButton: {
    backgroundColor: PatientColors.phoneHeaderButton,
    borderColor: PatientColors.phoneHeaderBorder,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
  },
  footerButtonText: {
    color: PatientColors.phoneHeaderText,
    fontSize: PatientTypography.size.reduced,
    fontWeight: PatientTypography.weight.bold,
  },

  // ── Aba de confirmação ───────────────────────────────────────────────────────
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' },
  sheet: {
    backgroundColor: '#F1EFE8',
    borderTopWidth: 7,
    borderTopColor: PatientColors.phoneMain,
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
  sheetContactName: {
    fontSize: PatientTypography.size.sheet,
    fontWeight: PatientTypography.weight.bold,
    color: '#2C2C2C',
    textAlign: 'center',
  },
  sheetButtonCall: {
    backgroundColor: PatientColors.phoneMain,
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
  },
  sheetButtonCallText: {
    color: PatientColors.phoneHeaderText,
    fontSize: PatientTypography.size.sheet,
    fontWeight: PatientTypography.weight.bold,
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
});