import { Application, Assets, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { GameState } from '../sim/types';
import { getStation, STATIONS, type StationId } from '../data/stations';
import type { ResourceId } from '../data/resources';
import { FORGE_STATION_SLOTS, type SceneView } from './sceneView';

/** Mine cavern + forge workshop hall */
const MINE_BG_URL = `${import.meta.env.BASE_URL}art/forge-bg.jpg`;
const FORGE_BG_URL = `${import.meta.env.BASE_URL}art/forge-hall-bg.jpg`;
const STATION_ART: Record<StationId, string> = {
  smelter: `${import.meta.env.BASE_URL}art/stations/smelter.png`,
  anvil: `${import.meta.env.BASE_URL}art/stations/anvil.png`,
  enchanter: `${import.meta.env.BASE_URL}art/stations/enchanter.png`,
};

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
  private mineLayer = new Container();
  private forgeLayer = new Container();
  private mineBg: Sprite | null = null;
  private forgeBg: Sprite | null = null;
  private vignette = new Graphics();
  private hearth = new Graphics();
  private vein = new Graphics();
  private stationsGfx = new Graphics();
  private stationSpritesRoot = new Container();
  private stationLabels = new Container();
  private fx = new Graphics();
  private particles = new Graphics();
  private scout = new Graphics();
  private floatLayer = new Container();
  private brand!: Text;
  private comboLabel!: Text;
  private labelByStation = new Map<StationId, Text>();
  private spriteByStation = new Map<StationId, Sprite>();
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
  private spawnAnim: Partial<Record<StationId, number>> = {};
  private width = 800;
  private height = 600;
  private state: GameState | null = null;
  private onVeinTap: (() => void) | null = null;
  private productionPulse = 0;
  private view: SceneView = 'mine';
  private viewFade = 1;

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

    const [mineTex, forgeTex] = await Promise.all([
      this.loadTexture(MINE_BG_URL),
      this.loadTexture(FORGE_BG_URL),
    ]);

    this.app.stage.addChild(this.root);

    if (mineTex) {
      this.mineBg = new Sprite(mineTex);
      this.mineBg.alpha = 0.95;
      this.mineLayer.addChild(this.mineBg);
    }
    if (forgeTex) {
      this.forgeBg = new Sprite(forgeTex);
      this.forgeBg.alpha = 0.95;
      this.forgeLayer.addChild(this.forgeBg);
    }

    this.mineLayer.addChild(this.hearth);
    this.mineLayer.addChild(this.vein);

    this.forgeLayer.addChild(this.stationsGfx);
    this.forgeLayer.addChild(this.stationSpritesRoot);
    this.forgeLayer.addChild(this.stationLabels);

    this.root.addChild(this.mineLayer);
    this.root.addChild(this.forgeLayer);
    this.root.addChild(this.vignette);
    this.root.addChild(this.scout);
    this.root.addChild(this.particles);
    this.root.addChild(this.fx);
    this.root.addChild(this.floatLayer);

    await this.loadStationArt();

    for (const def of STATIONS) {
      const label = new Text({
        text: def.name,
        style: {
          fontFamily: 'DM Sans, sans-serif',
          fontSize: 11,
          fontWeight: '700',
          fill: COLORS.mist,
          dropShadow: { color: 0x0b1c22, blur: 3, distance: 1, alpha: 0.85 },
        },
      });
      label.anchor.set(0.5, 0);
      label.visible = false;
      this.labelByStation.set(def.id, label);
      this.stationLabels.addChild(label);
    }

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
    this.mineLayer.alpha = 1;
    this.forgeLayer.alpha = 0;
    this.applyViewEventModes();
    this.resize();
  }

  setVeinTapHandler(handler: () => void) {
    this.onVeinTap = handler;
  }

  getView(): SceneView {
    return this.view;
  }

  setView(view: SceneView) {
    if (this.view === view) return;
    this.view = view;
    this.viewFade = 0;
    this.applyViewEventModes();
    this.redrawStations();
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
    this.layoutBackground(this.mineBg);
    this.layoutBackground(this.forgeBg);
    this.drawVignette();
    this.redrawStations();
  }

  sync(state: GameState) {
    this.state = state;
    this.redrawStations();
  }

  /** Call on successful vein tap — sparks, shockwave, floating +ore */
  triggerVeinHit(amount: number) {
    if (this.view !== 'mine') this.setView('mine');
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
    const { x, y } =
      this.view === 'forge'
        ? { x: this.width * 0.5, y: this.height * 0.48 }
        : { x: this.width * 0.5, y: this.height * 0.58 };
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
    if (this.view !== 'forge') return;
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

  /** Pop-in animation when a station is purchased */
  triggerStationUnlock(stationId: StationId) {
    this.setView('forge');
    this.spawnAnim[stationId] = 0.7;
    const slot = this.stationLayout().find((s) => s.id === stationId);
    if (!slot) return;
    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * Math.PI * 2;
      this.bursts.push({
        x: slot.x,
        y: slot.y,
        vx: Math.cos(ang) * 90,
        vy: Math.sin(ang) * 70,
        life: 0.55,
        max: 0.55,
        size: 3,
        color: getStation(stationId).visualTint,
      });
    }
    const name = getStation(stationId).name;
    const label = new Text({
      text: `${name} online`,
      style: {
        fontFamily: 'Fraunces, Georgia, serif',
        fontSize: 16,
        fontWeight: '600',
        fill: COLORS.amber,
        dropShadow: { color: 0x0b1c22, blur: 4, distance: 1, alpha: 0.85 },
      },
    });
    label.anchor.set(0.5, 1);
    label.x = slot.x;
    label.y = slot.y - 36;
    this.floatLayer.addChild(label);
    this.floaters.push({ text: label, life: 1.2, max: 1.2, vy: -36 });
  }

  getCombo() {
    return this.combo;
  }

  destroy() {
    this.app.destroy(true);
  }

  private async loadTexture(url: string): Promise<Texture | null> {
    try {
      return await Assets.load(url);
    } catch {
      return null;
    }
  }

  private applyViewEventModes() {
    const forge = this.view === 'forge';
    this.forgeLayer.visible = true;
    this.mineLayer.visible = true;
    this.forgeLayer.eventMode = forge ? 'passive' : 'none';
    this.mineLayer.eventMode = forge ? 'none' : 'passive';
  }

  private veinPoint() {
    return { x: this.width * 0.28, y: this.height * 0.55 };
  }

  private stationLayout(): { id: StationId; x: number; y: number }[] {
    return (Object.keys(FORGE_STATION_SLOTS) as StationId[]).map((id) => ({
      id,
      x: this.width * FORGE_STATION_SLOTS[id].x,
      y: this.height * FORGE_STATION_SLOTS[id].y,
    }));
  }

  private handlePointer(px: number, py: number) {
    if (this.view !== 'mine' || !this.onVeinTap) return;
    const { x, y } = this.veinPoint();
    const dx = px - x;
    const dy = py - y;
    if (dx * dx + dy * dy <= 70 * 70) {
      this.onVeinTap();
    }
  }

  private layoutBackground(sprite: Sprite | null) {
    if (!sprite) return;
    const tex = sprite.texture;
    // Slight zoom keeps pedestals in the playable mid-band above the HUD.
    const cover = Math.max(this.width / tex.width, this.height / tex.height);
    const scale = cover * (sprite === this.forgeBg ? 1.08 : 1);
    sprite.scale.set(scale);
    sprite.x = (this.width - tex.width * scale) / 2;
    if (sprite === this.forgeBg) {
      // Bias upward so the pedestal band sits above the bottom dock.
      const rawY = (this.height - tex.height * scale) / 2;
      sprite.y = Math.min(-this.height * 0.02, rawY + this.height * 0.04);
    } else {
      sprite.y = (this.height - tex.height * scale) / 2;
    }
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

    if (this.viewFade < 1) {
      this.viewFade = Math.min(1, this.viewFade + dt * 4.5);
      const t = this.viewFade;
      if (this.view === 'forge') {
        this.forgeLayer.alpha = t;
        this.mineLayer.alpha = 1 - t;
      } else {
        this.mineLayer.alpha = t;
        this.forgeLayer.alpha = 1 - t;
      }
    }

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (this.shakeT > 0) this.shakeT = Math.max(0, this.shakeT - dt);
    if (this.craftBurstT > 0) this.craftBurstT = Math.max(0, this.craftBurstT - dt);

    if (this.shakeT > 0) {
      const mag = 3 * (this.shakeT / 0.12);
      this.root.x = (Math.random() - 0.5) * mag;
      this.root.y = (Math.random() - 0.5) * mag;
    } else {
      this.root.x = 0;
      this.root.y = 0;
    }

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

    for (const id of Object.keys(this.spawnAnim) as StationId[]) {
      const t = this.spawnAnim[id];
      if (t == null) continue;
      this.spawnAnim[id] = t - dt;
      if ((this.spawnAnim[id] ?? 0) <= 0) delete this.spawnAnim[id];
    }

    if (this.view === 'forge' && this.state && this.productionPulse > 0.9) {
      this.productionPulse = 0;
      for (const slot of this.stationLayout()) {
        if (this.isStationRunning(slot.id)) {
          this.triggerStationPuff(slot.id);
        }
      }
    }

    if (this.view === 'mine') {
      this.redrawHearth();
      this.redrawVeinHighlight();
    } else {
      this.hearth.clear();
      this.vein.clear();
    }
    this.redrawStations();
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

    if (this.combo === 0) {
      const ring = 48 + (this.pulse % 1.6) * 18;
      const a = 0.22 * (1 - (this.pulse % 1.6) / 1.6);
      g.circle(x, y, ring);
      g.stroke({ width: 2, color: COLORS.cyan, alpha: a });
    }
  }

  private isStationRunning(id: StationId): boolean {
    if (!this.state) return false;
    const st = this.state.stations[id];
    if (!st.unlocked || st.level <= 0) return false;
    const def = getStation(id);
    if (!def.inputs) return true;
    for (const [key, rate] of Object.entries(def.inputs) as [ResourceId, number][]) {
      if ((this.state.resources[key] ?? 0) < rate * st.level * 0.05) return false;
    }
    return true;
  }

  private async loadStationArt() {
    for (const def of STATIONS) {
      try {
        const texture = await Assets.load(STATION_ART[def.id]);
        const sprite = new Sprite(texture);
        sprite.anchor.set(0.5, 0.98);
        sprite.visible = false;
        sprite.tint = 0xe8f1f2;
        this.spriteByStation.set(def.id, sprite);
        this.stationSpritesRoot.addChild(sprite);
      } catch {
        // Procedural fallback in redrawStations keeps the scene playable.
      }
    }
  }

  private stationDisplayScale(): number {
    // Sized to sit on hall pedestals without swallowing the hearth.
    return Math.min(0.58, Math.max(0.36, this.width / 1300));
  }

  private redrawStations() {
    const g = this.stationsGfx;
    g.clear();
    if (!this.state || this.view !== 'forge') {
      for (const label of this.labelByStation.values()) label.visible = false;
      for (const sprite of this.spriteByStation.values()) sprite.visible = false;
      return;
    }

    const baseScale = this.stationDisplayScale();

    for (const slot of this.stationLayout()) {
      const st = this.state.stations[slot.id];
      const label = this.labelByStation.get(slot.id);
      const sprite = this.spriteByStation.get(slot.id);
      const hasArt = Boolean(sprite);

      // Pedestal top already in the painting — reinforce with a soft contact oval.
      g.ellipse(slot.x, slot.y + 6, 52 * baseScale, 14 * baseScale);
      g.fill({ color: COLORS.void, alpha: st.unlocked ? 0.38 : 0.22 });

      if (!st.unlocked) {
        if (sprite) {
          sprite.visible = true;
          sprite.x = slot.x;
          sprite.y = slot.y;
          sprite.scale.set(baseScale * 0.88);
          sprite.alpha = 0.4;
          sprite.tint = 0x9eb8c0;
        } else {
          this.drawStationBody(g, slot.id, slot.x, slot.y, 0.35, false, 1);
        }
        if (label) {
          label.visible = true;
          label.text = `${getStation(slot.id).name}?`;
          label.alpha = 0.6;
          label.x = slot.x;
          label.y = slot.y + (hasArt ? 18 : 26);
        }
        continue;
      }

      const spawn = this.spawnAnim[slot.id];
      const spawnScale = spawn != null ? 0.6 + (1 - spawn / 0.7) * 0.55 : 1;
      const running = this.isStationRunning(slot.id);
      const workPulse = running ? 1 + Math.sin(this.pulse * 5 + st.level) * 0.04 : 1;
      const scale = baseScale * spawnScale * workPulse;

      const poolColor = slot.id === 'enchanter' ? COLORS.cyan : COLORS.ember;
      g.circle(slot.x, slot.y - 10, 26 * scale);
      g.fill({ color: poolColor, alpha: running ? 0.14 : 0.06 });

      if (sprite) {
        sprite.visible = true;
        sprite.x = slot.x;
        sprite.y = slot.y;
        sprite.scale.set(scale);
        sprite.alpha = running ? 1 : 0.92;
        sprite.tint = running ? 0xffffff : 0xdfeaf0;
      } else {
        this.drawStationBody(g, slot.id, slot.x, slot.y, 1, running, spawnScale * workPulse);
      }

      if (label) {
        label.visible = true;
        label.text = running
          ? `${getStation(slot.id).name} · Lv${st.level}`
          : `${getStation(slot.id).name} (idle)`;
        label.alpha = 0.95;
        label.x = slot.x;
        label.y = slot.y + (hasArt ? 16 : 28);
      }

      if (running) {
        for (let i = 0; i < 3; i++) {
          const t = this.sparkTimer * 0.9 + i * 0.4 + st.level;
          const px = slot.x + Math.sin(t * 2) * 14;
          const py = slot.y - 36 * scale - ((t * 28 + i * 10) % 42);
          g.circle(px, py, 2);
          g.fill({
            color: slot.id === 'enchanter' ? COLORS.cyan : COLORS.amber,
            alpha: 0.65,
          });
        }
      }
    }
  }

  private drawStationBody(
    g: Graphics,
    id: StationId,
    x: number,
    y: number,
    alpha: number,
    running: boolean,
    scale: number,
  ) {
    const s = 22 * scale;
    const accent = id === 'enchanter' ? COLORS.cyan : id === 'anvil' ? COLORS.amber : COLORS.ember;

    g.roundRect(x - s * 1.1, y + s * 0.2, s * 2.2, s * 0.45, 6);
    g.fill({ color: COLORS.stone, alpha: 0.85 * alpha });

    if (id === 'smelter') {
      g.roundRect(x - s * 0.85, y - s * 1.05, s * 1.7, s * 1.4, 8);
      g.fill({ color: COLORS.tealLight, alpha: 0.9 * alpha });
      g.roundRect(x - s * 0.45, y - s * 0.7, s * 0.9, s * 0.7, 5);
      g.fill({ color: running ? COLORS.ember : COLORS.void, alpha: (running ? 0.95 : 0.5) * alpha });
      if (running) {
        g.circle(x, y - s * 0.35, s * 0.28);
        g.fill({ color: COLORS.amber, alpha: 0.85 * alpha });
      }
    } else if (id === 'anvil') {
      g.roundRect(x - s * 0.9, y - s * 0.25, s * 1.8, s * 0.55, 4);
      g.fill({ color: COLORS.slate, alpha: 0.95 * alpha });
      g.roundRect(x - s * 0.35, y + s * 0.1, s * 0.7, s * 0.45, 3);
      g.fill({ color: COLORS.tealLight, alpha: 0.9 * alpha });
      if (running) {
        g.circle(x + s * 0.55, y - s * 0.45, 3 + Math.sin(this.pulse * 8) * 1.5);
        g.fill({ color: COLORS.amber, alpha: 0.9 * alpha });
      }
    } else {
      g.moveTo(x, y - s * 1.1);
      g.lineTo(x + s * 0.7, y + s * 0.15);
      g.lineTo(x - s * 0.7, y + s * 0.15);
      g.closePath();
      g.fill({ color: COLORS.tealLight, alpha: 0.9 * alpha });
      g.circle(x, y - s * 0.45, s * 0.28);
      g.fill({ color: running ? COLORS.cyan : COLORS.slate, alpha: (running ? 0.95 : 0.45) * alpha });
    }

    g.circle(x, y - s * 1.25, running ? 4 : 2.5);
    g.fill({ color: accent, alpha: (running ? 0.95 : 0.4) * alpha });
  }

  private redrawParticles() {
    const g = this.particles;
    g.clear();
    const cx = this.width * 0.5;
    const cy = this.view === 'forge' ? this.height * 0.42 : this.height * 0.58;

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

    if (this.view === 'mine' && this.hitFlash > 0) {
      const { x, y } = this.veinPoint();
      const p = 1 - this.hitFlash / 0.28;
      g.circle(x, y, 20 + p * 55);
      g.stroke({ width: 3, color: COLORS.mist, alpha: 0.55 * (1 - p) });
    }

    if (this.view === 'mine' && this.combo >= 3) {
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
