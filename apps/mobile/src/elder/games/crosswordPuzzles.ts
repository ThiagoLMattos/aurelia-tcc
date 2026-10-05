/**
 * The crosswords: everyday words, each with a picture and a short clue. Answers are capital letters
 * A–Z only (no accents or Ç), so the letter tiles stay simple. The grid is laid out by `layoutCrossword`;
 * a test checks every puzzle fits on a phone.
 */

export interface CrosswordWord {
  answer: string;
  emoji: string;
  clue: string;
}

export interface CrosswordPuzzle {
  id: string;
  theme: string;
  emoji: string;
  words: CrosswordWord[];
}

export const CROSSWORD_PUZZLES: readonly CrosswordPuzzle[] = [
  {
    id: 'frutas',
    theme: 'Frutas',
    emoji: '🍎',
    words: [
      { answer: 'BANANA', emoji: '🍌', clue: 'Fruta amarela que o macaco adora.' },
      { answer: 'MANGA', emoji: '🥭', clue: 'Fruta doce e amarela; também é a parte da camisa que cobre o braço.' },
      { answer: 'UVA', emoji: '🍇', clue: 'Fruta pequena que nasce em cachos.' },
      { answer: 'PERA', emoji: '🍐', clue: 'Fruta parecida com a maçã, porém mais comprida.' },
      { answer: 'LARANJA', emoji: '🍊', clue: 'Fruta redonda e azedinha, boa para fazer suco.' },
    ],
  },
  {
    id: 'animais',
    theme: 'Animais',
    emoji: '🐶',
    words: [
      { answer: 'CAVALO', emoji: '🐴', clue: 'Animal que relincha e puxa a carroça.' },
      { answer: 'GATO', emoji: '🐱', clue: 'Animal que faz miau.' },
      { answer: 'VACA', emoji: '🐄', clue: 'Animal que faz muu e dá leite.' },
      { answer: 'PATO', emoji: '🦆', clue: 'Ave que nada no lago e faz quá-quá.' },
      { answer: 'GALO', emoji: '🐓', clue: 'Ave que canta bem cedo de manhã.' },
    ],
  },
  {
    id: 'casa',
    theme: 'Casa',
    emoji: '🏠',
    words: [
      { answer: 'CADEIRA', emoji: '🪑', clue: 'Usamos para sentar à mesa.' },
      { answer: 'JANELA', emoji: '🪟', clue: 'Por ela entra o sol e vemos a rua.' },
      { answer: 'PORTA', emoji: '🚪', clue: 'Abrimos para entrar em casa.' },
      { answer: 'MESA', emoji: '🍽️', clue: 'Onde servimos o almoço.' },
      { answer: 'CAMA', emoji: '🛏️', clue: 'Onde dormimos à noite.' },
    ],
  },
  {
    id: 'cozinha',
    theme: 'Cozinha',
    emoji: '🍲',
    words: [
      { answer: 'PANELA', emoji: '🍲', clue: 'Onde cozinhamos o feijão.' },
      { answer: 'GARFO', emoji: '🍴', clue: 'Usamos junto com a faca para comer.' },
      { answer: 'ARROZ', emoji: '🍚', clue: 'Grão branco que acompanha o feijão.' },
      { answer: 'LEITE', emoji: '🥛', clue: 'Bebida branca que vem da vaca.' },
      { answer: 'COPO', emoji: '🥤', clue: 'Usamos para beber água.' },
    ],
  },
  {
    id: 'natureza',
    theme: 'Natureza',
    emoji: '🌻',
    words: [
      { answer: 'ESTRELA', emoji: '⭐', clue: 'Brilha pequenininha no céu à noite.' },
      { answer: 'CHUVA', emoji: '🌧️', clue: 'Água que cai das nuvens.' },
      { answer: 'FLOR', emoji: '🌸', clue: 'Nasce no jardim e tem perfume.' },
      { answer: 'SOL', emoji: '☀️', clue: 'Brilha no céu durante o dia.' },
      { answer: 'MAR', emoji: '🌊', clue: 'Água salgada que molha a praia.' },
    ],
  },
  {
    id: 'roupas',
    theme: 'Roupas',
    emoji: '👕',
    words: [
      { answer: 'CAMISA', emoji: '👕', clue: 'Roupa com botões e mangas.' },
      { answer: 'SAPATO', emoji: '👞', clue: 'Calçamos nos pés para sair de casa.' },
      { answer: 'BOLSA', emoji: '👜', clue: 'Onde guardamos a carteira e as chaves.' },
      { answer: 'MEIA', emoji: '🧦', clue: 'Vestimos nos pés antes do sapato.' },
      { answer: 'SAIA', emoji: '👗', clue: 'Roupa que vai da cintura para baixo, sem pernas.' },
    ],
  },
];
