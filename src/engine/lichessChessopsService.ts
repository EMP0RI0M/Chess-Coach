import { Chess } from 'chessops/chess';
import { parseFen, makeFen } from 'chessops/fen';
import { parseUci, makeSquare } from 'chessops/util';
import { Square } from 'chessops/types';

export type LichessVariant = 'standard' | 'chess960' | 'kingofthehill' | 'threecheck' | 'crazyhouse' | 'antichess';

export interface LichessMoveValidation {
  valid: boolean;
  san?: string;
  uci?: string;
  fen?: string;
  isCheck?: boolean;
  isCheckmate?: boolean;
  isDraw?: boolean;
}

export class LichessChessopsEngine {
  /**
   * Official Lichess Chessops Engine Service
   * Powers variant rules, FEN/PGN transformations, and UCI validation.
   */
  public parsePosition(fen: string): Chess | null {
    const setup = parseFen(fen);
    if (!setup.isOk) {
      return null;
    }
    const pos = Chess.fromSetup(setup.value);
    return pos.isOk ? pos.value : null;
  }

  public getLegalUciMoves(fen: string): string[] {
    const pos = this.parsePosition(fen);
    if (!pos) return [];

    const moves: string[] = [];
    const destsMap = pos.allDests();

    for (const [fromSq, destSet] of destsMap.entries()) {
      const fromName = makeSquare(fromSq);
      for (const toSq of destSet) {
        const toName = makeSquare(toSq as Square);
        moves.push(`${fromName}${toName}`);
      }
    }
    return moves;
  }

  public validateUciMove(fen: string, uciMove: string): LichessMoveValidation {
    const pos = this.parsePosition(fen);
    if (!pos) return { valid: false };

    const parsed = parseUci(uciMove);
    if (!parsed) return { valid: false };

    if (!pos.isLegal(parsed)) {
      return { valid: false };
    }

    pos.play(parsed);
    const newFen = makeFen(pos.toSetup());

    return {
      valid: true,
      uci: uciMove,
      fen: newFen,
      isCheck: pos.isCheck(),
      isCheckmate: pos.isCheckmate(),
      isDraw: pos.isStalemate() || pos.isInsufficientMaterial(),
    };
  }
}

export const lichessChessopsEngine = new LichessChessopsEngine();
