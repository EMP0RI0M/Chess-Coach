// Real-Time Cross-Modal Sensory Anchoring Engine
// Maps Jev Tactical Motifs directly into High-Throughput Auditory Frequencies and Color Cues

export interface SensoryAnchorSpec {
  frequency_hz: number;
  wave_type: 'triangle' | 'sine' | 'sawtooth' | 'square';
  duration_ms: number;
  description: string;
  ui_color_overlay: string;
}

export const SENSORY_ANCHORING_MAP: Record<string, SensoryAnchorSpec> = {
  Pin: {
    frequency_hz: 880.0,
    wave_type: 'triangle',
    duration_ms: 80,
    description: 'High-pitched, sharp snap signifying absolute structural paralysis.',
    ui_color_overlay: '#FF0055',
  },
  Fork: {
    frequency_hz: 1200.0,
    wave_type: 'sine',
    duration_ms: 120,
    description: 'Dual harmonic chirp mimicking split visual attention across two vector targets.',
    ui_color_overlay: '#FF9900',
  },
  Space_Clamp: {
    frequency_hz: 110.0,
    wave_type: 'sine',
    duration_ms: 250,
    description: 'Low, heavy sub-bass drone representing territorial suffocation and lack of squares.',
    ui_color_overlay: '#00FFCC',
  },
  Tactical_Sacrifice: {
    frequency_hz: 440.0,
    wave_type: 'sawtooth',
    duration_ms: 150,
    description: 'Aggressive, texturized buzz indicating an imminent break in material balance for dynamic compensation.',
    ui_color_overlay: '#CC00FF',
  },
  Demolition: {
    frequency_hz: 1400.0,
    wave_type: 'sawtooth',
    duration_ms: 100,
    description: 'High-energy explosive crunch signaling catastrophic kingside pawn destruction.',
    ui_color_overlay: '#EF4444',
  },
  Overloaded_Defender: {
    frequency_hz: 660.0,
    wave_type: 'triangle',
    duration_ms: 90,
    description: 'Strained dual-frequency pulse highlighting over-leveraged defense pieces.',
    ui_color_overlay: '#F59E0B',
  },
  Discovered_Attack: {
    frequency_hz: 990.0,
    wave_type: 'sine',
    duration_ms: 110,
    description: 'Rising harmonic sweep revealing masked x-ray line of sight.',
    ui_color_overlay: '#8B5CF6',
  },
  King_Exposure: {
    frequency_hz: 1760.0,
    wave_type: 'square',
    duration_ms: 70,
    description: 'Piercing high-frequency alarm alerting critical king diagonal vulnerability.',
    ui_color_overlay: '#DC2626',
  },
  Back_Rank_Mate: {
    frequency_hz: 550.0,
    wave_type: 'sawtooth',
    duration_ms: 200,
    description: 'Descending resonance denoting back-rank perimeter collapse.',
    ui_color_overlay: '#9333EA',
  },
};

/**
 * Cross-platform Audio Synthesizer (Web Audio API + AudioContext fallback)
 */
class SensoryAudioEngine {
  private audioCtx: any = null;

  private getAudioContext() {
    if (typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        if (!this.audioCtx) {
          this.audioCtx = new AudioCtx();
        }
        if (this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().catch(() => {});
        }
        return this.audioCtx;
      }
    }
    return null;
  }

  /**
   * Synthesize and trigger a real-time sensory acoustic anchor
   */
  public triggerMotifTone(motif: string, volume: number = 0.25): void {
    const spec = SENSORY_ANCHORING_MAP[motif] || SENSORY_ANCHORING_MAP['Space_Clamp'];
    const ctx = this.getAudioContext();

    if (ctx) {
      try {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = spec.wave_type;
        osc.frequency.setValueAtTime(spec.frequency_hz, ctx.currentTime);

        // Exponential decay envelope for instant sensory imprinting
        gainNode.gain.setValueAtTime(volume, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(
          0.001,
          ctx.currentTime + spec.duration_ms / 1000
        );

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + spec.duration_ms / 1000);
      } catch (err) {
        // Fallback or non-blocking catch
      }
    }
  }

  public getMotifSpec(motif: string): SensoryAnchorSpec {
    return SENSORY_ANCHORING_MAP[motif] || SENSORY_ANCHORING_MAP['Space_Clamp'];
  }

  /**
   * Standard Chess Move Sound (Satisfying organic click)
   */
  public playMoveSound(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.06);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    } catch {}
  }

  /**
   * Capture Sound (Crisp impact thud)
   */
  public playCaptureSound(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.09);

      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } catch {}
  }

  /**
   * King in Check Sound (High-clarity alert chime)
   */
  public playCheckSound(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    try {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(880, ctx.currentTime);
      osc2.frequency.setValueAtTime(1320, ctx.currentTime);

      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.22);
      osc2.stop(ctx.currentTime + 0.22);
    } catch {}
  }

  /**
   * Illegal Move Sound (Low warning buzz)
   */
  public playIllegalSound(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.setValueAtTime(120, ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {}
  }

  /**
   * Checkmate Victory Sound (Triumphant chord arpeggio)
   */
  public playCheckmateSound(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    try {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.08);

        gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.08 + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.08);
        osc.stop(ctx.currentTime + i * 0.08 + 0.3);
      });
    } catch {}
  }
}

export const sensoryAudioEngine = new SensoryAudioEngine();
