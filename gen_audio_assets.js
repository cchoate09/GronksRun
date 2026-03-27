const fs = require('fs');

/**
 * Simple WAV file generator and procedural SFX synthesis
 */
class WaveGenerator {
    constructor(sampleRate = 44100) {
        this.sampleRate = sampleRate;
    }

    createWav(samples) {
        const buffer = Buffer.alloc(44 + samples.length * 2);
        
        // RIFF header
        buffer.write('RIFF', 0);
        buffer.writeUInt32LE(36 + samples.length * 2, 4);
        buffer.write('WAVE', 8);
        
        // fmt subchunk
        buffer.write('fmt ', 12);
        buffer.writeUInt32LE(16, 16);
        buffer.writeUInt16LE(1, 20); // PCM
        buffer.writeUInt16LE(1, 22); // Mono
        buffer.writeUInt32LE(this.sampleRate, 24);
        buffer.writeUInt32LE(this.sampleRate * 2, 28);
        buffer.writeUInt16LE(2, 32); // Block align
        buffer.writeUint16LE(16, 34); // Bits per sample
        
        // data subchunk
        buffer.write('data', 36);
        buffer.writeUInt32LE(samples.length * 2, 40);
        
        for (let i = 0; i < samples.length; i++) {
            const s = Math.max(-1, Math.min(1, samples[i]));
            buffer.writeInt16LE(s < 0 ? s * 0x8000 : s * 0x7FFF, 44 + i * 2);
        }
        
        return 'data:audio/wav;base64,' + buffer.toString('base64');
    }

    // Procedural sound: Jump (sliding sine)
    generateJump() {
        const length = 0.15;
        const samples = new Float32Array(this.sampleRate * length);
        for (let i = 0; i < samples.length; i++) {
            const t = i / this.sampleRate;
            const freq = 200 + 400 * (t / length);
            const amplitude = 0.5 * (1 - t / length);
            samples[i] = Math.sin(2 * Math.PI * freq * t) * amplitude;
        }
        return this.createWav(samples);
    }

    // Procedural sound: Gem (pure bell-like tone)
    generateGem() {
        const length = 0.2;
        const samples = new Float32Array(this.sampleRate * length);
        for (let i = 0; i < samples.length; i++) {
            const t = i / this.sampleRate;
            const freq = 880 + 320 * (t / length);
            const amplitude = 0.4 * Math.exp(-t * 15);
            samples[i] = Math.sin(2 * Math.PI * freq * t) * amplitude;
        }
        return this.createWav(samples);
    }

    // Procedural sound: Hit (harsh sawtooth with quick decay)
    generateHit() {
        const length = 0.25;
        const samples = new Float32Array(this.sampleRate * length);
        for (let i = 0; i < samples.length; i++) {
            const t = i / this.sampleRate;
            const freq = 100;
            const amplitude = 0.6 * Math.exp(-t * 10);
            const phase = (freq * t) % 1.0;
            samples[i] = (2 * phase - 1) * amplitude; // Sawtooth
        }
        return this.createWav(samples);
    }

    // Procedural sound: Death (descending harsh tone)
    generateDeath() {
        const length = 0.6;
        const samples = new Float32Array(this.sampleRate * length);
        for (let i = 0; i < samples.length; i++) {
            const t = i / this.sampleRate;
            const freq = 400 * (1 - t / length) + 40;
            const amplitude = 0.6 * (1 - t / length);
            const phase = (freq * t) % 1.0;
            samples[i] = (2 * phase - 1) * amplitude;
        }
        return this.createWav(samples);
    }

    // Procedural sound: Dash (filtered white noise)
    generateDash() {
        const length = 0.2;
        const samples = new Float32Array(this.sampleRate * length);
        for (let i = 0; i < samples.length; i++) {
            const t = i / this.sampleRate;
            const amplitude = 0.4 * (1 - t / length);
            samples[i] = (Math.random() * 2 - 1) * amplitude;
        }
        return this.createWav(samples);
    }

    // Procedural sound: UI Tap (short pop)
    generateUITap() {
        const length = 0.05;
        const samples = new Float32Array(this.sampleRate * length);
        for (let i = 0; i < samples.length; i++) {
            const t = i / this.sampleRate;
            const freq = 1200;
            const amplitude = 0.3 * Math.exp(-t * 60);
            samples[i] = Math.sin(2 * Math.PI * freq * t) * amplitude;
        }
        return this.createWav(samples);
    }
    
    // Procedural sound: Level Complete (fanfare)
    generateLevelComplete() {
        const length = 1.0;
        const samples = new Float32Array(this.sampleRate * length);
        const notes = [261.6, 329.6, 392.0, 523.3]; // C E G C
        for (let i = 0; i < samples.length; i++) {
            const t = i / this.sampleRate;
            let sample = 0;
            notes.forEach((freq, idx) => {
                const startTime = idx * 0.15;
                if (t >= startTime) {
                    const localT = t - startTime;
                    const amplitude = 0.2 * Math.exp(-localT * 5);
                    sample += Math.sin(2 * Math.PI * freq * localT) * amplitude;
                }
            });
            samples[i] = sample;
        }
        return this.createWav(samples);
    }
    // Procedural sound: Land (low thud)
    generateLand() {
        const length = 0.1;
        const samples = new Float32Array(this.sampleRate * length);
        for (let i = 0; i < samples.length; i++) {
            const t = i / this.sampleRate;
            const freq = 80;
            const amplitude = 0.4 * Math.exp(-t * 30);
            samples[i] = Math.sin(2 * Math.PI * freq * t) * amplitude;
        }
        return this.createWav(samples);
    }

    // Procedural sound: Slide (noise with low-pass flavor)
    generateSlide() {
        const length = 0.3;
        const samples = new Float32Array(this.sampleRate * length);
        for (let i = 0; i < samples.length; i++) {
            const t = i / this.sampleRate;
            const amplitude = 0.3 * (1 - t / length);
            // Simple noise
            samples[i] = (Math.random() * 2 - 1) * amplitude;
        }
        return this.createWav(samples);
    }

    // Procedural sound: Shield (crystal harmony)
    generateShield() {
        const length = 0.4;
        const samples = new Float32Array(this.sampleRate * length);
        for (let i = 0; i < samples.length; i++) {
            const t = i / this.sampleRate;
            const freq = 600;
            const amplitude = 0.4 * Math.exp(-t * 8);
            samples[i] = (Math.sin(2 * Math.PI * freq * t) + 0.5 * Math.sin(2 * Math.PI * freq * 1.5 * t)) * amplitude;
        }
        return this.createWav(samples);
    }

    // Procedural sound: Spin (fast tick)
    generateSpin() {
        const length = 0.03;
        const samples = new Float32Array(this.sampleRate * length);
        for (let i = 0; i < samples.length; i++) {
            const t = i / this.sampleRate;
            const freq = 2000;
            const amplitude = 0.2 * Math.exp(-t * 100);
            samples[i] = Math.sin(2 * Math.PI * freq * t) * amplitude;
        }
        return this.createWav(samples);
    }

    // Procedural sound: Music Loop (ambient style)
    generateMusic(theme) {
        const length = 2.0; // 2 second loops
        const samples = new Float32Array(this.sampleRate * length);
        const patterns = {
            JUNGLE: { scale:[262,294,330,392,440], type:'sine' },
            VOLCANO: { scale:[220,247,262,330,370], type:'sawtooth' },
            GLACIER: { scale:[330,392,440,494,523], type:'sine' },
            SWAMP: { scale:[196,220,262,294,330], type:'triangle' },
            SKY: { scale:[392,440,494,523,587], type:'sine' },
        };
        const pat = patterns[theme] || patterns.JUNGLE;
        
        for (let i = 0; i < samples.length; i++) {
            const t = i / this.sampleRate;
            // Base drone
            let sample = Math.sin(2 * Math.PI * pat.scale[0] * 0.5 * t) * 0.15;
            // Layered harmonics
            sample += Math.sin(2 * Math.PI * pat.scale[2] * t) * 0.05;
            // Theme specific texture
            if (pat.type === 'sawtooth') {
                sample += (( (pat.scale[1] * t) % 1.0 ) * 2 - 1) * 0.03;
            } else if (pat.type === 'triangle') {
                sample += (Math.abs(( (pat.scale[1] * t) % 1.0 ) * 4 - 2) - 1) * 0.04;
            }
            // Fade in/out for seamless loop
            const fade = Math.min(t / 0.1, (length - t) / 0.1, 1);
            samples[i] = sample * fade;
        }
        return this.createWav(samples);
    }
}

const gen = new WaveGenerator(22050); // Lower sample rate for music objects to save space
const sfxAssets = {
    jump: gen.generateJump(),
    land: gen.generateLand(),
    gem: gen.generateGem(),
    hit: gen.generateHit(),
    death: gen.generateDeath(),
    dash: gen.generateDash(),
    slide: gen.generateSlide(),
    shield: gen.generateShield(),
    spin: gen.generateSpin(),
    ui_tap: gen.generateUITap(),
    level_complete: gen.generateLevelComplete()
};

const musicAssets = {
    JUNGLE: gen.generateMusic('JUNGLE'),
    VOLCANO: gen.generateMusic('VOLCANO'),
    GLACIER: gen.generateMusic('GLACIER'),
    SWAMP: gen.generateMusic('SWAMP'),
    SKY: gen.generateMusic('SKY')
};

const fileContent = `// Auto-generated audio assets
var SFX_ASSETS = ${JSON.stringify(sfxAssets, null, 2)};
var MUSIC_ASSETS = ${JSON.stringify(musicAssets, null, 2)};
`;

fs.writeFileSync('C:\\Users\\cchoa\\Claude_Sandbox\\gronk-run-app\\audio_assets.js', fileContent);
console.log('Successfully generated audio_assets.js with SFX and Music');
