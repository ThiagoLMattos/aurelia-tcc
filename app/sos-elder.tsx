// @ts-nocheck

import { Layout, PatientColors, PatientTypography, Shadow } from '@/constants/theme-elder';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import React, { useState, useCallback } from 'react';
import { Image, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SosElderScreen() {
  const router = useRouter();

  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [showConfirmSheet, setShowConfirmSheet] = useState(false);

  // ── Carrega contatos de emergência salvos ─────────────────────────────────
  const loadEmergencyContacts = async () => {
    try {
      const raw = await AsyncStorage.getItem('emergency_contacts');
      const list = raw ? JSON.parse(raw) : [];
      setContacts(list);
    } catch (error) {
      console.error('Erro ao carregar contatos de emergência:', error);
    }
  };

  // ── Recarrega toda vez que a tela abre ────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      loadEmergencyContacts();
    }, [])
  );

  // ── Ações ─────────────────────────────────────────────────────────────────
  const handleContactPress = (contact) => {
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor={PatientColors.sosMain} />
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SOS</Text>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Text style={styles.headerButtonText}>VOLTAR</Text>
        </TouchableOpacity>
      </View>

      {/* ── Label ── */}
      <View style={styles.labelRow}>
        <Text style={styles.label}>LIGAR PARA:</Text>
      </View>

      {/* ── Lista vazia ── */}
      {contacts.length === 0 && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            Nenhum contato de emergência cadastrado.{'\n'}
            Adicione na tela de Telefone.
          </Text>
        </View>
      )}

      {/* ── Lista de contatos de emergência ── */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {contacts.map((contact) => (
          <TouchableOpacity
            key={contact.id}
            style={styles.contactCard}
            onPress={() => handleContactPress(contact)}
            activeOpacity={0.8}
          >
            {/* Avatar */}
            <View style={styles.avatar}>
              <Image
                source={require('@/assets/images/ContatoSOS.png')}
                style={styles.avatarImage}
                resizeMode="cover"
              />
            </View>

            {/* Info */}
            <View style={styles.contactInfo}>
              <Text style={styles.contactName}>
                {contact.name}{contact.relation ? ` — ${contact.relation}` : ''}
              </Text>
              <Text style={styles.contactPhone}>{contact.phone}</Text>
            </View>
          </TouchableOpacity>
        ))}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Aba de confirmação ── */}
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
              {selectedContact?.name}{selectedContact?.relation ? ` — ${selectedContact?.relation}` : ''}
            </Text>

            <TouchableOpacity
              style={styles.sheetButtonCall}
              onPress={handleCall}
              activeOpacity={0.85}
            >
              <Text style={styles.sheetButtonCallText}>LIGAR</Text>
            </TouchableOpacity>

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
    backgroundColor: PatientColors.sosBg,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    backgroundColor: PatientColors.sosMain,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 25,
    height: Layout.headerHeight,
    ...Shadow.header,
  },
  headerTitle: {
    color: PatientColors.sosHeaderText,
    fontSize: 50,
    fontWeight: PatientTypography.weight.regular,
    marginLeft: 40,
  },
  headerButton: {
    backgroundColor: PatientColors.sosHeaderButton,
    borderWidth: 1.5,
    borderColor: PatientColors.sosHeaderBorder,
    borderRadius: 10,
    paddingVertical: 20,
    paddingHorizontal: 20,
    flexShrink: 0,
  },
  headerButtonText: {
    color: PatientColors.sosHeaderText,
    fontSize: PatientTypography.size.backButton,
    fontWeight: PatientTypography.weight.regular,
  },

  // ── Label ───────────────────────────────────────────────────────────────────
  labelRow: {
    backgroundColor: PatientColors.sosBg,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  label: {
    fontSize: PatientTypography.size.sheet,
    color: PatientColors.sosText,
    textAlign: 'center',
  },

  // ── Lista vazia ──────────────────────────────────────────────────────────────
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: PatientTypography.size.common,
    color: PatientColors.sosText,
    textAlign: 'center',
    lineHeight: 24 * 1.7,
  },

  // ── Lista ────────────────────────────────────────────────────────────────────
  scrollContent: {
    paddingHorizontal: 0,
  },
  contactCard: {
    backgroundColor: PatientColors.sosBg,
    borderWidth: 0.5,
    borderColor: PatientColors.sosCardAvatar,
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
    color: PatientColors.sosTextEmphasis,
    marginBottom: 4,
  },
  contactPhone: {
    fontSize: PatientTypography.size.reduced,
    fontWeight: PatientTypography.weight.bold,
    color: PatientColors.sosText,
  },

  // ── Aba de confirmação ───────────────────────────────────────────────────────
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
  },
  sheet: {
    backgroundColor: PatientColors.sosBg,
    borderTopWidth: 7,
    borderTopColor: PatientColors.sosMain,
    padding: 24,
    gap: 16,
    ...Shadow.sheet,
  },
  sheetQuestion: {
    fontSize: PatientTypography.size.reduced,
    fontWeight: PatientTypography.weight.regular,
    color: PatientColors.sosText,
    textAlign: 'center',
  },
  sheetContactName: {
    fontSize: PatientTypography.size.sheet,
    fontWeight: PatientTypography.weight.bold,
    color: PatientColors.sosText,
    textAlign: 'center',
  },
  sheetButtonCall: {
    backgroundColor: PatientColors.sosMain,
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
  },
  sheetButtonCallText: {
    color: PatientColors.sosHeaderText,
    fontSize: PatientTypography.size.sheet,
    fontWeight: PatientTypography.weight.bold,
  },
  sheetButtonCancel: {
    backgroundColor: PatientColors.sosHeaderButton,
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
  },
  sheetButtonCancelText: {
    color: PatientColors.sosHeaderText,
    fontSize: PatientTypography.size.sheet,
    fontWeight: PatientTypography.weight.bold,
  },
});