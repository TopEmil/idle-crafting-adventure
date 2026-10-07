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

function safeCall(label: string, fn: () => void) {
  try {
    fn();
  } catch (err) {
    console.warn(`[embervein] SDK ${label} skipped`, err);
  }
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
        // Outside the CrazyGames iframe init can hang — race a short timeout.
        await Promise.race([
          sdk.init(),
          new Promise<void>((resolve) => {
            window.setTimeout(resolve, 2500);
          }),
        ]);
        ready = true;
        if (sdk.ad.hasAdblock) {
          try {
            adblock = await Promise.race([
              sdk.ad.hasAdblock(),
              new Promise<boolean>((resolve) => {
                window.setTimeout(() => resolve(false), 1500);
              }),
            ]);
          } catch {
            adblock = false;
          }
        }
      } catch {
        ready = true;
        adsEnabled = false;
      }
    },

    loadingStart() {
      // CrazyGames SDK v3: game.loadingStart() (posts sdkGameLoadingStart internally)
      safeCall('loadingStart', () => getSdk()?.game.loadingStart());
    },

    loadingStop() {
      safeCall('loadingStop', () => getSdk()?.game.loadingStop());
    },

    gameplayStart() {
      if (gameplayActive) return;
      gameplayActive = true;
      safeCall('gameplayStart', () => getSdk()?.game.gameplayStart());
    },

    gameplayStop() {
      if (!gameplayActive) return;
      gameplayActive = false;
      safeCall('gameplayStop', () => getSdk()?.game.gameplayStop());
    },

    happytime() {
      safeCall('happytime', () => getSdk()?.game.happytime?.());
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
              // Caller mutes/pauses around the await
            },
            adFinished: () => finish({ status: 'finished' }),
            adError: (error) => {
              const reason =
                typeof error === 'string' ? error : (error?.reason ?? 'adError');
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
          // local fallback only
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
