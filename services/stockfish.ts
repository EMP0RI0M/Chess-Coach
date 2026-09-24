import { useState, useEffect, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import { searchBestMove, evaluateBoardState } from './androidChessEngine';

// Type definition for Chess analysis results
export interface EngineEvaluation {
  depth: number;
  scoreCp: number | null; // Centipawns (positive = white advantage)
  scoreMate: number | null; // Mate in N moves
  bestMove: string | null; // e.g. "e2e4"
  pvLine: string; // Principal variation
  isCalculating: boolean;
}

export function useStockfishEngine() {
  const [evaluation, setEvaluation] = useState<EngineEvaluation>({
    depth: 0,
    scoreCp: 0.2,
    scoreMate: null,
    bestMove: null,
    pvLine: '',
    isCalculating: false,
  });

  const [engineReady, setEngineReady] = useState(true);
  const sendCommandRef = useRef<((cmd: string) => void) | null>(null);

  // Send FEN position to Engine for evaluation (uses ported android-chess evaluation + search algorithm)
  const evaluatePosition = useCallback(
    (fen: string, depth = 3) => {
      setEvaluation((prev) => ({ ...prev, isCalculating: true }));

      // Run computation asynchronously to avoid blocking UI frame
      setTimeout(() => {
        try {
          const tempChess = new Chess(fen);
          if (tempChess.isCheckmate()) {
            const mateIn = tempChess.turn() === 'w' ? -1 : 1;
            setEvaluation({
              depth: 1,
              scoreCp: null,
              scoreMate: mateIn,
              bestMove: null,
              pvLine: 'Checkmate',
              isCalculating: false,
            });
            return;
          }

          const searchResult = searchBestMove(tempChess, depth > 4 ? 4 : depth);
          const bestMoveLan = searchResult.bestMove ? `${searchResult.bestMove.from}${searchResult.bestMove.to}` : null;
          const pvStr = searchResult.bestMove ? searchResult.bestMove.san : '';

          setEvaluation({
            depth: depth > 4 ? 4 : depth,
            scoreCp: searchResult.scoreCp,
            scoreMate: null,
            bestMove: bestMoveLan,
            pvLine: pvStr,
            isCalculating: false,
          });
        } catch {
          setEvaluation((prev) => ({ ...prev, isCalculating: false }));
        }
      }, 10);
    },
    []
  );

  const stopEvaluation = useCallback(() => {
    setEvaluation((prev) => ({ ...prev, isCalculating: false }));
  }, []);

  return {
    engineReady,
    evaluation,
    evaluatePosition,
    stopEvaluation,
  };
}
