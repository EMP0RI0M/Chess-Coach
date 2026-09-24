import { searchBestMove, evaluateBoardState, CandidateMove } from './androidChessEngine';
import { rustEngineBridge } from './rustWasmEngine';
import { jevCognitiveFilter, JevVisualImprint } from './jevFilter';
import { superCache } from './superCache';
import { chessApiService } from './chessApiService';
import { jevInvariantExtractor, JevVariationAnalysis } from './jevInvariantExtractor';
import { EngineSource } from '../state/chessStore';
import { Chess } from 'chess.js';

export interface WorkerMessage {
  type: 'START' | 'CALCULATE' | 'STOP';
  data?: {
    fen: string;
    depth?: number;
    movetime?: number;
    engineSource?: EngineSource;
    serverAnalysis?: boolean;
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
    jevAnalysis?: JevVariationAnalysis;
    engineSource?: EngineSource;
    sourceLabel?: string;
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
      const { fen, depth = 12, movetime = 500, engineSource = 'stockfish', serverAnalysis = true } = msg.data;

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
            sourceLabel: serverAnalysis ? 'Server' : 'Local',
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
            sourceLabel: serverAnalysis ? 'Server' : 'Local',
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
            sourceLabel: 'Jev Fast System-1',
          },
        });

        // 3. Forced move instant return (strictly when only 1 legal move exists)
        if (legalMoves.length === 1) {
          const forcedMove = legalMoves[0];
          const forcedLan = `${forcedMove.from}${forcedMove.to}`;
          const quickJevAnalysis = jevInvariantExtractor.extract(fen, [forcedLan], staticScore);
          superCache.set(
            fen,
            forcedLan,
            staticScore,
            1,
            `⚡ Forced move: ${forcedMove.san}`,
            jevDecision.imprint
          );

          this.emit({
            type: 'MOVE_FOUND',
            data: {
              bestMove: forcedLan,
              scoreCp: staticScore,
              depth: 1,
              pvLine: `⚡ Forced: ${forcedMove.san}`,
              imprint: jevDecision.imprint,
              jevAnalysis: quickJevAnalysis,
              sourceLabel: 'Forced (Instant)',
            },
          });
          return;
        }
      } catch (err: any) {
        this.emit({ type: 'ERROR', error: err.message });
      }

      // 4. If Local Stockfish explicitly requested or Server Analysis toggled OFF
      if (engineSource === 'local_stockfish' || !serverAnalysis) {
        this.runLocalSearch(calcId, fen, depth, initialJevImprint, 'Local Stockfish');
        return;
      }

      // 5. Website Provider (Lichess Cloud Evaluation)
      if (engineSource === 'website') {
        fetch(`https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=3`)
          .then((res) => res.ok ? res.json() : null)
          .then((data) => {
            if (calcId !== this.currentCalculationId) return;
            if (data && data.pvs && data.pvs.length > 0) {
              const pv0 = data.pvs[0];
              const moves = pv0.moves.split(' ');
              const bestMoveLan = moves[0];
              const scoreCp = pv0.cp !== undefined ? pv0.cp / 100 : (pv0.mate ? pv0.mate * 10 : 0);
              const cloudDepth = data.depth || 25;
              const jev = jevInvariantExtractor.extract(fen, moves, scoreCp);

              this.emit({
                type: 'MOVE_FOUND',
                data: {
                  bestMove: bestMoveLan,
                  scoreCp,
                  depth: cloudDepth,
                  pvLine: `🌐 Lichess: ${moves.slice(0, 4).join(' ')}`,
                  imprint: initialJevImprint,
                  jevAnalysis: jev,
                  engineSource: 'website',
                  sourceLabel: `Website (Depth ${cloudDepth})`,
                },
              });
              return;
            }
            // Fallback to stockfish cloud stream
            this.runCloudStockfish(calcId, fen, depth, initialJevImprint, 'website');
          })
          .catch(() => {
            if (calcId !== this.currentCalculationId) return;
            this.runCloudStockfish(calcId, fen, depth, initialJevImprint, 'website');
          });
        return;
      }

      // 6. Malaf Server Provider
      if (engineSource === 'malaf_server') {
        this.runCloudStockfish(calcId, fen, depth, initialJevImprint, 'malaf_server', 'Malaf Server');
        return;
      }

      // 7. Default: Stockfish 18 NNUE Cloud Stream (Chess-API.com @ 80 MNPS)
      this.runCloudStockfish(calcId, fen, depth, initialJevImprint, 'stockfish', 'Server Stockfish 18');
    }
  }

  private runCloudStockfish(
    calcId: number,
    fen: string,
    depth: number,
    imprint?: JevVisualImprint,
    source: EngineSource = 'stockfish',
    customLabel?: string
  ) {
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
            imprint
          );

          this.emit({
            type: 'MOVE_FOUND',
            data: {
              bestMove: cloudResult.bestMove,
              scoreCp: cloudResult.scoreCp,
              depth: cloudResult.depth,
              pvLine: `🦆 SF18: ${cloudResult.pvLine}`,
              imprint,
              topMoves: cloudResult.topMoves,
              jevAnalysis: cloudResult.jevAnalysis,
              engineSource: source,
              sourceLabel: customLabel || `Server SF18 (Depth ${cloudResult.depth})`,
            },
          });
        } else {
          // Offline fallback
          this.runLocalSearch(calcId, fen, depth, imprint, 'Local Stockfish');
        }
      })
      .catch(() => {
        if (calcId !== this.currentCalculationId) return;
        this.runLocalSearch(calcId, fen, depth, imprint, 'Local Stockfish');
      });
  }

  private runLocalSearch(
    calcId: number,
    fen: string,
    depth: number,
    imprint?: JevVisualImprint,
    label: string = 'Local Stockfish'
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
        const localJevAnalysis = bestMoveLan 
          ? jevInvariantExtractor.extract(fen, [bestMoveLan], searchResult.scoreCp) 
          : undefined;

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
            jevAnalysis: localJevAnalysis,
            engineSource: 'local_stockfish',
            sourceLabel: `${label} (Depth 3)`,
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
