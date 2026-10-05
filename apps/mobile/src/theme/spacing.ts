/** Aurélia — spacing, radii, shadows and fixed layout sizes. */

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
  // Abas (Y negativo sombra para cima)
  sheet: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  // Headers (Sombra pronunciada para BAIXO)
  header: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
};

export const Layout = {
  headerHeight: 100,  // altura fixa de todos os headers do app do idoso
};
