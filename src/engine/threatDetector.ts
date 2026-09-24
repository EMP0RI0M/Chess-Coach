import { Chess, Square, Move } from 'chess.js';

export interface ThreatLine {
  from: string; // e.g. "c3" (attacker)
  to: string;   // e.g. "e4" (target)
  attackerPiece: string;
  targetPiece?: string;
  isCapture: boolean;
  isCheck: boolean;
  severity: number; // 1 (minor attack) to 10 (mating / free queen threat)
}

export interface ThreatAnalysisResult {
  threatLines: ThreatLine[];
  attackedSquares: Set<string>;
  threatenedPieceSquares: Set<string>;
}

export function detectPositionThreats(fen: string): ThreatAnalysisResult {
  const threatLines: ThreatLine[] = [];
  const attackedSquares = new Set<string>();
  const threatenedPieceSquares = new Set<string>();

  try {
    const parts = fen.split(' ');
    if (parts.length < 2) {
      return { threatLines, attackedSquares, threatenedPieceSquares };
    }

    const currentTurn = parts[1]; // 'w' or 'b'
    const oppTurn = currentTurn === 'w' ? 'b' : 'w';

    // 1. Swap active turn in FEN to see what moves the opponent could play next
    parts[1] = oppTurn;
    // Reset en-passant and halfmove clock for safety if needed
    const oppFen = parts.join(' ');

    let oppChess: Chess;
    try {
      oppChess = new Chess(oppFen);
    } catch {
      // If king is already in check under oppFen, fallback to standard
      return { threatLines, attackedSquares, threatenedPieceSquares };
    }

    const oppMoves = oppChess.moves({ verbose: true }) as Move[];

    for (const m of oppMoves) {
      attackedSquares.add(m.to);

      let severity = 0;
      const isCheck = m.san.includes('+') || m.san.includes('#');
      const isCapture = !!m.captured;

      if (isCapture) {
        threatenedPieceSquares.add(m.to);
        const victimVal = getPieceValue(m.captured || 'p');
        const attackerVal = getPieceValue(m.piece);
        // Higher severity if capturing higher value piece or equal
        severity = Math.min(10, Math.max(3, victimVal - attackerVal + 6));
      }

      if (isCheck) {
        severity = Math.max(severity, 8);
      }

      // Record high-priority threats (captures, checks, and major attacks)
      if (isCapture || isCheck) {
        threatLines.push({
          from: m.from,
          to: m.to,
          attackerPiece: m.piece,
          targetPiece: m.captured,
          isCapture,
          isCheck,
          severity,
        });
      }
    }

    // Sort threat lines by severity descending
    threatLines.sort((a, b) => b.severity - a.severity);

  } catch {
    // Graceful fallback
  }

  return {
    // Limit to top 5 most critical threat lines to keep board clean and readable
    threatLines: threatLines.slice(0, 5),
    attackedSquares,
    threatenedPieceSquares,
  };
}

function getPieceValue(p: string): number {
  switch (p.toLowerCase()) {
    case 'p': return 1;
    case 'n': return 3;
    case 'b': return 3;
    case 'r': return 5;
    case 'q': return 9;
    case 'k': return 100;
    default: return 0;
  }
}
