import { Chess, Move } from 'chess.js';

export interface SystemOneDecision {
  policyMove: string | null;
  confidence: number; // 0.0 to 1.0
  recommendedDepth: number;
  isObviousMove: boolean;
  tacticalPruningOrder: string[]; // Ordered list of top candidate moves
  cognitiveInsight: string;
}

export class JevCognitiveFilter {
  private isOnline = false;

  constructor() {
    // Initialized
  }

  /**
   * Fast Non-Autoregressive "System One" Policy Filter
   * Evaluates the chess state instantaneously (<5ms) to predict move probabilities,
   * prune unpromising tree branches, and dynamically assign calculation budgets.
   */
  public filterPosition(fen: string, legalMoves: Move[]): SystemOneDecision {
    if (legalMoves.length === 0) {
      return {
        policyMove: null,
        confidence: 1.0,
        recommendedDepth: 0,
        isObviousMove: false,
        tacticalPruningOrder: [],
        cognitiveInsight: 'Game Over / Terminal state.',
      };
    }

    // 1. Check for single forced move (e.g. escaping check or single recapture)
    if (legalMoves.length === 1) {
      const singleMove = legalMoves[0];
      return {
        policyMove: `${singleMove.from}${singleMove.to}`,
        confidence: 0.99,
        recommendedDepth: 1, // Bypass deep calculation
        isObviousMove: true,
        tacticalPruningOrder: [`${singleMove.from}${singleMove.to}`],
        cognitiveInsight: 'Forced reply. Bypassing engine calculation search.',
      };
    }

    // 2. Fast Policy Heuristic Scoring (MVV-LVA + Tactical checks)
    const scoredMoves = legalMoves.map((m) => {
      let score = 0;
      // Captures
      if (m.captured) {
        const victimVal = this.getPieceValue(m.captured);
        const attackerVal = this.getPieceValue(m.piece);
        score += 1000 + (victimVal * 10 - attackerVal);
      }
      // Checks
      if (m.san.includes('+')) {
        score += 500;
      }
      // Promotions
      if (m.promotion) {
        score += 800;
      }
      // Central Control (e4, d4, e5, d5, c4, f4)
      if (['e4', 'd4', 'e5', 'd5', 'c4', 'c5', 'f4', 'f5'].includes(m.to)) {
        score += 50;
      }
      // Piece Development (Knights & Bishops early)
      if (['n', 'b'].includes(m.piece)) {
        score += 30;
      }

      return {
        lan: `${m.from}${m.to}`,
        san: m.san,
        score,
        move: m,
      };
    });

    // Sort moves descending by policy score
    scoredMoves.sort((a, b) => b.score - a.score);

    const bestCandidate = scoredMoves[0];
    const secondCandidate = scoredMoves.length > 1 ? scoredMoves[1] : null;

    // Determine confidence gap between #1 candidate and #2
    const scoreDiff = secondCandidate ? bestCandidate.score - secondCandidate.score : bestCandidate.score;
    const isObvious = scoreDiff > 400 && bestCandidate.score > 900;
    const confidence = isObvious ? 0.95 : Math.min(0.9, Math.max(0.3, scoreDiff / 500));

    // Dynamic Time & Depth Allocation:
    // High confidence -> Fast low depth (2-3)
    // Low confidence / Complex branched state -> Deep search depth (4-5)
    const recommendedDepth = isObvious ? 2 : (confidence < 0.5 ? 4 : 3);

    return {
      policyMove: bestCandidate.lan,
      confidence,
      recommendedDepth,
      isObviousMove: isObvious,
      tacticalPruningOrder: scoredMoves.slice(0, 5).map((m) => m.lan),
      cognitiveInsight: isObvious
        ? `Jev Confidence ${Math.round(confidence * 100)}%: High tactical priority detected.`
        : `Jev Ambiguity: Complex position with multiple viable continuations. Expanding search depth.`,
    };
  }

  private getPieceValue(p: string): number {
    switch (p.toLowerCase()) {
      case 'p': return 1;
      case 'n': return 3;
      case 'b': return 3;
      case 'r': return 5;
      case 'q': return 9;
      case 'k': return 100;
      default: return 0;
    }
  }
}

export const jevCognitiveFilter = new JevCognitiveFilter();
