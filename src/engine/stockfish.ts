import { useState, useEffect, useCallback, useRef } from 'react';
import { createStockfishWorker } from './stockfish.worker';

export interface EngineEvaluation {
  depth: number;
  scoreCp: number | null;
  scoreMate: number | null;
  bestMove: string | null;
  pvLine: string;
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

  const [engineReady, setEngineReady] = useState(false);
  const workerRef = useRef<ReturnType<typeof createStockfishWorker> | null>(null);

  useEffect(() => {
    // Spin up background worker thread controller
    const worker = createStockfishWorker();
    workerRef.current = worker;

    worker.addEventListener((event) => {
      if (event.type === 'READY') {
        setEngineReady(true);
      } else if (event.type === 'EVALUATION' && event.data) {
        setEvaluation((prev) => ({
          ...prev,
          scoreCp: event.data!.scoreCp,
        }));
      } else if (event.type === 'MOVE_FOUND' && event.data) {
        setEvaluation({
          depth: event.data.depth,
          scoreCp: event.data.scoreCp,
          scoreMate: null,
          bestMove: event.data.bestMove,
          pvLine: event.data.pvLine,
          isCalculating: false,
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
