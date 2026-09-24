import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Dimensions,
  Platform,
  Modal,
  Switch,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Chess, Square, Move } from 'chess.js';
import { useStockfishEngine } from './src/engine/stockfish';
import { identifyEco } from './src/engine/ecoService';
import { DAILY_PUZZLES, ChessPuzzle } from './src/engine/puzzleService';
import { ChessBoardView } from './src/components/ChessBoardView';
import Svg, { Line, Circle as SvgCircle } from 'react-native-svg';
import {
  Menu,
  Settings as SettingsIcon,
  Brain,
  Undo2,
  Redo2,
  Compass,
  CircleDot,
  ShieldCheck,
  Trash2,
  Layers,
  AlertOctagon,
  Edit3,
  PlayCircle,
  X,
  Check,
  Volume2,
  BookOpen,
  Cloud,
  Cpu,
  Eye,
  Sliders,
  Sparkles,
  ChevronRight,
  ArrowUpDown,
  Swords,
  Puzzle,
  FileText,
  ArrowLeft,
  Trophy,
} from 'lucide-react-native';

import { useChessStore } from './src/state/chessStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BASE_BOARD_SIZE = Math.min(SCREEN_WIDTH - 28, 380);

// Unicode Chess Pieces
const PIECE_SYMBOLS: Record<string, string> = {
  w_p: '♙',
  w_n: '♘',
  w_b: '♗',
  w_r: '♖',
  w_q: '♕',
  w_k: '♔',
  b_p: '♟',
  b_n: '♞',
  b_b: '♝',
  b_r: '♜',
  b_q: '♛',
  b_k: '♚',
};

// Available Chess Variants
const CHESS_VARIANTS = [
  'Standard Chess',
  'Chess960 (Fischer Random)',
  'King of the Hill',
  'Three-Check',
  'Crazyhouse',
];

// Coordinate helper for arrow rendering
function getSquareCenter(sq: string, isWhiteOrientation: boolean, squareSize: number) {
  const file = sq.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = parseInt(sq[1], 10) - 1;
  const col = isWhiteOrientation ? file : 7 - file;
  const row = isWhiteOrientation ? 7 - rank : rank;
  return {
    x: col * squareSize + squareSize / 2,
    y: row * squareSize + squareSize / 2,
  };
}

export default function App() {
  // Zustand Atomic Subscriptions
  const chess = useChessStore((s) => s.chess);
  const fen = useChessStore((s) => s.fen);
  const selectedSquare = useChessStore((s) => s.selectedSquare);
  const possibleMoves = useChessStore((s) => s.possibleMoves);
  const lastMove = useChessStore((s) => s.lastMove);
  const isWhiteOrientation = useChessStore((s) => s.isWhiteOrientation);
  const historyMoves = useChessStore((s) => s.historyMoves);
  const currentMoveIndex = useChessStore((s) => s.currentMoveIndex);
  const currentScreen = useChessStore((s) => s.currentScreen);
  const currentPuzzleIdx = useChessStore((s) => s.currentPuzzleIdx);
  const isMenuOpen = useChessStore((s) => s.isMenuOpen);
  const isSettingsOpen = useChessStore((s) => s.isSettingsOpen);
  const isVariantOpen = useChessStore((s) => s.isVariantOpen);
  const isBoardEditorOpen = useChessStore((s) => s.isBoardEditorOpen);
  const selectedVariant = useChessStore((s) => s.selectedVariant);
  const selectedEditorPiece = useChessStore((s) => s.selectedEditorPiece);
  const settings = useChessStore((s) => s.settings);

  // Zustand Store Actions
  const setScreen = useChessStore((s) => s.setScreen);
  const selectSquare = useChessStore((s) => s.selectSquare);
  const makeMove = useChessStore((s) => s.makeMove);
  const undoMove = useChessStore((s) => s.undoMove);
  const redoMove = useChessStore((s) => s.redoMove);
  const resetGame = useChessStore((s) => s.resetGame);
  const jumpToMove = useChessStore((s) => s.jumpToMove);
  const flipBoard = useChessStore((s) => s.flipBoard);
  const loadFen = useChessStore((s) => s.loadFen);
  const updateSetting = useChessStore((s) => s.updateSetting);
  const setMenuOpen = useChessStore((s) => s.setMenuOpen);
  const setSettingsOpen = useChessStore((s) => s.setSettingsOpen);
  const setVariantOpen = useChessStore((s) => s.setVariantOpen);
  const setBoardEditorOpen = useChessStore((s) => s.setBoardEditorOpen);
  const setSelectedVariant = useChessStore((s) => s.setSelectedVariant);
  const setSelectedEditorPiece = useChessStore((s) => s.setSelectedEditorPiece);
  const setCurrentPuzzleIdx = useChessStore((s) => s.setCurrentPuzzleIdx);

  // Aliases for seamless JSX binding
  const setCurrentScreen = setScreen;
  const setIsMenuOpen = setMenuOpen;
  const setIsSettingsOpen = setSettingsOpen;
  const setIsVariantOpen = setVariantOpen;
  const setIsBoardEditorOpen = setBoardEditorOpen;
  const setSettings = (newSettingsOrFn: any) => {
    if (typeof newSettingsOrFn === 'function') {
      const updated = newSettingsOrFn(settings);
      Object.keys(updated).forEach((k) => {
        updateSetting(k as any, updated[k]);
      });
    } else {
      Object.keys(newSettingsOrFn).forEach((k) => {
        updateSetting(k as any, newSettingsOrFn[k]);
      });
    }
  };

  const [engineActive] = useState(true);

  // Dynamic board sizing bound to settings.smallBoard
  const boardSize = settings.smallBoard ? BASE_BOARD_SIZE * 0.82 : BASE_BOARD_SIZE;
  const squareSize = boardSize / 8;

  // Stockfish Engine Integration
  const { evaluation, evaluatePosition, stopEvaluation } = useStockfishEngine();

  // ECO Opening Detection
  const detectedEco = useMemo(() => {
    const sans = historyMoves.slice(0, currentMoveIndex + 1).map((m) => m.san);
    return identifyEco(sans);
  }, [historyMoves, currentMoveIndex]);

  // Synchronize evaluation when FEN changes
  useEffect(() => {
    if (engineActive && settings.stockfishEnabled) {
      const depth = Math.min(Math.max(settings.cpuThreads >= 4 ? 3 : 2, 2), 3);
      evaluatePosition(fen, depth);
    }
  }, [fen, engineActive, settings.stockfishEnabled, settings.cpuThreads, evaluatePosition]);

  // 1. Reset / Clear All Moves
  const handleClearAllMoves = () => {
    resetGame();
  };

  // 2. Undo
  const handleUndo = () => {
    undoMove();
  };

  // 3. Redo
  const handleRedo = () => {
    redoMove();
  };

  // 4. Flip Board
  const handleFlipBoard = () => {
    flipBoard();
  };

  // 5. Jump to Specific Move in History
  const handleJumpToMove = (idx: number) => {
    jumpToMove(idx);
  };

  // 6. Handle square tap
  const handleSquarePress = (square: Square) => {
    if (isBoardEditorOpen) {
      if (!selectedEditorPiece) {
        chess.remove(square);
      } else {
        const [color, type] = selectedEditorPiece.split('_');
        chess.put({ type: type as any, color: color as any }, square);
      }
      loadFen(chess.fen());
      return;
    }

    if (selectedSquare === null) {
      const piece = chess.get(square);
      if (piece && piece.color === chess.turn()) {
        const moves = chess.moves({ square, verbose: true }) as Move[];
        selectSquare(square, moves.map((m) => m.to));
      }
    } else {
      if (selectedSquare === square) {
        selectSquare(null, []);
        return;
      }

      const moved = makeMove(selectedSquare, square, 'q');
      if (!moved) {
        const piece = chess.get(square);
        if (piece && piece.color === chess.turn()) {
          const moves = chess.moves({ square, verbose: true }) as Move[];
          selectSquare(square, moves.map((m) => m.to));
        } else {
          selectSquare(null, []);
        }
      }
    }
  };

  // Handle Drag and Drop move from Reanimated native thread gesture
  const handleDropMove = useCallback((from: Square, to: Square) => {
    makeMove(from, to, 'q');
  }, [makeMove]);

  const currentMove = currentMoveIndex >= 0 ? historyMoves[currentMoveIndex] : null;

  // Evaluation & Assessment
  const evaluationSummary = useMemo(() => {
    const cp = evaluation.scoreCp || 0.2;
    let evalText = `+${cp.toFixed(2)}`;
    let stateText = '≈ Equal';
    let stateColor = '#64748B';

    if (evaluation.scoreMate !== null) {
      evalText = evaluation.scoreMate > 0 ? `+M${evaluation.scoreMate}` : `-M${Math.abs(evaluation.scoreMate)}`;
      stateText = evaluation.scoreMate > 0 ? 'White Mate' : 'Black Mate';
      stateColor = '#2563EB';
    } else if (cp >= 1.5) {
      evalText = `+${cp.toFixed(2)}`;
      stateText = 'White +Advantage';
      stateColor = '#059669';
    } else if (cp <= -1.5) {
      evalText = `${cp.toFixed(2)}`;
      stateText = 'Black +Advantage';
      stateColor = '#DC2626';
    }

    return { evalText, stateText, stateColor };
  }, [evaluation]);

  // Cognitive Explanation (Bound to settings.showComments & toggleMoveAnnotations)
  const cognitiveInsight = useMemo(() => {
    if (!currentMove) {
      return {
        hasMove: false,
        annotation: '',
        why: 'Make a move on the board to begin grounded cognitive analysis.',
        concept: 'Opening Preparation',
      };
    }

    const san = currentMove.san;
    const isCapture = san.includes('x');
    const annotation = settings.toggleMoveAnnotations ? (isCapture ? '!' : '') : '';

    let why = 'Develops pieces actively while securing key central squares.';
    let concept = 'Piece Activity & Center Control';

    if (currentMove.piece === 'p') {
      why = 'Claims central space and opens lines for bishop and queen development.';
      concept = 'Pawn Structure & Space';
    } else if (currentMove.piece === 'n') {
      why = 'Develops knight toward center, controlling vital outpost squares.';
      concept = 'Knight Mobility';
    } else if (currentMove.piece === 'b') {
      why = 'Activates bishop along open diagonal to exert long-range pressure.';
      concept = 'Diagonal Tension';
    }

    return {
      hasMove: true,
      moveSan: san,
      annotation,
      why,
      concept,
    };
  }, [currentMove, settings.toggleMoveAnnotations]);

  // Arrow calculations bound to settings.bestMoveArrow and Stockfish bestMove
  const arrowPoints = useMemo(() => {
    if (!settings.bestMoveArrow) return null;
    
    // Prefer Stockfish engine's calculated best move e.g. "e2e4" -> from "e2", to "e4"
    if (evaluation.bestMove && evaluation.bestMove.length >= 4) {
      const fromSq = evaluation.bestMove.substring(0, 2);
      const toSq = evaluation.bestMove.substring(2, 4);
      const from = getSquareCenter(fromSq, isWhiteOrientation, squareSize);
      const to = getSquareCenter(toSq, isWhiteOrientation, squareSize);
      return { from, to, isEngine: true };
    }

    if (lastMove) {
      const from = getSquareCenter(lastMove.from, isWhiteOrientation, squareSize);
      const to = getSquareCenter(lastMove.to, isWhiteOrientation, squareSize);
      return { from, to, isEngine: false };
    }

    return null;
  }, [evaluation.bestMove, lastMove, isWhiteOrientation, settings.bestMoveArrow, squareSize]);

  const ranks = isWhiteOrientation ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const files = isWhiteOrientation ? ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] : ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'];

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar barStyle="dark-content" backgroundColor="#F4F7FB" />
        
        {/* Ambient Fog Layers */}
        <View style={styles.ambientFog1} />
        <View style={styles.ambientFog2} />
        <View style={styles.ambientFog3} />

        <View style={styles.container}>
          {/* ======================================================== */}
          {/* 🏠 FRONT PAGE / DASHBOARD HUB (currentScreen === 'home') */}
          {/* ======================================================== */}
          {currentScreen === 'home' && (
            <ScrollView style={styles.homeScrollView} showsVerticalScrollIndicator={false}>
              {/* App Brand Header */}
              <View style={styles.homeHeader}>
                <View style={styles.homeLogoRow}>
                  <View style={styles.homeLogoIcon}>
                    <Brain size={28} color="#FFFFFF" strokeWidth={2.4} />
                  </View>
                  <View>
                    <Text style={styles.homeTitle}>Chess Coach</Text>
                    <Text style={styles.homeSubtitle}>Cognitive OS & Training Engine</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.homeSettingsButton}
                  onPress={() => setIsSettingsOpen(true)}
                >
                  <SettingsIcon size={22} color="#1E293B" />
                </TouchableOpacity>
              </View>

              {/* Main Play & Analysis Card */}
              <TouchableOpacity
                style={styles.heroPlayCard}
                activeOpacity={0.88}
                onPress={() => setCurrentScreen('analysis')}
              >
                <View style={styles.heroPlayBadge}>
                  <Text style={styles.heroPlayBadgeText}>⚡ SF19 Live Engine</Text>
                </View>
                <Text style={styles.heroPlayTitle}>Play & Cognitive Analysis</Text>
                <Text style={styles.heroPlaySubtitle}>
                  Interactive board with real-time Stockfish engine, best-move arrows, and grounded coach explanations.
                </Text>
                <View style={styles.heroPlayButton}>
                  <Swords size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.heroPlayButtonText}>Start Game Board →</Text>
                </View>
              </TouchableOpacity>

              {/* Feature Grid: Book, Puzzles, PGN, Settings */}
              <View style={styles.homeGrid}>
                {/* 1. Opening Book */}
                <TouchableOpacity
                  style={styles.homeGridCard}
                  activeOpacity={0.85}
                  onPress={() => setCurrentScreen('openings')}
                >
                  <View style={[styles.homeGridIconWrapper, { backgroundColor: '#EFF6FF' }]}>
                    <BookOpen size={24} color="#2563EB" />
                  </View>
                  <Text style={styles.homeGridCardTitle}>Opening Book</Text>
                  <Text style={styles.homeGridCardDesc}>ECO classifier & master database win rates.</Text>
                </TouchableOpacity>

                {/* 2. Tactical Puzzles */}
                <TouchableOpacity
                  style={styles.homeGridCard}
                  activeOpacity={0.85}
                  onPress={() => setCurrentScreen('puzzles')}
                >
                  <View style={[styles.homeGridIconWrapper, { backgroundColor: '#FEF3C7' }]}>
                    <Puzzle size={24} color="#D97706" />
                  </View>
                  <Text style={styles.homeGridCardTitle}>Tactical Puzzles</Text>
                  <Text style={styles.homeGridCardDesc}>Endgames, forks, pins, and Greek gift sacrifices.</Text>
                </TouchableOpacity>

                {/* 3. PGN Manager */}
                <TouchableOpacity
                  style={styles.homeGridCard}
                  activeOpacity={0.85}
                  onPress={() => setCurrentScreen('pgn')}
                >
                  <View style={[styles.homeGridIconWrapper, { backgroundColor: '#ECFDF5' }]}>
                    <FileText size={24} color="#059669" />
                  </View>
                  <Text style={styles.homeGridCardTitle}>PGN Manager</Text>
                  <Text style={styles.homeGridCardDesc}>View, import, and export game notation.</Text>
                </TouchableOpacity>

                {/* 4. Chess Variants */}
                <TouchableOpacity
                  style={styles.homeGridCard}
                  activeOpacity={0.85}
                  onPress={() => setIsVariantOpen(true)}
                >
                  <View style={[styles.homeGridIconWrapper, { backgroundColor: '#F3E8FF' }]}>
                    <Layers size={24} color="#7C3AED" />
                  </View>
                  <Text style={styles.homeGridCardTitle}>Chess Variants</Text>
                  <Text style={styles.homeGridCardDesc}>Fischer Random, King of Hill, Three-Check.</Text>
                </TouchableOpacity>
              </View>

              <View style={{ height: 30 }} />
            </ScrollView>
          )}

          {/* ======================================================== */}
          {/* ♟️ FULL GAME & ANALYSIS SCREEN (currentScreen === 'analysis') */}
          {/* ======================================================== */}
          {currentScreen === 'analysis' && (
            <>
              {/* Back to Home Header */}
              <View style={styles.screenHeaderRow}>
                <TouchableOpacity
                  style={styles.screenBackButton}
                  onPress={() => setCurrentScreen('home')}
                >
                  <ArrowLeft size={18} color="#1E293B" strokeWidth={2.4} />
                  <Text style={styles.screenBackText}>Hub</Text>
                </TouchableOpacity>
                <Text style={styles.screenHeaderTitle}>Interactive Board</Text>
                <TouchableOpacity
                  style={styles.screenHeaderAction}
                  onPress={() => setIsSettingsOpen(true)}
                >
                  <SettingsIcon size={18} color="#1E293B" />
                </TouchableOpacity>
              </View>

              {/* 1. Evaluation Gauge & ECO Badge */}
              {settings.showEvalGauge && (
                <View style={styles.engineStatusBar}>
                  <View style={styles.evalScoreRow}>
                    <View style={styles.evalScoreBadge}>
                      <Text style={styles.evalScoreText}>{evaluationSummary.evalText}</Text>
                    </View>
                    <View style={styles.ecoBadge}>
                      <Text style={styles.ecoBadgeText}>{detectedEco.eco}</Text>
                    </View>
                    <Text style={[styles.evalStateText, { color: evaluationSummary.stateColor }]}>
                      {evaluationSummary.stateText}
                    </Text>
                  </View>
                  <View style={styles.engineStatsRow}>
                    <Text style={styles.engineStatItem}>SF19</Text>
                    <Text style={styles.statDot}>•</Text>
                    <Text style={styles.engineStatItem}>Depth {evaluation.depth || 3}</Text>
                    <Text style={styles.statDot}>•</Text>
                    <Text style={styles.engineStatItem}>{settings.cpuThreads} Threads</Text>
                    <Text style={styles.statDot}>•</Text>
                    <Text style={styles.engineStatItem}>{detectedEco.name.split(',')[0]}</Text>
                  </View>
                </View>
              )}

              {/* Board Editor Mode Banner */}
              {isBoardEditorOpen && (
                <View style={styles.editorBannerPill}>
                  <Text style={styles.editorBannerText}>✏️ Board Editor Active</Text>
                  <TouchableOpacity
                    style={styles.editorDoneButton}
                    onPress={() => setIsBoardEditorOpen(false)}
                  >
                    <Text style={styles.editorDoneText}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* 2. Interactive Chessboard with Reanimated 60 FPS Native Gestures */}
              <ChessBoardView
                chess={chess}
                boardSize={boardSize}
                isWhiteOrientation={isWhiteOrientation}
                selectedSquare={selectedSquare}
                possibleMoves={possibleMoves}
                lastMove={lastMove}
                bestMoveArrow={arrowPoints}
                heroSquare={
                  settings.bestHero
                    ? ((evaluation.bestMove && evaluation.bestMove.length >= 4
                        ? evaluation.bestMove.substring(2, 4)
                        : lastMove?.to) as Square | null)
                    : null
                }
                threatsEnabled={settings.showThreats}
                coordinatesEnabled={settings.inlineNotations}
                onSquarePress={handleSquarePress}
                onDropMove={handleDropMove}
                isEditorActive={isBoardEditorOpen}
                boardTheme={settings.boardTheme}
                pieceTheme={settings.pieceTheme}
                sideEvalScore={{ cp: evaluation.scoreCp, mate: evaluation.scoreMate }}
                showSideEvalBar={settings.showSideEvalBar}
              />

              {/* Board Editor Piece Palette */}
              {isBoardEditorOpen && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.editorPalette}>
                  {['w_k', 'w_q', 'w_r', 'w_b', 'w_n', 'w_p', 'b_k', 'b_q', 'b_r', 'b_b', 'b_n', 'b_p', null].map((p, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.editorPaletteItem,
                        selectedEditorPiece === p && styles.editorPaletteItemSelected,
                      ]}
                      onPress={() => setSelectedEditorPiece(p)}
                    >
                      <Text style={styles.editorPalettePiece}>
                        {p ? PIECE_SYMBOLS[p] : '❌'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {/* 3. Inline Notation Timeline */}
              {settings.inlineNotations && (
                <View style={styles.timelineWrapper}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timelineScroll}>
                    <TouchableOpacity
                      style={[styles.timelinePill, currentMoveIndex === -1 && styles.timelinePillActive]}
                      onPress={handleClearAllMoves}
                    >
                      <Compass size={12} color={currentMoveIndex === -1 ? '#FFFFFF' : '#64748B'} style={{ marginRight: 4 }} />
                      <Text style={[styles.timelineText, currentMoveIndex === -1 && styles.timelineTextActive]}>
                        Start
                      </Text>
                    </TouchableOpacity>

                    {historyMoves.map((m, idx) => {
                      const moveNum = Math.floor(idx / 2) + 1;
                      const isWhite = idx % 2 === 0;
                      const label = isWhite ? `${moveNum}. ${m.san}` : `${m.san}`;
                      const isActive = currentMoveIndex === idx;

                      return (
                        <TouchableOpacity
                          key={idx}
                          style={[styles.timelinePill, isActive && styles.timelinePillActive]}
                          onPress={() => handleJumpToMove(idx)}
                        >
                          <Text style={[styles.timelineText, isActive && styles.timelineTextActive]}>
                            {label}{cognitiveInsight.annotation}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* 4. Cognitive Comments */}
              <ScrollView style={styles.analysisScrollView} showsVerticalScrollIndicator={false}>
                {settings.showComments && (
                  <View style={styles.cognitiveCard}>
                    <View style={styles.cognitiveCardHeader}>
                      <Text style={styles.cognitiveHeaderTitle}>🧠 Grounded Coach</Text>
                      <Text style={styles.cognitiveConceptTag}>{cognitiveInsight.concept}</Text>
                    </View>
                    <Text style={styles.cognitiveBodyText}>{cognitiveInsight.why}</Text>
                  </View>
                )}

                {settings.showIndianLines && (
                  <View style={styles.indianLinesCard}>
                    <Text style={styles.indianLinesTitle}>🇮🇳 Indian Lines Variation:</Text>
                    <Text style={styles.indianLinesBody}>
                      King's Indian / Queen's Indian Defense Structure: 1. d4 Nf6 2. c4 e6 3. Nf3 b6.
                    </Text>
                  </View>
                )}
              </ScrollView>

              {/* 5. Bottom Pill-Shaped Navbar */}
              <View style={styles.bottomNebba}>
                {/* 1. Three-line Menu (☰) */}
                <TouchableOpacity
                  style={styles.nebbaButton}
                  activeOpacity={0.7}
                  onPress={() => setIsMenuOpen(true)}
                >
                  <Menu size={20} color="#1E293B" strokeWidth={2.2} />
                </TouchableOpacity>

                {/* 2. Flip Board (⇅) */}
                <TouchableOpacity
                  style={styles.nebbaButton}
                  activeOpacity={0.7}
                  onPress={handleFlipBoard}
                >
                  <ArrowUpDown size={20} color="#1E293B" strokeWidth={2.2} />
                </TouchableOpacity>

                {/* 3. Stockfish Engine Processor / Coach (⚙ / 🧠 / Cpu) */}
                <TouchableOpacity
                  style={[styles.nebbaButton, styles.nebbaHeroButton, !settings.stockfishEnabled && styles.nebbaHeroButtonInactive]}
                  activeOpacity={0.8}
                  onPress={() => {
                    const nextState = !settings.stockfishEnabled;
                    updateSetting('stockfishEnabled', nextState);
                    if (nextState) {
                      evaluatePosition(fen, 3);
                    } else {
                      stopEvaluation();
                    }
                  }}
                >
                  <Cpu size={22} color="#FFFFFF" strokeWidth={2.3} />
                </TouchableOpacity>

                {/* 4. Undo / Back (↶) */}
                <TouchableOpacity
                  style={[styles.nebbaButton, currentMoveIndex < 0 && styles.nebbaButtonDisabled]}
                  activeOpacity={0.7}
                  disabled={currentMoveIndex < 0}
                  onPress={handleUndo}
                >
                  <Undo2 size={20} color="#1E293B" strokeWidth={2.2} />
                </TouchableOpacity>

                {/* 5. Redo / Forward (↷) */}
                <TouchableOpacity
                  style={[styles.nebbaButton, currentMoveIndex >= historyMoves.length - 1 && styles.nebbaButtonDisabled]}
                  activeOpacity={0.7}
                  disabled={currentMoveIndex >= historyMoves.length - 1}
                  onPress={handleRedo}
                >
                  <Redo2 size={20} color="#1E293B" strokeWidth={2.2} />
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ======================================================== */}
          {/* 📖 OPENINGS PAGE (currentScreen === 'openings') */}
          {/* ======================================================== */}
          {currentScreen === 'openings' && (
            <View style={{ flex: 1 }}>
              <View style={styles.screenHeaderRow}>
                <TouchableOpacity
                  style={styles.screenBackButton}
                  onPress={() => setCurrentScreen('home')}
                >
                  <ArrowLeft size={18} color="#1E293B" strokeWidth={2.4} />
                  <Text style={styles.screenBackText}>Hub</Text>
                </TouchableOpacity>
                <Text style={styles.screenHeaderTitle}>Opening Explorer</Text>
                <View style={{ width: 32 }} />
              </View>

              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                <View style={styles.explorerCard}>
                  <View style={styles.explorerHeaderRow}>
                    <Text style={styles.explorerTitle}>📖 {detectedEco.name}</Text>
                    <View style={styles.ecoTagSmall}>
                      <Text style={styles.ecoTagSmallText}>{detectedEco.eco}</Text>
                    </View>
                  </View>
                  <Text style={styles.explorerBody}>
                    {chess.history().length === 0 
                      ? 'Initial Position: 1. e4 (48% win), 1. d4 (36% win), 1. Nf3 (9% win), 1. c4 (5% win)' 
                      : `Active Played Line: ${chess.history().join(' ')}`}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.pageActionButton}
                  onPress={() => setCurrentScreen('analysis')}
                >
                  <Text style={styles.pageActionButtonText}>Go to Interactive Board →</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}

          {/* ======================================================== */}
          {/* 🧩 TACTICAL PUZZLES PAGE (currentScreen === 'puzzles') */}
          {/* ======================================================== */}
          {currentScreen === 'puzzles' && (
            <View style={{ flex: 1 }}>
              <View style={styles.screenHeaderRow}>
                <TouchableOpacity
                  style={styles.screenBackButton}
                  onPress={() => setCurrentScreen('home')}
                >
                  <ArrowLeft size={18} color="#1E293B" strokeWidth={2.4} />
                  <Text style={styles.screenBackText}>Hub</Text>
                </TouchableOpacity>
                <Text style={styles.screenHeaderTitle}>Tactical Puzzles</Text>
                <View style={{ width: 32 }} />
              </View>

              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                <View style={styles.puzzleCard}>
                  <View style={styles.puzzleHeaderRow}>
                    <Text style={styles.puzzleTitle}>🧩 Puzzle #{currentPuzzleIdx + 1}</Text>
                    <Text style={styles.puzzleRatingBadge}>{DAILY_PUZZLES[currentPuzzleIdx].rating} ELO</Text>
                  </View>
                  <Text style={styles.puzzleThemeText}>Theme: {DAILY_PUZZLES[currentPuzzleIdx].theme}</Text>
                  <Text style={styles.puzzleDescText}>{DAILY_PUZZLES[currentPuzzleIdx].description}</Text>
                  
                  <View style={styles.puzzleActionRow}>
                    <TouchableOpacity
                      style={styles.puzzleLoadButton}
                      onPress={() => {
                        loadFen(DAILY_PUZZLES[currentPuzzleIdx].fen);
                        setScreen('analysis');
                      }}
                    >
                      <Text style={styles.puzzleLoadButtonText}>Load onto Board</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.puzzleNextButton}
                      onPress={() => {
                        const next = (currentPuzzleIdx + 1) % DAILY_PUZZLES.length;
                        setCurrentPuzzleIdx(next);
                      }}
                    >
                      <Text style={styles.puzzleNextButtonText}>Next Puzzle →</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </View>
          )}

          {/* ======================================================== */}
          {/* 📂 PGN MANAGER PAGE (currentScreen === 'pgn') */}
          {/* ======================================================== */}
          {currentScreen === 'pgn' && (
            <View style={{ flex: 1 }}>
              <View style={styles.screenHeaderRow}>
                <TouchableOpacity
                  style={styles.screenBackButton}
                  onPress={() => setCurrentScreen('home')}
                >
                  <ArrowLeft size={18} color="#1E293B" strokeWidth={2.4} />
                  <Text style={styles.screenBackText}>Hub</Text>
                </TouchableOpacity>
                <Text style={styles.screenHeaderTitle}>PGN Manager</Text>
                <View style={{ width: 32 }} />
              </View>

              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                <View style={styles.pgnCard}>
                  <Text style={styles.pgnCardTitle}>📂 Current Game PGN</Text>
                  <Text style={styles.pgnContentText}>
                    {chess.pgn() || '[Event "Casual Game"]\n[Site "Chess Coach"]\n1. --'}
                  </Text>
                </View>
              </ScrollView>
            </View>
          )}
        </View>

        {/* ======================================================== */}
        {/* ☰ 1. MAIN THREE-LINE MENU (6 Core Menu Items) */}
        {/* ======================================================== */}
        <Modal
          visible={isMenuOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsMenuOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.menuGlassCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Menu</Text>
                <TouchableOpacity
                  style={styles.closeCircleButton}
                  onPress={() => setIsMenuOpen(false)}
                >
                  <X size={18} color="#64748B" strokeWidth={2.5} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* 1. Settings */}
                <TouchableOpacity
                  style={styles.menuItemPill}
                  activeOpacity={0.7}
                  onPress={() => {
                    setIsMenuOpen(false);
                    setIsSettingsOpen(true);
                  }}
                >
                  <View style={styles.menuItemLeft}>
                    <SettingsIcon size={18} color="#2563EB" style={styles.menuItemIcon} />
                    <Text style={styles.menuItemText}>Settings</Text>
                  </View>
                  <ChevronRight size={18} color="#94A3B8" />
                </TouchableOpacity>

                {/* 2. Clear Move (Clear All) */}
                <TouchableOpacity
                  style={styles.menuItemPill}
                  activeOpacity={0.7}
                  onPress={handleClearAllMoves}
                >
                  <View style={styles.menuItemLeft}>
                    <Trash2 size={18} color="#DC2626" style={styles.menuItemIcon} />
                    <Text style={[styles.menuItemText, { color: '#DC2626' }]}>Clear Move (Clear All)</Text>
                  </View>
                </TouchableOpacity>

                {/* 3. Variant */}
                <TouchableOpacity
                  style={styles.menuItemPill}
                  activeOpacity={0.7}
                  onPress={() => {
                    setIsMenuOpen(false);
                    setIsVariantOpen(true);
                  }}
                >
                  <View style={styles.menuItemLeft}>
                    <Layers size={18} color="#7C3AED" style={styles.menuItemIcon} />
                    <Text style={styles.menuItemText}>Variant</Text>
                  </View>
                  <Text style={styles.menuSubBadge}>{selectedVariant.split(' ')[0]}</Text>
                </TouchableOpacity>

                {/* 4. Show Threats */}
                <TouchableOpacity
                  style={styles.menuItemPill}
                  activeOpacity={0.7}
                  onPress={() => {
                    updateSetting('showThreats', !settings.showThreats);
                    setIsMenuOpen(false);
                  }}
                >
                  <View style={styles.menuItemLeft}>
                    <AlertOctagon size={18} color="#D97706" style={styles.menuItemIcon} />
                    <Text style={styles.menuItemText}>Show Threats</Text>
                  </View>
                  <Text style={[styles.menuSubBadge, settings.showThreats && styles.menuSubBadgeActive]}>
                    {settings.showThreats ? 'ON' : 'OFF'}
                  </Text>
                </TouchableOpacity>

                {/* 5. Board Editor */}
                <TouchableOpacity
                  style={styles.menuItemPill}
                  activeOpacity={0.7}
                  onPress={() => {
                    setIsBoardEditorOpen(true);
                    setIsMenuOpen(false);
                  }}
                >
                  <View style={styles.menuItemLeft}>
                    <Edit3 size={18} color="#059669" style={styles.menuItemIcon} />
                    <Text style={styles.menuItemText}>Board Editor</Text>
                  </View>
                </TouchableOpacity>

                {/* 6. Continue from Here */}
                <TouchableOpacity
                  style={styles.menuItemPill}
                  activeOpacity={0.7}
                  onPress={() => {
                    setIsMenuOpen(false);
                  }}
                >
                  <View style={styles.menuItemLeft}>
                    <PlayCircle size={18} color="#0284C7" style={styles.menuItemIcon} />
                    <Text style={styles.menuItemText}>Continue from Here</Text>
                  </View>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ======================================================== */}
        {/* ⚙️ 2. FULL SETTINGS SUBMENU (All 16 User Settings) */}
        {/* ======================================================== */}
        <Modal
          visible={isSettingsOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setIsSettingsOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.menuGlassCard, { maxHeight: '85%' }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Settings</Text>
                <TouchableOpacity
                  style={styles.closeCircleButton}
                  onPress={() => setIsSettingsOpen(false)}
                >
                  <X size={18} color="#64748B" strokeWidth={2.5} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Section: Stockfish Settings */}
                <Text style={styles.settingsSectionTitle}>Stockfish Settings</Text>

                {/* 1. Stockfish Toggle */}
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Stockfish Engine</Text>
                  <Switch
                    value={settings.stockfishEnabled}
                    onValueChange={(val) => setSettings({ ...settings, stockfishEnabled: val })}
                    trackColor={{ true: '#2563EB', false: '#CBD5E1' }}
                  />
                </View>

                {/* 2. CPU Threads */}
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>CPU Threads</Text>
                  <View style={styles.stepperRow}>
                    {[1, 2, 4, 8].map((t) => (
                      <TouchableOpacity
                        key={t}
                        style={[
                          styles.stepperPill,
                          settings.cpuThreads === t && styles.stepperPillActive,
                        ]}
                        onPress={() => updateSetting('cpuThreads', t)}
                      >
                        <Text
                          style={[
                            styles.stepperText,
                            settings.cpuThreads === t && styles.stepperTextActive,
                          ]}
                        >
                          {t}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* 3. Multiple Lines (MultiPV) */}
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Multiple Lines (MultiPV)</Text>
                  <View style={styles.stepperRow}>
                    {[1, 2, 3, 5].map((l) => (
                      <TouchableOpacity
                        key={l}
                        style={[
                          styles.stepperPill,
                          settings.multipleLines === l && styles.stepperPillActive,
                        ]}
                        onPress={() => updateSetting('multipleLines', l)}
                      >
                        <Text
                          style={[
                            styles.stepperText,
                            settings.multipleLines === l && styles.stepperTextActive,
                          ]}
                        >
                          {l}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* 4. Search Time */}
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Search Time</Text>
                  <View style={styles.stepperRow}>
                    {[0.5, 1.0, 2.0, 5.0].map((sec) => (
                      <TouchableOpacity
                        key={sec}
                        style={[
                          styles.stepperPill,
                          settings.stockfishSearchTime === sec && styles.stepperPillActive,
                        ]}
                        onPress={() => updateSetting('stockfishSearchTime', sec)}
                      >
                        <Text
                          style={[
                            styles.stepperText,
                            settings.stockfishSearchTime === sec && styles.stepperTextActive,
                          ]}
                        >
                          {sec}s
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* 5. Best Move Arrow */}
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Best Move Arrow</Text>
                  <Switch
                    value={settings.bestMoveArrow}
                    onValueChange={(val) => updateSetting('bestMoveArrow', val)}
                    trackColor={{ true: '#2563EB', false: '#CBD5E1' }}
                  />
                </View>

                {/* 6. Best Hero */}
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Best Hero</Text>
                  <Switch
                    value={settings.bestHero}
                    onValueChange={(val) => updateSetting('bestHero', val)}
                    trackColor={{ true: '#2563EB', false: '#CBD5E1' }}
                  />
                </View>

                {/* 7. Server Analysis */}
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Server Analysis</Text>
                  <Switch
                    value={settings.serverAnalysis}
                    onValueChange={(val) => updateSetting('serverAnalysis', val)}
                    trackColor={{ true: '#2563EB', false: '#CBD5E1' }}
                  />
                </View>

                {/* Section: Display & Analysis Settings */}
                <Text style={styles.settingsSectionTitle}>Display & Analysis</Text>

                {/* 8. Show Evaluation Gauge */}
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Show Evaluation Gauge</Text>
                  <Switch
                    value={settings.showEvalGauge}
                    onValueChange={(val) => updateSetting('showEvalGauge', val)}
                    trackColor={{ true: '#2563EB', false: '#CBD5E1' }}
                  />
                </View>

                {/* 9. Inline Notations */}
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Inline Notations</Text>
                  <Switch
                    value={settings.inlineNotations}
                    onValueChange={(val) => updateSetting('inlineNotations', val)}
                    trackColor={{ true: '#2563EB', false: '#CBD5E1' }}
                  />
                </View>

                {/* 10. Toggle Move Annotations */}
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Toggle Move Annotations</Text>
                  <Switch
                    value={settings.toggleMoveAnnotations}
                    onValueChange={(val) => updateSetting('toggleMoveAnnotations', val)}
                    trackColor={{ true: '#2563EB', false: '#CBD5E1' }}
                  />
                </View>

                {/* 11. Show Indian Lines */}
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Show Indian Lines</Text>
                  <Switch
                    value={settings.showIndianLines}
                    onValueChange={(val) => updateSetting('showIndianLines', val)}
                    trackColor={{ true: '#2563EB', false: '#CBD5E1' }}
                  />
                </View>

                {/* 12. Show Comments */}
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Show Comments</Text>
                  <Switch
                    value={settings.showComments}
                    onValueChange={(val) => updateSetting('showComments', val)}
                    trackColor={{ true: '#2563EB', false: '#CBD5E1' }}
                  />
                </View>

                {/* 13. Small Board */}
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Small Board</Text>
                  <Switch
                    value={settings.smallBoard}
                    onValueChange={(val) => updateSetting('smallBoard', val)}
                    trackColor={{ true: '#2563EB', false: '#CBD5E1' }}
                  />
                </View>

                {/* 14. Open Explorer */}
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Open Explorer</Text>
                  <Switch
                    value={settings.openExplorer}
                    onValueChange={(val) => updateSetting('openExplorer', val)}
                    trackColor={{ true: '#2563EB', false: '#CBD5E1' }}
                  />
                </View>

                {/* 15. Show Threats */}
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Show Threats</Text>
                  <Switch
                    value={settings.showThreats}
                    onValueChange={(val) => updateSetting('showThreats', val)}
                    trackColor={{ true: '#2563EB', false: '#CBD5E1' }}
                  />
                </View>

                {/* 16. Show Side Evaluation Bar */}
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Show Side Evaluation Bar</Text>
                  <Switch
                    value={settings.showSideEvalBar}
                    onValueChange={(val) => updateSetting('showSideEvalBar', val)}
                    trackColor={{ true: '#2563EB', false: '#CBD5E1' }}
                  />
                </View>

                {/* 17. Sound */}
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Sound</Text>
                  <Switch
                    value={settings.sound}
                    onValueChange={(val) => updateSetting('sound', val)}
                    trackColor={{ true: '#2563EB', false: '#CBD5E1' }}
                  />
                </View>

                {/* Section: Board & Piece Themes */}
                <Text style={styles.settingsSectionTitle}>Board & Piece Themes</Text>

                {/* Board Theme Selector */}
                <View style={{ marginBottom: 12 }}>
                  <Text style={[styles.settingLabel, { marginBottom: 8 }]}>Board Theme</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {(['Classic Wood', 'Emerald Green', 'Ocean Blue', 'Midnight Slate', 'Charcoal Dark'] as const).map((t) => (
                      <TouchableOpacity
                        key={t}
                        style={[
                          styles.themeOptionPill,
                          settings.boardTheme === t && styles.themeOptionPillActive,
                        ]}
                        onPress={() => updateSetting('boardTheme', t)}
                      >
                        <Text
                          style={[
                            styles.themeOptionText,
                            settings.boardTheme === t && styles.themeOptionTextActive,
                          ]}
                        >
                          {t}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Piece Theme Selector */}
                <View style={{ marginBottom: 12 }}>
                  <Text style={[styles.settingLabel, { marginBottom: 8 }]}>Piece Style</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {(['Vector Neo', 'Classic Alpha', 'Modern Minimal', 'High Contrast'] as const).map((p) => (
                      <TouchableOpacity
                        key={p}
                        style={[
                          styles.themeOptionPill,
                          settings.pieceTheme === p && styles.themeOptionPillActive,
                        ]}
                        onPress={() => updateSetting('pieceTheme', p)}
                      >
                        <Text
                          style={[
                            styles.themeOptionText,
                            settings.pieceTheme === p && styles.themeOptionTextActive,
                          ]}
                        >
                          {p}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={{ height: 20 }} />
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ======================================================== */}
        {/* ♟️ 3. CHESS VARIANT SELECTION MODAL */}
        {/* ======================================================== */}
        <Modal
          visible={isVariantOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsVariantOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.menuGlassCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Chess Variant</Text>
                <TouchableOpacity
                  style={styles.closeCircleButton}
                  onPress={() => setIsVariantOpen(false)}
                >
                  <X size={18} color="#64748B" strokeWidth={2.5} />
                </TouchableOpacity>
              </View>

              {CHESS_VARIANTS.map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[styles.variantItemPill, selectedVariant === v && styles.variantItemPillActive]}
                  onPress={() => {
                    setSelectedVariant(v);
                    setIsVariantOpen(false);
                  }}
                >
                  <Text style={[styles.variantItemText, selectedVariant === v && styles.variantItemTextActive]}>
                    {v}
                  </Text>
                  {selectedVariant === v && <Check size={18} color="#2563EB" />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },
  container: {
    flex: 1,
    paddingHorizontal: 14,
    justifyContent: 'space-between',
  },
  ambientFog1: {
    position: 'absolute',
    top: -50,
    left: -40,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(219, 234, 254, 0.6)',
  },
  ambientFog2: {
    position: 'absolute',
    top: 280,
    right: -50,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(237, 233, 254, 0.55)',
  },
  ambientFog3: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(224, 242, 254, 0.5)',
  },
  // Engine Status Bar
  engineStatusBar: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    marginTop: 4,
    marginBottom: 6,
  },
  evalScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  evalScoreBadge: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  evalScoreText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  evalStateText: {
    fontSize: 12,
    fontWeight: '700',
  },
  engineStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  engineStatItem: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  statDot: {
    fontSize: 10,
    color: '#CBD5E1',
    marginHorizontal: 5,
  },
  // Editor Mode Banner
  editorBannerPill: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 246, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(191, 219, 254, 0.9)',
    marginBottom: 4,
  },
  editorBannerText: {
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: '700',
  },
  editorDoneButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  editorDoneText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  // Chessboard Container
  boardGlassContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    padding: 6,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  board: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#CBD5E1',
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
    backgroundColor: '#F8FAFC',
  },
  darkSquare: {
    backgroundColor: '#7192B3',
  },
  selectedSquare: {
    backgroundColor: '#FEF08A',
  },
  lastMoveSquare: {
    backgroundColor: '#BAE6FD',
  },
  heroSquareHighlight: {
    backgroundColor: 'rgba(234, 179, 8, 0.35)',
  },
  threatHighlight: {
    backgroundColor: 'rgba(239, 68, 68, 0.35)',
  },
  pieceText: {
    textAlign: 'center',
  },
  whitePiece: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowOffset: { width: 1, height: 1.5 },
    textShadowRadius: 2,
  },
  blackPiece: {
    color: '#0F172A',
  },
  moveDot: {
    position: 'absolute',
    backgroundColor: 'rgba(15, 23, 42, 0.25)',
  },
  captureRing: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: 'rgba(239, 68, 68, 0.45)',
  },
  coordRank: {
    position: 'absolute',
    top: 2,
    left: 3,
    fontSize: 9,
    fontWeight: '700',
  },
  coordFile: {
    position: 'absolute',
    bottom: 1,
    right: 3,
    fontSize: 9,
    fontWeight: '700',
  },
  lightCoord: {
    color: '#94A3B8',
  },
  darkCoord: {
    color: '#F1F5F9',
  },
  // Editor Palette
  editorPalette: {
    flexDirection: 'row',
    marginTop: 4,
  },
  editorPaletteItem: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'rgba(203, 213, 225, 0.6)',
  },
  editorPaletteItemSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
    borderWidth: 2,
  },
  editorPalettePiece: {
    fontSize: 20,
  },
  // Timeline Strip
  timelineWrapper: {
    marginVertical: 4,
  },
  timelineScroll: {
    flexDirection: 'row',
  },
  timelinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    borderRadius: 9999,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timelinePillActive: {
    backgroundColor: '#2563EB',
    borderColor: '#1D4ED8',
  },
  timelineText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  timelineTextActive: {
    color: '#FFFFFF',
  },
  // Analysis Content Area
  analysisScrollView: {
    flex: 1,
    marginVertical: 4,
  },
  cognitiveCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: 16,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cognitiveCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cognitiveHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E293B',
  },
  cognitiveConceptTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  cognitiveBodyText: {
    fontSize: 11,
    color: '#334155',
    lineHeight: 16,
    fontWeight: '500',
  },
  indianLinesCard: {
    backgroundColor: 'rgba(254, 243, 199, 0.85)',
    borderRadius: 14,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(253, 230, 138, 0.9)',
  },
  indianLinesTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 2,
  },
  indianLinesBody: {
    fontSize: 11,
    color: '#78350F',
    lineHeight: 15,
  },
  explorerCard: {
    backgroundColor: 'rgba(239, 246, 255, 0.85)',
    borderRadius: 14,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(191, 219, 254, 0.9)',
  },
  explorerTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E40AF',
    marginBottom: 2,
  },
  explorerBody: {
    fontSize: 11,
    color: '#1E3A8A',
    lineHeight: 15,
  },
  // Bottom Toolbar (5 Meaningful Action Buttons)
  bottomNebba: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 4,
  },
  nebbaButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(241, 245, 249, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(203, 213, 225, 0.6)',
  },
  nebbaHeroButton: {
    backgroundColor: '#2563EB',
    borderColor: '#1D4ED8',
    width: 46,
    height: 46,
    borderRadius: 23,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  nebbaHeroButtonInactive: {
    backgroundColor: '#94A3B8',
    borderColor: '#64748B',
    shadowOpacity: 0.1,
  },
  nebbaButtonDisabled: {
    opacity: 0.35,
  },
  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  menuGlassCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  closeCircleButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemPill: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemIcon: {
    marginRight: 10,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  menuSubBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  menuSubBadgeActive: {
    color: '#D97706',
    backgroundColor: '#FEF3C7',
  },
  settingsSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  settingLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  stepperRow: {
    flexDirection: 'row',
  },
  stepperPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    marginLeft: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stepperPillActive: {
    backgroundColor: '#2563EB',
    borderColor: '#1D4ED8',
  },
  stepperText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  stepperTextActive: {
    color: '#FFFFFF',
  },
  variantItemPill: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  variantItemPillActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  variantItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  variantItemTextActive: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  // ECO Badge
  ecoBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  ecoBadgeText: {
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: '800',
  },
  // Sub-page Tabs
  themeOptionPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  themeOptionPillActive: {
    backgroundColor: '#2563EB',
    borderColor: '#1D4ED8',
  },
  themeOptionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  themeOptionTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  subPageTabRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(241, 245, 249, 0.85)',
    borderRadius: 12,
    padding: 3,
    marginVertical: 4,
  },
  subPageTabButton: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 9,
  },
  subPageTabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  subPageTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  subPageTabTextActive: {
    color: '#0F172A',
    fontWeight: '800',
  },
  // Opening Explorer Header
  explorerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  ecoTagSmall: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  ecoTagSmallText: {
    color: '#1E40AF',
    fontSize: 10,
    fontWeight: '800',
  },
  // Puzzle Card
  puzzleCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  puzzleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  puzzleTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  puzzleRatingBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  puzzleThemeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
    marginBottom: 2,
  },
  puzzleDescText: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 15,
    marginBottom: 8,
  },
  puzzleActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  puzzleLoadButton: {
    flex: 1,
    backgroundColor: '#2563EB',
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 6,
  },
  puzzleLoadButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  puzzleNextButton: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  puzzleNextButtonText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '700',
  },
  // PGN Card
  pgnCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.95)',
  },
  pgnCardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  pgnContentText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#334155',
    lineHeight: 16,
  },
  // Home Hub Styles
  homeScrollView: {
    flex: 1,
    paddingTop: 8,
  },
  homeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  homeLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  homeLogoIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  homeTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  homeSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  homeSettingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(203, 213, 225, 0.6)',
  },
  heroPlayCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  heroPlayBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 9999,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  heroPlayBadgeText: {
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: '800',
  },
  heroPlayTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  heroPlaySubtitle: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 14,
  },
  heroPlayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  heroPlayButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  homeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  homeGridCard: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  homeGridIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  homeGridCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  homeGridCardDesc: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },
  // Screen Header Styles
  screenHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 6,
  },
  screenBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(203, 213, 225, 0.6)',
  },
  screenBackText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    marginLeft: 4,
  },
  screenHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  screenHeaderAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(203, 213, 225, 0.6)',
  },
  pageActionButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  pageActionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
