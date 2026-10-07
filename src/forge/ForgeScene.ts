import { Application, Assets, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { GameState } from '../sim/types';
import type { StationId } from '../data/stations';

/** Served from `public/art/` — painted cavern backdrop */
const FORGE_BG_URL = `${import.meta.env.BASE_URL}art/forge-bg.jpg`;

const COLORS = {
  void: 0x0b1c22,
  teal: 0x163a44,
  tealLight: 0x1f4d5a,
  stone: 0x0f2a32,
  ember: 0xe85d04,
  amber: 0xf48c06,
  cyan: 0x2ec4b6,
  mist: 0xe8f1f2,
  slate: 0x8fa8b0,
};

export class ForgeScene {
  readonly app: Application;
  private root = new Container();
  private bgSprite: Sprite | null = null;
  private vignette = new Graphics();
  private hearth = new Graphics();
  private vein = new Graphics();
  private stationsGfx = new Graphics();
  private particles = new Graphics();
  private scout = new Graphics();
  private brand!: Text;
  private sparkTimer = 0;
  private pulse = 0;
  private craftBurstT = 0;
  private expeditionReturnT = 0;
  private width = 800;
  private height = 600;
  private state: GameState | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.app = new Application();
    this.initPromise = this.app.init({
      canvas,
      background: COLORS.void,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      resizeTo: canvas.parentElement ?? window,
    });
  }

  readonly initPromise: Promise<void>;

  async ready() {
    await this.initPromise;

    let texture: Texture | null = null;
    try {
      texture = await Assets.load(FORGE_BG_URL);
    } catch {
      texture = null;
    }

    this.app.stage.addChild(this.root);

    if (texture) {
      this.bgSprite = new Sprite(texture);
      this.bgSprite.alpha = 0.95;
      this.root.addChild(this.bgSprite);
    }

    this.root.addChild(this.vignette);
    this.root.addChild(this.stationsGfx);
    this.root.addChild(this.hearth);
    this.root.addChild(this.vein);
    this.root.addChild(this.scout);
    this.root.addChild(this.particles);

    this.brand = new Text({
      text: 'Embervein',
      style: {
        fontFamily: 'Fraunces, Georgia, serif',
        fontSize: 40,
        fill: COLORS.mist,
        fontWeight: '600',
        letterSpacing: 1.5,
        dropShadow: {
          color: 0x0b1c22,
          blur: 8,
          distance: 2,
          alpha: 0.75,
        },
      },
    });
    this.brand.alpha = 0.96;
    this.root.addChild(this.brand);

    this.app.ticker.add((ticker) => this.update(ticker.deltaMS / 1000));
    this.resize();
  }

  resize() {
    const parent = this.app.canvas.parentElement;
    this.width = parent?.clientWidth || window.innerWidth;
    this.height = parent?.clientHeight || window.innerHeight;
    this.app.renderer.resize(this.width, this.height);
    this.brand.x = 22;
    this.brand.y = 16;
    this.brand.style.fontSize = this.width < 520 ? 26 : 40;
    this.layoutBackground();
    this.drawVignette();
    this.redrawStations();
  }

  sync(state: GameState) {
    this.state = state;
    this.redrawStations();
  }

  triggerCraftBurst() {
    this.craftBurstT = 0.45;
  }

  triggerExpeditionReturn() {
    this.expeditionReturnT = 1.2;
  }

  destroy() {
    this.app.destroy(true);
  }

  private layoutBackground() {
    if (!this.bgSprite) return;
    const tex = this.bgSprite.texture;
    const scale = Math.max(this.width / tex.width, this.height / tex.height);
    this.bgSprite.scale.set(scale);
    this.bgSprite.x = (this.width - tex.width * scale) / 2;
    this.bgSprite.y = (this.height - tex.height * scale) / 2;
  }

  private drawVignette() {
    const g = this.vignette;
    g.clear();
    // Soft top/bottom scrims so HUD stays readable over art
    g.rect(0, 0, this.width, this.height * 0.22);
    g.fill({ color: COLORS.void, alpha: 0.45 });
    g.rect(0, this.height * 0.72, this.width, this.height * 0.28);
    g.fill({ color: COLORS.void, alpha: 0.55 });
  }

  private update(dt: number) {
    this.pulse += dt;
    this.sparkTimer += dt;
    this.redrawHearth();
    this.redrawVeinHighlight();
    this.redrawParticles();

    if (this.craftBurstT > 0) {
      this.craftBurstT = Math.max(0, this.craftBurstT - dt);
    }
    if (this.expeditionReturnT > 0) {
      this.expeditionReturnT = Math.max(0, this.expeditionReturnT - dt);
      this.redrawScout();
    } else {
      this.scout.clear();
    }
  }

  private redrawHearth() {
    const g = this.hearth;
    g.clear();
    const cx = this.width * 0.5;
    const cy = this.height * 0.58;
    const breath = 1 + Math.sin(this.pulse * 2.2) * 0.1;

    // Accent glow layered on painted hearth
    g.circle(cx, cy, 70 * breath);
    g.fill({ color: COLORS.ember, alpha: 0.14 });
    g.circle(cx, cy, 38 * breath);
    g.fill({ color: COLORS.amber, alpha: 0.22 });

    const cosmetic = this.state?.activeCosmetic ?? 'default';
    if (cosmetic !== 'default') {
      const tint = cosmetic === 'cyan_hearth' ? COLORS.cyan : COLORS.ember;
      g.star(cx, cy - 62, 5, 12, 5, this.pulse);
      g.fill({ color: tint, alpha: 0.9 });
    }
  }

  private redrawVeinHighlight() {
    const g = this.vein;
    g.clear();
    // Soft tap-target pulse over painted ore seam — keep subtle so art stays hero
    const x = this.width * 0.28;
    const y = this.height * 0.55;
    const shimmer = 0.08 + Math.sin(this.pulse * 2.8) * 0.05;
    g.circle(x, y, 36 + Math.sin(this.pulse * 2.2) * 4);
    g.fill({ color: COLORS.cyan, alpha: shimmer });
  }

  private redrawStations() {
    const g = this.stationsGfx;
    g.clear();
    if (!this.state) return;

    const layout: { id: StationId; x: number; y: number }[] = [
      { id: 'smelter', x: this.width * 0.7, y: this.height * 0.48 },
      { id: 'anvil', x: this.width * 0.8, y: this.height * 0.56 },
      { id: 'enchanter', x: this.width * 0.62, y: this.height * 0.42 },
    ];

    for (const slot of layout) {
      const st = this.state.stations[slot.id];
      if (!st.unlocked) continue;
      const glow = slot.id === 'enchanter' ? COLORS.cyan : COLORS.ember;
      g.circle(slot.x, slot.y, 10);
      g.fill({ color: glow, alpha: 0.55 });
      g.circle(slot.x, slot.y, 4);
      g.fill({ color: COLORS.mist, alpha: 0.7 });
    }
  }

  private redrawParticles() {
    const g = this.particles;
    g.clear();
    const cx = this.width * 0.5;
    const cy = this.height * 0.58;

    for (let i = 0; i < 14; i++) {
      const t = this.sparkTimer * 0.75 + i * 0.35;
      const px = cx + Math.sin(t * 1.7 + i) * (18 + i * 2);
      const py = cy - ((t * 34 + i * 15) % 100);
      g.circle(px, py, 1.5 + (i % 3) * 0.4);
      g.fill({ color: i % 2 ? COLORS.amber : COLORS.ember, alpha: 0.55 });
    }

    if (this.craftBurstT > 0) {
      const p = 1 - this.craftBurstT / 0.45;
      for (let i = 0; i < 16; i++) {
        const ang = (i / 16) * Math.PI * 2;
        const r = 24 + p * 78;
        g.circle(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * 0.65, 3 * (1 - p));
        g.fill({ color: COLORS.amber, alpha: 1 - p });
      }
    }
  }

  private redrawScout() {
    const g = this.scout;
    g.clear();
    const p = 1 - this.expeditionReturnT / 1.2;
    const x = this.width * (0.92 - p * 0.38);
    const y = this.height * 0.34;
    g.moveTo(x, y);
    g.lineTo(this.width, y - 12);
    g.stroke({ width: 3, color: COLORS.cyan, alpha: 0.55 * (1 - p) });
    g.circle(x, y, 11);
    g.fill(COLORS.mist);
    g.circle(x - 7, y + 5, 5);
    g.fill(COLORS.cyan);
  }
}
