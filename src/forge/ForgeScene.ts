import { Application, Container, Graphics, Text } from 'pixi.js';
import type { GameState } from '../sim/types';
import type { StationId } from '../data/stations';

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
  private cavern = new Graphics();
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
    this.app.stage.addChild(this.root);
    this.root.addChild(this.cavern);
    this.root.addChild(this.stationsGfx);
    this.root.addChild(this.hearth);
    this.root.addChild(this.vein);
    this.root.addChild(this.scout);
    this.root.addChild(this.particles);

    this.brand = new Text({
      text: 'Embervein',
      style: {
        fontFamily: 'Fraunces, Georgia, serif',
        fontSize: 42,
        fill: COLORS.mist,
        fontWeight: '600',
        letterSpacing: 1,
      },
    });
    this.brand.alpha = 0.92;
    this.root.addChild(this.brand);

    this.app.ticker.add((ticker) => this.update(ticker.deltaMS / 1000));
    this.resize();
  }

  resize() {
    const parent = this.app.canvas.parentElement;
    this.width = parent?.clientWidth || window.innerWidth;
    this.height = parent?.clientHeight || window.innerHeight;
    this.app.renderer.resize(this.width, this.height);
    this.brand.x = 24;
    this.brand.y = 18;
    if (this.width < 520) {
      this.brand.style.fontSize = 28;
    } else {
      this.brand.style.fontSize = 42;
    }
    this.redrawStatic();
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

  private update(dt: number) {
    this.pulse += dt;
    this.sparkTimer += dt;
    this.redrawHearth();
    this.redrawVein();
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

  private redrawStatic() {
    const g = this.cavern;
    g.clear();
    const w = this.width;
    const h = this.height;

    g.rect(0, 0, w, h);
    g.fill(COLORS.void);

    // Back wall wash
    g.ellipse(w * 0.5, h * 0.15, w * 0.75, h * 0.35);
    g.fill({ color: COLORS.teal, alpha: 0.55 });

    // Ceiling ribs
    for (let i = 0; i < 7; i++) {
      const x0 = (w / 7) * i;
      g.moveTo(x0, 0);
      g.quadraticCurveTo(x0 + w / 14, h * 0.18, x0 + w / 7, 0);
      g.fill({ color: COLORS.stone, alpha: 0.9 });
    }

    // Side pillars
    g.roundRect(-20, h * 0.2, w * 0.12, h * 0.6, 18);
    g.fill({ color: COLORS.tealLight, alpha: 0.55 });
    g.roundRect(w * 0.9, h * 0.22, w * 0.14, h * 0.58, 18);
    g.fill({ color: COLORS.tealLight, alpha: 0.55 });

    // Cyan mineral seams
    for (let i = 0; i < 6; i++) {
      const x = w * (0.14 + i * 0.14);
      g.moveTo(x, h * 0.22);
      g.quadraticCurveTo(x + 28, h * 0.4, x - 12, h * 0.58);
      g.stroke({ width: 2 + (i % 3), color: COLORS.cyan, alpha: 0.28 + (i % 2) * 0.1 });
    }

    // Floor ledge
    g.moveTo(0, h * 0.7);
    g.quadraticCurveTo(w * 0.5, h * 0.64, w, h * 0.72);
    g.lineTo(w, h);
    g.lineTo(0, h);
    g.closePath();
    g.fill(COLORS.teal);

    // Floor highlight
    g.ellipse(w * 0.5, h * 0.78, w * 0.28, h * 0.05);
    g.fill({ color: COLORS.ember, alpha: 0.12 });

    this.redrawStations();
  }

  private redrawHearth() {
    const g = this.hearth;
    g.clear();
    const cx = this.width * 0.5;
    const cy = this.height * 0.6;
    const breath = 1 + Math.sin(this.pulse * 2.2) * 0.1;

    g.roundRect(cx - 78, cy + 26, 156, 42, 10);
    g.fill(COLORS.stone);
    g.roundRect(cx - 64, cy + 18, 128, 28, 8);
    g.fill(COLORS.tealLight);

    g.circle(cx, cy, 62 * breath);
    g.fill({ color: COLORS.ember, alpha: 0.18 });
    g.circle(cx, cy, 40 * breath);
    g.fill({ color: COLORS.ember, alpha: 0.4 });
    g.circle(cx, cy, 24 * breath);
    g.fill({ color: COLORS.amber, alpha: 0.75 });
    g.circle(cx, cy - 4, 11);
    g.fill({ color: COLORS.mist, alpha: 0.85 });

    const cosmetic = this.state?.activeCosmetic ?? 'default';
    if (cosmetic !== 'default') {
      const tint = cosmetic === 'cyan_hearth' ? COLORS.cyan : COLORS.ember;
      g.star(cx, cy - 58, 5, 14, 6, this.pulse);
      g.fill(tint);
    }
  }

  private redrawVein() {
    const g = this.vein;
    g.clear();
    const x = this.width * 0.2;
    const y = this.height * 0.54;
    const shimmer = 0.5 + Math.sin(this.pulse * 3.1) * 0.2;

    g.ellipse(x, y + 18, 70, 28);
    g.fill({ color: COLORS.stone, alpha: 0.8 });
    g.ellipse(x, y, 58, 74);
    g.fill(COLORS.tealLight);
    g.ellipse(x - 10, y - 14, 20, 32);
    g.fill({ color: COLORS.cyan, alpha: shimmer });
    g.ellipse(x + 14, y + 18, 14, 22);
    g.fill({ color: COLORS.slate, alpha: 0.85 });
    g.ellipse(x + 4, y - 30, 10, 14);
    g.fill({ color: COLORS.mist, alpha: 0.35 * shimmer });
  }

  private redrawStations() {
    const g = this.stationsGfx;
    g.clear();
    if (!this.state) return;

    const layout: { id: StationId; x: number; y: number; label: string }[] = [
      { id: 'smelter', x: this.width * 0.7, y: this.height * 0.46, label: 'Smelter' },
      { id: 'anvil', x: this.width * 0.82, y: this.height * 0.56, label: 'Anvil' },
      { id: 'enchanter', x: this.width * 0.62, y: this.height * 0.38, label: 'Enchanter' },
    ];

    for (const slot of layout) {
      const st = this.state.stations[slot.id];
      const alpha = st.unlocked ? 1 : 0.28;
      g.roundRect(slot.x - 40, slot.y - 30, 80, 62, 12);
      g.fill({ color: COLORS.stone, alpha: 0.75 * alpha });
      g.roundRect(slot.x - 34, slot.y - 24, 68, 50, 10);
      g.fill({ color: COLORS.tealLight, alpha: 0.85 * alpha });
      const glow = slot.id === 'enchanter' ? COLORS.cyan : COLORS.ember;
      g.circle(slot.x, slot.y, st.unlocked ? 16 : 9);
      g.fill({ color: glow, alpha: st.unlocked ? 0.95 : 0.35 });
      if (st.unlocked && st.level > 1) {
        g.circle(slot.x + 26, slot.y - 20, 7);
        g.fill({ color: COLORS.amber, alpha: 0.95 });
      }
    }
  }

  private redrawParticles() {
    const g = this.particles;
    g.clear();
    const cx = this.width * 0.5;
    const cy = this.height * 0.6;

    for (let i = 0; i < 16; i++) {
      const t = this.sparkTimer * 0.75 + i * 0.35;
      const px = cx + Math.sin(t * 1.7 + i) * (22 + i * 2.2);
      const py = cy - ((t * 34 + i * 15) % 110);
      g.circle(px, py, 1.6 + (i % 3) * 0.5);
      g.fill({ color: i % 2 ? COLORS.amber : COLORS.ember, alpha: 0.6 });
    }

    // Soft cyan motes near vein
    const vx = this.width * 0.2;
    const vy = this.height * 0.54;
    for (let i = 0; i < 6; i++) {
      const t = this.sparkTimer * 0.4 + i;
      g.circle(vx + Math.sin(t) * 24, vy - 40 - ((t * 20) % 50), 2);
      g.fill({ color: COLORS.cyan, alpha: 0.35 });
    }

    if (this.craftBurstT > 0) {
      const p = 1 - this.craftBurstT / 0.45;
      for (let i = 0; i < 18; i++) {
        const ang = (i / 18) * Math.PI * 2;
        const r = 24 + p * 80;
        g.circle(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * 0.65, 3.2 * (1 - p));
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
