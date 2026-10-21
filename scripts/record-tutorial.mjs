/**
 * Drive a fresh-save tutorial playthrough and record video + step screenshots.
 * Usage: node scripts/record-tutorial.mjs
 */
import { chromium } from 'playwright';
import { mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const BASE = process.env.GAME_URL ?? 'http://127.0.0.1:5173/';
const OUT = process.env.ARTIFACT_DIR ?? '/opt/cursor/artifacts';
const VIEW = { width: 1280, height: 800 };

async function waitCoach(page, text) {
  await page.locator('.onboarding-coach-card').filter({ hasText: text }).waitFor({
    timeout: 45_000,
  });
}

async function digUntil(page, predicate, label) {
  for (let i = 0; i < 500; i++) {
    if (await predicate()) return;
    await page.locator('#btn-vein').click({ force: true });
    if (i % 8 === 0) await page.waitForTimeout(30);
  }
  throw new Error(`Timed out while digging for: ${label}`);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const videoDir = path.join(OUT, 'tutorial-video-raw');
  await mkdir(videoDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({
    viewport: VIEW,
    recordVideo: { dir: videoDir, size: VIEW },
  });
  const page = await context.newPage();

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#btn-vein', { timeout: 30_000 });
  await waitCoach(page, 'Step 1');
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, 'tutorial_step1_dig.png') });

  await digUntil(
    page,
    async () => {
      const text = (await page.locator('.onboarding-coach-card').textContent()) ?? '';
      return /Step 2/i.test(text);
    },
    'Step 2',
  );
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(OUT, 'tutorial_step2_craft.png') });

  await page.locator('#btn-craft').click({ force: true });
  await waitCoach(page, 'Step 3');
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(OUT, 'tutorial_step3_gather_smelter.png') });

  // Stay on Mine until Smelter is affordable, then Stations opens automatically.
  await digUntil(
    page,
    async () => {
      const unlock = page.locator('[data-unlock="smelter"]');
      return (await unlock.count()) > 0 && !(await unlock.isDisabled());
    },
    'affordable Smelter unlock',
  );
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(OUT, 'tutorial_step3_smelter_ready.png') });

  await page.locator('[data-unlock="smelter"]').click({ force: true });
  await waitCoach(page, 'Step 4');
  await page.waitForTimeout(550);
  await page.screenshot({ path: path.join(OUT, 'tutorial_step4_reforge.png') });

  await page.locator('#btn-prestige').click({ force: true });
  await page.locator('#prestige-yes').waitFor({ timeout: 10_000 });
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(OUT, 'tutorial_reforge_confirm.png') });
  await page.locator('#prestige-yes').click({ force: true });
  await page.locator('#ms-ok').waitFor({ timeout: 15_000 });
  const finale = (await page.locator('.modal').textContent()) ?? '';
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, 'tutorial_first_reforge_done.png') });
  await page.locator('#ms-ok').click({ force: true });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, 'tutorial_after_complete.png') });

  const videoPath = await page.video()?.path();
  await context.close();
  await browser.close();
  if (!videoPath) throw new Error('No Playwright video produced');

  const webm = path.join(OUT, 'tutorial_dig_to_first_reforge.webm');
  const mp4 = path.join(OUT, 'tutorial_dig_to_first_reforge.mp4');
  await copyFile(videoPath, webm);
  const ff = spawnSync(
    'ffmpeg',
    ['-y', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', mp4],
    { encoding: 'utf8' },
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        finaleIncludesFirstReforge: /First Reforge|Tutorial complete/i.test(finale),
        finaleSnippet: finale.replace(/\s+/g, ' ').trim().slice(0, 180),
        webm,
        mp4: ff.status === 0 ? mp4 : null,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
