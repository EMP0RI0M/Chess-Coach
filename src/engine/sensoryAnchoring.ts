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
}

export const sensoryAudioEngine = new SensoryAudioEngine();
