/**
 * Dual-Core Chess-API.com Streaming Service
 * 
 * Streams Stockfish 18 NNUE calculation power (up to 80 MNPS @ 32 vCores)
 * via Chess-API.com without consuming mobile CPU.
 */

import { CandidateMove } from './androidChessEngine';

export interface ChessApiResponse {
  text: string;
  eval: number;
  centipawns: string;
  mate: number | null;
  move: string;
  san: string;
  lan: string;
  from: string;
  to: string;
  depth: number;
  winChance: number;
  continuationArr?: string[];
  type: 'move' | 'bestmove' | 'info';
  taskId?: string;
}

class ChessApiService {
  private ws: WebSocket | null = null;
  private currentTaskId: string = '';
  private listeners: ((res: ChessApiResponse) => void)[] = [];

  constructor() {
    this.initWebSocket();
  }

  private initWebSocket() {
    try {
      if (typeof WebSocket !== 'undefined') {
        this.ws = new WebSocket('wss://chess-api.com/v1');

        this.ws.onmessage = (event) => {
          try {
            const data: ChessApiResponse = JSON.parse(event.data);
            this.emit(data);
          } catch {
            // ignore malformed packets
          }
        };

        this.ws.onclose = () => {
          // Reconnect on close
          setTimeout(() => this.initWebSocket(), 3000);
        };

        this.ws.onerror = () => {
          // Fallback to POST fetch API on socket error
        };
      }
    } catch {
      // Offline fallback
    }
  }

  /**
   * Request Stockfish 18 NNUE analysis via POST or WebSocket stream
   */
  public async analyzePosition(
    fen: string,
    variants: number = 3,
    depth: number = 12
  ): Promise<{
    scoreCp: number;
    scoreMate: number | null;
    bestMove: string;
    depth: number;
    pvLine: string;
    topMoves: CandidateMove[];
    winChance: number;
  } | null> {
    const taskId = Math.random().toString(36).substring(2, 9);
    this.currentTaskId = taskId;

    // 1. If WebSocket is open, stream via WS
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(
          JSON.stringify({
            fen,
            variants,
            depth,
            maxThinkingTime: 50,
            taskId,
          })
        );
      } catch {
        // Fallback to POST
      }
    }

    // 2. High-speed POST fetch API fallback & confirmation
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1800);

      const response = await fetch('https://chess-api.com/v1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fen,
          variants,
          depth,
          maxThinkingTime: 50,
          taskId,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data: ChessApiResponse = await response.json();
        const scoreCp = data.eval;
        const bestMoveLan = data.lan || data.move || `${data.from}${data.to}`;

        // Build top candidate moves
        const topMoves: CandidateMove[] = [
          {
            from: data.from,
            to: data.to,
            san: data.san || data.move,
            scoreCp: scoreCp,
            rank: 1,
          },
        ];

        // If continuation array exists, map next variations
        if (data.continuationArr && data.continuationArr.length >= 2) {
          const move2 = data.continuationArr[1];
          if (move2 && move2.length >= 4) {
            topMoves.push({
              from: move2.substring(0, 2),
              to: move2.substring(2, 4),
              san: move2,
              scoreCp: scoreCp - 0.2,
              rank: 2,
            });
          }
        }

        return {
          scoreCp,
          scoreMate: data.mate,
          bestMove: bestMoveLan,
          depth: data.depth || depth,
          pvLine: (data.continuationArr || []).slice(0, 4).join(' ') || data.text,
          topMoves,
          winChance: data.winChance || 50,
        };
      }
    } catch {
      // Fallback
    }

    return null;
  }

  public addListener(callback: (res: ChessApiResponse) => void) {
    this.listeners.push(callback);
  }

  public removeListener(callback: (res: ChessApiResponse) => void) {
    this.listeners = this.listeners.filter((cb) => cb !== callback);
  }

  private emit(data: ChessApiResponse) {
    this.listeners.forEach((cb) => {
      try {
        cb(data);
      } catch {}
    });
  }
}

export const chessApiService = new ChessApiService();
