import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Square, Chess } from 'chess.js';
import Svg, { Line, Circle as SvgCircle } from 'react-native-svg';
import { DraggablePiece } from './DraggablePiece';
import { BoardTheme, PieceTheme } from '../state/chessStore';

interface ChessBoardViewProps {
  chess: Chess;
  boardSize: number;
  isWhiteOrientation: boolean;
  selectedSquare: Square | null;
  possibleMoves: string[];
  lastMove: { from: string; to: string } | null;
  bestMoveArrow?: { from: { x: number; y: number }; to: { x: number; y: number }; isEngine: boolean } | null;
  heroSquare?: Square | null;
  threatsEnabled?: boolean;
  coordinatesEnabled?: boolean;
  onSquarePress: (square: Square) => void;
  onDropMove: (from: Square, to: Square) => void;
  isEditorActive?: boolean;
  boardTheme?: BoardTheme;
  pieceTheme?: PieceTheme;
  sideEvalScore?: { cp: number | null; mate: number | null };
  showSideEvalBar?: boolean;
}

const BOARD_THEME_COLORS: Record<BoardTheme, { light: string; dark: string }> = {
  'Classic Wood': { light: '#F0D9B5', dark: '#B58863' },
  'Emerald Green': { light: '#EADECA', dark: '#4B7399' },
  'Ocean Blue': { light: '#DEE3E6', dark: '#8CA2AD' },
  'Midnight Slate': { light: '#CBD5E1', dark: '#475569' },
  'Charcoal Dark': { light: '#E2E8F0', dark: '#334155' },
};

export const ChessBoardView: React.FC<ChessBoardViewProps> = React.memo(
  ({
    chess,
    boardSize,
    isWhiteOrientation,
    selectedSquare,
    possibleMoves,
    lastMove,
    bestMoveArrow,
    heroSquare,
    threatsEnabled = false,
    coordinatesEnabled = true,
    onSquarePress,
    onDropMove,
    isEditorActive = false,
    boardTheme = 'Classic Wood',
    pieceTheme = 'Vector Neo',
    sideEvalScore,
    showSideEvalBar = true,
  }) => {
    const squareSize = boardSize / 8;
    const ranks = isWhiteOrientation ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
    const files = isWhiteOrientation ? ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] : ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'];
    const themeColors = BOARD_THEME_COLORS[boardTheme] || BOARD_THEME_COLORS['Classic Wood'];

    // Side Evaluation Bar Fill Calculation
    let whitePercentage = 50;
    if (sideEvalScore) {
      if (sideEvalScore.mate !== null) {
        whitePercentage = sideEvalScore.mate > 0 ? 98 : 2;
      } else if (sideEvalScore.cp !== null) {
        // Sigmoid mapping for smooth score representation
        const clampedCp = Math.max(-10, Math.min(10, sideEvalScore.cp));
        whitePercentage = 50 + (clampedCp / 10) * 45;
      }
    }
    // Flip bar direction if board is flipped
    const topBarHeightPercent = isWhiteOrientation ? 100 - whitePercentage : whitePercentage;

    return (
      <View style={styles.boardWithSideBarWrapper}>
        {/* 📊 Side Evaluation Bar Beside the Board */}
        {showSideEvalBar && (
          <View style={[styles.sideEvalBar, { height: boardSize }]}>
            {/* Black Portion (Top) */}
            <View
              style={[
                styles.sideEvalBlackFill,
                { height: `${topBarHeightPercent}%` },
              ]}
            />
            {/* White Portion (Bottom) */}
            <View style={styles.sideEvalWhiteFill} />
          </View>
        )}

        <View style={styles.boardGlassContainer}>
          <View style={[styles.board, { width: boardSize, height: boardSize, backgroundColor: themeColors.dark }]}>
            {ranks.map((rank, rIdx) => (
              <View key={rank} style={[styles.row, { height: squareSize }]}>
                {files.map((file, fIdx) => {
                  const squareName = `${file}${rank}` as Square;
                  const piece = chess.get(squareName);
                  const isLight = (rIdx + fIdx) % 2 === 0;
                  const isSelected = selectedSquare === squareName;
                  const isTarget = possibleMoves.includes(squareName);
                  const isLastMoveSquare =
                    lastMove?.from === squareName || lastMove?.to === squareName;
                  const isHero = heroSquare === squareName;
                  const isThreat = threatsEnabled && piece && piece.color !== chess.turn();

                  return (
                    <TouchableOpacity
                      key={squareName}
                      activeOpacity={0.9}
                      onPress={() => onSquarePress(squareName)}
                      style={[
                        styles.square,
                        {
                          width: squareSize,
                          height: squareSize,
                          backgroundColor: isLight ? themeColors.light : themeColors.dark,
                        },
                        isSelected && styles.selectedSquare,
                        isLastMoveSquare && styles.lastMoveSquare,
                        isHero && styles.heroSquareHighlight,
                        isThreat && styles.threatHighlight,
                      ]}
                    >
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

                      {/* Reanimated 60 FPS Native-Thread Draggable Piece */}
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
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}

            {/* SVG Best Move & Last Move Arrows */}
            {bestMoveArrow && (
              <Svg
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
                width={boardSize}
                height={boardSize}
              >
                <Line
                  x1={bestMoveArrow.from.x}
                  y1={bestMoveArrow.from.y}
                  x2={bestMoveArrow.to.x}
                  y2={bestMoveArrow.to.y}
                  stroke={bestMoveArrow.isEngine ? '#06B6D4' : 'rgba(255, 255, 255, 0.45)'}
                  strokeWidth={bestMoveArrow.isEngine ? '5' : '3.5'}
                  strokeLinecap="round"
                  strokeDasharray={bestMoveArrow.isEngine ? '7, 4' : undefined}
                />
                <SvgCircle
                  cx={bestMoveArrow.to.x}
                  cy={bestMoveArrow.to.y}
                  r="6"
                  fill={bestMoveArrow.isEngine ? '#06B6D4' : '#FFFFFF'}
                />
              </Svg>
            )}
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
    backgroundColor: 'rgba(245, 158, 11, 0.65)',
  },
  lastMoveSquare: {
    backgroundColor: 'rgba(59, 130, 246, 0.35)',
  },
  heroSquareHighlight: {
    backgroundColor: 'rgba(16, 185, 129, 0.42)',
    borderWidth: 1.5,
    borderColor: '#10B981',
  },
  threatHighlight: {
    backgroundColor: 'rgba(239, 68, 68, 0.28)',
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
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    zIndex: 5,
  },
  captureRing: {
    borderWidth: 3.5,
    borderColor: 'rgba(239, 68, 68, 0.6)',
    zIndex: 5,
  },
});
