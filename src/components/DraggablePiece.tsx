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
  disabled?: boolean;
  pieceTheme?: PieceTheme;
}

// 120 FPS High-Response Spring Physics (Lichess feel)
const SPRING_CONFIG = {
  damping: 22,
  mass: 0.5,
  stiffness: 280,
  overshootClamping: true,
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
    disabled = false,
    pieceTheme = 'Vector Neo',
  }) => {
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const scale = useSharedValue(1);
    const zIndex = useSharedValue(1);

    // Tap Gesture for instantaneous selection
    const tapGesture = Gesture.Tap()
      .enabled(!disabled)
      .onEnd(() => {
        runOnJS(onSelectSquare)(square);
      });

    // Pan Gesture for fluid 120Hz native-thread tracking
    const panGesture = Gesture.Pan()
      .enabled(!disabled)
      .activeOffsetX([-6, 6])
      .activeOffsetY([-6, 6])
      .onStart(() => {
        scale.value = withSpring(1.15, SPRING_CONFIG);
        zIndex.value = 999;
        runOnJS(onSelectSquare)(square);
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

        // Immediate snap-back on native UI thread
        translateX.value = withSpring(0, SPRING_CONFIG);
        translateY.value = withSpring(0, SPRING_CONFIG);
        scale.value = withSpring(1, SPRING_CONFIG);
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
