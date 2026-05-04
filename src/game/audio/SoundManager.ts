import { readNumber } from '../storage';

type SoundCue = 'select' | 'melee' | 'ranged' | 'hit' | 'clear' | 'damage';

const cueMap: Record<SoundCue, { frequency: number; duration: number; type: OscillatorType; gain: number }> = {
    select: { frequency: 520, duration: 0.045, type: 'triangle', gain: 0.035 },
    melee: { frequency: 180, duration: 0.07, type: 'sawtooth', gain: 0.04 },
    ranged: { frequency: 760, duration: 0.08, type: 'square', gain: 0.028 },
    hit: { frequency: 120, duration: 0.09, type: 'sawtooth', gain: 0.055 },
    clear: { frequency: 660, duration: 0.16, type: 'triangle', gain: 0.045 },
    damage: { frequency: 92, duration: 0.12, type: 'sawtooth', gain: 0.055 },
};

export class SoundManager {
    private static context: AudioContext | null = null;

    public static playCue(cue: SoundCue): void {
        if (!readNumber('gronk_sound_enabled', 1)) return;
        const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtor) return;

        try {
            if (!SoundManager.context) SoundManager.context = new AudioCtor();
            const context = SoundManager.context;
            const config = cueMap[cue];
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            const now = context.currentTime;

            oscillator.type = config.type;
            oscillator.frequency.setValueAtTime(config.frequency, now);
            oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, config.frequency * 0.62), now + config.duration);
            gain.gain.setValueAtTime(config.gain, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + config.duration);
            oscillator.connect(gain);
            gain.connect(context.destination);
            oscillator.start(now);
            oscillator.stop(now + config.duration);
        } catch {
            // Sound is optional; WebView/browser audio policies should never break gameplay.
        }
    }
}
