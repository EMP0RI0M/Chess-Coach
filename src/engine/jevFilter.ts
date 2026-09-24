import { Chess, Move } from 'chess.js';
import { SENSORY_ANCHORING_MAP, SensoryAnchorSpec } from './sensoryAnchoring';

export type TacticalMotif = 'Pin' | 'Fork' | 'Overloaded_Defender' | 'Space_Clamp' | 'King_Exposure' | 'Discovered_Attack' | 'Back_Rank_Mate' | 'Demolition' | 'Tactical_Sacrifice';

export interface JevVisualImprint {
  tacticalMotif: TacticalMotif;
  criticalSquare: string; // e.g. "f7", "e4", "d5"
  confidenceScore: number; // 0.0 to 1.0
  flashWord: string; // e.g. "DEMOLITION", "PIN", "VECTOR CLAMP"
  threatSeverity: number; // 1 to 10
  vectorClampLine?: { from: string; to: string } | null;
  latencyMs: number;
  uiColorOverlay: string;
  audioSpec?: SensoryAnchorSpec;
}

export interface SystemOneDecision {
  policyMove: string | null;
  confidence: number; // 0.0 to 1.0
  recommendedDepth: number;
  isObviousMove: boolean;
  tacticalPruningOrder: string[]; // Ordered list of top candidate moves
  cognitiveInsight: string;
  imprint: JevVisualImprint;
}

export class JevCognitiveFilter {
  /**
   * Fast Non-Autoregressive "System One" Neuro-Imprinting & Policy Filter
   * Outputs structured decision primitives, visual anchor squares, and flash motifs in <5ms.
   */
  public filterPosition(fen: string, legalMoves: Move[]): SystemOneDecision {
    const t0 = Date.now();

    if (legalMoves.length === 0) {
      const spec = SENSORY_ANCHORING_MAP['King_Exposure'];
      const imprint: JevVisualImprint = {
        tacticalMotif: 'King_Exposure',
        criticalSquare: 'e1',
        confidenceScore: 1.0,
        flashWord: 'TERMINAL',
        threatSeverity: 10,
        latencyMs: Date.now() - t0,
        uiColorOverlay: spec.ui_color_overlay,
        audioSpec: spec,
      };
      return {
        policyMove: null,
        confidence: 1.0,
        recommendedDepth: 0,
        isObviousMove: false,
        tacticalPruningOrder: [],
        cognitiveInsight: 'Game Over / Terminal state.',
        imprint,
      };
    }

    // 1. Analyze critical squares (f7/f2 king exposure, central clamps, back ranks, sacrifices)
    let detectedMotif: TacticalMotif = 'Space_Clamp';
    let criticalSquare = 'e4';
    let flashWord = 'POSITIONAL';
    let threatSeverity = 3;
    let vectorClampLine: { from: string; to: string } | null = null;

    for (const m of legalMoves) {
      // Piece sacrifice for dynamic compensation or check
      if (m.captured && this.getPieceValue(m.piece) > this.getPieceValue(m.captured) && ['q', 'r'].includes(m.piece)) {
        detectedMotif = 'Tactical_Sacrifice';
        criticalSquare = m.to;
        flashWord = 'SACRIFICE BREAK';
        threatSeverity = 9;
        vectorClampLine = { from: m.from, to: m.to };
        break;
      }
      // King Exposure / Demolition on f7 / f2
      if (['f7', 'f2'].includes(m.to) && (m.captured || m.san.includes('+'))) {
        detectedMotif = 'Demolition';
        criticalSquare = m.to;
        flashWord = 'DEMOLITION';
        threatSeverity = 9;
        break;
      }
      // Tactical Fork / Check
      if (m.san.includes('+')) {
        detectedMotif = 'King_Exposure';
        criticalSquare = m.to;
        flashWord = 'CHECK TENSION';
        threatSeverity = 8;
        break;
      }
      // Forks (Knights targeting multiple pieces)
      if (m.piece === 'n' && ['c7', 'f7', 'e6', 'd5'].includes(m.to)) {
        detectedMotif = 'Fork';
        criticalSquare = m.to;
        flashWord = 'TACTICAL FORK';
        threatSeverity = 8;
        break;
      }
      // Pins / Skewers (Bishops/Rooks along diagonals/files)
      if (['b', 'r', 'q'].includes(m.piece) && m.san.includes('x')) {
        detectedMotif = 'Pin';
        criticalSquare = m.to;
        flashWord = 'PIN VECTOR';
        threatSeverity = 7;
        vectorClampLine = { from: m.from, to: m.to };
      }
    }

    // 2. Check for single forced move (e.g. escaping check or single recapture)
    if (legalMoves.length === 1) {
      const singleMove = legalMoves[0];
      const spec = SENSORY_ANCHORING_MAP[detectedMotif] || SENSORY_ANCHORING_MAP['Space_Clamp'];
      const imprint: JevVisualImprint = {
        tacticalMotif: detectedMotif,
        criticalSquare: singleMove.to,
        confidenceScore: 0.99,
        flashWord: 'FORCED REPLY',
        threatSeverity,
        latencyMs: Date.now() - t0,
        uiColorOverlay: spec.ui_color_overlay,
        audioSpec: spec,
      };
      return {
        policyMove: `${singleMove.from}${singleMove.to}`,
        confidence: 0.99,
        recommendedDepth: 1, // Bypass deep calculation
        isObviousMove: true,
        tacticalPruningOrder: [`${singleMove.from}${singleMove.to}`],
        cognitiveInsight: 'Forced reply. Instant System-1 neuro-imprint.',
        imprint,
      };
    }

    // 3. Fast Policy Heuristic Scoring (MVV-LVA + Tactical checks)
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
    const recommendedDepth = isObvious ? 2 : (confidence < 0.5 ? 4 : 3);

    const spec = SENSORY_ANCHORING_MAP[detectedMotif] || SENSORY_ANCHORING_MAP['Space_Clamp'];
    const imprint: JevVisualImprint = {
      tacticalMotif: detectedMotif,
      criticalSquare: criticalSquare || bestCandidate.move.to,
      confidenceScore: confidence,
      flashWord: isObvious ? 'TACTICAL BLITZ' : flashWord,
      threatSeverity,
      vectorClampLine,
      latencyMs: Date.now() - t0,
      uiColorOverlay: spec.ui_color_overlay,
      audioSpec: spec,
    };

    return {
      policyMove: bestCandidate.lan,
      confidence,
      recommendedDepth,
      isObviousMove: isObvious,
      tacticalPruningOrder: scoredMoves.slice(0, 5).map((m) => m.lan),
      cognitiveInsight: isObvious
        ? `Jev Confidence ${Math.round(confidence * 100)}%: ${flashWord} on ${criticalSquare}.`
        : `Jev Ambiguity: Complex position with multiple viable lines.`,
      imprint,
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
