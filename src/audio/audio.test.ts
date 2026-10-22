import { describe, expect, it } from 'vitest';
import { AudioBus } from './audio';

describe('AudioBus mute priority', () => {
  it('mutes from the in-game toggle', () => {
    const audio = new AudioBus();
    expect(audio.isMuted).toBe(false);
    expect(audio.toggleMute()).toBe(true);
    expect(audio.isMuted).toBe(true);
    expect(audio.toggleMute()).toBe(false);
  });

  it('keeps audio muted while SDK muteAudio is true even if user wants sound', () => {
    const audio = new AudioBus();
    audio.setSdkMuted(true);
    expect(audio.isMuted).toBe(true);
    expect(audio.isSdkMuted).toBe(true);

    // HUD shows muted; click means prefer sound — output stays silent under host mute.
    expect(audio.toggleMute()).toBe(true);
    expect(audio.isMuted).toBe(true);

    audio.setSdkMuted(false);
    expect(audio.isMuted).toBe(false);
  });

  it('restores user unmute preference when SDK mute clears', () => {
    const audio = new AudioBus();
    audio.setSdkMuted(true);
    audio.setMuted(false);
    expect(audio.isMuted).toBe(true);

    audio.setSdkMuted(false);
    expect(audio.isMuted).toBe(false);
  });

  it('keeps user mute after SDK mute clears if they preferred mute', () => {
    const audio = new AudioBus();
    audio.setMuted(true);
    audio.setSdkMuted(true);
    expect(audio.isMuted).toBe(true);

    audio.setSdkMuted(false);
    expect(audio.isMuted).toBe(true);
  });
});
