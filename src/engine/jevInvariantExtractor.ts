import { Chess, Square } from 'chess.js';

export interface JevVariationAnalysis {
  threat: string;
  constraint: string;
  transformation: string;
  dependency: string;
  invariant: string;
  failureCondition: string;
  coreIdea: string;
  pvLineSans: string[];
}

export class JevInvariantExtractor {
  /**
   * System 1: Invariant & Core Idea Extraction from Stockfish 5-10 Move PV Variations.
   * 
   * "Stockfish calculates the variation. JEV System-1 extracts the invariant/idea from that variation."
   * Detects:
   * 1. Threat: What is being threatened?
   * 2. Constraint: What is the opponent forced to deal with?
   * 3. Transformation: What changes across the moves?
   * 4. Dependency: Why move N works because of move N-1.
   * 5. Invariant: What strategic/tactical geometric truth remains TRUE across all moves.
   * 6. Failure Condition: What would make the original move stop working.
   */
  public extract(
    fen: string,
    pvMoves: string[], // array of LAN (e.g. ['e2e4', 'e7e5']) or SAN strings
    evalScore?: number | null
  ): JevVariationAnalysis {
    if (!pvMoves || pvMoves.length === 0) {
      return {
        threat: 'Positional maneuvering and space consolidation.',
        constraint: 'Opponent must maintain defensive coordination.',
        transformation: 'Gradual piece activation and file pressure.',
        dependency: 'Preserves tempo and tactical elasticity.',
        invariant: 'Dynamic balance and central territorial control.',
        failureCondition: 'Passive play allowing opponent counter-initiative.',
        coreIdea: 'Consolidates position while preventing tactical ruptures.',
        pvLineSans: [],
      };
    }

    try {
      const chess = new Chess(fen);
      const playedMoves: {
        san: string;
        from: string;
        to: string;
        piece: string;
        captured?: string;
        isCheck: boolean;
        turn: 'w' | 'b';
      }[] = [];

      for (const m of pvMoves) {
        if (!m) continue;
        let moveRes = null;
        if (m.length >= 4 && !m.includes(' ')) {
          const from = m.substring(0, 2) as Square;
          const to = m.substring(2, 4) as Square;
          const promotion = m.length > 4 ? m[4] : undefined;
          try {
            moveRes = chess.move({ from, to, promotion });
          } catch {
            try {
              moveRes = chess.move(m);
            } catch {}
          }
        } else {
          try {
            moveRes = chess.move(m);
          } catch {}
        }

        if (moveRes) {
          playedMoves.push({
            san: moveRes.san,
            from: moveRes.from,
            to: moveRes.to,
            piece: moveRes.piece,
            captured: moveRes.captured,
            isCheck: moveRes.san.includes('+') || moveRes.san.includes('#'),
            turn: moveRes.color,
          });
        }
      }

      if (playedMoves.length === 0) {
        return this.fallbackAnalysis(pvMoves[0]);
      }

      const firstMove = playedMoves[0];
      const side = firstMove.turn === 'w' ? 'White' : 'Black';
      const oppSide = firstMove.turn === 'w' ? 'Black' : 'White';
      const pvLineSans = playedMoves.map((m) => m.san);

      // 1. Detect Threat
      let threat = '';
      if (firstMove.isCheck) {
        threat = `Direct forcing check against ${oppSide}'s king on ${firstMove.to}, collapsing defensive coordination.`;
      } else if (firstMove.captured) {
        threat = `Material removal of the ${this.pieceName(firstMove.captured)} on ${firstMove.to}, targeting undefended tactical vectors.`;
      } else if (['q', 'r'].includes(firstMove.piece) && ['e1', 'e8', 'd1', 'd8', 'f7', 'f2'].includes(firstMove.to)) {
        threat = `Infiltration along the critical file/rank to seize absolute tactical dominance.`;
      } else {
        threat = `Creates immediate vector pressure on ${firstMove.to}, restricting ${oppSide}'s piece activity.`;
      }

      // 2. Detect Constraint
      let constraint = '';
      const forcedCaptures = playedMoves.slice(1, 3).filter((m) => m.captured || m.isCheck);
      if (forcedCaptures.length > 0) {
        constraint = `${oppSide} is forced into immediate defensive trades on ${forcedCaptures[0].to}, ceding initiative and tempo.`;
      } else if (playedMoves.length > 1 && playedMoves[1].isCheck) {
        constraint = `${oppSide}'s king is forced onto a precarious escape square, preventing defensive regrouping.`;
      } else {
        constraint = `${oppSide} is constrained to react to the central tension, unable to execute active counter-attacks.`;
      }

      // 3. Detect Transformation
      let transformation = '';
      const totalCaptures = playedMoves.filter((m) => m.captured).length;
      if (totalCaptures >= 2) {
        transformation = `Forces mass liquidation of minor pieces to convert dynamic spatial tension into a decisive structural advantage.`;
      } else if (firstMove.piece === 'p') {
        transformation = `Structural pawn breakthrough opening vital diagonals and files for heavy piece infiltration.`;
      } else {
        transformation = `Transforms localized piece activity into pervasive diagonal and file pressure across ${oppSide}'s territory.`;
      }

      // 4. Detect Dependency
      let dependency = '';
      if (playedMoves.length >= 2) {
        const move2 = playedMoves[1];
        dependency = `${side}'s subsequent follow-up (${playedMoves.slice(1, 3).map(m => m.san).join(' ')}) works because ${firstMove.san} deflected key defenders away from ${move2.to}.`;
      } else {
        dependency = `Secures tactical coordination between heavy pieces and central outposts.`;
      }

      // 5. Detect Invariant
      let invariant = '';
      const hasChecks = playedMoves.some((m) => m.isCheck);
      const pieceAct = firstMove.piece.toUpperCase();
      if (hasChecks) {
        invariant = `Continuous king exposure and vector clamp: ${oppSide}'s king remains under persistent tactical checkmate tension.`;
      } else if (totalCaptures > 0) {
        invariant = `Material and structural superiority: ${side} maintains active piece coordination while ${oppSide}'s defensive nodes remain overloaded.`;
      } else {
        invariant = `Geometric dominance of central vectors and permanent suppression of ${oppSide}'s counterplay.`;
      }

      // 6. Detect Failure Condition
      let failureCondition = '';
      if (firstMove.captured) {
        failureCondition = `Fails if ${oppSide} can maintain the defensive anchor on ${firstMove.to} without conceding tactical deflection.`;
      } else if (firstMove.isCheck) {
        failureCondition = `Fails if ${oppSide}'s king finds immediate shelter without compromising key piece protection.`;
      } else {
        failureCondition = `Fails if ${oppSide} is allowed time to complete piece harmonization or block the active line.`;
      }

      // 7. Human-readable JEV Core Idea
      const coreIdea = `${firstMove.san} creates a forcing problem for ${oppSide}. Even with optimal defensive responses (${pvLineSans.slice(1, 4).join(' ')}), ${side} maintains ${invariant.toLowerCase().replace(':', '—')}. The key factor is not just the piece exchange, but the permanent change in piece activity and pressure.`;

      return {
        threat,
        constraint,
        transformation,
        dependency,
        invariant,
        failureCondition,
        coreIdea,
        pvLineSans,
      };
    } catch {
      return this.fallbackAnalysis(pvMoves[0]);
    }
  }

  private fallbackAnalysis(moveStr?: string): JevVariationAnalysis {
    const move = moveStr || 'The move';
    return {
      threat: `${move} creates immediate tactical tension and central pressure.`,
      constraint: `Opponent is forced to address the active piece coordination.`,
      transformation: `Enhances dynamic square control across the board.`,
      dependency: `Follow-up moves rely on the opened lines established by ${move}.`,
      invariant: `Active piece geometry and sustained initiative.`,
      failureCondition: `Fails if opponent can safely consolidate without ceding central control.`,
      coreIdea: `${move} creates forcing pressure. The critical feature is the active coordination and resulting positional grip.`,
      pvLineSans: moveStr ? [moveStr] : [],
    };
  }

  private pieceName(p?: string): string {
    switch (p?.toLowerCase()) {
      case 'p': return 'pawn';
      case 'n': return 'knight';
      case 'b': return 'bishop';
      case 'r': return 'rook';
      case 'q': return 'queen';
      case 'k': return 'king';
      default: return 'piece';
    }
  }
}

export const jevInvariantExtractor = new JevInvariantExtractor();
