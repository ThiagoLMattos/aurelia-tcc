// @ts-nocheck

import { Layout, PatientColors, PatientTypography, Shadow } from '@/constants/theme-elder';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

// ─── Dados falsos — substituir pelos contatos reais da tela de telefone ───────
const MOCK_EMERGENCY_CONTACTS = [
  { id: '1', name: 'Maria',   relation: 'Filha',     phone: '11999999991' },
  { id: '2', name: 'João',    relation: 'Filho',     phone: '11999999992' },
  { id: '3', name: 'Carlos',  relation: 'Cuidador',  phone: '11999999993' },
  { id: '4', name: 'Ana',relation: 'Vizinha',    phone: '11999999994' },
  { id: '5', name: 'Pedro',   relation: 'Neto',      phone: '11999999995' },
];

// ─── Componente principal ────────────────────────────────────────────────────
export default function PhoneElderScreen() {
  const router = useRouter();

  const [selectedContact, setSelectedContact] = useState(null);
  const [showConfirmSheet, setShowConfirmSheet] = useState(false);

  const handleContactPress = (contact) => {
    setSelectedContact(contact);
    setShowConfirmSheet(true);
  };

  const handleCall = () => {
    if (!selectedContact) return;
    Linking.openURL(`tel:${selectedContact.phone}`);
    setShowConfirmSheet(false);
    setSelectedContact(null);
  };

  const handleCancel = () => {
    setShowConfirmSheet(false);
    setSelectedContact(null);
  };

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

      {/* ── Lista de contatos de emergência ── */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {MOCK_EMERGENCY_CONTACTS.map((contact) => (
          <TouchableOpacity
            key={contact.id}
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
                {contact.name} — {contact.relation}
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
              {selectedContact?.name} — {selectedContact?.relation}
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

  // ── Lista ────────────────────────────────────────────────────────────────────
  scrollContent: {
    paddingHorizontal: 0,
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
    color: "#2C2C2C",
    marginBottom: 4,
  },
  contactPhone: {
    fontSize: PatientTypography.size.reduced,
    fontWeight: PatientTypography.weight.bold,
    color: "#2C2C2C",
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
    color: "#2C2C2C",
    textAlign: 'center',
  },
  sheetContactName: {
    fontSize: PatientTypography.size.sheet,
    fontWeight: PatientTypography.weight.bold,
    color: "#2C2C2C",
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