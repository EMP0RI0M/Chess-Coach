import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Share,
  Alert,
} from 'react-native';
import {
  FileText,
  Copy,
  Share2,
  Upload,
  Download,
  Check,
  RefreshCw,
  Image as ImageIcon,
  Flame,
  ArrowRight,
} from 'lucide-react-native';
import { useChessStore } from '../state/chessStore';
import { Chess } from 'chess.js';

interface PgnFenManagerProps {
  onNavigateToBoard?: () => void;
}

const FAMOUS_PGN_PRESETS = [
  {
    name: 'The Immortal Game (1851)',
    players: 'Adolf Anderssen vs Lionel Kieseritzky',
    pgn: `[Event "London Casual"]
[Site "London"]
[Date "1851.06.21"]
[White "Adolf Anderssen"]
[Black "Lionel Kieseritzky"]
[Result "1-0"]

1. e4 e5 2. f4 exf4 3. Bc4 Qh4+ 4. Kf1 b5 5. Bxb5 Nf6 6. Nf3 Qh6 7. d3 Nh5 8. Nh4 Qg5 9. Nf5 c6 10. g4 Nf6 11. Rg1 cxb5 12. h4 Qg6 13. h5 Qg5 14. Qf3 Ng8 15. Bxf4 Qf6 16. Nc3 Bc5 17. Nd5 Qxb2 18. Bd6 Bxg1 19. e5 Qxa1+ 20. Ke2 Na6 21. Nxg7+ Kd8 22. Qf6+ Nxf6 23. Be7# 1-0`,
  },
  {
    name: 'The Opera Game (1858)',
    players: 'Paul Morphy vs Duke of Brunswick',
    pgn: `[Event "Paris Opera"]
[Site "Paris"]
[Date "1858.11.02"]
[White "Paul Morphy"]
[Black "Duke of Brunswick"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`,
  },
  {
    name: 'Kasparov vs Deep Blue (1996, Game 1)',
    players: 'Deep Blue vs Garry Kasparov',
    pgn: `[Event "ACM Challenge Match"]
[Site "Philadelphia, PA"]
[Date "1996.02.10"]
[White "Deep Blue"]
[Black "Garry Kasparov"]
[Result "1-0"]

1. e4 c5 2. c3 d5 3. exd5 Qxd5 4. d4 Nf6 5. Nf3 Bg4 6. Be2 e6 7. h3 Bh5 8. O-O Nc6 9. Be3 cxd4 10. cxd4 Bb4 11. a3 Ba5 12. Nc3 Qd6 13. Nb5 Qe7 14. Ne5 Bxe2 15. Qxe2 O-O 16. Rac1 Rac8 17. Bg5 Bb6 18. Bxf6 gxf6 19. Nc4 Rfd8 20. Nxb6 axb6 21. Rfd1 f5 22. Qe3 Qf6 23. d5 Rxd5 24. Rxd5 exd5 25. b3 Kh8 26. Qxb6 Rg8 27. Qc5 d4 28. Nd6 f4 29. Nxb7 Ne5 30. Qd5 f3 31. g3 Nd3 32. Rc7 Re8 33. Nd6 Re1+ 34. Kh2 Nxf2 35. Nxf7+ Kg7 36. Ng5+ Kh6 37. Rxh7# 1-0`,
  },
];

const FAMOUS_FEN_PRESETS = [
  {
    name: 'Standard Starting Position',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    desc: 'Default international chess starting array.',
  },
  {
    name: 'Lucena Position (Rook Endgame)',
    fen: '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1',
    desc: 'The fundamental winning rook + pawn endgame technique (bridge building).',
  },
  {
    name: 'Philidor Position (Rook Defense)',
    fen: '4k3/8/8/8/8/4r3/3K4/2R5 b - - 0 1',
    desc: 'The standard drawing setup in rook vs rook and pawn endgames.',
  },
  {
    name: 'Tactical Greek Gift Sacrifice',
    fen: 'r1bq1rk1/pp1nbppp/4p3/3pP3/3P4/3B1N2/PP3PPP/R1BQK2R w KQ - 0 1',
    desc: 'Classic Bxh7+ sacrificial attacking motif.',
  },
];

export const PgnFenManager: React.FC<PgnFenManagerProps> = ({ onNavigateToBoard }) => {
  const chess = useChessStore((s) => s.chess);
  const currentFen = useChessStore((s) => s.fen);
  const loadFen = useChessStore((s) => s.loadFen);
  const resetGame = useChessStore((s) => s.resetGame);

  const [activeTab, setActiveTab] = useState<'pgn' | 'fen' | 'image'>('pgn');
  const [customPgn, setCustomPgn] = useState('');
  const [customFen, setCustomFen] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Load PGN into current game state
  const handleLoadPgn = (pgnString: string) => {
    try {
      const cleanPgn = pgnString.trim();
      if (!cleanPgn) {
        Alert.alert('Empty PGN', 'Please enter or paste valid PGN text.');
        return;
      }

      const tempChess = new Chess();
      tempChess.loadPgn(cleanPgn);

      loadFen(tempChess.fen());
      Alert.alert('PGN Loaded', 'Game loaded onto the board successfully!', [
        {
          text: 'Go to Board',
          onPress: () => onNavigateToBoard?.(),
        },
        { text: 'OK' },
      ]);
    } catch {
      Alert.alert('Invalid PGN', 'Could not parse PGN notation. Please check the move format.');
    }
  };

  // Load FEN into board
  const handleLoadFen = (fenString: string) => {
    try {
      const cleanFen = fenString.trim();
      if (!cleanFen) {
        Alert.alert('Empty FEN', 'Please enter a valid FEN string.');
        return;
      }

      const tempChess = new Chess();
      tempChess.load(cleanFen);

      loadFen(cleanFen);
      Alert.alert('FEN Loaded', 'Board position set successfully!', [
        {
          text: 'Go to Board',
          onPress: () => onNavigateToBoard?.(),
        },
        { text: 'OK' },
      ]);
    } catch {
      Alert.alert('Invalid FEN', 'The provided FEN string is invalid.');
    }
  };

  // Share Content
  const handleShare = async (title: string, message: string) => {
    try {
      await Share.share({
        title,
        message,
      });
    } catch {
      // User cancelled
    }
  };

  // Copy Feedback
  const triggerCopyFeedback = (key: string, content: string) => {
    setCopiedKey(key);
    handleShare(key, content);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <View style={styles.container}>
      {/* Top Tab Bar: PGN | FEN | PNG/Diagram */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'pgn' && styles.tabBtnActive]}
          onPress={() => setActiveTab('pgn')}
        >
          <FileText size={15} color={activeTab === 'pgn' ? '#2563EB' : '#64748B'} />
          <Text style={[styles.tabBtnText, activeTab === 'pgn' && styles.tabBtnTextActive]}>PGN Games</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'fen' && styles.tabBtnActive]}
          onPress={() => setActiveTab('fen')}
        >
          <RefreshCw size={15} color={activeTab === 'fen' ? '#2563EB' : '#64748B'} />
          <Text style={[styles.tabBtnText, activeTab === 'fen' && styles.tabBtnTextActive]}>FEN Position</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'image' && styles.tabBtnActive]}
          onPress={() => setActiveTab('image')}
        >
          <ImageIcon size={15} color={activeTab === 'image' ? '#2563EB' : '#64748B'} />
          <Text style={[styles.tabBtnText, activeTab === 'image' && styles.tabBtnTextActive]}>PNG & Diagram</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
        {/* ======================================================== */}
        {/* 1. PGN MANAGER TAB */}
        {/* ======================================================== */}
        {activeTab === 'pgn' && (
          <View>
            {/* Current Game PGN Box */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <FileText size={16} color="#2563EB" />
                  <Text style={styles.cardTitle}>Current Board PGN</Text>
                </View>
                <TouchableOpacity
                  style={styles.copyBtn}
                  onPress={() => triggerCopyFeedback('Current PGN', chess.pgn() || '1. --')}
                >
                  <Copy size={13} color="#2563EB" />
                  <Text style={styles.copyBtnText}>Copy / Share</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.pgnTextBox}>
                <Text style={styles.pgnText}>
                  {chess.pgn() || '[Event "Casual Game"]\n[Site "Chess Coach"]\n1. --'}
                </Text>
              </View>
            </View>

            {/* Paste & Import Custom PGN Box */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>📥 Import / Upload PGN</Text>
              <Text style={styles.cardSubtitle}>
                Paste any PGN text from Lichess, Chess.com, or tournament books:
              </Text>
              <TextInput
                style={styles.pgnInput}
                placeholder="Paste PGN here (e.g. 1. e4 e5 2. Nf3 Nc6...)"
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={4}
                value={customPgn}
                onChangeText={setCustomPgn}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={() => handleLoadPgn(customPgn)}
              >
                <Upload size={16} color="#FFFFFF" />
                <Text style={styles.primaryActionText}>Extract & Load PGN onto Board</Text>
              </TouchableOpacity>
            </View>

            {/* Master Presets Library */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>👑 Famous Master Games (1-Tap Load)</Text>
              {FAMOUS_PGN_PRESETS.map((item, idx) => (
                <View key={idx} style={styles.presetItem}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.presetName}>{item.name}</Text>
                    <Text style={styles.presetSub}>{item.players}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.presetLoadBtn}
                    onPress={() => handleLoadPgn(item.pgn)}
                  >
                    <Text style={styles.presetLoadText}>Load →</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ======================================================== */}
        {/* 2. FEN MANAGER TAB */}
        {/* ======================================================== */}
        {activeTab === 'fen' && (
          <View>
            {/* Current FEN */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <RefreshCw size={16} color="#2563EB" />
                  <Text style={styles.cardTitle}>Current FEN String</Text>
                </View>
                <TouchableOpacity
                  style={styles.copyBtn}
                  onPress={() => triggerCopyFeedback('FEN String', currentFen)}
                >
                  <Copy size={13} color="#2563EB" />
                  <Text style={styles.copyBtnText}>Copy / Share</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.pgnTextBox}>
                <Text style={styles.fenText}>{currentFen}</Text>
              </View>
            </View>

            {/* Custom FEN Input */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>📥 Import / Set Custom FEN</Text>
              <Text style={styles.cardSubtitle}>
                Paste any FEN position to instantly configure the board:
              </Text>
              <TextInput
                style={styles.singleLineInput}
                placeholder="e.g. rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"
                placeholderTextColor="#94A3B8"
                value={customFen}
                onChangeText={setCustomFen}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={() => handleLoadFen(customFen)}
              >
                <Upload size={16} color="#FFFFFF" />
                <Text style={styles.primaryActionText}>Set FEN to Board</Text>
              </TouchableOpacity>
            </View>

            {/* FEN Position Library */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>📚 Training & Endgame FENs</Text>
              {FAMOUS_FEN_PRESETS.map((item, idx) => (
                <View key={idx} style={styles.presetItem}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.presetName}>{item.name}</Text>
                    <Text style={styles.presetSub}>{item.desc}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.presetLoadBtn}
                    onPress={() => handleLoadFen(item.fen)}
                  >
                    <Text style={styles.presetLoadText}>Set →</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ======================================================== */}
        {/* 3. PNG & DIAGRAM TAB */}
        {/* ======================================================== */}
        {activeTab === 'image' && (
          <View>
            {/* ASCII / Visual Diagram Box */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <ImageIcon size={16} color="#2563EB" />
                  <Text style={styles.cardTitle}>Board Diagram Snapshot</Text>
                </View>
                <TouchableOpacity
                  style={styles.copyBtn}
                  onPress={() => triggerCopyFeedback('Chessboard Diagram', chess.ascii())}
                >
                  <Share2 size={13} color="#2563EB" />
                  <Text style={styles.copyBtnText}>Share Diagram</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.pgnTextBox, { alignItems: 'center' }]}>
                <Text style={styles.asciiBoardText}>{chess.ascii()}</Text>
              </View>
            </View>

            {/* Lichess Board Image Exporter */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>📸 Lichess HD Board PNG Generator</Text>
              <Text style={styles.cardSubtitle}>
                Export this exact live position as a crystal-clear HD PNG image via Lichess image generator:
              </Text>
              <View style={styles.pngUrlBox}>
                <Text style={styles.pngUrlText} numberOfLines={2}>
                  {`https://lichess1.org/export/fen.png?fen=${encodeURIComponent(currentFen)}&color=white&theme=brown&piece=cburnett`}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={() =>
                  handleShare(
                    'Board PNG Link',
                    `https://lichess1.org/export/fen.png?fen=${encodeURIComponent(currentFen)}&color=white&theme=brown&piece=cburnett`
                  )
                }
              >
                <Download size={16} color="#FFFFFF" />
                <Text style={styles.primaryActionText}>Export & Share PNG Link</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 4,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 14,
    padding: 3,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 11,
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginLeft: 5,
  },
  tabBtnTextActive: {
    color: '#2563EB',
    fontWeight: '800',
  },
  scrollBody: {
    paddingBottom: 24,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginLeft: 6,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 10,
    lineHeight: 16,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  copyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
    marginLeft: 4,
  },
  pgnTextBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pgnText: {
    fontSize: 11.5,
    fontFamily: 'monospace',
    color: '#334155',
    lineHeight: 18,
  },
  fenText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#1E293B',
    fontWeight: '600',
  },
  asciiBoardText: {
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 15,
    color: '#0F172A',
    fontWeight: '700',
  },
  pgnInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#0F172A',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  singleLineInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#0F172A',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    marginBottom: 10,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryActionText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    marginLeft: 6,
  },
  presetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  presetName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  presetSub: {
    fontSize: 11,
    color: '#64748B',
  },
  presetLoadBtn: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  presetLoadText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2563EB',
  },
  pngUrlBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  pngUrlText: {
    fontSize: 10.5,
    fontFamily: 'monospace',
    color: '#64748B',
  },
});
