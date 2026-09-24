import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Linking,
  Share,
  Alert,
} from 'react-native';
import {
  Users,
  Swords,
  Globe,
  Copy,
  ExternalLink,
  Play,
  RotateCcw,
  Zap,
  Clock,
  ShieldAlert,
  CheckCircle2,
  X,
} from 'lucide-react-native';
import { lichessApiService } from '../engine/lichessApiService';
import { useChessStore } from '../state/chessStore';

interface MultiplayerModalProps {
  visible: boolean;
  onClose: () => void;
}

export const MultiplayerModal: React.FC<MultiplayerModalProps> = ({ visible, onClose }) => {
  const settings = useChessStore((s) => s.settings);
  const lichessUser = useChessStore((s) => s.lichessUser);

  const [activeTab, setActiveTab] = useState<'quick' | 'custom' | 'friend' | 'ongoing'>('quick');
  const [loading, setLoading] = useState(false);
  const [createdChallenge, setCreatedChallenge] = useState<{
    id: string;
    url: string;
    status: string;
  } | null>(null);

  // Custom challenge form state
  const [selectedMinutes, setSelectedMinutes] = useState(3);
  const [selectedIncrement, setSelectedIncrement] = useState(2);
  const [selectedColor, setSelectedColor] = useState<'random' | 'white' | 'black'>('random');
  const [isRated, setIsRated] = useState(false);

  // Direct challenge form state
  const [friendUsername, setFriendUsername] = useState('');

  // Ongoing games state
  const [ongoingGames, setOngoingGames] = useState<any[]>([]);
  const [fetchingGames, setFetchingGames] = useState(false);

  useEffect(() => {
    if (visible && activeTab === 'ongoing' && settings.lichessToken) {
      loadOngoingGames();
    }
  }, [visible, activeTab]);

  const loadOngoingGames = async () => {
    if (!settings.lichessToken) return;
    setFetchingGames(true);
    try {
      const games = await lichessApiService.getOngoingGames(settings.lichessToken);
      setOngoingGames(games);
    } catch {
      // Ignore error
    } finally {
      setFetchingGames(false);
    }
  };

  const handleQuickChallenge = async (mins: number, inc: number, rated = false) => {
    setLoading(true);
    setCreatedChallenge(null);
    try {
      const challenge = await lichessApiService.createOpenChallenge({
        clockLimit: mins * 60,
        clockIncrement: inc,
        rated,
        color: 'random',
        token: settings.lichessToken,
      });

      if (challenge) {
        setCreatedChallenge(challenge);
      } else {
        Alert.alert('Challenge Failed', 'Could not create Lichess challenge. Please check your internet connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCustomChallenge = async () => {
    setLoading(true);
    setCreatedChallenge(null);
    try {
      const challenge = await lichessApiService.createOpenChallenge({
        clockLimit: selectedMinutes * 60,
        clockIncrement: selectedIncrement,
        rated: isRated,
        color: selectedColor,
        token: settings.lichessToken,
      });

      if (challenge) {
        setCreatedChallenge(challenge);
      } else {
        Alert.alert('Challenge Failed', 'Could not create Lichess challenge.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDirectChallenge = async () => {
    if (!friendUsername.trim()) {
      Alert.alert('Username Required', 'Please enter your opponent\'s Lichess username.');
      return;
    }

    setLoading(true);
    setCreatedChallenge(null);
    try {
      const challenge = await lichessApiService.createDirectChallenge(friendUsername.trim(), {
        clockLimit: selectedMinutes * 60,
        clockIncrement: selectedIncrement,
        rated: isRated,
        color: selectedColor,
        token: settings.lichessToken,
      });

      if (challenge) {
        setCreatedChallenge(challenge);
      } else {
        Alert.alert('Direct Challenge Failed', `Could not challenge @${friendUsername}. User may not exist or has challenges disabled.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleShareLink = async (url: string) => {
    try {
      await Share.share({
        message: `Play chess with me on Lichess: ${url}`,
        url: url,
        title: 'Lichess Challenge',
      });
    } catch {
      // User cancelled share
    }
  };

  const handleOpenLink = (url: string) => {
    Linking.openURL(url);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconContainer}>
                <Globe size={20} color="#2563EB" />
              </View>
              <View>
                <Text style={styles.modalTitle}>Lichess Multiplayer</Text>
                <Text style={styles.modalSubtitle}>
                  {lichessUser ? `Logged in as @${lichessUser.username}` : 'Instant Open & Friend Matches'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Navigation Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'quick' && styles.tabItemActive]}
              onPress={() => {
                setActiveTab('quick');
                setCreatedChallenge(null);
              }}
            >
              <Zap size={14} color={activeTab === 'quick' ? '#2563EB' : '#64748B'} />
              <Text style={[styles.tabText, activeTab === 'quick' && styles.tabTextActive]}>Quick Match</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'custom' && styles.tabItemActive]}
              onPress={() => {
                setActiveTab('custom');
                setCreatedChallenge(null);
              }}
            >
              <Clock size={14} color={activeTab === 'custom' ? '#2563EB' : '#64748B'} />
              <Text style={[styles.tabText, activeTab === 'custom' && styles.tabTextActive]}>Custom</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'friend' && styles.tabItemActive]}
              onPress={() => {
                setActiveTab('friend');
                setCreatedChallenge(null);
              }}
            >
              <Swords size={14} color={activeTab === 'friend' ? '#2563EB' : '#64748B'} />
              <Text style={[styles.tabText, activeTab === 'friend' && styles.tabTextActive]}>Direct</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'ongoing' && styles.tabItemActive]}
              onPress={() => setActiveTab('ongoing')}
            >
              <Play size={14} color={activeTab === 'ongoing' ? '#2563EB' : '#64748B'} />
              <Text style={[styles.tabText, activeTab === 'ongoing' && styles.tabTextActive]}>Live ({ongoingGames.length})</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
            {/* Quick Match Tab */}
            {activeTab === 'quick' && (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionHeading}>Instant Open Challenge</Text>
                <Text style={styles.sectionSubtext}>Create an open game link with standard tournament time controls:</Text>

                <View style={styles.quickGrid}>
                  {[
                    { title: '1+0 Bullet', mins: 1, inc: 0, tag: 'Ultra-fast' },
                    { title: '3+0 Blitz', mins: 3, inc: 0, tag: 'Standard Blitz' },
                    { title: '3+2 Blitz', mins: 3, inc: 2, tag: 'Fischer Blitz' },
                    { title: '5+0 Blitz', mins: 5, inc: 0, tag: 'Popular' },
                    { title: '5+3 Blitz', mins: 5, inc: 3, tag: 'Tournament' },
                    { title: '10+0 Rapid', mins: 10, inc: 0, tag: 'Master Rapid' },
                  ].map((preset) => (
                    <TouchableOpacity
                      key={preset.title}
                      style={styles.quickCard}
                      disabled={loading}
                      onPress={() => handleQuickChallenge(preset.mins, preset.inc)}
                    >
                      <View style={styles.quickCardTop}>
                        <Text style={styles.quickCardTitle}>{preset.title}</Text>
                        <Zap size={15} color="#2563EB" />
                      </View>
                      <Text style={styles.quickCardTag}>{preset.tag}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Custom Challenge Tab */}
            {activeTab === 'custom' && (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionHeading}>Custom Time & Rules</Text>

                {/* Minutes */}
                <Text style={styles.fieldLabel}>Base Clock (Minutes)</Text>
                <View style={styles.pillRow}>
                  {[1, 2, 3, 5, 10, 15, 30].map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.pillBtn, selectedMinutes === m && styles.pillBtnActive]}
                      onPress={() => setSelectedMinutes(m)}
                    >
                      <Text style={[styles.pillText, selectedMinutes === m && styles.pillTextActive]}>{m}m</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Increment */}
                <Text style={styles.fieldLabel}>Increment (Seconds per Move)</Text>
                <View style={styles.pillRow}>
                  {[0, 1, 2, 3, 5, 10, 15].map((inc) => (
                    <TouchableOpacity
                      key={inc}
                      style={[styles.pillBtn, selectedIncrement === inc && styles.pillBtnActive]}
                      onPress={() => setSelectedIncrement(inc)}
                    >
                      <Text style={[styles.pillText, selectedIncrement === inc && styles.pillTextActive]}>+{inc}s</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Color */}
                <Text style={styles.fieldLabel}>Play As</Text>
                <View style={styles.colorRow}>
                  {(['random', 'white', 'black'] as const).map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.colorBtn, selectedColor === c && styles.colorBtnActive]}
                      onPress={() => setSelectedColor(c)}
                    >
                      <Text style={[styles.colorBtnText, selectedColor === c && styles.colorBtnTextActive]}>
                        {c === 'random' ? '🎲 Random' : c === 'white' ? '⚪ White' : '⚫ Black'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={styles.primaryActionBtn}
                  disabled={loading}
                  onPress={handleCustomChallenge}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Zap size={16} color="#FFFFFF" />
                      <Text style={styles.primaryActionText}>Generate Open Link</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Direct User Challenge Tab */}
            {activeTab === 'friend' && (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionHeading}>Challenge a Specific Player</Text>
                <Text style={styles.sectionSubtext}>Enter opponent's Lichess username to send a direct notification match:</Text>

                <Text style={styles.fieldLabel}>Lichess Username</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. magnuscarlsen, thibault"
                  placeholderTextColor="#94A3B8"
                  value={friendUsername}
                  onChangeText={setFriendUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                {/* Quick Time Picker */}
                <Text style={styles.fieldLabel}>Time Control</Text>
                <View style={styles.pillRow}>
                  {[
                    { m: 3, inc: 0, label: '3+0' },
                    { m: 3, inc: 2, label: '3+2' },
                    { m: 5, inc: 0, label: '5+0' },
                    { m: 5, inc: 3, label: '5+3' },
                    { m: 10, inc: 0, label: '10+0' },
                  ].map((tc) => (
                    <TouchableOpacity
                      key={tc.label}
                      style={[styles.pillBtn, selectedMinutes === tc.m && selectedIncrement === tc.inc && styles.pillBtnActive]}
                      onPress={() => {
                        setSelectedMinutes(tc.m);
                        setSelectedIncrement(tc.inc);
                      }}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          selectedMinutes === tc.m && selectedIncrement === tc.inc && styles.pillTextActive,
                        ]}
                      >
                        {tc.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={styles.primaryActionBtn}
                  disabled={loading}
                  onPress={handleDirectChallenge}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Swords size={16} color="#FFFFFF" />
                      <Text style={styles.primaryActionText}>Send Direct Challenge</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Ongoing Live Games Tab */}
            {activeTab === 'ongoing' && (
              <View style={styles.sectionContainer}>
                <View style={styles.ongoingHeader}>
                  <Text style={styles.sectionHeading}>Your Active Games</Text>
                  <TouchableOpacity style={styles.refreshBtn} onPress={loadOngoingGames}>
                    <RotateCcw size={14} color="#2563EB" />
                    <Text style={styles.refreshText}>Refresh</Text>
                  </TouchableOpacity>
                </View>

                {fetchingGames ? (
                  <ActivityIndicator size="small" color="#2563EB" style={{ marginVertical: 20 }} />
                ) : ongoingGames.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Play size={28} color="#94A3B8" />
                    <Text style={styles.emptyTitle}>No Live Games Active</Text>
                    <Text style={styles.emptyDesc}>
                      Create an open challenge or challenge a friend to start a live game.
                    </Text>
                  </View>
                ) : (
                  ongoingGames.map((game) => (
                    <View key={game.gameId || game.fullId} style={styles.ongoingCard}>
                      <View style={styles.ongoingCardLeft}>
                        <Text style={styles.ongoingOpponent}>
                          vs {game.opponent?.username || 'Opponent'} ({game.opponent?.rating || '?'})
                        </Text>
                        <Text style={styles.ongoingMeta}>
                          {game.speed} • Turn: {game.isMyTurn ? '🟢 YOUR TURN' : '⚪ Waiting...'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.resumeBtn}
                        onPress={() => handleOpenLink(`https://lichess.org/${game.fullId || game.gameId}`)}
                      >
                        <Play size={14} color="#FFFFFF" />
                        <Text style={styles.resumeText}>Play</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* Generated Challenge Box */}
            {createdChallenge && (
              <View style={styles.challengeBox}>
                <View style={styles.challengeBoxHeader}>
                  <CheckCircle2 size={18} color="#10B981" />
                  <Text style={styles.challengeBoxTitle}>Challenge Link Created!</Text>
                </View>
                <Text style={styles.challengeBoxUrl} numberOfLines={1}>
                  {createdChallenge.url}
                </Text>

                <View style={styles.challengeActionRow}>
                  <TouchableOpacity
                    style={styles.challengeActionBtn}
                    onPress={() => handleShareLink(createdChallenge.url)}
                  >
                    <Copy size={15} color="#2563EB" />
                    <Text style={styles.challengeActionText}>Share / Copy</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.challengeActionBtn, styles.challengeActionBtnPrimary]}
                    onPress={() => handleOpenLink(createdChallenge.url)}
                  >
                    <ExternalLink size={15} color="#FFFFFF" />
                    <Text style={styles.challengeActionTextPrimary}>Open Game</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 10,
    marginHorizontal: 3,
  },
  tabItemActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginLeft: 5,
  },
  tabTextActive: {
    color: '#2563EB',
  },
  scrollBody: {
    padding: 20,
  },
  sectionContainer: {
    marginBottom: 16,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  sectionSubtext: {
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 14,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickCard: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  quickCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  quickCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  quickCardTag: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginTop: 10,
    marginBottom: 8,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  pillBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pillBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  pillTextActive: {
    color: '#2563EB',
  },
  colorRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  colorBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  colorBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  colorBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  colorBtnTextActive: {
    color: '#2563EB',
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 6,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 13,
    marginTop: 14,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryActionText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  challengeBox: {
    backgroundColor: '#ECFDF5',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    marginTop: 10,
  },
  challengeBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  challengeBoxTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#065F46',
    marginLeft: 6,
  },
  challengeBoxUrl: {
    fontSize: 12,
    fontWeight: '600',
    color: '#047857',
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  challengeActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  challengeActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 9,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  challengeActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
    marginLeft: 5,
  },
  challengeActionBtnPrimary: {
    backgroundColor: '#10B981',
    borderColor: '#059669',
    marginRight: 0,
    marginLeft: 6,
  },
  challengeActionTextPrimary: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 5,
  },
  ongoingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
  },
  refreshText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#475569',
    marginTop: 8,
  },
  emptyDesc: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
  ongoingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  ongoingCardLeft: {
    flex: 1,
  },
  ongoingOpponent: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  ongoingMeta: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  resumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  resumeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    marginLeft: 4,
  },
});
