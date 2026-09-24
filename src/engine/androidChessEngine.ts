import { Chess, Square, Move } from 'chess.js';

export interface EngineEvaluationResult {
  depth: number;
  scoreCp: number | null;
  scoreMate: number | null;
  bestMove: string | null;
  pvLine: string;
  isCalculating: boolean;
}

// Piece values in Centipawns (from android-chess Valuation table)
const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// Piece-Square Tables (PST) from android-chess
const PST_PAWN = [
  0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
   5,  5, 10, 25, 25, 10,  5,  5,
   0,  0,  0, 20, 20,  0,  0,  0,
   5, -5,-10,  0,  0,-10, -5,  5,
   5, 10, 10,-20,-20, 10, 10,  5,
   0,  0,  0,  0,  0,  0,  0,  0
];

const PST_KNIGHT = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50,
];

const PST_BISHOP = [
  -20,-10,-10,-10,-10,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5, 10, 10,  5,  0,-10,
  -10,  5,  5, 10, 10,  5,  5,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10, 10, 10, 10, 10, 10, 10,-10,
  -10,  5,  0,  0,  0,  0,  5,-10,
  -20,-10,-10,-10,-10,-10,-10,-20,
];

const PST_ROOK = [
    0,  0,  0,  0,  0,  0,  0,  0,
    5, 10, 10, 10, 10, 10, 10,  5,
   -5,  0,  0,  0,  0,  0,  0, -5,
   -5,  0,  0,  0,  0,  0,  0, -5,
   -5,  0,  0,  0,  0,  0,  0, -5,
   -5,  0,  0,  0,  0,  0,  0, -5,
   -5,  0,  0,  0,  0,  0,  0, -5,
    0,  0,  0,  5,  5,  0,  0,  0
];

const PST_QUEEN = [
  -20,-10,-10, -5, -5,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5,  5,  5,  5,  0,-10,
   -5,  0,  5,  5,  5,  5,  0, -5,
    0,  0,  5,  5,  5,  5,  0, -5,
  -10,  5,  5,  5,  5,  5,  0,-10,
  -10,  0,  5,  0,  0,  0,  0,-10,
  -20,-10,-10, -5, -5,-10,-10,-20
];

const PST_KING = [
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -20,-30,-30,-40,-40,-30,-30,-20,
  -10,-20,-20,-20,-20,-20,-20,-10,
   20, 20,  0,  0,  0,  0, 20, 20,
   20, 30, 10,  0,  0, 10, 30, 20
];

function getSquareIndex(sq: string, isWhite: boolean): number {
  const file = sq.charCodeAt(0) - 97; // 0..7
  const rank = 8 - parseInt(sq[1], 10); // 0..7
  const idx = rank * 8 + file;
  return isWhite ? idx : 63 - idx;
}

/**
 * Static evaluation of board state matching android-chess algorithm
 */
export function evaluateBoardState(chess: Chess): number {
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? -20000 : 20000;
  }
  if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition()) {
    return 0;
  }

  let whiteScore = 0;
  let blackScore = 0;

  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;

      const sqName = `${String.fromCharCode(97 + c)}${8 - r}` as Square;
      const isWhite = piece.color === 'w';
      const baseVal = PIECE_VALUES[piece.type] || 0;
      let pstVal = 0;
      const sqIdx = getSquareIndex(sqName, isWhite);

      if (piece.type === 'p') pstVal = PST_PAWN[sqIdx] || 0;
      else if (piece.type === 'n') pstVal = PST_KNIGHT[sqIdx] || 0;
      else if (piece.type === 'b') pstVal = PST_BISHOP[sqIdx] || 0;
      else if (piece.type === 'r') pstVal = PST_ROOK[sqIdx] || 0;
      else if (piece.type === 'q') pstVal = PST_QUEEN[sqIdx] || 0;
      else if (piece.type === 'k') pstVal = PST_KING[sqIdx] || 0;

      const totalVal = baseVal + pstVal;
      if (isWhite) {
        whiteScore += totalVal;
      } else {
        blackScore += totalVal;
      }
    }
  }

  return whiteScore - blackScore;
}

/**
 * Alpha-Beta Minimax Search (matching android-chess GameSearch engine)
 */
export function searchBestMove(
  chess: Chess,
  depth: number = 3
): { bestMove: Move | null; scoreCp: number; pv: string[] } {
  const isMaximizing = chess.turn() === 'w';
  const moves = chess.moves({ verbose: true }) as Move[];

  if (moves.length === 0) {
    return { bestMove: null, scoreCp: evaluateBoardState(chess) / 100, pv: [] };
  }

  // Move ordering: captures first
  moves.sort((a, b) => {
    const aCapture = a.captured ? PIECE_VALUES[a.captured] || 0 : 0;
    const bCapture = b.captured ? PIECE_VALUES[b.captured] || 0 : 0;
    return bCapture - aCapture;
  });

  let bestMove: Move = moves[0];
  let bestScore = isMaximizing ? -Infinity : Infinity;
  let alpha = -Infinity;
  let beta = Infinity;
  const pv: string[] = [];

  for (const move of moves) {
    chess.move(move);
    const score = alphaBeta(chess, depth - 1, alpha, beta, !isMaximizing);
    chess.undo();

    if (isMaximizing) {
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
      alpha = Math.max(alpha, bestScore);
    } else {
      if (score < bestScore) {
        bestScore = score;
        bestMove = move;
      }
      beta = Math.min(beta, bestScore);
    }

    if (beta <= alpha) break;
  }

  pv.push(bestMove.san);
  return {
    bestMove,
    scoreCp: bestScore / 100,
    pv,
  };
}

function alphaBeta(
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean
): number {
  if (depth === 0 || chess.isGameOver()) {
    return evaluateBoardState(chess);
  }

  const moves = chess.moves({ verbose: true }) as Move[];

  // Move ordering
  moves.sort((a, b) => {
    const aCapture = a.captured ? PIECE_VALUES[a.captured] || 0 : 0;
    const bCapture = b.captured ? PIECE_VALUES[b.captured] || 0 : 0;
    return bCapture - aCapture;
  });

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      chess.move(move);
      const evaluation = alphaBeta(chess, depth - 1, alpha, beta, false);
      chess.undo();
      maxEval = Math.max(maxEval, evaluation);
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      chess.move(move);
      const evaluation = alphaBeta(chess, depth - 1, alpha, beta, true);
      chess.undo();
      minEval = Math.min(minEval, evaluation);
      beta = Math.min(beta, evaluation);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}
