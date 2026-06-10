let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playSound(type: string, masterVolumeVal: number, fxEnabled: boolean = true) {
  if (!fxEnabled || masterVolumeVal === 0) return;

  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const volume = masterVolumeVal / 100;

    // Create a main gain node for volume control
    const mainGain = ctx.createGain();
    mainGain.gain.setValueAtTime(volume, now);
    mainGain.connect(ctx.destination);

    switch (type) {
      case 'click': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.05);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.connect(gain);
        gain.connect(mainGain);
        osc.start(now);
        osc.stop(now + 0.05);
        break;
      }

      case 'pickup': {
        // High pitch ascending arpeggio
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.12, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        g.connect(mainGain);

        const notes = [300, 450, 600, 900];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.06);
          osc.connect(g);
          osc.start(now + idx * 0.06);
          osc.stop(now + (idx + 1) * 0.06 + 0.05);
        });
        break;
      }

      case 'reload': {
        // Mechanical click-click
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const g = ctx.createGain();

        osc1.type = 'sawtooth';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(150, now);
        osc2.frequency.setValueAtTime(280, now + 0.15);

        g.gain.setValueAtTime(0.08, now);
        g.gain.setValueAtTime(0, now + 0.08);
        g.gain.setValueAtTime(0.08, now + 0.15);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        osc1.connect(g);
        osc2.connect(g);
        g.connect(mainGain);

        osc1.start(now);
        osc1.stop(now + 0.1);
        osc2.start(now + 0.15);
        osc2.stop(now + 0.3);
        break;
      }

      case 'gunshot_pistol': {
        // Short white noise + high frequency osc pop
        const bufferSize = ctx.sampleRate * 0.08;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(1200, now);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.18, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(mainGain);

        // Synth core pop
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.frequency.setValueAtTime(450, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);
        oscGain.gain.setValueAtTime(0.12, now);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

        osc.connect(oscGain);
        oscGain.connect(mainGain);

        noise.start(now);
        osc.start(now);
        noise.stop(now + 0.08);
        osc.stop(now + 0.05);
        break;
      }

      case 'gunshot_shotgun': {
        // Very loud wide band noise + lower frequency thump
        const bufferSize = ctx.sampleRate * 0.18;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(800, now);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.3, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(mainGain);

        // Sub kick
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.12);
        oscGain.gain.setValueAtTime(0.3, now);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc.connect(oscGain);
        oscGain.connect(mainGain);

        noise.start(now);
        osc.start(now);
        noise.stop(now + 0.18);
        osc.stop(now + 0.12);
        break;
      }

      case 'gunshot_rifle': {
        // Fast, intermediate burst with minor click
        const bufferSize = ctx.sampleRate * 0.06;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(1400, now);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.14, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(mainGain);

        // Core pitch
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 0.04);
        oscGain.gain.setValueAtTime(0.08, now);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

        osc.connect(oscGain);
        oscGain.connect(mainGain);

        noise.start(now);
        osc.start(now);
        noise.stop(now + 0.06);
        osc.stop(now + 0.04);
        break;
      }

      case 'gunshot_sniper': {
        // Whip crack laser followed by longer high decay
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(2000, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.25);

        oscGain.gain.setValueAtTime(0.24, now);
        oscGain.gain.setValueAtTime(0.12, now + 0.02);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        osc.connect(oscGain);
        oscGain.connect(mainGain);

        // Metallic element
        const metOsc = ctx.createOscillator();
        const metGain = ctx.createGain();
        metOsc.type = 'sawtooth';
        metOsc.frequency.setValueAtTime(950, now);
        metGain.gain.setValueAtTime(0.05, now);
        metGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        metOsc.connect(metGain);
        metGain.connect(mainGain);

        osc.start(now);
        metOsc.start(now);
        osc.stop(now + 0.3);
        metOsc.stop(now + 0.08);
        break;
      }

      case 'gunshot_rocket': {
        // Fast ascending whoosh then boom
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.linearRampToValueAtTime(350, now + 0.1);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

        osc.connect(gain);
        gain.connect(mainGain);

        osc.start(now);
        osc.stop(now + 0.1);
        break;
      }

      case 'explosion': {
        // Heavy bass boom + wide noise decay
        const bufferSize = ctx.sampleRate * 0.45;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(350, now);
        filter.frequency.exponentialRampToValueAtTime(30, now + 0.4);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.4, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(mainGain);

        // Sub bass kick
        const sub = ctx.createOscillator();
        const subGain = ctx.createGain();
        sub.frequency.setValueAtTime(100, now);
        sub.frequency.linearRampToValueAtTime(10, now + 0.25);
        subGain.gain.setValueAtTime(0.4, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        sub.connect(subGain);
        subGain.connect(mainGain);

        noise.start(now);
        sub.start(now);
        noise.stop(now + 0.45);
        sub.stop(now + 0.25);
        break;
      }

      case 'hit_wall': {
        // short high pitched tick
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.frequency.setValueAtTime(800, now);
        g.gain.setValueAtTime(0.03, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
        osc.connect(g);
        g.connect(mainGain);
        osc.start(now);
        osc.stop(now + 0.02);
        break;
      }

      case 'hit_player': {
        // squishy direct mid-range drop
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(250, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.06);
        g.gain.setValueAtTime(0.08, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc.connect(g);
        g.connect(mainGain);
        osc.start(now);
        osc.stop(now + 0.06);
        break;
      }

      case 'kill': {
        // High pitched pleasant "ding!"
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const g = ctx.createGain();

        osc1.frequency.setValueAtTime(900, now);
        osc2.frequency.setValueAtTime(1350, now);

        g.gain.setValueAtTime(0.12, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        osc1.connect(g);
        osc2.connect(g);
        g.connect(mainGain);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.18);
        osc2.stop(now + 0.18);
        break;
      }

      case 'death': {
        // low sliding thud + resonance
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.4);

        g.gain.setValueAtTime(0.16, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

        osc.connect(g);
        g.connect(mainGain);

        osc.start(now);
        osc.stop(now + 0.4);
        break;
      }

      case 'levelup': {
        // Bright heroic rising chord
        const notes = [261.63, 329.63, 392.00, 523.25]; // C E G C
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.15, now);
        g.gain.exponentialRampToValueAtTime(0.005, now + 0.5);
        g.connect(mainGain);

        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.07);
          osc.connect(g);
          osc.start(now + idx * 0.07);
          osc.stop(now + 0.5);
        });
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.warn("Unable to play sound due to AudioContext block or missing support", err);
  }
}
