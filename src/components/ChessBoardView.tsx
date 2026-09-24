import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Square, Chess } from 'chess.js';
import Svg, { Line, Circle as SvgCircle } from 'react-native-svg';
import { DraggablePiece } from './DraggablePiece';

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
}

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
  }) => {
    const squareSize = boardSize / 8;
    const ranks = isWhiteOrientation ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
    const files = isWhiteOrientation ? ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] : ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'];

    return (
      <View style={styles.boardGlassContainer}>
        <View style={[styles.board, { width: boardSize, height: boardSize }]}>
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
                      { width: squareSize, height: squareSize },
                      isLight ? styles.lightSquare : styles.darkSquare,
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
                          isLight ? styles.darkCoord : styles.lightCoord,
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
                          isLight ? styles.darkCoord : styles.lightCoord,
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
    );
  }
);

const styles = StyleSheet.create({
  boardGlassContainer: {
    alignSelf: 'center',
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
    backgroundColor: '#B58863',
  },
  row: {
    flexDirection: 'row',
  },
  square: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  lightSquare: {
    backgroundColor: '#F0D9B5',
  },
  darkSquare: {
    backgroundColor: '#B58863',
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
  lightCoord: {
    color: '#F0D9B5',
  },
  darkCoord: {
    color: '#B58863',
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
