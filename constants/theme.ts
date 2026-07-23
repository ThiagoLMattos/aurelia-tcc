/**
 * Aurélia — Design tokens
 * Single source of truth for colors, typography scale, and spacing.
 * All screens import from here — never hardcode hex values in component files.
 */

export const Colors = {
  // Primary — teal
  primary: '#0F8080',
  primaryDark: '#0A5F5F',
  primaryLight: '#E0F7FA',
  primaryText: '#0F6E56',

  // Surface & background
  surface: '#F8FAFC',
  white: '#FFFFFF',
  border: '#DDE3E8',
  borderLight: '#E2E6EA',
  borderMid: '#C8D0D8',

  // Text
  textPrimary: '#0F172A',
  textSecondary: '#5F5E5A',
  textMuted: '#9A9A95',

  // Sage green — completed / success
  successBg: '#EAF3DE',
  successText: '#3B6D11',
  successBorder: '#1D9E75',

  // Amber — missed / warning
  warningBg: '#FAEEDA',
  warningText: '#854F0B',
  warningBorder: '#EF9F27',
  warningAccent: '#FAC775',

  // Red — danger / breach / destructive
  dangerBg: '#FCEBEB',
  dangerText: '#A32D2D',
  dangerBorder: '#E24B4A',
  dangerHeader: '#A32D2D',
  dangerDot: '#E24B4A',

  // Lavender — Aurélia-branded elements ONLY
  aureliaBg: '#EEEDFE',
  aureliaText: '#534AB7',
  aureliaBorder: '#CECBF6',

  // Tab bar
  tabBarBg: '#FFFFFF',
  tabActive: '#0F8080',
  tabInactive: '#5F5E5A',

  // Misc
  progressBg: '#EEF1F3',
  inputBg: '#FFFFFF',
  skeletonBg: '#EEF1F3',
};

// ─── PatientColors ───────────────────────────────────────────────────────────
// Cores específicas por seção do app do paciente

export const PatientColors = {
 
  // ── Home & Header ──────────────────────────────────────────────────────────
  homeHeader: '#0F6E56',         // header principal — identidade do app
  homeHeaderButton: '#085041',   // botão no header — tom mais escuro
  homeHeaderBorder: '#9FE1CB',   // borda do botão no header — tom claro
  homeHeaderText: '#FFFFFF',     // texto e ícones no header
  homeHeaderSubtitle: '#FFFFFF', // subtítulo no header
 
  // ── SOS / Emergência (Vermelho) ────────────────────────────────────────────
  sosMain: '#A32D2D',            // botão home, header SOS, botão "Ligar agora"
  sosHeaderButton: '#501313',    // botão no header SOS
  sosHeaderBorder: '#F7C1C1',    // borda botão no header
  sosHeaderText: '#FCEBEB',      // texto e ícones no header SOS
  sosBg: '#FCEBEB',              // fundo da tela SOS
  sosCardAvatar: '#F7C1C1',      // avatar contatos de emergência
  sosTextEmphasis: '#791F1F',    // nome do contato, ênfase
  sosText: '#501313',            // texto principal sobre fundo claro
 
  // ── Tarefas (Verde floresta) ───────────────────────────────────────────────
  tasksMain: '#2D7A3A',          // botão home, header, botão "Concluir"
  tasksHeaderButton: '#1A4D24',  // botão no header
  tasksHeaderBorder: '#A8DFB0',  // borda botão no header
  tasksHeaderText: '#E8F8EB',    // texto e ícones no header
  tasksDoneIcon: '#A8DFB0',      // ícone de tarefa concluída
  tasksFieldBorder: '#2D7A3A',   // borda ativa de campo na tela de tarefas
 
  // ── Jogos (Roxo / Índigo) ─────────────────────────────────────────────────
  gamesMain: '#534AB7',          // botão home, header, botão "Jogar"
  gamesHeaderButton: '#2E2880',  // botão no header
  gamesHeaderBorder: '#C5C2F5',  // borda botão no header
  gamesHeaderText: '#FFFFFF',    // texto e ícones no header (branco puro)
  gamesCardBg: '#EEEDFE',        // fundo card do jogo, ícone decorativo
  gamesFieldBorder: '#534AB7',   // borda ativa de campo
 
  // ── Ligações / Telefone (Azul) ────────────────────────────────────────────
  phoneMain: '#185FA5',          // botão home, header, botão "Ligar"
  phoneHeaderButton: '#0C447C',  // botão no header
  phoneHeaderBorder: '#B5D4F4',  // borda botão no header
  phoneHeaderText: '#E6F1FB',    // texto e ícones no header
  phoneAvatar: '#B5D4F4',        // avatar/inicial do contato
  phoneFieldBorder: '#185FA5',   // borda ativa de campo
 
  // ── Aurélia / Chat (Verde identidade) ─────────────────────────────────────
  aureliaMain: '#0F6E56',        // botão home, header, avatar IA, botão mic
  aureliaHeaderButton: '#085041',// botão no header
  aureliaHeaderBorder: '#9FE1CB',// borda botão no header
  aureliaHeaderText: '#E1F5EE',  // texto e ícones no header
  aureliaSubtitle: '#9FE1CB',    // subtítulo "Assistente virtual"
  aureliaChatBg: '#F1EFE8',      // fundo da área de chat
  aureliaBubbleUser: '#0F6E56',  // balão do usuário
  aureliaBubbleUserText: '#E1F5EE', // texto no balão do usuário
  aureliaBubbleAI: '#FFFFFF',    // balão da IA
  aureliaBubbleAIText: '#2C2C2A',// texto no balão da IA
  aureliaTimestamp: '#888780',   // horário das mensagens
};

/**
 * Tab bar colors wired to expo-router tab layout.
 * Kept as light/dark shape so the tab layout can reference Colors[scheme].tint.
 */
export const TabColors = {
  light: {
    text: Colors.textPrimary,
    background: Colors.surface,
    tint: Colors.primary,
    icon: Colors.tabInactive,
    tabIconDefault: Colors.tabInactive,
    tabIconSelected: Colors.primary,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: Colors.primary,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: Colors.primary,
  },
};

export const Typography = {
  size: {
    xs: 10,
    sm: 12,
    base: 14,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  lineHeight: {
    tight: 1.2,
    base: 1.45,
    relaxed: 1.6,
  },
};

export const Radius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  full: 999,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

// ─── Sombras ─────────────────────────────────────────────────────────────────
// Uso: spread no StyleSheet com o objeto correspondente

export const Shadow = {
  // Headers e botões internos
  soft: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  // Botões da home
  medium: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 5,
  },
  // Abas (Y negativo — sombra para cima)
  sheet: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  // Headers (Sombra pronunciada para BAIXO) -> Adicione esta se quiser uma sombra forte no topo!
  header: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 }, // Positivo joga a sombra pra BAIXO
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
};
