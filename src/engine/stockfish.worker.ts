import { searchBestMove, evaluateBoardState, CandidateMove } from './androidChessEngine';
import { rustEngineBridge } from './rustWasmEngine';
import { jevCognitiveFilter, JevVisualImprint } from './jevFilter';
import { superCache } from './superCache';
import { Chess } from 'chess.js';

export interface WorkerMessage {
  type: 'START' | 'CALCULATE' | 'STOP';
  data?: {
    fen: string;
    depth?: number;
    movetime?: number;
  };
}

export interface WorkerResponse {
  type: 'READY' | 'MOVE_FOUND' | 'EVALUATION' | 'ERROR';
  data?: {
    bestMove: string | null;
    scoreCp: number | null;
    depth: number;
    pvLine: string;
    imprint?: JevVisualImprint;
    topMoves?: CandidateMove[];
  };
  error?: string;
}

// Background Worker implementation for chess engine processing
class StockfishWorkerController {
  private listeners: ((event: WorkerResponse) => void)[] = [];
  private isBusy = false;
  private currentCalculationId = 0;

  constructor() {
    rustEngineBridge.initEngine();
  }

  public postMessage(msg: WorkerMessage) {
    if (msg.type === 'START') {
      setTimeout(() => {
        this.emit({ type: 'READY' });
      }, 10);
      return;
    }

    if (msg.type === 'STOP') {
      this.isBusy = false;
      this.currentCalculationId++;
      return;
    }

    if (msg.type === 'CALCULATE' && msg.data) {
      const calcId = ++this.currentCalculationId;
      const { fen, depth = 3, movetime = 500 } = msg.data;

      // 1. Instant 0ms Super Cache & Transposition Table Lookup
      const cached = superCache.get(fen, depth);
      if (cached) {
        this.emit({
          type: 'EVALUATION',
          data: {
            bestMove: cached.bestMove,
            scoreCp: cached.scoreCp,
            depth: cached.depth,
            pvLine: cached.pvLine,
            imprint: cached.imprint,
          },
        });
        this.emit({
          type: 'MOVE_FOUND',
          data: {
            bestMove: cached.bestMove,
            scoreCp: cached.scoreCp,
            depth: cached.depth,
            pvLine: cached.pvLine,
            imprint: cached.imprint,
          },
        });
        return;
      }

      // 2. Instant static zero-allocation bitboard evaluation & Jev System-One Imprinting (<3ms)
      try {
        const bitboardEval = rustEngineBridge.evaluateBitboard(fen);
        const tempChess = new Chess(fen);
        const staticScore = evaluateBoardState(tempChess) / 100 || bitboardEval.scoreCp;
        const legalMoves = tempChess.moves({ verbose: true });
        const jevDecision = jevCognitiveFilter.filterPosition(fen, legalMoves);

        this.emit({
          type: 'EVALUATION',
          data: {
            bestMove: null,
            scoreCp: staticScore,
            depth: bitboardEval.depth,
            pvLine: '',
            imprint: jevDecision.imprint,
          },
        });

        // 3. High-confidence fast policy bypass (<5ms forward pass)
        if (jevDecision.isObviousMove && jevDecision.policyMove) {
          superCache.set(
            fen,
            jevDecision.policyMove,
            staticScore,
            1,
            `⚡ Jev Fast-Policy: ${jevDecision.cognitiveInsight}`,
            jevDecision.imprint
          );

          this.emit({
            type: 'MOVE_FOUND',
            data: {
              bestMove: jevDecision.policyMove,
              scoreCp: staticScore,
              depth: 1,
              pvLine: `⚡ Jev Fast-Policy: ${jevDecision.cognitiveInsight}`,
              imprint: jevDecision.imprint,
            },
          });
          return;
        }
      } catch (err: any) {
        this.emit({ type: 'ERROR', error: err.message });
      }

      // 4. Time-Sliced Non-Blocking Engine Search with micro-yield
      setTimeout(() => {
        if (calcId !== this.currentCalculationId) return;

        try {
          const tempChess = new Chess(fen);
          const legalMoves = tempChess.moves({ verbose: true });
          const jevDecision = jevCognitiveFilter.filterPosition(fen, legalMoves);
          const allocatedDepth = Math.max(depth, jevDecision.recommendedDepth);

          const searchResult = searchBestMove(tempChess, allocatedDepth);
          const bestMoveLan = searchResult.bestMove
            ? `${searchResult.bestMove.from}${searchResult.bestMove.to}`
            : (jevDecision.policyMove || null);
          const pvStr = searchResult.bestMove ? searchResult.bestMove.san : '';

          // Cache evaluated state in Super Cache
          superCache.set(
            fen,
            bestMoveLan,
            searchResult.scoreCp,
            allocatedDepth,
            pvStr,
            jevDecision.imprint
          );

          this.emit({
            type: 'MOVE_FOUND',
            data: {
              bestMove: bestMoveLan,
              scoreCp: searchResult.scoreCp,
              depth: allocatedDepth,
              pvLine: pvStr,
              imprint: jevDecision.imprint,
              topMoves: searchResult.topMoves,
            },
          });
        } catch (err: any) {
          this.emit({ type: 'ERROR', error: err.message });
        }
      }, 16); // 16ms frame-synced micro-yield
    }
  }

  public addEventListener(callback: (event: WorkerResponse) => void) {
    this.listeners.push(callback);
  }

  public removeEventListener(callback: (event: WorkerResponse) => void) {
    this.listeners = this.listeners.filter((cb) => cb !== callback);
  }

  public terminate() {
    this.listeners = [];
    this.isBusy = false;
    this.currentCalculationId++;
  }

  private emit(event: WorkerResponse) {
    this.listeners.forEach((cb) => {
      try {
        cb(event);
      } catch {
        // ignore listener errors
      }
    });
  }
}

export function createStockfishWorker() {
  return new StockfishWorkerController();
}
