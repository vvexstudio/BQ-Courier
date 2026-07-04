// Procedural chiptune SFX — no audio files, everything synthesized from
// oscillators and a shared noise buffer, in the same 16-bit register as the
// art. The AudioContext can only start after a user gesture, so we lazily
// unlock on the first keydown; every play() before that is a silent no-op.
//
// One function per sound, tuned by ear: play('bell'), play('crash'), etc.

const MASTER_GAIN = 0.22;
const MUSIC_GAIN = 0.3; // × master ≈ 0.066 — a bed, never a blanket

export function createSFX() {
  let ctx = null;
  let master = null;
  let music = null; // separate bus so the bed stays under every SFX
  let noiseBuf = null;

  function unlock() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = MASTER_GAIN;
      master.connect(ctx.destination);
      music = ctx.createGain();
      music.gain.value = MUSIC_GAIN;
      music.connect(master);

      // 1s of white noise, reused by every percussive sound.
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

      startMusic();
    } catch {
      ctx = null; // audio stays off; the game must not care
    }
  }
  // Keydown covers desktop; pointerdown covers thumbs. Either counts as the
  // user gesture the AudioContext needs.
  window.addEventListener('keydown', unlock, { once: true });
  window.addEventListener('pointerdown', unlock, { once: true });

  // --- building blocks ------------------------------------------------------

  // One oscillator: type, freq (can glide), gain envelope (attack-free decay).
  function beep({ type = 'square', from = 440, to = from, dur = 0.15, vol = 0.5, delay = 0 }) {
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // Filtered noise burst: the percussion section.
  function noise({ dur = 0.2, vol = 0.6, freq = 1200, q = 0.7, type = 'bandpass', delay = 0, sweepTo = 0 }) {
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t0);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t0, Math.random());
    src.stop(t0 + dur + 0.02);
  }

  // --- the kit --------------------------------------------------------------

  const kit = {
    // Classic two-strike bike bell.
    bell() {
      for (const d of [0, 0.09]) {
        beep({ type: 'sine', from: 2093, dur: 0.4, vol: 0.35, delay: d });
        beep({ type: 'sine', from: 2637, dur: 0.3, vol: 0.2, delay: d });
      }
    },
    // Eating asphalt: low thud + metal clatter.
    crash() {
      noise({ dur: 0.09, vol: 0.9, freq: 160, type: 'lowpass' });
      noise({ dur: 0.35, vol: 0.5, freq: 2600, q: 0.4, delay: 0.03 });
      beep({ type: 'sawtooth', from: 120, to: 40, dur: 0.3, vol: 0.5 });
      noise({ dur: 0.25, vol: 0.3, freq: 3400, q: 1.5, delay: 0.16 });
    },
    // Something big slid past your elbow.
    whoosh() {
      noise({ dur: 0.22, vol: 0.5, freq: 700, sweepTo: 2600, q: 1.2 });
    },
    // Order delivered: rising major arpeggio.
    win() {
      const notes = [523, 659, 784, 1047];
      notes.forEach((f, i) => beep({ type: 'square', from: f, dur: 0.14, vol: 0.3, delay: i * 0.07 }));
    },
    // Order expired: sad trombone, chip edition.
    lose() {
      beep({ type: 'square', from: 392, to: 370, dur: 0.2, vol: 0.3 });
      beep({ type: 'square', from: 330, to: 294, dur: 0.35, vol: 0.3, delay: 0.2 });
    },
    // New order ding-dong.
    order() {
      beep({ type: 'triangle', from: 880, dur: 0.12, vol: 0.4 });
      beep({ type: 'triangle', from: 1175, dur: 0.2, vol: 0.4, delay: 0.1 });
    },
    // Bunny hop: quick up-blip; landing handled by physics feel alone.
    hop() {
      beep({ type: 'square', from: 300, to: 620, dur: 0.09, vol: 0.25 });
    },
    // Boost ignition + the ongoing hiss is faked with one longer sweep.
    boost() {
      beep({ type: 'sawtooth', from: 180, to: 720, dur: 0.35, vol: 0.3 });
      noise({ dur: 0.4, vol: 0.25, freq: 900, sweepTo: 2400, q: 0.6 });
    },
    // Angry vehicle. Two-tone cluster, held.
    horn() {
      beep({ type: 'sawtooth', from: 440, dur: 0.45, vol: 0.25 });
      beep({ type: 'sawtooth', from: 349, dur: 0.45, vol: 0.25 });
    },
    // Box truck backing up.
    beep() {
      beep({ type: 'square', from: 1000, dur: 0.18, vol: 0.14 });
    },
    // A whole flock going vertical.
    flutter() {
      for (let i = 0; i < 5; i++) {
        noise({ dur: 0.05, vol: 0.3, freq: 1800 + i * 300, q: 2, delay: i * 0.045 });
      }
    },
    // Car door creaking open right in front of you.
    creak() {
      beep({ type: 'sawtooth', from: 180, to: 340, dur: 0.28, vol: 0.16 });
    },
    // Scored points ticker blip.
    blip() {
      beep({ type: 'square', from: 1319, dur: 0.07, vol: 0.2 });
    },
    // Tires losing an argument with physics.
    skid() {
      noise({ dur: 0.7, vol: 0.45, freq: 2200, sweepTo: 500, q: 2.5 });
    },
    // A hydrant giving up: thump, then the gush settles into a hiss.
    splash() {
      noise({ dur: 0.12, vol: 0.8, freq: 220, type: 'lowpass' });
      noise({ dur: 1.6, vol: 0.4, freq: 500, sweepTo: 1400, q: 0.5, delay: 0.08 });
      for (let i = 0; i < 6; i++) {
        beep({ type: 'sine', from: 700 + Math.random() * 900, to: 300, dur: 0.1, vol: 0.12, delay: 0.1 + i * 0.12 });
      }
    },
    // Something large just stopped existing.
    explosion() {
      noise({ dur: 0.15, vol: 1.0, freq: 120, type: 'lowpass' });
      noise({ dur: 0.9, vol: 0.6, freq: 900, sweepTo: 150, q: 0.5, delay: 0.05 });
      beep({ type: 'sawtooth', from: 90, to: 30, dur: 0.7, vol: 0.5 });
    },
    // The big fella, several blocks away, announcing himself.
    roar() {
      beep({ type: 'sawtooth', from: 70, to: 45, dur: 1.2, vol: 0.5 });
      beep({ type: 'sawtooth', from: 105, to: 60, dur: 1.1, vol: 0.35, delay: 0.08 });
      noise({ dur: 1.1, vol: 0.3, freq: 300, sweepTo: 120, q: 0.8, delay: 0.1 });
    },
    // The ground has opinions.
    rumble() {
      noise({ dur: 1.4, vol: 0.55, freq: 90, type: 'lowpass' });
      beep({ type: 'sine', from: 45, to: 28, dur: 1.3, vol: 0.4 });
    },
    // That is not one of ours.
    ufo() {
      beep({ type: 'sine', from: 620, to: 880, dur: 0.5, vol: 0.14 });
      beep({ type: 'sine', from: 660, to: 920, dur: 0.5, vol: 0.1, delay: 0.05 });
    },
    // The neighbors are hungrier than usual.
    groan() {
      beep({ type: 'sawtooth', from: 110 + Math.random() * 30, to: 70, dur: 0.7, vol: 0.16 });
    },
    // Something good, for once.
    pickup() {
      beep({ type: 'triangle', from: 784, dur: 0.09, vol: 0.35 });
      beep({ type: 'triangle', from: 1175, dur: 0.09, vol: 0.35, delay: 0.08 });
      beep({ type: 'triangle', from: 1568, dur: 0.16, vol: 0.35, delay: 0.16 });
    },
    // A bagel, deployed.
    toss() {
      noise({ dur: 0.14, vol: 0.3, freq: 900, sweepTo: 2400, q: 1.5 });
    },
    // A bagel, arriving.
    glazed() {
      beep({ type: 'square', from: 220, to: 90, dur: 0.16, vol: 0.35 });
      noise({ dur: 0.1, vol: 0.3, freq: 1400, q: 1, delay: 0.02 });
    },
    // Ten thousand people who just watched their team win it all.
    chant() {
      for (let i = 0; i < 3; i++) {
        noise({ dur: 0.22, vol: 0.4, freq: 700, q: 0.6, delay: i * 0.28 });
        beep({ type: 'sawtooth', from: 180 + i * 20, to: 140, dur: 0.2, vol: 0.12, delay: i * 0.28 });
      }
    },
    // Whistles and joy, parade-grade.
    party() {
      beep({ type: 'sine', from: 1800, to: 2400, dur: 0.16, vol: 0.2 });
      beep({ type: 'sine', from: 2400, to: 1600, dur: 0.22, vol: 0.2, delay: 0.18 });
      noise({ dur: 0.5, vol: 0.25, freq: 900, q: 0.5, delay: 0.1 });
    },
    // Someone nearby humming an old melody, mostly to himself. Warm, soft,
    // wordless — a niggun on a stoop, not a performance.
    nigun() {
      const phrase = [293.66, 349.23, 329.63, 293.66, 261.63, 293.66];
      let d = 0;
      for (const f of phrase) {
        const dur = 0.22 + Math.random() * 0.12;
        beep({ type: 'triangle', from: f, to: f * 1.008, dur, vol: 0.07, delay: d });
        d += dur * 0.85;
      }
    },
    // A large night, summarized.
    hiccup() {
      beep({ type: 'square', from: 240, to: 480, dur: 0.08, vol: 0.15 });
    },
    // The debate. Two nonverbal voices trading short muttered phrases —
    // rhythm and pitch carry the argument, no words at all.
    argue() {
      let d = 0;
      const voice = (base) => {
        const n = 2 + (Math.random() * 3 | 0);
        for (let i = 0; i < n; i++) {
          beep({
            type: 'sawtooth',
            from: base + Math.random() * 40,
            to: base - 25 + Math.random() * 70,
            dur: 0.09 + Math.random() * 0.08,
            vol: 0.09,
            delay: d,
          });
          d += 0.1 + Math.random() * 0.06;
        }
        d += 0.14; // beat before the rebuttal
      };
      voice(150); // the assertion
      voice(215); // the objection
      if (Math.random() < 0.5) voice(140); // the last word. always.
    },
  };

  // --- the bed --------------------------------------------------------------
  //
  // Sparse lo-fi at 84 BPM, scheduled with the standard WebAudio lookahead
  // pattern: a coarse interval walks a fine musical clock a half-second ahead.
  // Deliberately thin — a bass note, an occasional pad, a whisper of a hat —
  // so every gameplay sound lands on top of it, not inside it. The pattern
  // follows the escalation tier: warm → wary → minor → a drone with the
  // melody removed, the way horror movies stop scoring the monster.

  let musicTier = 0;
  let musicTimer = null;

  // One scheduled tone on the music bus at an absolute context time.
  function mTone({ type = 'sine', freq, at, dur, vol, glideTo = 0, filter = 0 }) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (glideTo) osc.frequency.linearRampToValueAtTime(glideTo, at + dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(vol, at + Math.min(0.35, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    let head = osc;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filter;
      osc.connect(f);
      head = f;
    }
    head.connect(g).connect(music);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }

  function mTick(at, vol = 0.1) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 6000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.04);
    src.connect(f).connect(g).connect(music);
    src.start(at, Math.random());
    src.stop(at + 0.06);
  }

  // Root cycles + chord colors per mood. Freqs, not note names — chip music.
  const MOODS = [
    { roots: [146.83, 110.0, 130.81, 98.0], third: 1.26, hats: 0.3 },  // warm major-ish
    { roots: [146.83, 110.0, 123.47, 98.0], third: 1.26, hats: 0.25 }, // a cloud passes
    { roots: [110.0, 87.31, 103.83, 82.41], third: 1.19, hats: 0.15 }, // minor, wary
    null, // tier 3 is the drone, handled separately
  ];

  function startMusic() {
    const beat = 60 / 84;
    let next = ctx.currentTime + 0.2;
    let i = 0;
    musicTimer = setInterval(() => {
      if (ctx.state === 'suspended') return;
      while (next < ctx.currentTime + 0.6) {
        const bar = (i / 4) | 0;
        const b = i % 4;
        const mood = MOODS[Math.min(musicTier, 3)];

        if (!mood) {
          // Armageddon: no music, just the ground humming. Long low sines
          // every other bar, a flat tritone answer now and then.
          if (b === 0 && bar % 2 === 0) {
            mTone({ freq: 55, at: next, dur: beat * 8.5, vol: 0.5 });
            if (Math.random() < 0.3) {
              mTone({ freq: 77.78, at: next + beat * 2, dur: beat * 4, vol: 0.18, filter: 400 });
            }
          }
        } else {
          const root = mood.roots[bar % mood.roots.length];
          if (b === 0) {
            mTone({ freq: root, at: next, dur: beat * 1.6, vol: 0.5 });
          } else if (b === 2 && Math.random() < 0.4) {
            mTone({ freq: root * 1.5, at: next, dur: beat, vol: 0.3 }); // the fifth
          } else if (Math.random() < mood.hats) {
            mTick(next);
          }
          // A pad every other bar: root + color tone, filtered triangles.
          if (b === 0 && bar % 2 === 1) {
            mTone({ type: 'triangle', freq: root * 2, at: next, dur: beat * 3.4, vol: 0.12, filter: 900 });
            mTone({ type: 'triangle', freq: root * 2 * mood.third, at: next, dur: beat * 3.4, vol: 0.09, filter: 900 });
          }
        }
        next += beat;
        i++;
      }
    }, 200);
  }

  function setMusicTier(n) {
    musicTier = n;
  }

  function play(name) {
    if (!ctx || !kit[name]) return;
    if (ctx.state === 'suspended') ctx.resume();
    kit[name]();
  }

  return { play, setMusicTier };
}
