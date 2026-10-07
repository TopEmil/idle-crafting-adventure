export type AdKind = 'midgame' | 'rewarded';

export interface AdRequestResult {
  status: 'finished' | 'error' | 'disabled' | 'blocked';
  reason?: string;
}

export interface PlatformBridge {
  ready: boolean;
  adsEnabled: boolean;
  adblock: boolean;
  init(): Promise<void>;
  loadingStart(): void;
  loadingStop(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  happytime(): void;
  requestAd(kind: AdKind): Promise<AdRequestResult>;
  saveCloud(key: string, value: string): Promise<void>;
  loadCloud(key: string): Promise<string | null>;
}

function getSdk(): CrazyGamesSDK | null {
  return window.CrazyGames?.SDK ?? null;
}

export function createPlatformBridge(): PlatformBridge {
  let ready = false;
  let adsEnabled = true;
  let adblock = false;
  let gameplayActive = false;

  return {
    get ready() {
      return ready;
    },
    get adsEnabled() {
      return adsEnabled;
    },
    get adblock() {
      return adblock;
    },

    async init() {
      const sdk = getSdk();
      if (!sdk) {
        ready = true;
        adsEnabled = false;
        return;
      }
      try {
        await sdk.init();
        ready = true;
        if (sdk.ad.hasAdblock) {
          adblock = await sdk.ad.hasAdblock();
        }
      } catch {
        ready = true;
        adsEnabled = false;
      }
    },

    loadingStart() {
      getSdk()?.game.sdkGameLoadingStart();
    },

    loadingStop() {
      getSdk()?.game.sdkGameLoadingStop();
    },

    gameplayStart() {
      if (gameplayActive) return;
      gameplayActive = true;
      getSdk()?.game.gameplayStart();
    },

    gameplayStop() {
      if (!gameplayActive) return;
      gameplayActive = false;
      getSdk()?.game.gameplayStop();
    },

    happytime() {
      getSdk()?.game.happytime?.();
    },

    requestAd(kind: AdKind): Promise<AdRequestResult> {
      const sdk = getSdk();
      if (!sdk || !adsEnabled) {
        return Promise.resolve({ status: 'disabled' });
      }
      if (adblock && kind === 'rewarded') {
        return Promise.resolve({ status: 'blocked', reason: 'adblock' });
      }

      return new Promise((resolve) => {
        let settled = false;
        const finish = (result: AdRequestResult) => {
          if (settled) return;
          settled = true;
          resolve(result);
        };

        try {
          sdk.ad.requestAd(kind, {
            adStarted: () => {
              // Caller mutes/pauses on start via promise race — we only signal lifecycle here
            },
            adFinished: () => finish({ status: 'finished' }),
            adError: (error) => {
              const reason =
                typeof error === 'string' ? error : (error?.reason ?? 'adError');
              // unfilled / disabled inventory
              if (reason === 'unfilled' || reason.includes('disabled')) {
                adsEnabled = false;
              }
              finish({ status: 'error', reason });
            },
          });
        } catch (err) {
          finish({
            status: 'error',
            reason: err instanceof Error ? err.message : 'request failed',
          });
        }
      });
    },

    async saveCloud(key: string, value: string) {
      const sdk = getSdk();
      if (sdk?.data?.setItem) {
        try {
          await sdk.data.setItem(key, value);
        } catch {
          // fall through to local only
        }
      }
    },

    async loadCloud(key: string) {
      const sdk = getSdk();
      if (sdk?.data?.getItem) {
        try {
          return await sdk.data.getItem(key);
        } catch {
          return null;
        }
      }
      return null;
    },
  };
}
