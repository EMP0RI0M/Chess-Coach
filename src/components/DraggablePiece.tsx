import React from 'react';
import { StyleSheet } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Square } from 'chess.js';
import { ChessPieceSvg } from './ChessPieceSvg';
import { PieceTheme } from '../state/chessStore';

interface DraggablePieceProps {
  square: Square;
  color: 'w' | 'b';
  type: 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
  squareSize: number;
  isWhiteOrientation: boolean;
  onDropMove: (from: Square, to: Square) => void;
  onSelectSquare: (square: Square) => void;
  legalTargets?: string[];
  onIllegalDrop?: () => void;
  disabled?: boolean;
  pieceTheme?: PieceTheme;
}

// 120 FPS High-Response Spring Physics (Ultra-Smooth Lichess/Chess.com feel)
const SPRING_CONFIG = {
  damping: 26,
  mass: 0.32,
  stiffness: 280,
  overshootClamping: false,
};

export const DraggablePiece: React.FC<DraggablePieceProps> = React.memo(
  ({
    square,
    color,
    type,
    squareSize,
    isWhiteOrientation,
    onDropMove,
    onSelectSquare,
    legalTargets,
    onIllegalDrop,
    disabled = false,
    pieceTheme = 'Vector Neo',
  }) => {
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const scale = useSharedValue(1);
    const zIndex = useSharedValue(1);

    const tapGesture = Gesture.Tap()
      .enabled(!disabled)
      .maxDuration(250)
      .onEnd(() => {
        'worklet';
        runOnJS(onSelectSquare)(square);
      });

    // High-performance unified Pan gesture (handles zero-lag drag moves)
    const panGesture = Gesture.Pan()
      .enabled(!disabled)
      .minDistance(4)
      .onStart(() => {
        'worklet';
        scale.value = withSpring(1.15, SPRING_CONFIG);
        zIndex.value = 999;
      })
      .onUpdate((event) => {
        'worklet';
        translateX.value = event.translationX;
        translateY.value = event.translationY;
      })
      .onEnd((event) => {
        'worklet';
        const deltaCol = Math.round(event.translationX / squareSize);
        const deltaRow = Math.round(event.translationY / squareSize);
        const distanceSq = event.translationX * event.translationX + event.translationY * event.translationY;

        scale.value = withSpring(1, SPRING_CONFIG);
        zIndex.value = 1;

        if (distanceSq < 36 || (deltaCol === 0 && deltaRow === 0)) {
          translateX.value = withSpring(0, SPRING_CONFIG);
          translateY.value = withSpring(0, SPRING_CONFIG);
          runOnJS(onSelectSquare)(square);
          return;
        }

        const fileChar = square[0];
        const rankNum = parseInt(square[1], 10);
        const colIndex = fileChar.charCodeAt(0) - 97;
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
          const targetFile = String.fromCharCode(97 + targetCol);
          const targetRank = (targetRow + 1).toString();
          const targetSquare = `${targetFile}${targetRank}` as Square;

          // Validate legality before snapping to new square
          if (legalTargets && !legalTargets.includes(targetSquare)) {
            // Illegal move! Instantly snap back to starting square
            translateX.value = withSpring(0, SPRING_CONFIG);
            translateY.value = withSpring(0, SPRING_CONFIG);
            if (onIllegalDrop) {
              runOnJS(onIllegalDrop)();
            }
            return;
          }

          // Legal move: snap directly to target square and commit
          translateX.value = deltaCol * squareSize;
          translateY.value = deltaRow * squareSize;

          runOnJS(onDropMove)(square, targetSquare);
        } else {
          // Out of bounds drop -> snap back to start
          translateX.value = withSpring(0, SPRING_CONFIG);
          translateY.value = withSpring(0, SPRING_CONFIG);
          if (onIllegalDrop) {
            runOnJS(onIllegalDrop)();
          }
        }
      });

    const composedGesture = Gesture.Race(panGesture, tapGesture);

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
      <GestureDetector gesture={composedGesture}>
        <Animated.View
          renderToHardwareTextureAndroid={true}
          style={[
            styles.pieceContainer,
            { width: squareSize, height: squareSize },
            animatedStyle,
          ]}
        >
          <ChessPieceSvg color={color} type={type} size={squareSize * 0.82} theme={pieceTheme} />
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
