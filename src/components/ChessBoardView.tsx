import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Square, Chess } from 'chess.js';
import Svg, { Line, Circle as SvgCircle } from 'react-native-svg';
import { DraggablePiece } from './DraggablePiece';
import { BoardTheme, PieceTheme } from '../state/chessStore';
import { JevVisualImprint } from '../engine/jevFilter';
import { detectPositionThreats } from '../engine/threatDetector';

export interface MultiMoveArrow {
  from: { x: number; y: number };
  to: { x: number; y: number };
  rank: 1 | 2 | 3;
}

interface ChessBoardViewProps {
  chess: Chess;
  fen?: string;
  boardSize: number;
  isWhiteOrientation: boolean;
  selectedSquare: Square | null;
  possibleMoves: string[];
  lastMove: { from: string; to: string } | null;
  bestMoveArrow?: { from: { x: number; y: number }; to: { x: number; y: number }; isEngine: boolean } | null;
  multiMoveArrows?: MultiMoveArrow[] | null;
  heroSquare?: Square | null;
  threatsEnabled?: boolean;
  coordinatesEnabled?: boolean;
  onSquarePress: (square: Square) => void;
  onDropMove: (from: Square, to: Square) => void;
  isEditorActive?: boolean;
  boardTheme?: BoardTheme;
  pieceTheme?: PieceTheme;
  sideEvalCp?: number | null;
  sideEvalMate?: number | null;
  showSideEvalBar?: boolean;
  jevImprint?: JevVisualImprint;
}

const BOARD_THEME_COLORS: Record<BoardTheme, { light: string; dark: string }> = {
  'Classic Wood': { light: '#F0D9B5', dark: '#B58863' },
  'Emerald Green': { light: '#EADECA', dark: '#4B7399' },
  'Ocean Blue': { light: '#DEE3E6', dark: '#8CA2AD' },
  'Midnight Slate': { light: '#CBD5E1', dark: '#475569' },
  'Charcoal Dark': { light: '#E2E8F0', dark: '#334155' },
};

function getSquareCoords(sq: string | null | undefined, isWhiteOrientation: boolean, squareSize: number) {
  if (!sq || typeof sq !== 'string' || sq.length < 2) {
    return { x: 0, y: 0 };
  }
  const file = sq.charCodeAt(0) - 97; // 'a' -> 0
  const rank = parseInt(sq[1], 10) - 1;
  if (isNaN(file) || isNaN(rank) || file < 0 || file > 7 || rank < 0 || rank > 7) {
    return { x: 0, y: 0 };
  }
  const col = isWhiteOrientation ? file : 7 - file;
  const row = isWhiteOrientation ? 7 - rank : rank;
  return {
    x: col * squareSize + squareSize / 2,
    y: row * squareSize + squareSize / 2,
  };
}

export const ChessBoardView: React.FC<ChessBoardViewProps> = React.memo(
  ({
    chess,
    fen,
    boardSize,
    isWhiteOrientation,
    selectedSquare,
    possibleMoves,
    lastMove,
    bestMoveArrow,
    multiMoveArrows,
    heroSquare,
    threatsEnabled = false,
    coordinatesEnabled = true,
    onSquarePress,
    onDropMove,
    isEditorActive = false,
    boardTheme = 'Classic Wood',
    pieceTheme = 'Vector Neo',
    sideEvalCp,
    sideEvalMate,
    showSideEvalBar = true,
    jevImprint,
  }) => {
    const squareSize = boardSize / 8;
    const ranks = React.useMemo(() => isWhiteOrientation ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8], [isWhiteOrientation]);
    const files = React.useMemo(() => isWhiteOrientation ? ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] : ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'], [isWhiteOrientation]);
    const themeColors = BOARD_THEME_COLORS[boardTheme] || BOARD_THEME_COLORS['Classic Wood'];

    // Side Evaluation Bar Fill Calculation
    let whitePercentage = 50;
    if (sideEvalMate !== undefined && sideEvalMate !== null) {
      whitePercentage = sideEvalMate > 0 ? 98 : 2;
    } else if (sideEvalCp !== undefined && sideEvalCp !== null) {
      const clampedCp = Math.max(-10, Math.min(10, sideEvalCp));
      whitePercentage = 50 + (clampedCp / 10) * 45;
    }
    const topBarHeightPercent = isWhiteOrientation ? 100 - whitePercentage : whitePercentage;

    // Fast O(1) Matrix Board Extraction - Always fresh for current position
    const boardMatrix = chess.board();

    // Vector Clamp Ray calculation from Jev System-1
    const vectorClampPoints = React.useMemo(() => {
      if (!jevImprint?.vectorClampLine) return null;
      return {
        from: getSquareCoords(jevImprint.vectorClampLine.from, isWhiteOrientation, squareSize),
        to: getSquareCoords(jevImprint.vectorClampLine.to, isWhiteOrientation, squareSize),
      };
    }, [jevImprint?.vectorClampLine, isWhiteOrientation, squareSize]);

    // Real Threat Detection (Calculates opponent threat vectors and attacked pieces)
    const threatAnalysis = React.useMemo(() => {
      if (!threatsEnabled) {
        return {
          threatLines: [],
          attackedSquares: new Set<string>(),
          threatenedPieceSquares: new Set<string>(),
        };
      }
      return detectPositionThreats(fen || chess.fen());
    }, [threatsEnabled, fen, chess]);

    const activeTurn = chess.turn();

    return (
      <View style={styles.boardWithSideBarWrapper}>
        {/* 📊 Side Evaluation Bar Beside the Board */}
        {showSideEvalBar && (
          <View style={[styles.sideEvalBar, { height: boardSize }]}>
            <View
              style={[
                styles.sideEvalBlackFill,
                { height: `${topBarHeightPercent}%` },
              ]}
            />
            <View style={styles.sideEvalWhiteFill} />
          </View>
        )}

        <View style={styles.boardGlassContainer}>
          <View style={[styles.board, { width: boardSize, height: boardSize, backgroundColor: themeColors.dark }]}>
            {ranks.map((rank, rIdx) => (
              <View key={rank} style={[styles.row, { height: squareSize }]}>
                {files.map((file, fIdx) => {
                  const squareName = `${file}${rank}` as Square;
                  const matrixRow = 8 - rank;
                  const matrixCol = file.charCodeAt(0) - 97;
                  const piece = boardMatrix[matrixRow] ? boardMatrix[matrixRow][matrixCol] : null;
                  const isLight = (rIdx + fIdx) % 2 === 0;
                  const isSelected = selectedSquare === squareName;
                  const isTarget = possibleMoves.includes(squareName);
                  const isLastMoveSquare =
                    lastMove?.from === squareName || lastMove?.to === squareName;
                  const isHero = heroSquare === squareName;
                  // Threat is active if this piece belongs to the active player and is under direct attack
                  const isThreatenedPiece = threatsEnabled && piece && piece.color === activeTurn && threatAnalysis.threatenedPieceSquares.has(squareName);
                  const isAttackingPiece = threatsEnabled && piece && piece.color !== activeTurn && threatAnalysis.threatLines.some(t => t.from === squareName);
                  const isJevCritical = jevImprint && jevImprint.criticalSquare === squareName;
                  const jevGlowColor = jevImprint?.uiColorOverlay || '#EF4444';

                  const squareContent = (
                    <>
                      {/* Rank Coordinates */}
                      {coordinatesEnabled && fIdx === 0 && (
                        <Text
                          style={[
                            styles.coordRank,
                            { color: isLight ? themeColors.dark : themeColors.light },
                          ]}
                        >
                          {rank}
                        </Text>
                      )}

                      {/* File Coordinates */}
                      {coordinatesEnabled && rIdx === 7 && (
                        <Text
                          style={[
                            styles.coordFile,
                            { color: isLight ? themeColors.dark : themeColors.light },
                          ]}
                        >
                          {file}
                        </Text>
                      )}

                      {/* Move Target Indicators */}
                      {isTarget && (
                        <View
                          style={[
                            piece ? styles.captureRing : styles.moveDot,
                            {
                              width: squareSize * (piece ? 0.85 : 0.28),
                              height: squareSize * (piece ? 0.85 : 0.28),
                              borderRadius: (squareSize * (piece ? 0.85 : 0.28)) / 2,
                            },
                          ]}
                        />
                      )}

                      {/* Reanimated 120 FPS Native-Thread Draggable Piece */}
                      {piece && (
                        <DraggablePiece
                          square={squareName}
                          color={piece.color}
                          type={piece.type}
                          squareSize={squareSize}
                          isWhiteOrientation={isWhiteOrientation}
                          onDropMove={onDropMove}
                          onSelectSquare={onSquarePress}
                          disabled={isEditorActive}
                          pieceTheme={pieceTheme}
                        />
                      )}
                    </>
                  );

                  const squareStyle = [
                    styles.square,
                    {
                      width: squareSize,
                      height: squareSize,
                      backgroundColor: isLight ? themeColors.light : themeColors.dark,
                    },
                    isSelected && styles.selectedSquare,
                    isLastMoveSquare && styles.lastMoveSquare,
                    isHero && styles.heroSquareHighlight,
                    isThreatenedPiece && styles.threatenedPieceHighlight,
                    isAttackingPiece && styles.attackingPieceHighlight,
                    isJevCritical && {
                      backgroundColor: `${jevGlowColor}44`,
                      borderWidth: 2,
                      borderColor: jevGlowColor,
                    },
                  ];

                  if (piece) {
                    return (
                      <View key={squareName} style={squareStyle}>
                        {squareContent}
                      </View>
                    );
                  }

                  return (
                    <TouchableOpacity
                      key={squareName}
                      activeOpacity={0.8}
                      onPress={() => onSquarePress(squareName)}
                      style={squareStyle}
                    >
                      {squareContent}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}

            {/* SVG Vectors, High-Speed Sensory Laser & Real Threat Lines */}
            <Svg
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
              width={boardSize}
              height={boardSize}
            >
              {/* 1. Real Threat Vectors & Attacking Lines (Dashed Crimson Lines) */}
              {threatsEnabled &&
                threatAnalysis.threatLines.map((threat, idx) => {
                  const fromPt = getSquareCoords(threat.from, isWhiteOrientation, squareSize);
                  const toPt = getSquareCoords(threat.to, isWhiteOrientation, squareSize);
                  const isCritical = threat.severity >= 7;

                  return (
                    <React.Fragment key={`threat-vector-${idx}`}>
                      <Line
                        x1={fromPt.x}
                        y1={fromPt.y}
                        x2={toPt.x}
                        y2={toPt.y}
                        stroke="#EF4444"
                        strokeWidth={isCritical ? '4' : '2.5'}
                        strokeOpacity={0.85}
                        strokeDasharray={isCritical ? '6, 3' : '4, 4'}
                        strokeLinecap="round"
                      />
                      <SvgCircle
                        cx={toPt.x}
                        cy={toPt.y}
                        r={isCritical ? '6' : '4.5'}
                        fill="#EF4444"
                        opacity={0.9}
                      />
                    </React.Fragment>
                  );
                })}

              {/* 2. Jev Vector Clamp Laser Trajectory */}
              {vectorClampPoints && (
                <Line
                  x1={vectorClampPoints.from.x}
                  y1={vectorClampPoints.from.y}
                  x2={vectorClampPoints.to.x}
                  y2={vectorClampPoints.to.y}
                  stroke={jevImprint?.uiColorOverlay || '#3B82F6'}
                  strokeWidth="6"
                  strokeOpacity="0.85"
                  strokeLinecap="round"
                />
              )}

              {/* 2. Multi-Variation Candidate Arrows (Best = Green, 2nd = Dark Grey, 3rd = Muted Intensity) */}
              {multiMoveArrows && multiMoveArrows.length > 0 ? (
                multiMoveArrows.map((arrow, idx) => {
                  const isRank1 = arrow.rank === 1;
                  const isRank2 = arrow.rank === 2;
                  const color = isRank1 ? '#10B981' : isRank2 ? '#334155' : '#94A3B8';
                  const strokeWidth = isRank1 ? '6' : isRank2 ? '4.5' : '3';
                  const opacity = isRank1 ? 0.95 : isRank2 ? 0.75 : 0.5;

                  return (
                    <React.Fragment key={idx}>
                      <Line
                        x1={arrow.from.x}
                        y1={arrow.from.y}
                        x2={arrow.to.x}
                        y2={arrow.to.y}
                        stroke={color}
                        strokeWidth={strokeWidth}
                        strokeOpacity={opacity}
                        strokeLinecap="round"
                        strokeDasharray={arrow.rank === 3 ? '6, 4' : undefined}
                      />
                      <SvgCircle
                        cx={arrow.to.x}
                        cy={arrow.to.y}
                        r={isRank1 ? '6.5' : isRank2 ? '5' : '4'}
                        fill={color}
                        opacity={opacity}
                      />
                    </React.Fragment>
                  );
                })
              ) : bestMoveArrow ? (
                <>
                  <Line
                    x1={bestMoveArrow.from.x}
                    y1={bestMoveArrow.from.y}
                    x2={bestMoveArrow.to.x}
                    y2={bestMoveArrow.to.y}
                    stroke={bestMoveArrow.isEngine ? '#10B981' : 'rgba(255, 255, 255, 0.45)'}
                    strokeWidth={bestMoveArrow.isEngine ? '6' : '3.5'}
                    strokeLinecap="round"
                    strokeOpacity={0.95}
                  />
                  <SvgCircle
                    cx={bestMoveArrow.to.x}
                    cy={bestMoveArrow.to.y}
                    r="6.5"
                    fill={bestMoveArrow.isEngine ? '#10B981' : '#FFFFFF'}
                  />
                </>
              ) : null}
            </Svg>
          </View>
        </View>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  boardWithSideBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideEvalBar: {
    width: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  sideEvalBlackFill: {
    backgroundColor: '#0F172A',
    width: '100%',
  },
  sideEvalWhiteFill: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    width: '100%',
  },
  boardGlassContainer: {
    padding: 6,
    borderRadius: 18,
    backgroundColor: '#0F172A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  board: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
  },
  square: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  selectedSquare: {
    backgroundColor: 'rgba(245, 158, 11, 0.45)',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
  },
  lastMoveSquare: {
    backgroundColor: 'rgba(59, 130, 246, 0.28)',
  },
  heroSquareHighlight: {
    backgroundColor: 'rgba(16, 185, 129, 0.35)',
    borderWidth: 1.5,
    borderColor: '#10B981',
  },
  threatHighlight: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
  },
  threatenedPieceHighlight: {
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1.5,
    borderColor: '#EF4444',
  },
  attackingPieceHighlight: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  jevCriticalSquareGlow: {
    backgroundColor: 'rgba(239, 68, 68, 0.38)',
    borderWidth: 1.5,
    borderColor: '#EF4444',
  },
  coordRank: {
    position: 'absolute',
    top: 2,
    left: 3,
    fontSize: 10,
    fontWeight: '800',
    zIndex: 2,
  },
  coordFile: {
    position: 'absolute',
    bottom: 2,
    right: 3,
    fontSize: 10,
    fontWeight: '800',
    zIndex: 2,
  },
  moveDot: {
    backgroundColor: 'rgba(15, 23, 42, 0.32)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.65)',
    zIndex: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  captureRing: {
    borderWidth: 3.5,
    borderColor: 'rgba(239, 68, 68, 0.75)',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    zIndex: 5,
  },
});
