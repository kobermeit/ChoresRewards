/**
 * High-quality audio effects and category-aware sound manager for ChoresRewards.
 * Supports:
 * - Built-in Web Audio synthesis (100% offline, immediate, zero latency)
 * - Bundled mp3/wav audio clips categorized by action
 * - Themed synthesizers: Fantasy (Zelda-style), Christmas, Spooky, Chimes, Fanfare
 * - Automatic pre-unlock on first user interaction for tablet/mobile browsers
 */

import { resolveAssetUrl } from '../api';

export type SoundCategory = 'celebration' | 'chore_done' | 'timer_alert' | 'timer_done' | 'silly' | 'ding';
export type SoundThemeKey = 'auto' | 'default' | 'fantasy' | 'christmas' | 'spooky' | 'chimes' | 'fanfare';

// Curated sound file mapping from static/sounds (resolved relative for Home Assistant Ingress)
const CATEGORY_SOUND_FILES: Record<SoundCategory, string[]> = {
  celebration: [
    './static/sounds/ta-da_yrvBrlS.mp3',
    './static/sounds/sound_effects_-_reggaeton_air_horn_CkAudio.wav',
    './static/sounds/anime-wow-sound-effect.mp3',
    './static/sounds/yeah-boiii-i-i-i.mp3',
    './static/sounds/yooooooooooooooooooooooooo_4_objp8XX.mp3',
  ],
  chore_done: [
    './static/sounds/ta-da_yrvBrlS.mp3',
    './static/sounds/anime-wow-sound-effect.mp3',
    './static/sounds/best-friends-v1_3Coc8NL.mp3',
    './static/sounds/Can_of_Soda_Opened.mp3',
  ],
  silly: [
    './static/sounds/fart-meme-sound.mp3',
    './static/sounds/dry-fart.mp3',
    './static/sounds/fart-with-reverb.mp3',
    './static/sounds/nuclear-fart-1.mp3',
    './static/sounds/goofy-ahh-car-horn-sound-effect.mp3',
    './static/sounds/duck-quack.mp3',
    './static/sounds/cow-moo.mp3',
    './static/sounds/elephant-trumpet.mp3',
    './static/sounds/frog-croak.mp3',
    './static/sounds/cat-meow.mp3',
    './static/sounds/sheep-baa.mp3',
    './static/sounds/dog-bark.mp3',
    './static/sounds/vine-boom.mp3',
    './static/sounds/taco-bell-bong-sfx.mp3',
  ],
  timer_alert: [
    './static/sounds/samsung-notification-sound-bass-boosted.mp3',
    './static/sounds/blaster.mp3',
  ],
  timer_done: [
    './static/sounds/dun-dun-dun-sound-effect-brass_8nFBccR.mp3',
    './static/sounds/sound_effects_-_reggaeton_air_horn_CkAudio.wav',
    './static/sounds/ta-da_yrvBrlS.mp3',
  ],
  ding: [
    './static/sounds/Can_of_Soda_Opened.mp3',
    './static/sounds/blaster.mp3',
  ],
};

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// Global unlock listener on first user touch/click for mobile browsers
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  };
  window.addEventListener('click', unlockAudio, { passive: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });
}

/**
 * Procedural Web Audio Synth for instant, zero-latency celebratory sound
 */
export function playSyntheticChime(type: 'success' | 'fanfare' | 'timer_done' | 'pop') {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  if (type === 'success' || type === 'pop') {
    // Pleasant melodic 3-note arpeggio (C5 -> E5 -> G5)
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.001, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.25, now + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.3);
    });
  } else if (type === 'fanfare') {
    // Triumphant 4-note brass-style fanfare (C5 -> G5 -> C6 -> E6)
    const notes = [523.25, 783.99, 1046.5, 1318.51];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.1);

      gain.gain.setValueAtTime(0.001, now + idx * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.3, now + idx * 0.1 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.1);
      osc.stop(now + idx * 0.1 + 0.5);
    });
  } else if (type === 'timer_done') {
    // 3 rhythmic urgent beeps
    [0, 0.2, 0.4].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, now + delay);

      gain.gain.setValueAtTime(0.18, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.13);
    });
  }
}

/**
 * Procedural Themed Sound Synthesizers (100% offline, immediate, zero latency)
 */
export function playThemedSound(theme: SoundThemeKey | string, action: 'chore_done' | 'timer_done' | 'celebration' = 'chore_done') {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const key = String(theme).toLowerCase();

  if (key === 'fantasy') {
    // Iconic Zelda-style 8-note secret chime (G5 -> F#5 -> D#5 -> A4 -> G#4 -> E5 -> G#5 -> C6)
    const notes = [783.99, 739.99, 622.25, 440.0, 415.3, 659.25, 830.61, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.1);

      gain.gain.setValueAtTime(0.001, now + idx * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.28, now + idx * 0.1 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.1);
      osc.stop(now + idx * 0.1 + 0.38);
    });
  } else if (key === 'christmas') {
    // Warm Celesta & Church Bell Chimes (D6 -> B5 -> G5 -> D5 with bell overtones)
    const notes = [1174.66, 987.77, 783.99, 587.33];
    notes.forEach((freq, idx) => {
      [1, 2.76].forEach((harmonic, hIdx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * harmonic, now + idx * 0.14);

        const vol = hIdx === 0 ? 0.25 : 0.08;
        gain.gain.setValueAtTime(0.001, now + idx * 0.14);
        gain.gain.exponentialRampToValueAtTime(vol, now + idx * 0.14 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.55);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.14);
        osc.stop(now + idx * 0.14 + 0.6);
      });
    });
  } else if (key === 'spooky') {
    // Halloween theremin arpeggio (D4 -> G#4 -> B4 -> F5 with vibrato)
    const notes = [293.66, 415.3, 493.88, 698.46];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);

      gain.gain.setValueAtTime(0.001, now + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.22, now + idx * 0.12 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.42);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.45);
    });
  } else if (key === 'chimes') {
    // Gentle zen wind chimes (E6 -> G#6 -> B6 -> D#7)
    const notes = [1318.51, 1661.22, 1975.53, 2489.02];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);

      gain.gain.setValueAtTime(0.001, now + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.2, now + idx * 0.09 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.55);
    });
  } else if (key === 'fanfare') {
    playSyntheticChime('fanfare');
  } else {
    // Default fallback
    if (action === 'timer_done') playSyntheticChime('timer_done');
    else if (action === 'celebration') playSyntheticChime('fanfare');
    else playSyntheticChime('success');
  }
}

/**
 * Text-to-Speech milestone announcement (100% offline via browser Web Speech API)
 */
export function speakAnnouncement(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.1; // friendly, upbeat pitch
    utterance.volume = 0.9;
    window.speechSynthesis.speak(utterance);
  } catch {
    // ignore
  }
}

/**
 * Main audio playback dispatcher
 */
export function playSoundCategory(
  category: SoundCategory | string = 'chore_done',
  options?: { customUrl?: string; fallbackSynth?: boolean; theme?: SoundThemeKey | string }
): void {
  try {
    getAudioContext();

    if (options?.customUrl) {
      const audio = new Audio(resolveAssetUrl(options.customUrl));
      audio.play().catch(() => {});
      return;
    }

    // If a theme other than 'default' or 'auto' is selected, use themed synth
    if (options?.theme && options.theme !== 'default' && options.theme !== 'auto') {
      const action = category === 'timer_done' ? 'timer_done' : category === 'celebration' ? 'celebration' : 'chore_done';
      playThemedSound(options.theme, action);
      return;
    }

    const catKey = (category in CATEGORY_SOUND_FILES ? category : 'chore_done') as SoundCategory;
    const soundList = CATEGORY_SOUND_FILES[catKey] || [];

    if (soundList.length > 0) {
      const chosenUrl = soundList[Math.floor(Math.random() * soundList.length)];
      const resolved = resolveAssetUrl(chosenUrl);
      const audio = new Audio(resolved);
      audio.play().catch(() => {
        // If audio clip fails or is blocked, fallback to procedural Web Audio Synth
        if (options?.fallbackSynth !== false) {
          playSyntheticChime(catKey === 'celebration' ? 'fanfare' : catKey === 'timer_done' ? 'timer_done' : 'success');
        }
      });
    } else {
      playSyntheticChime(catKey === 'celebration' ? 'fanfare' : catKey === 'timer_done' ? 'timer_done' : 'success');
    }
  } catch {
    // fallback
  }
}
