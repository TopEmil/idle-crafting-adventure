import { Application, Container, Graphics, Text } from 'pixi.js';
import type { GameState } from '../sim/types';
import type { StationId } from '../data/stations';

const COLORS = {
  void: 0x0b1c22,
  teal: 0x163a44,
  tealLight: 0x1f4d5a,
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

    // Deep cavern wash
    g.rect(0, 0, this.width, this.height);
    g.fill(COLORS.void);

    // Stone arches
    g.moveTo(0, this.height * 0.2);
    g.quadraticCurveTo(this.width * 0.25, this.height * 0.05, this.width * 0.5, this.height * 0.18);
    g.quadraticCurveTo(this.width * 0.75, this.height * 0.05, this.width, this.height * 0.22);
    g.lineTo(this.width, 0);
    g.lineTo(0, 0);
    g.closePath();
    g.fill({ color: COLORS.teal, alpha: 0.85 });

    // Floor
    g.moveTo(0, this.height * 0.72);
    g.quadraticCurveTo(this.width * 0.5, this.height * 0.68, this.width, this.height * 0.74);
    g.lineTo(this.width, this.height);
    g.lineTo(0, this.height);
    g.closePath();
    g.fill(COLORS.teal);

    // Cyan mineral veins in walls
    for (let i = 0; i < 5; i++) {
      const x = this.width * (0.1 + i * 0.18);
      g.moveTo(x, this.height * 0.25);
      g.quadraticCurveTo(x + 20, this.height * 0.4, x - 10, this.height * 0.55);
      g.stroke({ width: 2 + (i % 2), color: COLORS.cyan, alpha: 0.35 });
    }

    this.redrawStations();
  }

  private redrawHearth() {
    const g = this.hearth;
    g.clear();
    const cx = this.width * 0.5;
    const cy = this.height * 0.62;
    const breath = 1 + Math.sin(this.pulse * 2.2) * 0.08;

    // Pedestal
    g.roundRect(cx - 70, cy + 20, 140, 36, 8);
    g.fill(COLORS.tealLight);

    // Ember core pulse
    g.circle(cx, cy, 48 * breath);
    g.fill({ color: COLORS.ember, alpha: 0.25 });
    g.circle(cx, cy, 28 * breath);
    g.fill({ color: COLORS.amber, alpha: 0.55 });
    g.circle(cx, cy - 6, 14);
    g.fill({ color: COLORS.mist, alpha: 0.7 });

    const cosmetic = this.state?.activeCosmetic ?? 'default';
    if (cosmetic !== 'default') {
      g.circle(cx, cy - 55, 10);
      g.fill(cosmetic === 'cyan_hearth' ? COLORS.cyan : COLORS.ember);
    }
  }

  private redrawVein() {
    const g = this.vein;
    g.clear();
    const x = this.width * 0.18;
    const y = this.height * 0.55;
    const shimmer = 0.45 + Math.sin(this.pulse * 3) * 0.15;

    g.ellipse(x, y, 54, 70);
    g.fill({ color: COLORS.tealLight, alpha: 0.95 });
    g.ellipse(x - 8, y - 10, 18, 28);
    g.fill({ color: COLORS.cyan, alpha: shimmer });
    g.ellipse(x + 12, y + 16, 12, 18);
    g.fill({ color: COLORS.slate, alpha: 0.8 });
  }

  private redrawStations() {
    const g = this.stationsGfx;
    g.clear();
    if (!this.state) return;

    const layout: { id: StationId; x: number; y: number }[] = [
      { id: 'smelter', x: this.width * 0.72, y: this.height * 0.48 },
      { id: 'anvil', x: this.width * 0.82, y: this.height * 0.58 },
      { id: 'enchanter', x: this.width * 0.64, y: this.height * 0.4 },
    ];

    for (const slot of layout) {
      const st = this.state.stations[slot.id];
      const alpha = st.unlocked ? 1 : 0.25;
      g.roundRect(slot.x - 36, slot.y - 28, 72, 56, 10);
      g.fill({ color: COLORS.tealLight, alpha: 0.7 * alpha });
      g.circle(slot.x, slot.y, st.unlocked ? 14 : 8);
      g.fill({
        color: slot.id === 'enchanter' ? COLORS.cyan : COLORS.ember,
        alpha: st.unlocked ? 0.9 : 0.3,
      });
      if (st.unlocked && st.level > 1) {
        g.circle(slot.x + 22, slot.y - 18, 6);
        g.fill({ color: COLORS.amber, alpha: 0.9 });
      }
    }
  }

  private redrawParticles() {
    const g = this.particles;
    g.clear();
    const cx = this.width * 0.5;
    const cy = this.height * 0.62;

    // Continuous ember sparks
    for (let i = 0; i < 12; i++) {
      const t = this.sparkTimer * 0.7 + i * 0.4;
      const px = cx + Math.sin(t * 1.7 + i) * (20 + i * 2);
      const py = cy - ((t * 30 + i * 13) % 90);
      g.circle(px, py, 1.5 + (i % 3) * 0.4);
      g.fill({ color: i % 2 ? COLORS.amber : COLORS.ember, alpha: 0.55 });
    }

    if (this.craftBurstT > 0) {
      const p = 1 - this.craftBurstT / 0.45;
      for (let i = 0; i < 16; i++) {
        const ang = (i / 16) * Math.PI * 2;
        const r = 20 + p * 70;
        g.circle(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * 0.7, 3 * (1 - p));
        g.fill({ color: COLORS.amber, alpha: 1 - p });
      }
    }
  }

  private redrawScout() {
    const g = this.scout;
    g.clear();
    const p = 1 - this.expeditionReturnT / 1.2;
    const x = this.width * (0.9 - p * 0.35);
    const y = this.height * 0.36;
    g.moveTo(x, y);
    g.lineTo(this.width, y - 10);
    g.stroke({ width: 3, color: COLORS.cyan, alpha: 0.5 * (1 - p) });
    g.circle(x, y, 10);
    g.fill(COLORS.mist);
    g.circle(x - 6, y + 4, 5);
    g.fill(COLORS.cyan);
  }
}
