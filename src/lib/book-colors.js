export const BOOK_TONES = ['#a74050', '#287248', '#906e0e', '#396fd0', '#aa5722', '#009ca0', '#009ca0', '#009ca0', '#009ca0'];

export const BOOK_COLORS = Object.fromEntries(BOOK_TONES.map((color, index) => [
  `${index < 5 ? 'compulsory' : 'elective'}-${index < 5 ? index + 1 : index - 4}`, color,
]));
