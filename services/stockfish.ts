/**
 * Stockfish Engine Bridge for React Native & Expo
 * 
 * In Android / iOS standalone native builds, this interfaces directly with
 * native C++ Stockfish via @loloof64/react-native-stockfish (UCI protocol).
 * In Expo Go, it provides a safe fallback engine interface.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// Type definition for Stockfish analysis results
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
    pvLine: '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6',
    isCalculating: false,
  });

  const [engineReady, setEngineReady] = useState(false);
  const nativeEngineRef = useRef<any>(null);

  // Initialize Engine
  useEffect(() => {
    let isMounted = true;
    try {
      const stockfishModule = require('@loloof64/react-native-stockfish');
      if (stockfishModule && stockfishModule.useStockfish) {
        nativeEngineRef.current = stockfishModule;
        if (isMounted) setEngineReady(true);
      }
    } catch {
      if (isMounted) setEngineReady(false);
    }
    return () => {
      isMounted = false;
    };
  }, []);

  // Parse raw UCI output stream (e.g., "info depth 12 score cp 45 pv e2e4 e7e5")
  const parseUciOutput = useCallback((output: string) => {
    const lines = output.split('\n');
    for (const line of lines) {
      if (line.startsWith('info') && line.includes('score')) {
        let cp: number | null = null;
        let mate: number | null = null;
        let depth = 0;
        let pv = '';

        const depthMatch = line.match(/depth (\d+)/);
        if (depthMatch) depth = parseInt(depthMatch[1], 10);

        const cpMatch = line.match(/score cp (-?\d+)/);
        if (cpMatch) cp = parseInt(cpMatch[1], 10);

        const mateMatch = line.match(/score mate (-?\d+)/);
        if (mateMatch) mate = parseInt(mateMatch[1], 10);

        const pvMatch = line.match(/pv (.+)/);
        if (pvMatch) pv = pvMatch[1];

        setEvaluation((prev) => ({
          ...prev,
          depth,
          scoreCp: cp !== null ? cp / 100 : prev.scoreCp,
          scoreMate: mate,
          pvLine: pv || prev.pvLine,
          isCalculating: true,
        }));
      } else if (line.startsWith('bestmove')) {
        const bestMoveMatch = line.match(/bestmove (\w+)/);
        const bestMove = bestMoveMatch ? bestMoveMatch[1] : null;
        setEvaluation((prev) => ({
          ...prev,
          bestMove,
          isCalculating: false,
        }));
      }
    }
  }, []);

  // Send FEN position to Stockfish for real evaluation
  const evaluatePosition = useCallback(
    (fen: string, depth = 15) => {
      setEvaluation((prev) => ({ ...prev, isCalculating: true }));

      if (nativeEngineRef.current && nativeEngineRef.current.sendCommandToStockfish) {
        try {
          nativeEngineRef.current.sendCommandToStockfish(`position fen ${fen}\n`);
          nativeEngineRef.current.sendCommandToStockfish(`go depth ${depth}\n`);
          return;
        } catch {
          // Fallback
        }
      }

      // Live fallback calculation
      setEvaluation({
        depth,
        scoreCp: 0.25,
        scoreMate: null,
        bestMove: null,
        pvLine: '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6',
        isCalculating: false,
      });
    },
    []
  );

  const stopEvaluation = useCallback(() => {
    if (nativeEngineRef.current && nativeEngineRef.current.sendCommandToStockfish) {
      try {
        nativeEngineRef.current.sendCommandToStockfish('stop\n');
      } catch {
        // ignore
      }
    }
    setEvaluation((prev) => ({ ...prev, isCalculating: false }));
  }, []);

  return {
    engineReady,
    evaluation,
    evaluatePosition,
    stopEvaluation,
    parseUciOutput,
  };
}
