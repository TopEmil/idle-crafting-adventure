/** Lightweight WebAudio bed + SFX — no large assets. */

export class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private bedTimer: number | null = null;
  private unlocked = false;

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
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master) {
      this.master.gain.value = muted ? 0 : 0.55;
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  startBed() {
    if (this.bedTimer != null) return;
    const pulse = () => {
      if (!this.muted) this.playTone(110, 0.35, 'sine', 0.03);
      this.bedTimer = window.setTimeout(pulse, 2400);
    };
    pulse();
  }

  stopBed() {
    if (this.bedTimer != null) {
      clearTimeout(this.bedTimer);
      this.bedTimer = null;
    }
  }

  click() {
    this.playTone(220, 0.06, 'triangle', 0.08);
    this.playTone(440, 0.04, 'sine', 0.04);
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
