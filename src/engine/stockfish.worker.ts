import { searchBestMove, evaluateBoardState, CandidateMove } from './androidChessEngine';
import { rustEngineBridge } from './rustWasmEngine';
import { jevCognitiveFilter, JevVisualImprint } from './jevFilter';
import { superCache } from './superCache';
import { chessApiService } from './chessApiService';
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
      const { fen, depth = 12, movetime = 500 } = msg.data;

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

      // 2. System 1: Instant static zero-allocation bitboard evaluation & Jev Imprinting (<1ms)
      let initialJevImprint: JevVisualImprint | undefined;
      try {
        const bitboardEval = rustEngineBridge.evaluateBitboard(fen);
        const tempChess = new Chess(fen);
        const staticScore = evaluateBoardState(tempChess) / 100 || bitboardEval.scoreCp;
        const legalMoves = tempChess.moves({ verbose: true });
        const jevDecision = jevCognitiveFilter.filterPosition(fen, legalMoves);
        initialJevImprint = jevDecision.imprint;

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

        // 3. High-confidence fast policy bypass (<3ms forward pass)
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

      // 4. System 2: Dual Chess-API.com Cloud Stream (80 MNPS Stockfish 18 NNUE @ 32 vCores)
      chessApiService
        .analyzePosition(fen, 3, depth)
        .then((cloudResult) => {
          if (calcId !== this.currentCalculationId) return;

          if (cloudResult) {
            superCache.set(
              fen,
              cloudResult.bestMove,
              cloudResult.scoreCp,
              cloudResult.depth,
              cloudResult.pvLine,
              initialJevImprint
            );

            this.emit({
              type: 'MOVE_FOUND',
              data: {
                bestMove: cloudResult.bestMove,
                scoreCp: cloudResult.scoreCp,
                depth: cloudResult.depth,
                pvLine: `🦆 SF18: ${cloudResult.pvLine}`,
                imprint: initialJevImprint,
                topMoves: cloudResult.topMoves,
              },
            });
          } else {
            // 5. Offline fallback: local pruned alpha-beta search
            this.runLocalSearch(calcId, fen, depth, initialJevImprint);
          }
        })
        .catch(() => {
          if (calcId !== this.currentCalculationId) return;
          this.runLocalSearch(calcId, fen, depth, initialJevImprint);
        });
    }
  }

  private runLocalSearch(
    calcId: number,
    fen: string,
    depth: number,
    imprint?: JevVisualImprint
  ) {
    setTimeout(() => {
      if (calcId !== this.currentCalculationId) return;

      try {
        const tempChess = new Chess(fen);
        const searchResult = searchBestMove(tempChess, Math.min(depth, 3));
        const bestMoveLan = searchResult.bestMove
          ? `${searchResult.bestMove.from}${searchResult.bestMove.to}`
          : null;
        const pvStr = searchResult.bestMove ? searchResult.bestMove.san : '';

        superCache.set(
          fen,
          bestMoveLan,
          searchResult.scoreCp,
          3,
          pvStr,
          imprint
        );

        this.emit({
          type: 'MOVE_FOUND',
          data: {
            bestMove: bestMoveLan,
            scoreCp: searchResult.scoreCp,
            depth: 3,
            pvLine: pvStr,
            imprint,
            topMoves: searchResult.topMoves,
          },
        });
      } catch (err: any) {
        this.emit({ type: 'ERROR', error: err.message });
      }
    }, 10);
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
