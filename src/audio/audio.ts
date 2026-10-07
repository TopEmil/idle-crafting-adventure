/** WebAudio SFX + looping mine bed music. */

const BED_URL = `${import.meta.env.BASE_URL}audio/embervein-mine-bed.ogg`;

export class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private unlocked = false;
  private bed: HTMLAudioElement | null = null;
  private bedStarted = false;

  get isMuted() {
    return this.muted;
  }

  async unlock() {
    if (this.unlocked) return;
    const ctx = this.ensure();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    this.unlocked = true;
    void this.playBed();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master) {
      this.master.gain.value = muted ? 0 : 0.55;
    }
    if (this.bed) {
      this.bed.muted = muted;
      this.bed.volume = muted ? 0 : 0.28;
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  startBed() {
    void this.playBed();
  }

  stopBed() {
    if (this.bed) {
      this.bed.pause();
      this.bedStarted = false;
    }
  }

  click(combo = 1) {
    const bump = Math.min(8, Math.max(0, combo - 1)) * 18;
    this.playTone(220 + bump, 0.055, 'triangle', 0.09);
    this.playTone(440 + bump * 1.5, 0.04, 'sine', 0.045);
    if (combo >= 5) {
      this.playTone(660 + bump, 0.05, 'sine', 0.03);
    }
  }

  craft() {
    this.playTone(330, 0.08, 'sawtooth', 0.05);
    this.playTone(520, 0.12, 'triangle', 0.06);
  }

  claim() {
    this.playTone(392, 0.1, 'sine', 0.07);
    this.playTone(523, 0.14, 'sine', 0.06);
  }

  prestige() {
    this.playTone(196, 0.2, 'triangle', 0.08);
    this.playTone(294, 0.25, 'sine', 0.07);
    this.playTone(392, 0.3, 'sine', 0.05);
  }

  pauseForAd() {
    this.stopBed();
    if (this.master) this.master.gain.value = 0;
  }

  resumeAfterAd() {
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.55;
    this.startBed();
  }

  private ensureBed(): HTMLAudioElement {
    if (!this.bed) {
      const el = new Audio(BED_URL);
      el.loop = true;
      el.preload = 'auto';
      el.volume = this.muted ? 0 : 0.28;
      el.muted = this.muted;
      this.bed = el;
    }
    return this.bed;
  }

  private async playBed() {
    const el = this.ensureBed();
    el.muted = this.muted;
    el.volume = this.muted ? 0 : 0.28;
    if (this.bedStarted && !el.paused) return;
    try {
      await el.play();
      this.bedStarted = true;
    } catch {
      // Autoplay blocked until unlock() after a user gesture.
      this.bedStarted = false;
    }
  }

  private ensure(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType,
    gainValue: number,
  ) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!this.master) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = gainValue;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }
}
