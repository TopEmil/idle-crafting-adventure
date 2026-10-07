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

interface BurstParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: number;
}

interface Floater {
  text: Text;
  life: number;
  max: number;
  vy: number;
}

export class ForgeScene {
  readonly app: Application;
  private root = new Container();
  private bgSprite: Sprite | null = null;
  private vignette = new Graphics();
  private hearth = new Graphics();
  private vein = new Graphics();
  private stationsGfx = new Graphics();
  private fx = new Graphics();
  private particles = new Graphics();
  private scout = new Graphics();
  private floatLayer = new Container();
  private brand!: Text;
  private comboLabel!: Text;
  private sparkTimer = 0;
  private pulse = 0;
  private craftBurstT = 0;
  private expeditionReturnT = 0;
  private hitFlash = 0;
  private shakeT = 0;
  private combo = 0;
  private comboTimer = 0;
  private bursts: BurstParticle[] = [];
  private floaters: Floater[] = [];
  private width = 800;
  private height = 600;
  private state: GameState | null = null;
  private onVeinTap: (() => void) | null = null;
  private productionPulse = 0;

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
    this.root.addChild(this.fx);
    this.root.addChild(this.floatLayer);

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

    this.comboLabel = new Text({
      text: '',
      style: {
        fontFamily: 'DM Sans, sans-serif',
        fontSize: 13,
        fontWeight: '700',
        fill: COLORS.amber,
      },
    });
    this.comboLabel.anchor.set(0.5);
    this.comboLabel.visible = false;
    this.root.addChild(this.comboLabel);

    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;
    this.app.stage.on('pointerdown', (e) => this.handlePointer(e.global.x, e.global.y));

    this.app.ticker.add((ticker) => this.update(ticker.deltaMS / 1000));
    this.resize();
  }

  setVeinTapHandler(handler: () => void) {
    this.onVeinTap = handler;
  }

  resize() {
    const parent = this.app.canvas.parentElement;
    this.width = parent?.clientWidth || window.innerWidth;
    this.height = parent?.clientHeight || window.innerHeight;
    this.app.renderer.resize(this.width, this.height);
    this.app.stage.hitArea = this.app.screen;
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

  /** Call on successful vein tap — sparks, shockwave, floating +ore */
  triggerVeinHit(amount: number) {
    const { x, y } = this.veinPoint();
    this.hitFlash = 0.28;
    this.shakeT = 0.12;
    this.comboTimer = 0.85;
    this.combo = Math.min(12, this.combo + 1);

    const count = 10 + Math.min(10, this.combo);
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 120 + this.combo * 6;
      this.bursts.push({
        x,
        y,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed - 40,
        life: 0.35 + Math.random() * 0.35,
        max: 0.55,
        size: 2 + Math.random() * 3,
        color: Math.random() > 0.45 ? COLORS.cyan : COLORS.amber,
      });
    }

    const label = new Text({
      text: `+${trimAmount(amount)} Ore`,
      style: {
        fontFamily: 'DM Sans, sans-serif',
        fontSize: 18 + Math.min(10, this.combo),
        fontWeight: '700',
        fill: COLORS.mist,
        dropShadow: { color: 0x0b1c22, blur: 4, distance: 1, alpha: 0.8 },
      },
    });
    label.anchor.set(0.5, 1);
    label.x = x + (Math.random() * 24 - 12);
    label.y = y - 20;
    this.floatLayer.addChild(label);
    this.floaters.push({ text: label, life: 0.85, max: 0.85, vy: -48 - this.combo * 2 });
  }

  triggerCraftBurst() {
    this.craftBurstT = 0.55;
    const { x, y } = { x: this.width * 0.5, y: this.height * 0.58 };
    for (let i = 0; i < 22; i++) {
      const ang = (i / 22) * Math.PI * 2;
      this.bursts.push({
        x,
        y,
        vx: Math.cos(ang) * 160,
        vy: Math.sin(ang) * 110,
        life: 0.5,
        max: 0.5,
        size: 3,
        color: i % 2 ? COLORS.amber : COLORS.ember,
      });
    }
  }

  triggerExpeditionReturn() {
    this.expeditionReturnT = 1.2;
  }

  triggerStationPuff(stationId: StationId) {
    const layout = this.stationLayout();
    const slot = layout.find((s) => s.id === stationId);
    if (!slot) return;
    for (let i = 0; i < 4; i++) {
      this.bursts.push({
        x: slot.x,
        y: slot.y,
        vx: (Math.random() - 0.5) * 30,
        vy: -30 - Math.random() * 40,
        life: 0.6,
        max: 0.6,
        size: 2,
        color: stationId === 'enchanter' ? COLORS.cyan : COLORS.ember,
      });
    }
  }

  getCombo() {
    return this.combo;
  }

  destroy() {
    this.app.destroy(true);
  }

  private veinPoint() {
    return { x: this.width * 0.28, y: this.height * 0.55 };
  }

  private stationLayout(): { id: StationId; x: number; y: number }[] {
    return [
      { id: 'smelter', x: this.width * 0.7, y: this.height * 0.48 },
      { id: 'anvil', x: this.width * 0.8, y: this.height * 0.56 },
      { id: 'enchanter', x: this.width * 0.62, y: this.height * 0.42 },
    ];
  }

  private handlePointer(px: number, py: number) {
    if (!this.onVeinTap) return;
    const { x, y } = this.veinPoint();
    const dx = px - x;
    const dy = py - y;
    if (dx * dx + dy * dy <= 70 * 70) {
      this.onVeinTap();
    }
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
    g.rect(0, 0, this.width, this.height * 0.2);
    g.fill({ color: COLORS.void, alpha: 0.4 });
    g.rect(0, this.height * 0.74, this.width, this.height * 0.26);
    g.fill({ color: COLORS.void, alpha: 0.52 });
  }

  private update(dt: number) {
    this.pulse += dt;
    this.sparkTimer += dt;
    this.productionPulse += dt;

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (this.shakeT > 0) this.shakeT = Math.max(0, this.shakeT - dt);
    if (this.craftBurstT > 0) this.craftBurstT = Math.max(0, this.craftBurstT - dt);

    // Camera shake
    if (this.shakeT > 0) {
      const mag = 3 * (this.shakeT / 0.12);
      this.root.x = (Math.random() - 0.5) * mag;
      this.root.y = (Math.random() - 0.5) * mag;
    } else {
      this.root.x = 0;
      this.root.y = 0;
    }

    // Burst physics
    for (const p of this.bursts) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 120 * dt;
    }
    this.bursts = this.bursts.filter((p) => p.life > 0);

    for (const f of this.floaters) {
      f.life -= dt;
      f.text.y += f.vy * dt;
      f.text.alpha = Math.max(0, f.life / f.max);
    }
    for (const f of this.floaters.filter((f) => f.life <= 0)) {
      f.text.destroy();
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);

    // Ambient station puffs when producing
    if (this.state && this.productionPulse > 1.4) {
      this.productionPulse = 0;
      for (const slot of this.stationLayout()) {
        if (this.state.stations[slot.id].unlocked) {
          this.triggerStationPuff(slot.id);
        }
      }
    }

    this.redrawHearth();
    this.redrawVeinHighlight();
    this.redrawParticles();
    this.redrawFx();

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
    const boost = this.craftBurstT > 0 ? 1.15 : 1;

    g.circle(cx, cy, 70 * breath * boost);
    g.fill({ color: COLORS.ember, alpha: 0.14 });
    g.circle(cx, cy, 38 * breath * boost);
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
    const { x, y } = this.veinPoint();
    const shimmer = 0.1 + Math.sin(this.pulse * 2.8) * 0.06 + this.hitFlash * 0.55;
    const r = 38 + Math.sin(this.pulse * 2.2) * 5 + this.hitFlash * 22;
    g.circle(x, y, r);
    g.fill({ color: COLORS.cyan, alpha: shimmer });
    g.circle(x, y, r * 0.45);
    g.fill({ color: COLORS.mist, alpha: 0.08 + this.hitFlash * 0.25 });

    // Hint ring when idle (invite tap)
    if (this.combo === 0) {
      const ring = 48 + (this.pulse % 1.6) * 18;
      const a = 0.22 * (1 - (this.pulse % 1.6) / 1.6);
      g.circle(x, y, ring);
      g.stroke({ width: 2, color: COLORS.cyan, alpha: a });
    }
  }

  private redrawStations() {
    const g = this.stationsGfx;
    g.clear();
    if (!this.state) return;

    for (const slot of this.stationLayout()) {
      const st = this.state.stations[slot.id];
      if (!st.unlocked) continue;
      const glow = slot.id === 'enchanter' ? COLORS.cyan : COLORS.ember;
      const pulse = 1 + Math.sin(this.pulse * 3 + st.level) * 0.12;
      g.circle(slot.x, slot.y, 11 * pulse);
      g.fill({ color: glow, alpha: 0.5 });
      g.circle(slot.x, slot.y, 4);
      g.fill({ color: COLORS.mist, alpha: 0.75 });
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
      const p = 1 - this.craftBurstT / 0.55;
      for (let i = 0; i < 16; i++) {
        const ang = (i / 16) * Math.PI * 2;
        const r = 24 + p * 90;
        g.circle(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * 0.65, 3.2 * (1 - p));
        g.fill({ color: COLORS.amber, alpha: 1 - p });
      }
    }
  }

  private redrawFx() {
    const g = this.fx;
    g.clear();
    for (const p of this.bursts) {
      const a = Math.max(0, p.life / p.max);
      g.circle(p.x, p.y, p.size * a);
      g.fill({ color: p.color, alpha: a });
    }

    if (this.hitFlash > 0) {
      const { x, y } = this.veinPoint();
      const p = 1 - this.hitFlash / 0.28;
      g.circle(x, y, 20 + p * 55);
      g.stroke({ width: 3, color: COLORS.mist, alpha: 0.55 * (1 - p) });
    }

    if (this.combo >= 3) {
      const { x, y } = this.veinPoint();
      this.comboLabel.visible = true;
      this.comboLabel.text = `×${this.combo}`;
      this.comboLabel.x = x + 52;
      this.comboLabel.y = y - 36;
    } else {
      this.comboLabel.visible = false;
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

function trimAmount(n: number): string {
  if (n >= 100) return Math.floor(n).toString();
  const t = Math.round(n * 10) / 10;
  return t.toString().replace(/\.0$/, '');
}
