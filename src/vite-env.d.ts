/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CG_LEADERBOARD_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface CrazyGamesAdCallbacks {
  adFinished?: () => void;
  adError?: (error: { reason?: string } | string) => void;
  adStarted?: () => void;
}

interface CrazyGamesSDK {
  init: () => Promise<void>;
  game: {
    loadingStart: () => void;
    loadingStop: () => void;
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
    submitScore?: (payload: {
      encryptedScore: string;
      score: number;
    }) => Promise<unknown> | unknown;
  };
}

interface Window {
  CrazyGames?: {
    SDK: CrazyGamesSDK;
  };
}
