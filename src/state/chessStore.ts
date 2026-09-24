import { create } from 'zustand';
import { Chess, Square, Move } from 'chess.js';
import { identifyEco } from '../engine/ecoService';

export type BoardTheme = 'Classic Wood' | 'Emerald Green' | 'Ocean Blue' | 'Midnight Slate' | 'Charcoal Dark';
export type PieceTheme = 'Vector Neo' | 'Classic Alpha' | 'Modern Minimal' | 'High Contrast';

export interface ChessSettings {
  // Stockfish Engine
  stockfishEnabled: boolean;
  stockfishSearchTime: number;
  multipleLines: number;
  cpuThreads: number;
  bestMoveArrow: boolean;
  bestHero: boolean;
  serverAnalysis: boolean;
  // Display & Board
  smallBoard: boolean;
  showEvalGauge: boolean;
  showSideEvalBar: boolean;
  inlineNotations: boolean;
  toggleMoveAnnotations: boolean;
  showComments: boolean;
  showThreats: boolean;
  showIndianLines: boolean;
  openExplorer: boolean;
  sound: boolean;
  // Customization Themes
  boardTheme: BoardTheme;
  pieceTheme: PieceTheme;
}

interface ChessGameState {
  chess: Chess;
  fen: string;
  selectedSquare: Square | null;
  possibleMoves: string[];
  lastMove: { from: string; to: string } | null;
  isWhiteOrientation: boolean;
  historyMoves: Move[];
  currentMoveIndex: number;
  currentScreen: 'home' | 'analysis' | 'openings' | 'puzzles' | 'pgn';
  currentPuzzleIdx: number;
  isMenuOpen: boolean;
  isSettingsOpen: boolean;
  isVariantOpen: boolean;
  isBoardEditorOpen: boolean;
  selectedVariant: string;
  selectedEditorPiece: string | null;
  settings: ChessSettings;
  
  // Actions
  setScreen: (screen: 'home' | 'analysis' | 'openings' | 'puzzles' | 'pgn') => void;
  selectSquare: (sq: Square | null, moves?: string[]) => void;
  makeMove: (from: Square, to: Square, promotion?: string) => boolean;
  undoMove: () => void;
  redoMove: () => void;
  resetGame: () => void;
  jumpToMove: (idx: number) => void;
  flipBoard: () => void;
  loadFen: (fen: string) => void;
  updateSetting: <K extends keyof ChessSettings>(key: K, value: ChessSettings[K]) => void;
  setMenuOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setVariantOpen: (open: boolean) => void;
  setBoardEditorOpen: (open: boolean) => void;
  setSelectedVariant: (variant: string) => void;
  setSelectedEditorPiece: (piece: string | null) => void;
  setCurrentPuzzleIdx: (idx: number) => void;
}

export const useChessStore = create<ChessGameState>((set, get) => {
  const initialChess = new Chess();

  return {
    chess: initialChess,
    fen: initialChess.fen(),
    selectedSquare: null,
    possibleMoves: [],
    lastMove: null,
    isWhiteOrientation: true,
    historyMoves: [],
    currentMoveIndex: -1,
    currentScreen: 'analysis',
    currentPuzzleIdx: 0,
    isMenuOpen: false,
    isSettingsOpen: false,
    isVariantOpen: false,
    isBoardEditorOpen: false,
    selectedVariant: 'Standard Chess',
    selectedEditorPiece: 'w_p',
    settings: {
      stockfishEnabled: true,
      stockfishSearchTime: 1.0,
      multipleLines: 3,
      cpuThreads: 4,
      bestMoveArrow: true,
      bestHero: true,
      serverAnalysis: false,
      smallBoard: false,
      showEvalGauge: true,
      showSideEvalBar: true,
      inlineNotations: true,
      toggleMoveAnnotations: true,
      showComments: true,
      showThreats: false,
      showIndianLines: false,
      openExplorer: true,
      sound: true,
      boardTheme: 'Classic Wood',
      pieceTheme: 'Vector Neo',
    },

    setScreen: (currentScreen) => set({ currentScreen }),

    selectSquare: (selectedSquare, possibleMoves = []) => set({ selectedSquare, possibleMoves }),

    makeMove: (from, to, promotion = 'q') => {
      const { chess, historyMoves, currentMoveIndex } = get();
      try {
        const move = chess.move({ from, to, promotion });
        if (move) {
          const updatedHistory = historyMoves.slice(0, currentMoveIndex + 1);
          updatedHistory.push(move);
          set({
            fen: chess.fen(),
            historyMoves: updatedHistory,
            currentMoveIndex: updatedHistory.length - 1,
            lastMove: { from: move.from, to: move.to },
            selectedSquare: null,
            possibleMoves: [],
          });
          return true;
        }
      } catch {
        // invalid
      }
      return false;
    },

    undoMove: () => {
      const { chess, historyMoves, currentMoveIndex } = get();
      if (historyMoves.length === 0 || currentMoveIndex < 0) return;
      chess.undo();
      const newIndex = currentMoveIndex - 1;
      const prevMove = newIndex >= 0 ? historyMoves[newIndex] : null;
      set({
        fen: chess.fen(),
        currentMoveIndex: newIndex,
        selectedSquare: null,
        possibleMoves: [],
        lastMove: prevMove ? { from: prevMove.from, to: prevMove.to } : null,
      });
    },

    redoMove: () => {
      const { chess, historyMoves, currentMoveIndex } = get();
      if (currentMoveIndex >= historyMoves.length - 1) return;
      const nextMove = historyMoves[currentMoveIndex + 1];
      chess.move(nextMove);
      set({
        fen: chess.fen(),
        currentMoveIndex: currentMoveIndex + 1,
        selectedSquare: null,
        possibleMoves: [],
        lastMove: { from: nextMove.from, to: nextMove.to },
      });
    },

    resetGame: () => {
      const { chess } = get();
      chess.reset();
      set({
        fen: chess.fen(),
        selectedSquare: null,
        possibleMoves: [],
        lastMove: null,
        historyMoves: [],
        currentMoveIndex: -1,
        isMenuOpen: false,
      });
    },

    jumpToMove: (idx) => {
      const { chess, historyMoves } = get();
      chess.reset();
      for (let i = 0; i <= idx; i++) {
        chess.move(historyMoves[i]);
      }
      const targetMove = historyMoves[idx];
      set({
        fen: chess.fen(),
        currentMoveIndex: idx,
        lastMove: targetMove ? { from: targetMove.from, to: targetMove.to } : null,
        selectedSquare: null,
        possibleMoves: [],
      });
    },

    flipBoard: () => set((state) => ({ isWhiteOrientation: !state.isWhiteOrientation })),

    loadFen: (fen) => {
      const { chess } = get();
      try {
        chess.load(fen);
        set({
          fen: chess.fen(),
          selectedSquare: null,
          possibleMoves: [],
          lastMove: null,
          historyMoves: [],
          currentMoveIndex: -1,
        });
      } catch {
        // invalid FEN
      }
    },

    updateSetting: (key, value) =>
      set((state) => ({
        settings: {
          ...state.settings,
          [key]: value,
        },
      })),

    setMenuOpen: (isMenuOpen) => set({ isMenuOpen }),
    setSettingsOpen: (isSettingsOpen) => set({ isSettingsOpen }),
    setVariantOpen: (isVariantOpen) => set({ isVariantOpen }),
    setBoardEditorOpen: (isBoardEditorOpen) => set({ isBoardEditorOpen }),
    setSelectedVariant: (selectedVariant) => set({ selectedVariant }),
    setSelectedEditorPiece: (selectedEditorPiece) => set({ selectedEditorPiece }),
    setCurrentPuzzleIdx: (currentPuzzleIdx) => set({ currentPuzzleIdx }),
  };
});
