export interface EcoOpening {
  eco: string;
  name: string;
  moves: string[];
}

export const ECO_DATABASE: EcoOpening[] = [
  { eco: 'A00', name: 'Grob Opening', moves: ['g4'] },
  { eco: 'A01', name: 'Nimzo-Larsen Attack', moves: ['b3'] },
  { eco: 'A04', name: 'Réti Opening', moves: ['Nf3'] },
  { eco: 'A10', name: 'English Opening', moves: ['c4'] },
  { eco: 'A40', name: "Queen's Pawn Game", moves: ['d4'] },
  { eco: 'B00', name: "King's Pawn Game", moves: ['e4'] },
  { eco: 'B01', name: 'Scandinavian Defense', moves: ['e4', 'd5'] },
  { eco: 'B02', name: "Alekhine's Defense", moves: ['e4', 'Nf6'] },
  { eco: 'B07', name: 'Pirc Defense', moves: ['e4', 'd6'] },
  { eco: 'B10', name: 'Caro-Kann Defense', moves: ['e4', 'c6'] },
  { eco: 'B20', name: 'Sicilian Defense', moves: ['e4', 'c5'] },
  { eco: 'B90', name: 'Sicilian Defense, Najdorf', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'] },
  { eco: 'C00', name: 'French Defense', moves: ['e4', 'e6'] },
  { eco: 'C20', name: "King's Pawn Game (Open Game)", moves: ['e4', 'e5'] },
  { eco: 'C42', name: 'Petrov Defense', moves: ['e4', 'e5', 'Nf3', 'Nf6'] },
  { eco: 'C50', name: 'Italian Game / Giuoco Piano', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'] },
  { eco: 'C60', name: 'Ruy Lopez (Spanish Opening)', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'] },
  { eco: 'D00', name: "Queen's Pawn: Mason Attack", moves: ['d4', 'd5'] },
  { eco: 'D06', name: "Queen's Gambit", moves: ['d4', 'd5', 'c4'] },
  { eco: 'D30', name: "Queen's Gambit Declined", moves: ['d4', 'd5', 'c4', 'e6'] },
  { eco: 'E60', name: "King's Indian Defense", moves: ['d4', 'Nf6', 'c4', 'g6'] },
  { eco: 'E20', name: 'Nimzo-Indian Defense', moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'] },
  { eco: 'E12', name: "Queen's Indian Defense", moves: ['d4', 'Nf6', 'c4', 'e6', 'Nf3', 'b6'] },
];

export function identifyEco(historySans: string[]): { eco: string; name: string } {
  if (historySans.length === 0) {
    return { eco: 'A00', name: 'Standard Initial Position' };
  }

  let bestMatch: EcoOpening | null = null;
  let maxMatchedMoves = 0;

  for (const opening of ECO_DATABASE) {
    let matched = true;
    for (let i = 0; i < opening.moves.length; i++) {
      if (i >= historySans.length || opening.moves[i] !== historySans[i]) {
        matched = false;
        break;
      }
    }
    if (matched && opening.moves.length > maxMatchedMoves) {
      maxMatchedMoves = opening.moves.length;
      bestMatch = opening;
    }
  }

  if (bestMatch) {
    return { eco: bestMatch.eco, name: bestMatch.name };
  }

  return { eco: '---', name: 'Custom / Transition Position' };
}
