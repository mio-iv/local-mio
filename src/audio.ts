export interface MusicController {
  start(): Promise<void>;
  stop(): void;
  setStage(stage: number): void;
}

const NOTE = {
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  G4: 392,
  A4: 440,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
} as const;

const melodies = [
  [NOTE.C4, NOTE.E4, NOTE.G4, NOTE.E4, NOTE.D4, NOTE.G4, NOTE.A4, NOTE.G4],
  [NOTE.C4, NOTE.G4, NOTE.A4, NOTE.E4, NOTE.D4, NOTE.A4, NOTE.G4, NOTE.E4],
  [NOTE.E4, NOTE.G4, NOTE.C5, NOTE.A4, NOTE.D4, NOTE.G4, NOTE.D5, NOTE.C5],
];

/** Creates a quiet, asset-free soundtrack that begins only after user activation. */
export function createMusic(): MusicController {
  let context: AudioContext | undefined;
  let master: GainNode | undefined;
  let timer: number | undefined;
  let running = false;
  let stageIndex = 0;
  let patternIndex = 0;
  let generation = 0;

  const playNote = (
    frequency: number,
    startTime: number,
    duration: number,
    volume: number,
    type: OscillatorType,
  ): void => {
    if (!context || !master) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startTime);
    oscillator.detune.setValueAtTime(Math.sin(patternIndex * 1.7) * 3, startTime);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(type === 'sine' ? 1500 : 920, startTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.16);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    oscillator.connect(filter).connect(gain).connect(master);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.05);
  };

  const schedulePattern = (): void => {
    if (!running || !context) return;
    const melody = melodies[stageIndex];
    const start = context.currentTime + 0.06;
    const beat = 0.82;
    const root = [NOTE.C4 / 2, NOTE.A4 / 4, NOTE.D4 / 2][stageIndex];

    const noteIndex = patternIndex % melody.length;
    playNote(melody[noteIndex], start, beat * 0.76, 0.05, 'sine');
    if (noteIndex % 2 === 0) {
      playNote(root * (noteIndex === 4 ? 1.5 : 1), start, beat * 1.82, 0.032, 'triangle');
    }

    patternIndex = (patternIndex + 1) % melody.length;
    timer = window.setTimeout(schedulePattern, beat * 1000 - 40);
  };

  const handleVisibility = (): void => {
    if (!context || !running) return;
    if (document.hidden) {
      void context.suspend();
    } else {
      void context.resume();
    }
  };

  document.addEventListener('visibilitychange', handleVisibility);

  return {
    async start(): Promise<void> {
      if (running) return;
      const startGeneration = ++generation;
      if (!context || context.state === 'closed') {
        context = new AudioContext();
        master = context.createGain();
        master.gain.setValueAtTime(0.0001, context.currentTime);
        master.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 1.4);
        master.connect(context.destination);
      }
      const activeContext = context;
      await activeContext.resume();
      if (startGeneration !== generation || context !== activeContext) return;
      running = true;
      patternIndex = 0;
      schedulePattern();
    },

    stop(): void {
      generation += 1;
      running = false;
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
      if (!context || !master) return;
      const closingContext = context;
      master.gain.cancelScheduledValues(closingContext.currentTime);
      master.gain.setTargetAtTime(0.0001, closingContext.currentTime, 0.16);
      window.setTimeout(() => void closingContext.close(), 650);
      context = undefined;
      master = undefined;
    },

    setStage(stage: number): void {
      stageIndex = Math.max(0, Math.min(melodies.length - 1, Math.floor(stage) - 1));
      patternIndex = 0;
    },
  };
}
