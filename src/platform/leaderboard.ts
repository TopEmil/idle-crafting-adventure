/**
 * CrazyGames client leaderboard helpers.
 * Rankings render on the CrazyGames portal (weekly season); the game only submits scores.
 *
 * Portal config (invite-only feature) should match LEADERBOARD_CONFIG below.
 * @see https://docs.crazygames.com/sdk/leaderboards-client/
 */

/** 32-byte key as base64 — must match Developer Portal / CrazyGames admin config. */
export const LEADERBOARD_ENCRYPTION_KEY =
  import.meta.env.VITE_CG_LEADERBOARD_KEY ||
  'PdDXstLKxiBgC6uSparNEyaKsSGs+HItmMa/+MsHma4=';

/** Suggested portal settings for Embervein “most ore mined” weekly board. */
export const LEADERBOARD_CONFIG = {
  scoreLabel: 'POINTS' as const,
  scoreSorting: 'DESC' as const,
  minValue: 0,
  /** Idle totals grow large; keep headroom for a long season. */
  maxValue: 1_000_000_000_000,
  cooldownSeconds: 60,
  isIncremental: true,
  /** Shown on CrazyGames — max 50 chars. */
  guide: 'Mine the most ore this week',
} as const;

export async function encryptScore(
  score: number,
  encryptionKey: string = LEADERBOARD_ENCRYPTION_KEY,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const algorithm: AesGcmParams = { name: 'AES-GCM', iv };

  const keyBytes = Uint8Array.from(atob(encryptionKey), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, algorithm, false, [
    'encrypt',
  ]);

  const dataBuffer = new TextEncoder().encode(String(score));
  const encryptedBuffer = await crypto.subtle.encrypt(algorithm, cryptoKey, dataBuffer);

  const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encryptedBuffer), iv.length);

  let binary = '';
  for (let i = 0; i < combined.length; i++) {
    binary += String.fromCharCode(combined[i]!);
  }
  return btoa(binary);
}

export type SubmitScoreResult =
  | { status: 'submitted'; score: number }
  | { status: 'skipped'; reason: string }
  | { status: 'error'; reason: string };

export interface LeaderboardUserApi {
  submitScore?: (payload: {
    encryptedScore: string;
    score: number;
  }) => Promise<unknown> | unknown;
}

export async function submitEncryptedScore(
  userApi: LeaderboardUserApi | null | undefined,
  score: number,
  encryptionKey: string = LEADERBOARD_ENCRYPTION_KEY,
): Promise<SubmitScoreResult> {
  if (!userApi?.submitScore) {
    return { status: 'skipped', reason: 'sdk_unavailable' };
  }
  if (!Number.isFinite(score) || score < 0) {
    return { status: 'skipped', reason: 'invalid_score' };
  }
  if (!encryptionKey) {
    return { status: 'skipped', reason: 'missing_key' };
  }

  try {
    const encryptedScore = await encryptScore(score, encryptionKey);
    await Promise.resolve(
      userApi.submitScore({
        encryptedScore,
        score,
      }),
    );
    return { status: 'submitted', score };
  } catch (err) {
    return {
      status: 'error',
      reason: err instanceof Error ? err.message : 'submit_failed',
    };
  }
}
