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
  sosTextEmphasis: '#791F1F',    // nome do contato, ênfase
  sosText: '#501313',            // texto principal sobre fundo claro
  sosBorder: '#501313',            // borda do card de contato
 
  // ── Tarefas (Verde floresta) ───────────────────────────────────────────────
  tasksMain: '#2D7A3A',          // botão home, header, botão "Concluir"
  tasksHeaderButton: '#1A4D24',  // botão no header
  tasksBorder: '#A8DFB0',  // borda botão no header
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
  aureliaBubbleAIText: '#2C2C2C',// texto no balão da IA
  aureliaTimestamp: '#888780',   // horário das mensagens
};

// ─── Tipografia do Paciente ──────────────────────────────────────────────────
// Escala exclusiva para o app do idoso — tamanhos maiores por acessibilidade
export const PatientTypography = {
  size: {
    // Catalogados no design — usar sempre esses valores nas telas do idoso
    header: 36,      // texto do header (nome, título da tela) — sem negrito
    backButton: 30,  // texto do botão VOLTAR — sem negrito
    common: 24,      // texto comum (nome da tarefa, contato, item de lista) — sem negrito
    reduced: 20,     // texto reduzido (horário, descrição curta) — sem negrito
    sheet: 30,       // texto dentro de abas/modais — sem negrito
    minimum: 18,     // texto no tamanho mínimo WCAG — em negrito obrigatório
  },
  weight: {
    regular: '400' as const,   // sem negrito — padrão para quase tudo
    bold: '625' as const,      // negrito — obrigatório só no tamanho mínimo (18px)
  },
  lineHeight: {
    normal: 1.7,   // leitura corrida — ideal para Alzheimer inicial
    tight: 1.5,    // elementos compactos como botões
  },
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

export const Layout = {
  headerHeight: 100,  // altura fixa de todos os headers do app do idoso
};
