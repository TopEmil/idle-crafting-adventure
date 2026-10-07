import { describe, expect, it } from 'vitest';
import { encryptScore, submitEncryptedScore } from './leaderboard';

describe('leaderboard encrypt / submit', () => {
  it('encrypts a score into non-empty base64 distinct from plaintext', async () => {
    const key = 'PdDXstLKxiBgC6uSparNEyaKsSGs+HItmMa/+MsHma4=';
    const a = await encryptScore(1234, key);
    const b = await encryptScore(1234, key);
    expect(a).not.toBe('1234');
    expect(a).not.toBe(b); // random IV
    expect(() => atob(a)).not.toThrow();
  });

  it('submits encrypted + plain score through the user API', async () => {
    const calls: Array<{ encryptedScore: string; score: number }> = [];
    const submitScore = async (payload: { encryptedScore: string; score: number }) => {
      calls.push(payload);
      return true;
    };
    const result = await submitEncryptedScore(
      { submitScore },
      500,
      'PdDXstLKxiBgC6uSparNEyaKsSGs+HItmMa/+MsHma4=',
    );
    expect(result).toEqual({ status: 'submitted', score: 500 });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.score).toBe(500);
    expect(calls[0]?.encryptedScore.length).toBeGreaterThan(10);
  });

  it('skips when SDK user API is missing', async () => {
    const result = await submitEncryptedScore(null, 10);
    expect(result.status).toBe('skipped');
  });
});
