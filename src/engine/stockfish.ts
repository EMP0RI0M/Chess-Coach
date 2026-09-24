import { useState, useEffect, useCallback, useRef } from 'react';
import { createStockfishWorker } from './stockfish.worker';
import { JevVisualImprint } from './jevFilter';
import { CandidateMove } from './androidChessEngine';

export interface EngineEvaluation {
  depth: number;
  scoreCp: number | null;
  scoreMate: number | null;
  bestMove: string | null;
  pvLine: string;
  isCalculating: boolean;
  imprint?: JevVisualImprint;
  topMoves?: CandidateMove[];
}

export function useStockfishEngine() {
  const [evaluation, setEvaluation] = useState<EngineEvaluation>({
    depth: 0,
    scoreCp: 0.2,
    scoreMate: null,
    bestMove: null,
    pvLine: '',
    isCalculating: false,
    imprint: undefined,
    topMoves: [],
  });

  const [engineReady, setEngineReady] = useState(false);
  const workerRef = useRef<ReturnType<typeof createStockfishWorker> | null>(null);
  const lastUpdateTimestampRef = useRef<number>(0);

  useEffect(() => {
    // Spin up background worker thread controller
    const worker = createStockfishWorker();
    workerRef.current = worker;

    worker.addEventListener((event) => {
      if (event.type === 'READY') {
        setEngineReady(true);
        return;
      }

      // Stream Throttle Gate (250ms) to prevent UI thread choking from rapid UCI line floods
      const now = Date.now();
      if (event.type === 'EVALUATION' && event.data) {
        if (now - lastUpdateTimestampRef.current >= 250) {
          lastUpdateTimestampRef.current = now;
          setEvaluation((prev) => ({
            ...prev,
            scoreCp: event.data!.scoreCp,
            imprint: event.data!.imprint,
            topMoves: event.data!.topMoves || prev.topMoves,
          }));
        }
      } else if (event.type === 'MOVE_FOUND' && event.data) {
        // High-priority: bestmove always passes immediately without throttling
        lastUpdateTimestampRef.current = now;
        setEvaluation({
          depth: event.data.depth,
          scoreCp: event.data.scoreCp,
          scoreMate: null,
          bestMove: event.data.bestMove,
          pvLine: event.data.pvLine,
          isCalculating: false,
          imprint: event.data.imprint,
          topMoves: event.data.topMoves || [],
        });
      }
    });

    worker.postMessage({ type: 'START' });

    return () => {
      worker.terminate();
    };
  }, []);

  const evaluatePosition = useCallback((fen: string, depth = 3, movetime = 800) => {
    setEvaluation((prev) => ({ ...prev, isCalculating: true }));
    if (workerRef.current) {
      workerRef.current.postMessage({
        type: 'CALCULATE',
        data: { fen, depth, movetime },
      });
    }
  }, []);

  const stopEvaluation = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'STOP' });
    }
    setEvaluation((prev) => ({ ...prev, isCalculating: false }));
  }, []);

  return {
    engineReady,
    evaluation,
    evaluatePosition,
    stopEvaluation,
  };
}
