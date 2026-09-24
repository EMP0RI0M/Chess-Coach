import { Chess, PieceSymbol, Color } from 'chess.js';

export interface MaterialCount {
  whiteCaptured: PieceSymbol[]; // Pieces lost by black (captured by white)
  blackCaptured: PieceSymbol[]; // Pieces lost by white (captured by black)
  whiteMaterial: number;
  blackMaterial: number;
  advantage: number; // Positive = White ahead, Negative = Black ahead, 0 = Equal
}

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

const STARTING_PIECES: Record<PieceSymbol, number> = {
  p: 8,
  n: 2,
  b: 2,
  r: 2,
  q: 1,
  k: 1,
};

export function getMaterialDifference(chess: Chess): MaterialCount {
  const currentWhite: Record<PieceSymbol, number> = { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 };
  const currentBlack: Record<PieceSymbol, number> = { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 };

  let whiteMaterial = 0;
  let blackMaterial = 0;

  const board = chess.board();
  for (const row of board) {
    for (const piece of row) {
      if (piece) {
        if (piece.color === 'w') {
          currentWhite[piece.type]++;
          whiteMaterial += PIECE_VALUES[piece.type];
        } else {
          currentBlack[piece.type]++;
          blackMaterial += PIECE_VALUES[piece.type];
        }
      }
    }
  }

  const whiteCaptured: PieceSymbol[] = []; // Black pieces captured by White
  const blackCaptured: PieceSymbol[] = []; // White pieces captured by Black

  (['q', 'r', 'b', 'n', 'p'] as PieceSymbol[]).forEach((type) => {
    const missingBlack = Math.max(0, STARTING_PIECES[type] - currentBlack[type]);
    for (let i = 0; i < missingBlack; i++) {
      whiteCaptured.push(type);
    }

    const missingWhite = Math.max(0, STARTING_PIECES[type] - currentWhite[type]);
    for (let i = 0; i < missingWhite; i++) {
      blackCaptured.push(type);
    }
  });

  return {
    whiteCaptured,
    blackCaptured,
    whiteMaterial,
    blackMaterial,
    advantage: whiteMaterial - blackMaterial,
  };
}
