import React from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Square } from 'chess.js';
import { ChessPieceSvg } from './ChessPieceSvg';

interface DraggablePieceProps {
  square: Square;
  color: 'w' | 'b';
  type: 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
  squareSize: number;
  isWhiteOrientation: boolean;
  onDropMove: (from: Square, to: Square) => void;
  onSelectSquare: (square: Square) => void;
  disabled?: boolean;
}

export const DraggablePiece: React.FC<DraggablePieceProps> = React.memo(
  ({
    square,
    color,
    type,
    squareSize,
    isWhiteOrientation,
    onDropMove,
    onSelectSquare,
    disabled = false,
  }) => {
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const scale = useSharedValue(1);
    const zIndex = useSharedValue(1);

    const panGesture = Gesture.Pan()
      .enabled(!disabled)
      .onStart(() => {
        scale.value = withSpring(1.18, { damping: 15, stiffness: 200 });
        zIndex.value = 100;
        runOnJS(onSelectSquare)(square);
      })
      .onUpdate((event) => {
        // Direct native thread position tracking without re-rendering React
        translateX.value = event.translationX;
        translateY.value = event.translationY;
      })
      .onEnd((event) => {
        const deltaCol = Math.round(event.translationX / squareSize);
        const deltaRow = Math.round(event.translationY / squareSize);

        // Snap animation back on the native thread
        translateX.value = withSpring(0, { damping: 18, stiffness: 220 });
        translateY.value = withSpring(0, { damping: 18, stiffness: 220 });
        scale.value = withSpring(1, { damping: 18, stiffness: 220 });
        zIndex.value = 1;

        if (deltaCol !== 0 || deltaRow !== 0) {
          const fileChar = square[0];
          const rankNum = parseInt(square[1], 10);

          const colIndex = fileChar.charCodeAt(0) - 'a'.charCodeAt(0);
          const rowIndex = rankNum - 1;

          let targetCol: number;
          let targetRow: number;

          if (isWhiteOrientation) {
            targetCol = colIndex + deltaCol;
            targetRow = rowIndex - deltaRow;
          } else {
            targetCol = colIndex - deltaCol;
            targetRow = rowIndex + deltaRow;
          }

          if (targetCol >= 0 && targetCol <= 7 && targetRow >= 0 && targetRow <= 7) {
            const targetFile = String.fromCharCode('a'.charCodeAt(0) + targetCol);
            const targetRank = (targetRow + 1).toString();
            const targetSquare = `${targetFile}${targetRank}` as Square;

            runOnJS(onDropMove)(square, targetSquare);
          }
        }
      });

    const animatedStyle = useAnimatedStyle(() => {
      return {
        transform: [
          { translateX: translateX.value },
          { translateY: translateY.value },
          { scale: scale.value },
        ],
        zIndex: zIndex.value,
      };
    });

    return (
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.pieceContainer,
            { width: squareSize, height: squareSize },
            animatedStyle,
          ]}
        >
          <ChessPieceSvg color={color} type={type} size={squareSize * 0.78} />
        </Animated.View>
      </GestureDetector>
    );
  }
);

const styles = StyleSheet.create({
  pieceContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
