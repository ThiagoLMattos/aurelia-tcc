/** Aurélia — type scales. The elder app uses larger sizes for accessibility. */

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

// Escala exclusiva para o app do idoso — tamanhos maiores por acessibilidade
export const PatientTypography = {
  size: {
    // Catalogados no design, usar sempre esses valores nas telas do idoso, salvo exceções
    header: 36, // texto do header
    backButton: 30, // texto do botão VOLTAR
    common: 24, // texto comum (nome da tarefa, contato, item de lista)
    reduced: 20, // texto reduzido (horário, descrição curta)
    sheet: 30, // texto dentro de abas/modais
    minimum: 18, // texto no tamanho mínimo WCAG (negrito obrigatório)
  },
  weight: {
    regular: '400' as const, // sem negrito
    bold: '600' as const, // negrito
  },
  lineHeight: {
    normal: 1.7, // leitura corrida
    tight: 1.5, // elementos compactos como botões
  },
};

/** Body / title sizes by role, for shared components. */
export const fontSizes = {
  caregiver: { title: Typography.size.lg, body: Typography.size.md, small: Typography.size.base },
  elder: { title: PatientTypography.size.header, body: PatientTypography.size.common, small: PatientTypography.size.reduced },
} as const;
