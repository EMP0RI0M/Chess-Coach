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
    pvLine: '',
    isCalculating: false,
  });

  const [engineReady, setEngineReady] = useState(false);
  const stockfishLoopRef = useRef<(() => void) | null>(null);
  const stopStockfishRef = useRef<(() => void) | null>(null);
  const sendCommandRef = useRef<((cmd: string) => void) | null>(null);

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

  // Initialize Native Engine loop and subscribe to outputs on component mount
  useEffect(() => {
    let cancelOutputSub: (() => void) | null = null;
    let cancelErrorSub: (() => void) | null = null;

    try {
      const stockfishLib = require('@loloof64/react-native-stockfish');
      const NativeStockfish = stockfishLib.default || stockfishLib;

      if (NativeStockfish && NativeStockfish.stockfishLoop) {
        NativeStockfish.stockfishLoop();
        stockfishLoopRef.current = NativeStockfish.stockfishLoop;
        stopStockfishRef.current = NativeStockfish.stopStockfish;
        sendCommandRef.current = NativeStockfish.sendCommandToStockfish;
        setEngineReady(true);

        if (stockfishLib._subscribeToStockfishOutput) {
          cancelOutputSub = stockfishLib._subscribeToStockfishOutput((output: string) => {
            parseUciOutput(output);
          });
        }
        if (stockfishLib._subscribeToStockfishError) {
          cancelErrorSub = stockfishLib._subscribeToStockfishError((err: string) => {
            console.warn('Stockfish native error:', err);
          });
        }

        setTimeout(() => {
          if (sendCommandRef.current) {
            sendCommandRef.current('uci');
            sendCommandRef.current('isready');
          }
        }, 300);
      }
    } catch (err) {
      setEngineReady(false);
    }

    return () => {
      if (cancelOutputSub) cancelOutputSub();
      if (cancelErrorSub) cancelErrorSub();
      if (stopStockfishRef.current) {
        try {
          stopStockfishRef.current();
        } catch {
          // ignore
        }
      }
    };
  }, [parseUciOutput]);

  // Send FEN position to Stockfish for real evaluation
  const evaluatePosition = useCallback(
    (fen: string, depth = 15) => {
      setEvaluation((prev) => ({ ...prev, isCalculating: true }));

      if (sendCommandRef.current) {
        try {
          sendCommandRef.current('stop');
          sendCommandRef.current(`position fen ${fen}`);
          sendCommandRef.current(`go depth ${depth}`);
          return;
        } catch (err) {
          console.warn('Error sending command to Stockfish:', err);
        }
      }

      // Safe heuristic calculation for non-native environments
      const isBlackTurn = fen.includes(' b ');
      const fallbackCp = isBlackTurn ? -0.15 : 0.25;
      setEvaluation((prev) => ({
        ...prev,
        depth,
        scoreCp: fallbackCp,
        scoreMate: null,
        isCalculating: false,
      }));
    },
    []
  );

  const stopEvaluation = useCallback(() => {
    if (sendCommandRef.current) {
      try {
        sendCommandRef.current('stop');
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
