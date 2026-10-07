import { Application, Assets, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { GameState } from '../sim/types';
import { getStation, STATIONS, type StationId } from '../data/stations';
import type { ResourceId } from '../data/resources';
import {
  createOreRocks,
  damageRock,
  findNearestLivingRock,
  pickLivingRock,
  rockWorldPos,
  tickRockRespawns,
  type OreRock,
} from './miningFace';

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
  dwarfSkin: 0xc4a574,
  dwarfCoat: 0x3d5a4c,
  dwarfHelm: 0xb87333,
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
  private dwarfGfx = new Graphics();
  private stationsGfx = new Graphics();
  private stationLabels = new Container();
  private fx = new Graphics();
  private particles = new Graphics();
  private scout = new Graphics();
  private floatLayer = new Container();
  private brand!: Text;
  private comboLabel!: Text;
  private dwarfLabel!: Text;
  private labelByStation = new Map<StationId, Text>();
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
  private rocks: OreRock[] = createOreRocks();
  private lastPointer: { x: number; y: number } | null = null;
  private autoMineRate = 0;
  private dwarfTimer = 0;
  private dwarfSwingT = 0;
  private readonly dwarfPeriod = 1.25;

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
    this.root.addChild(this.stationLabels);
    this.root.addChild(this.hearth);
    this.root.addChild(this.vein);
    this.root.addChild(this.dwarfGfx);
    this.root.addChild(this.scout);
    this.root.addChild(this.particles);
    this.root.addChild(this.fx);
    this.root.addChild(this.floatLayer);

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

    this.dwarfLabel = new Text({
      text: 'Dwarf mining',
      style: {
        fontFamily: 'DM Sans, sans-serif',
        fontSize: 11,
        fontWeight: '600',
        fill: COLORS.cyan,
        dropShadow: { color: 0x0b1c22, blur: 3, distance: 1, alpha: 0.8 },
      },
    });
    this.dwarfLabel.anchor.set(0.5, 0);
    this.dwarfLabel.visible = false;
    this.root.addChild(this.dwarfLabel);

    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;
    this.app.stage.on('pointerdown', (e) => this.handlePointer(e.global.x, e.global.y));

    this.app.ticker.add((ticker) => this.update(ticker.deltaMS / 1000));
    this.resize();
  }

  setVeinTapHandler(handler: () => void) {
    this.onVeinTap = handler;
  }

  /** Ore/sec from economy — drives dwarf visibility and strike floats. */
  setAutoMineRate(rate: number) {
    this.autoMineRate = Math.max(0, rate);
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

  /** Call on successful vein tap — crack/shatter a rock, sparks, floating +ore */
  triggerVeinHit(amount: number) {
    const { x: cx, y: cy } = this.veinPoint();
    const target =
      this.lastPointer != null
        ? findNearestLivingRock(this.rocks, cx, cy, this.lastPointer.x, this.lastPointer.y, 110)
        : pickLivingRock(this.rocks);
    this.lastPointer = null;

    const hitPos = target ? rockWorldPos(target, cx, cy) : { x: cx, y: cy };
    let shattered = false;
    if (target) {
      shattered = damageRock(target, 1);
    }

    this.hitFlash = 0.28;
    this.shakeT = 0.12;
    this.comboTimer = 0.85;
    this.combo = Math.min(12, this.combo + 1);

    this.spawnRockDebris(hitPos.x, hitPos.y, shattered ? 14 : 8, this.combo);
    this.spawnOreFloater(hitPos.x, hitPos.y, amount, 18 + Math.min(10, this.combo));
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

  /** Pop-in animation when a station is purchased */
  triggerStationUnlock(stationId: StationId) {
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

  private veinPoint() {
    return { x: this.width * 0.28, y: this.height * 0.55 };
  }

  private dwarfPoint() {
    const { x, y } = this.veinPoint();
    return { x: x - 72, y: y + 36 };
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
    const nearCenter = (px - x) * (px - x) + (py - y) * (py - y) <= 100 * 100;
    const nearRock = findNearestLivingRock(this.rocks, x, y, px, py, 42) != null;
    if (nearCenter || nearRock) {
      this.lastPointer = { x: px, y: py };
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

    tickRockRespawns(this.rocks, dt);

    if (this.autoMineRate > 0) {
      this.dwarfTimer += dt;
      this.dwarfSwingT = this.dwarfTimer / this.dwarfPeriod;
      if (this.dwarfTimer >= this.dwarfPeriod) {
        this.dwarfTimer -= this.dwarfPeriod;
        this.performDwarfStrike();
      }
    } else {
      this.dwarfTimer = 0;
      this.dwarfSwingT = 0;
    }

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

    for (const id of Object.keys(this.spawnAnim) as StationId[]) {
      const t = this.spawnAnim[id];
      if (t == null) continue;
      this.spawnAnim[id] = t - dt;
      if ((this.spawnAnim[id] ?? 0) <= 0) delete this.spawnAnim[id];
    }

    // Ambient station puffs when producing
    if (this.state && this.productionPulse > 0.9) {
      this.productionPulse = 0;
      for (const slot of this.stationLayout()) {
        if (this.isStationRunning(slot.id)) {
          this.triggerStationPuff(slot.id);
        }
      }
    }

    this.redrawHearth();
    this.redrawOreFace();
    this.redrawDwarf();
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

  private performDwarfStrike() {
    const { x: cx, y: cy } = this.veinPoint();
    const rock = pickLivingRock(this.rocks);
    if (!rock) return;
    const pos = rockWorldPos(rock, cx, cy);
    const shattered = damageRock(rock, 1);
    this.hitFlash = Math.max(this.hitFlash, 0.14);
    this.spawnRockDebris(pos.x, pos.y, shattered ? 10 : 5, 2);
    const amount = this.autoMineRate * this.dwarfPeriod;
    if (amount > 0.05) {
      this.spawnOreFloater(pos.x, pos.y - 6, amount, 14);
    }
  }

  private spawnRockDebris(x: number, y: number, count: number, comboBoost: number) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const speed = 35 + Math.random() * 110 + comboBoost * 5;
      this.bursts.push({
        x,
        y,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed - 50,
        life: 0.3 + Math.random() * 0.35,
        max: 0.55,
        size: 2 + Math.random() * 3.5,
        color: Math.random() > 0.4 ? COLORS.cyan : Math.random() > 0.5 ? COLORS.slate : COLORS.tealLight,
      });
    }
  }

  private spawnOreFloater(x: number, y: number, amount: number, fontSize: number) {
    const label = new Text({
      text: `+${trimAmount(amount)} Ore`,
      style: {
        fontFamily: 'DM Sans, sans-serif',
        fontSize,
        fontWeight: '700',
        fill: COLORS.mist,
        dropShadow: { color: 0x0b1c22, blur: 4, distance: 1, alpha: 0.8 },
      },
    });
    label.anchor.set(0.5, 1);
    label.x = x + (Math.random() * 24 - 12);
    label.y = y - 16;
    this.floatLayer.addChild(label);
    this.floaters.push({ text: label, life: 0.85, max: 0.85, vy: -48 - Math.min(12, this.combo) * 2 });
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

  private redrawOreFace() {
    const g = this.vein;
    g.clear();
    const { x: cx, y: cy } = this.veinPoint();

    // Dark mound + cyan seam so the pile reads as a dig site
    g.ellipse(cx, cy + 18, 78, 36);
    g.fill({ color: COLORS.void, alpha: 0.42 });
    const shimmer = 0.1 + Math.sin(this.pulse * 2.8) * 0.04 + this.hitFlash * 0.4;
    g.circle(cx, cy, 58 + this.hitFlash * 18);
    g.fill({ color: COLORS.cyan, alpha: shimmer });

    for (const rock of this.rocks) {
      if (rock.respawn > 0) {
        // Faint reforming dust
        const reform = 1 - rock.respawn / 1.8;
        if (reform > 0.35) {
          const { x, y } = rockWorldPos(rock, cx, cy);
          g.ellipse(x, y, rock.w * 0.35 * reform, rock.h * 0.3 * reform);
          g.fill({ color: COLORS.tealLight, alpha: 0.2 * reform });
        }
        continue;
      }
      this.drawRock(g, rock, cx, cy);
    }

    // Idle invite ring when no combo
    if (this.combo === 0 && this.autoMineRate <= 0) {
      const ring = 62 + (this.pulse % 1.6) * 16;
      const a = 0.2 * (1 - (this.pulse % 1.6) / 1.6);
      g.circle(cx, cy, ring);
      g.stroke({ width: 2, color: COLORS.cyan, alpha: a });
    }
  }

  private drawRock(g: Graphics, rock: OreRock, cx: number, cy: number) {
    const { x, y } = rockWorldPos(rock, cx, cy);
    const dmg = 1 - rock.hp / rock.maxHp;
    const wobble = this.hitFlash > 0 && dmg > 0 ? Math.sin(this.pulse * 40) * 1.2 : 0;

    // Soft contact shadow so rocks lift off the painted backdrop
    g.ellipse(x + wobble, y + rock.h * 0.28, rock.w * 0.5, rock.h * 0.18);
    g.fill({ color: COLORS.void, alpha: 0.45 });

    // Chunkier stone body
    g.ellipse(x + wobble, y, rock.w * 0.55, rock.h * 0.48);
    g.fill({ color: rock.tint, alpha: 1 });
    g.ellipse(x - rock.w * 0.12 + wobble, y - rock.h * 0.14, rock.w * 0.34, rock.h * 0.3);
    g.fill({ color: 0x5a6b74, alpha: 0.85 });
    g.ellipse(x + rock.w * 0.18 + wobble, y + rock.h * 0.1, rock.w * 0.22, rock.h * 0.2);
    g.fill({ color: COLORS.stone, alpha: 0.7 });

    // Outline for readability
    g.ellipse(x + wobble, y, rock.w * 0.55, rock.h * 0.48);
    g.stroke({ width: 2, color: COLORS.void, alpha: 0.55 });

    // Cyan ore flecks — fewer as rock cracks
    const flecks = Math.max(1, 4 - Math.floor(dmg * 3));
    for (let i = 0; i < flecks; i++) {
      const fx = x + Math.cos(rock.seed + i * 2.1) * rock.w * 0.24;
      const fy = y + Math.sin(rock.seed * 1.3 + i) * rock.h * 0.2;
      g.circle(fx + wobble, fy, 3.2 - dmg);
      g.fill({ color: COLORS.cyan, alpha: 0.75 + this.hitFlash * 0.25 });
    }

    // Crack lines when damaged
    if (dmg > 0.05) {
      g.moveTo(x - rock.w * 0.28, y - rock.h * 0.12);
      g.lineTo(x + rock.w * 0.12 * dmg, y + rock.h * 0.22 * dmg);
      if (dmg > 0.4) {
        g.moveTo(x + rock.w * 0.18, y - rock.h * 0.22);
        g.lineTo(x - rock.w * 0.06, y + rock.h * 0.28);
      }
      g.stroke({ width: 2, color: COLORS.void, alpha: 0.7 + dmg * 0.25 });
    }
  }

  private redrawDwarf() {
    const g = this.dwarfGfx;
    g.clear();
    if (this.autoMineRate <= 0) {
      this.dwarfLabel.visible = false;
      return;
    }

    const { x, y } = this.dwarfPoint();
    const swing = Math.sin(this.dwarfSwingT * Math.PI * 2);
    // Wind-up then strike: pick arm angle
    const pickAng = -0.95 + swing * 1.25;
    const bob = Math.abs(swing) * 3;
    const s = 1.35;

    // Shadow
    g.ellipse(x, y + 22 * s, 18 * s, 6 * s);
    g.fill({ color: COLORS.void, alpha: 0.4 });

    // Legs
    g.roundRect(x - 10 * s, y + 5 * s - bob, 7 * s, 14 * s, 2);
    g.fill(COLORS.dwarfCoat);
    g.roundRect(x + 3 * s, y + 5 * s - bob, 7 * s, 14 * s, 2);
    g.fill(COLORS.dwarfCoat);

    // Body
    g.roundRect(x - 14 * s, y - 16 * s - bob, 28 * s, 24 * s, 6);
    g.fill(COLORS.dwarfCoat);

    // Head
    g.circle(x, y - 26 * s - bob, 10 * s);
    g.fill(COLORS.dwarfSkin);

    // Helm
    g.roundRect(x - 11 * s, y - 36 * s - bob, 22 * s, 10 * s, 3);
    g.fill(COLORS.dwarfHelm);
    g.moveTo(x, y - 42 * s - bob);
    g.lineTo(x + 7 * s, y - 34 * s - bob);
    g.lineTo(x - 7 * s, y - 34 * s - bob);
    g.closePath();
    g.fill(COLORS.amber);

    // Beard
    g.moveTo(x - 8 * s, y - 22 * s - bob);
    g.lineTo(x, y - 8 * s - bob);
    g.lineTo(x + 8 * s, y - 22 * s - bob);
    g.closePath();
    g.fill({ color: COLORS.slate, alpha: 0.95 });

    // Pickaxe arm + head — swings toward the ore pile
    const ax = x + 12 * s;
    const ay = y - 12 * s - bob;
    const px = ax + Math.cos(pickAng) * 32 * s;
    const py = ay + Math.sin(pickAng) * 32 * s;
    g.moveTo(ax, ay);
    g.lineTo(px, py);
    g.stroke({ width: 4, color: COLORS.slate, alpha: 0.95 });
    g.moveTo(px + Math.cos(pickAng - 1.2) * 12 * s, py + Math.sin(pickAng - 1.2) * 12 * s);
    g.lineTo(px + Math.cos(pickAng + 1.2) * 12 * s, py + Math.sin(pickAng + 1.2) * 12 * s);
    g.stroke({ width: 5, color: COLORS.amber, alpha: 0.95 });

    this.dwarfLabel.visible = true;
    this.dwarfLabel.text = 'Mining…';
    this.dwarfLabel.x = x;
    this.dwarfLabel.y = y + 28 * s;
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

  private redrawStations() {
    const g = this.stationsGfx;
    g.clear();
    if (!this.state) {
      for (const label of this.labelByStation.values()) label.visible = false;
      return;
    }

    for (const slot of this.stationLayout()) {
      const st = this.state.stations[slot.id];
      const label = this.labelByStation.get(slot.id);
      if (!st.unlocked) {
        // Ghost silhouette — shows where the station will appear
        this.drawStationBody(g, slot.id, slot.x, slot.y, 0.22, false, 1);
        if (label) {
          label.visible = true;
          label.text = `${getStation(slot.id).name}?`;
          label.alpha = 0.35;
          label.x = slot.x;
          label.y = slot.y + 28;
        }
        continue;
      }

      const spawn = this.spawnAnim[slot.id];
      const spawnScale = spawn != null ? 0.6 + (1 - spawn / 0.7) * 0.55 : 1;
      const running = this.isStationRunning(slot.id);
      const workPulse = running ? 1 + Math.sin(this.pulse * 5 + st.level) * 0.08 : 1;
      this.drawStationBody(g, slot.id, slot.x, slot.y, 1, running, spawnScale * workPulse);

      if (label) {
        label.visible = true;
        label.text = running ? `${getStation(slot.id).name} · Lv${st.level}` : `${getStation(slot.id).name} (idle)`;
        label.alpha = 0.95;
        label.x = slot.x;
        label.y = slot.y + 30;
      }

      if (running) {
        // Rising product motes
        for (let i = 0; i < 3; i++) {
          const t = this.sparkTimer * 0.9 + i * 0.4 + st.level;
          const px = slot.x + Math.sin(t * 2) * 10;
          const py = slot.y - 18 - ((t * 28 + i * 10) % 36);
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
    const s = 18 * scale;
    const accent = id === 'enchanter' ? COLORS.cyan : id === 'anvil' ? COLORS.amber : COLORS.ember;

    // Base plinth
    g.roundRect(x - s * 1.1, y + s * 0.35, s * 2.2, s * 0.55, 6);
    g.fill({ color: COLORS.stone, alpha: 0.85 * alpha });

    if (id === 'smelter') {
      g.roundRect(x - s * 0.85, y - s * 0.9, s * 1.7, s * 1.4, 8);
      g.fill({ color: COLORS.tealLight, alpha: 0.9 * alpha });
      g.roundRect(x - s * 0.45, y - s * 0.55, s * 0.9, s * 0.7, 5);
      g.fill({ color: running ? COLORS.ember : COLORS.void, alpha: (running ? 0.95 : 0.5) * alpha });
      if (running) {
        g.circle(x, y - s * 0.2, s * 0.28);
        g.fill({ color: COLORS.amber, alpha: 0.85 * alpha });
      }
    } else if (id === 'anvil') {
      g.roundRect(x - s * 0.9, y - s * 0.15, s * 1.8, s * 0.55, 4);
      g.fill({ color: COLORS.slate, alpha: 0.95 * alpha });
      g.roundRect(x - s * 0.35, y + s * 0.2, s * 0.7, s * 0.45, 3);
      g.fill({ color: COLORS.tealLight, alpha: 0.9 * alpha });
      if (running) {
        g.circle(x + s * 0.55, y - s * 0.35, 3 + Math.sin(this.pulse * 8) * 1.5);
        g.fill({ color: COLORS.amber, alpha: 0.9 * alpha });
      }
    } else {
      // enchanter — crystal pedestal
      g.moveTo(x, y - s);
      g.lineTo(x + s * 0.7, y + s * 0.2);
      g.lineTo(x - s * 0.7, y + s * 0.2);
      g.closePath();
      g.fill({ color: COLORS.tealLight, alpha: 0.9 * alpha });
      g.circle(x, y - s * 0.35, s * 0.28);
      g.fill({ color: running ? COLORS.cyan : COLORS.slate, alpha: (running ? 0.95 : 0.45) * alpha });
    }

    g.circle(x, y - s * 1.15, running ? 4 : 2.5);
    g.fill({ color: accent, alpha: (running ? 0.95 : 0.4) * alpha });
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
      g.circle(x, y, 28 + p * 50);
      g.stroke({ width: 3, color: COLORS.mist, alpha: 0.45 * (1 - p) });
    }

    if (this.combo >= 3) {
      const { x, y } = this.veinPoint();
      this.comboLabel.visible = true;
      this.comboLabel.text = `×${this.combo}`;
      this.comboLabel.x = x + 58;
      this.comboLabel.y = y - 42;
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
