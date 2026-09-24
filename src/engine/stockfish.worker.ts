import { searchBestMove, evaluateBoardState } from './androidChessEngine';
import { rustEngineBridge } from './rustWasmEngine';
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
      }, 50);
      return;
    }

    if (msg.type === 'STOP') {
      this.isBusy = false;
      this.currentCalculationId++;
      return;
    }

    if (msg.type === 'CALCULATE' && msg.data) {
      const calcId = ++this.currentCalculationId;
      const { fen, depth = 3, movetime = 800 } = msg.data;

      // 1. Instant static zero-allocation bitboard evaluation
      try {
        const bitboardEval = rustEngineBridge.evaluateBitboard(fen);
        const tempChess = new Chess(fen);
        const staticScore = evaluateBoardState(tempChess) / 100 || bitboardEval.scoreCp;
        this.emit({
          type: 'EVALUATION',
          data: {
            bestMove: null,
            scoreCp: staticScore,
            depth: bitboardEval.depth,
            pvLine: '',
          },
        });
      } catch (err: any) {
        this.emit({ type: 'ERROR', error: err.message });
      }

      // 2. Bounded asynchronous engine search budget (movetime)
      setTimeout(() => {
        if (calcId !== this.currentCalculationId) return;

        try {
          const tempChess = new Chess(fen);
          const searchResult = searchBestMove(tempChess, depth);
          const bestMoveLan = searchResult.bestMove
            ? `${searchResult.bestMove.from}${searchResult.bestMove.to}`
            : null;
          const pvStr = searchResult.bestMove ? searchResult.bestMove.san : '';

          this.emit({
            type: 'MOVE_FOUND',
            data: {
              bestMove: bestMoveLan,
              scoreCp: searchResult.scoreCp,
              depth,
              pvLine: pvStr,
            },
          });
        } catch (err: any) {
          this.emit({ type: 'ERROR', error: err.message });
        }
      }, Math.min(movetime, 50));
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
