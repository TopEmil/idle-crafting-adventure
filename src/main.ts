import './styles/main.css';
import { GameApp } from './game/GameApp';

async function boot() {
  const canvas = document.querySelector<HTMLCanvasElement>('#forge-canvas');
  const hud = document.querySelector<HTMLElement>('#hud');
  const overlay = document.querySelector<HTMLElement>('#overlay-root');
  if (!canvas || !hud || !overlay) {
    throw new Error('Missing app roots');
  }

  const app = new GameApp(canvas, hud, overlay);
  await app.start();
}

boot().catch((err) => {
  console.error(err);
  const overlay = document.querySelector('#overlay-root');
  if (overlay) {
    overlay.innerHTML = `<div class="modal"><h2>Embervein</h2><p>Failed to start. Refresh to try again.</p></div>`;
  }
});
