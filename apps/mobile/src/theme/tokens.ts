/**
 * Aurélia — colour tokens
 * Single source of truth for colours. Screens never hardcode hex values.
 *
 * `Colors` (caregiver) and `PatientColors` (elder, one block per section of the elder app) are the
 * raw palettes the existing screens use. `palette` maps both onto the same semantic names so shared
 * components can render in either role.
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

export const PatientColors = {
  // ── Home & Header ──────────────────────────────────────────────────────────
  homeHeader: '#0F6E56', // header principal — identidade do app
  homeHeaderButton: '#085041', // botão no header — tom mais escuro
  homeHeaderBorder: '#9FE1CB', // borda do botão no header — tom claro
  homeHeaderText: '#FFFFFF', // texto e ícones no header
  homeHeaderSubtitle: '#FFFFFF', // subtítulo no header

  // ── SOS / Emergência (Vermelho) ────────────────────────────────────────────
  sosMain: '#A32D2D', // botão home, header SOS, botão "Ligar agora"
  sosHeaderButton: '#501313', // botão no header SOS
  sosHeaderBorder: '#F7C1C1', // borda botão no header
  sosHeaderText: '#FCEBEB', // texto e ícones no header SOS
  sosBg: '#FCEBEB', // fundo da tela SOS
  sosTextEmphasis: '#791F1F', // nome do contato, ênfase
  sosText: '#501313', // texto principal sobre fundo claro
  sosBorder: '#501313', // borda do card de contato

  // ── Tarefas (Verde floresta) ───────────────────────────────────────────────
  tasksMain: '#2D7A3A', // botão home, header, botão "Concluir"
  tasksHeaderButton: '#1A4D24', // botão no header
  tasksBorder: '#A8DFB0', // borda botão no header
  tasksHeaderText: '#E8F8EB', // texto e ícones no header
  tasksDoneIcon: '#A8DFB0', // ícone de tarefa concluída
  tasksFieldBorder: '#2D7A3A', // borda ativa de campo na tela de tarefas

  // ── Jogos (Roxo / Índigo) ─────────────────────────────────────────────────
  gamesMain: '#534AB7', // botão home, header, botão "Jogar"
  gamesHeaderButton: '#2E2880', // botão no header
  gamesHeaderBorder: '#C5C2F5', // borda botão no header
  gamesHeaderText: '#FFFFFF', // texto e ícones no header (branco puro)
  gamesCardBg: '#EEEDFE', // fundo card do jogo, ícone decorativo
  gamesFieldBorder: '#534AB7', // borda ativa de campo

  // ── Ligações / Telefone (Azul) ────────────────────────────────────────────
  phoneMain: '#185FA5', // botão home, header, botão "Ligar"
  phoneHeaderButton: '#0C447C', // botão no header
  phoneHeaderBorder: '#B5D4F4', // borda botão no header
  phoneHeaderText: '#E6F1FB', // texto e ícones no header
  phoneAvatar: '#B5D4F4', // avatar/inicial do contato
  phoneFieldBorder: '#185FA5', // borda ativa de campo

  // ── Aurélia / Chat (Verde identidade) ─────────────────────────────────────
  aureliaMain: '#0F6E56', // botão home, header, avatar IA, botão mic
  aureliaHeaderButton: '#085041', // botão no header
  aureliaHeaderBorder: '#9FE1CB', // borda botão no header
  aureliaHeaderText: '#E1F5EE', // texto e ícones no header
  aureliaSubtitle: '#9FE1CB', // subtítulo "Assistente virtual"
  aureliaChatBg: '#F1EFE8', // fundo da área de chat
  aureliaBubbleUser: '#0F6E56', // balão do usuário
  aureliaBubbleUserText: '#E1F5EE', // texto no balão do usuário
  aureliaBubbleAI: '#FFFFFF', // balão da IA
  aureliaBubbleAIText: '#2C2C2C', // texto no balão da IA
  aureliaTimestamp: '#888780', // horário das mensagens
};

export type Role = 'caregiver' | 'elder';

export interface Palette {
  primary: string;
  onPrimary: string;
  background: string;
  card: string;
  text: string;
  textMuted: string;
  border: string;
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  danger: string;
  dangerBg: string;
}

export const palette: Record<Role, Palette> = {
  caregiver: {
    primary: Colors.primary,
    onPrimary: Colors.white,
    background: Colors.surface,
    card: Colors.white,
    text: Colors.textPrimary,
    textMuted: Colors.textSecondary,
    border: Colors.border,
    success: Colors.successText,
    successBg: Colors.successBg,
    warning: Colors.warningText,
    warningBg: Colors.warningBg,
    danger: Colors.dangerText,
    dangerBg: Colors.dangerBg,
  },
  elder: {
    primary: PatientColors.homeHeader,
    onPrimary: PatientColors.homeHeaderText,
    background: '#FFFFFF',
    card: '#FFFFFF',
    text: PatientColors.aureliaBubbleAIText,
    textMuted: PatientColors.aureliaTimestamp,
    border: PatientColors.homeHeaderBorder,
    success: PatientColors.tasksMain,
    successBg: PatientColors.tasksHeaderText,
    warning: Colors.warningText,
    warningBg: Colors.warningBg,
    danger: PatientColors.sosMain,
    dangerBg: PatientColors.sosBg,
  },
};
