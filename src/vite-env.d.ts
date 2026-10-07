/// <reference types="vite/client" />

interface CrazyGamesAdCallbacks {
  adFinished?: () => void;
  adError?: (error: { reason?: string } | string) => void;
  adStarted?: () => void;
}

interface CrazyGamesSDK {
  init: () => Promise<void>;
  game: {
    sdkGameLoadingStart: () => void;
    sdkGameLoadingStop: () => void;
    gameplayStart: () => void;
    gameplayStop: () => void;
    happytime?: () => void;
  };
  ad: {
    requestAd: (type: 'midgame' | 'rewarded', callbacks: CrazyGamesAdCallbacks) => void;
    hasAdblock?: () => Promise<boolean>;
  };
  data?: {
    setItem: (key: string, value: string) => Promise<void>;
    getItem: (key: string) => Promise<string | null>;
    removeItem?: (key: string) => Promise<void>;
  };
  user?: {
    systemInfo?: {
      countryCode?: string;
    };
  };
}

interface Window {
  CrazyGames?: {
    SDK: CrazyGamesSDK;
  };
}
