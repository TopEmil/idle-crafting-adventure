import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPlatformBridge } from './crazygames';

type TestWindow = {
  CrazyGames?: {
    SDK: CrazyGamesSDK;
  };
};

describe('platform muteAudio', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {} as TestWindow);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('applies initial settings.muteAudio and forwards listener updates', async () => {
    const listeners: Array<(settings: CrazyGamesGameSettings) => void> = [];
    (window as TestWindow).CrazyGames = {
      SDK: {
        init: async () => undefined,
        game: {
          loadingStart: () => undefined,
          loadingStop: () => undefined,
          gameplayStart: () => undefined,
          gameplayStop: () => undefined,
          settings: { muteAudio: true },
          addSettingsChangeListener: (listener) => {
            listeners.push(listener);
          },
        },
        ad: {
          requestAd: () => undefined,
        },
      },
    };

    const bridge = createPlatformBridge();
    await bridge.init();

    const seen: boolean[] = [];
    bridge.onMuteAudioChange((muteAudio) => {
      seen.push(muteAudio);
    });

    expect(seen).toEqual([true]);
    expect(listeners).toHaveLength(1);

    listeners[0]?.({ muteAudio: false });
    expect(seen).toEqual([true, false]);
  });

  it('no-ops when SDK is missing', () => {
    const bridge = createPlatformBridge();
    const listener = vi.fn();
    bridge.onMuteAudioChange(listener);
    expect(listener).not.toHaveBeenCalled();
  });
});
