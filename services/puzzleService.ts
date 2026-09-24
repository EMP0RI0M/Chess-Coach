export interface ChessPuzzle {
  id: string;
  fen: string;
  solution: string[]; // SAN moves e.g. ["Qxf7#"] or ["Nf7+", "Kg8", "Nh6#"]
  theme: string;
  rating: number;
  description: string;
}

export const DAILY_PUZZLES: ChessPuzzle[] = [
  {
    id: 'p1',
    fen: 'r1bqkb1r/pppp1ppp/2n5/4p3/2B1n3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4',
    solution: ['Bxf7+', 'Kxf7'],
    theme: 'King Hunt / Sacrifice',
    rating: 1200,
    description: 'White can disrupt black king castling with a forcing bishop check on f7.',
  },
  {
    id: 'p2',
    fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1',
    solution: ['Re8#'],
    theme: 'Back-Rank Mate',
    rating: 900,
    description: 'Black king is trapped on the 8th rank behind its pawns. Deliver checkmate.',
  },
  {
    id: 'p3',
    fen: 'r1b2rk1/pp3ppp/8/8/8/2N5/PPP2PPP/R3R1K1 w - - 0 1',
    solution: ['Re7'],
    theme: '7th Rank Infiltration',
    rating: 1450,
    description: 'Seize the 7th rank with the rook to paralyze black pawn structures.',
  },
  {
    id: 'p4',
    fen: 'r2qkb1r/pp2pppp/2n2n2/3p4/3P2b1/2NB1N2/PPP2PPP/R1BQK2R w KQkq - 4 7',
    solution: ['Bxh7+'],
    theme: 'Greek Gift Sacrifice',
    rating: 1600,
    description: 'Classic Bxh7+ bishop sacrifice uncovering an attack on the kingside.',
  },
];
