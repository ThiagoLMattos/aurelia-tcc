// @ts-nocheck
import { Layout, PatientColors, PatientTypography, Shadow } from '@/constants/theme-elder';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Contacts from 'expo-contacts';

export default function PhoneElderScreen() {
  const router = useRouter();

  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState(null);
  const [showConfirmSheet, setShowConfirmSheet] = useState(false);

  // ── Buscar contatos do dispositivo ─────────────────────────────────────────
  useEffect(() => {
    loadDeviceContacts();
  }, []);

  const loadDeviceContacts = async () => {
    try {
      setLoading(true);
      // Solicita permissão de acesso aos contatos
      const { status } = await Contacts.requestPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permissão Negada',
          'Precisamos de acesso aos seus contatos para poder exibi-los na tela de telefone.'
        );
        setLoading(false);
        return;
      }

      // Busca todos os contatos que possuem número de telefone
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers],
      });

      if (data && data.length > 0) {
        // Mapeia e filtra apenas os contatos que possuem número cadastrado
        const formattedContacts = data
          .filter((item) => item.phoneNumbers && item.phoneNumbers.length > 0)
          .map((item) => ({
            id: item.id,
            name: item.name || `${item.firstName || ''} ${item.lastName || ''}`.trim() || 'Contato Sem Nome',
            phone: item.phoneNumbers[0].number,
            relation: '', // Espaço reservado para ser configurado em outra tela posteriormente
          }));

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

  // ── Ações dos botões e modal ───────────────────────────────────────────────
  const handleContactPress = (contact) => {
    setSelectedContact(contact);
    setShowConfirmSheet(true);
  };

  const handleCall = () => {
    if (!selectedContact) return;
    // Remove espaços e caracteres especiais do número para discagem
    const cleanPhone = selectedContact.phone.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${cleanPhone}`);
    setShowConfirmSheet(false);
    setSelectedContact(null);
  };

  const handleCancel = () => {
    setShowConfirmSheet(false);
    setSelectedContact(null);
  };

  // Exemplo de como navegar para a outra tela para adicionar parentesco no futuro:
  const handleAddRelation = (contact) => {
    // router.push({ pathname: '/add-relation', params: { id: contact.id, name: contact.name } });
  };

  // ── Renderização do Item da Lista ──────────────────────────────────────────
  const renderContactItem = ({ item: contact }) => (
    <TouchableOpacity
      style={styles.contactCard}
      onPress={() => handleContactPress(contact)}
      activeOpacity={0.8}
    >
      {/* Avatar */}
      <View style={styles.avatar}>
        <Image
          source={require('@/assets/images/ContatoTelefone.png')}
          style={styles.avatarImage}
          resizeMode="cover"
        />
      </View>

      {/* Info */}
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>
          {contact.name} {contact.relation ? `— ${contact.relation}` : ''}
        </Text>
        <Text style={styles.contactPhone}>{contact.phone}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor={PatientColors.phoneMain} />
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>TELEFONE</Text>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Text style={styles.headerButtonText}>VOLTAR</Text>
        </TouchableOpacity>
      </View>

      {/* ── Conteúdo / Lista de contatos da agenda ── */}
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

      {/* ── Aba de confirmação de ligação ── */}
      <Modal
        visible={showConfirmSheet}
        transparent
        animationType="slide"
        onRequestClose={handleCancel}
      >
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetQuestion}>
              Certeza que deseja ligar para:
            </Text>

            <Text style={styles.sheetContactName}>
              {selectedContact?.name} {selectedContact?.relation ? `— ${selectedContact?.relation}` : ''}
            </Text>

            {/* Botão ligar */}
            <TouchableOpacity
              style={styles.sheetButtonCall}
              onPress={handleCall}
              activeOpacity={0.85}
            >
              <Text style={styles.sheetButtonCallText}>LIGAR</Text>
            </TouchableOpacity>

            {/* Botão voltar */}
            <TouchableOpacity
              style={styles.sheetButtonCancel}
              onPress={handleCancel}
              activeOpacity={0.85}
            >
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
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

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
    fontSize: 36,
    fontWeight: PatientTypography.weight.regular,
  },
  headerButton: {
    backgroundColor: PatientColors.phoneHeaderButton,
    borderWidth: 1.5,
    borderColor: PatientColors.phoneHeaderBorder,
    borderRadius: 10,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  headerButtonText: {
    color: PatientColors.phoneHeaderText,
    fontSize: PatientTypography.size.backButton,
    fontWeight: PatientTypography.weight.regular,
  },

  // ── Estados de Carregamento e Vazio ────────────────────────────────────────
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: PatientTypography.size.common,
    color: '#2C2C2C',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: PatientTypography.size.common,
    color: '#666666',
  },

  // ── Lista ────────────────────────────────────────────────────────────────────
  scrollContent: {
    paddingHorizontal: 0,
    paddingBottom: 32,
  },
  contactCard: {
    borderWidth: 0.5,
    borderColor: PatientColors.phoneFieldBorder,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },

  // ── Avatar ───────────────────────────────────────────────────────────────────
  avatar: {
    width: 100,
    height: 100,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },

  // ── Info do contato ──────────────────────────────────────────────────────────
  contactInfo: {
    flex: 1,
  },
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

  // ── Aba de confirmação ───────────────────────────────────────────────────────
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
  },
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