import { Application, Assets, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { GameState } from '../sim/types';
import { stationRunMult } from '../sim/economy';
import { getStation, STATIONS, type StationId } from '../data/stations';
import type { ResourceId } from '../data/resources';
import type { SceneView } from './sceneView';
import {
  FORGE_FOCUS,
  FORGE_STATION_UV,
  MINE_FOCUS,
  MINE_VEIN_UV,
  layoutFocusedCover,
  layoutForgeHall,
  playBandCenterY,
  playSafeInsets,
  uvToScreen,
} from './layout';
import { stratumAtDepth } from '../data/strata';
import {
  buildShaftCells,
  cellKey,
  findNearestFaceCell,
  pickLivingFaceCell,
  SHAFT_COLS,
  SHAFT_LOOKAHEAD,
  SHAFT_LOOKBEHIND,
  type ShaftCell,
} from '../sim/mineShaft';

/** Timber-framed dig shaft + forge workshop hall */
const MINE_BG_URL = `${import.meta.env.BASE_URL}art/mine-cavern-bg.jpg`;
const FORGE_BG_URL = `${import.meta.env.BASE_URL}art/forge-hall-bg.jpg`;
/** Painted station art when available; others use procedural drawStationBody. */
const STATION_ART: Partial<Record<StationId, string>> = {
  smelter: `${import.meta.env.BASE_URL}art/stations/smelter.png`,
  anvil: `${import.meta.env.BASE_URL}art/stations/anvil.png`,
  enchanter: `${import.meta.env.BASE_URL}art/stations/enchanter.png`,
};
/** 5-frame dwarf mining loop (pick wind-up → strike → recover). */
const DWARF_MINE_FRAMES = [1, 2, 3, 4, 5].map(
  (n) => `${import.meta.env.BASE_URL}art/dwarf/mine-0${n}.png`,
);
/** Legacy single-frame fallback if the 5-frame sheet fails to load. */
const DWARF_ART = `${import.meta.env.BASE_URL}art/mine/dwarf.png`;
const ORE_ROCK_ART = `${import.meta.env.BASE_URL}art/mine/ore-rock.png`;
const DWARF_FRAME_COUNT = 5;

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
  timber: 0x5c3a22,
  timberDark: 0x3a2414,
  timberLight: 0x7a5234,
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
  private mineLayer = new Container();
  private forgeLayer = new Container();
  private mineBg: Sprite | null = null;
  private forgeBg: Sprite | null = null;
  private vignette = new Graphics();
  private hearth = new Graphics();
  private vein = new Graphics();
  private dwarfGfx = new Graphics();
  private dwarfSprite: Sprite | null = null;
  private dwarfFrames: Texture[] = [];
  private oreSpritesRoot = new Container();
  private rockSprites: Sprite[] = [];
  private stationsGfx = new Graphics();
  private stationSpritesRoot = new Container();
  private stationLabels = new Container();
  private fx = new Graphics();
  private particles = new Graphics();
  private scout = new Graphics();
  private floatLayer = new Container();
  private brand!: Text;
  private comboLabel!: Text;
  private dwarfLabel!: Text;
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
  private onVeinTap: ((col?: number) => void) | null = null;
  private productionPulse = 0;
  private view: SceneView = 'mine';
  private viewFade = 1;
  private shaftCells: ShaftCell[] = buildShaftCells({
    depth: 0,
    faceDamage: Array.from({ length: SHAFT_COLS }, () => 0),
  });
  private cellPositions = new Map<string, { x: number; y: number }>();
  private cellSize = { w: 40, h: 34 };
  /** Smoothed camera depth for vertical scroll */
  private scrollDepth = 0;
  private lastPointer: { x: number; y: number } | null = null;
  private lastDigCol: number | null = null;
  private autoMineRate = 0;
  private dwarfTimer = 0;
  private dwarfSwingT = 0;
  private readonly dwarfPeriod = 1.25;
  private lastHitCellKey: string | null = null;
  private stratumFlash = 0;
  private lastStratumId = '';
  /** Smoothed dwarf world position (follows the block being mined). */
  private dwarfWorld = { x: 0, y: 0 };
  private dwarfFacing = 1;
  private dwarfInitialized = false;

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
    this.mineLayer.addChild(this.oreSpritesRoot);
    this.mineLayer.addChild(this.dwarfGfx);

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

    await Promise.all([this.loadStationArt(), this.loadMineArt()]);

    for (const def of STATIONS) {
      const label = new Text({
        text: def.name,
        style: {
          fontFamily: 'DM Sans, sans-serif',
          fontSize: 12,
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
    // Keep brand inside the padded safe area (HUD pad + notch).
    this.brand.x = 22;
    this.brand.y = 16;
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
    this.mineLayer.alpha = 1;
    this.forgeLayer.alpha = 0;
    this.applyViewEventModes();
    this.resize();
  }

  setVeinTapHandler(handler: (col?: number) => void) {
    this.onVeinTap = handler;
  }

  /** Column last aimed by pointer / Mine button (for targeted digs). */
  getPendingDigCol(): number | null {
    return this.lastDigCol;
  }

  /** Ore/sec from economy — drives dwarf visibility and strike floats. */
  setAutoMineRate(rate: number) {
    this.autoMineRate = Math.max(0, rate);
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
    const narrow = this.width < 520;
    this.brand.x = narrow ? 12 : 22;
    this.brand.y = narrow ? 10 : 16;
    this.brand.style.fontSize = narrow ? 20 : this.width < 900 ? 32 : 40;
    for (const label of this.labelByStation.values()) {
      label.style.fontSize = narrow ? 10 : 12;
    }
    this.layoutBackgrounds();
    this.drawVignette();
    this.redrawStations();
  }

  sync(state: GameState) {
    this.state = state;
    const depth = state.mineDepth ?? 0;
    const stratum = stratumAtDepth(depth);
    if (this.lastStratumId && this.lastStratumId !== stratum.id) {
      this.stratumFlash = 0.9;
    }
    this.lastStratumId = stratum.id;
    this.shaftCells = buildShaftCells({
      depth,
      faceDamage: state.mineFaceDamage ?? Array.from({ length: SHAFT_COLS }, () => 0),
    });
    this.redrawStations();
  }

  /** Call on successful vein tap — crack/shatter a face cell, sparks, floating +ore */
  triggerVeinHit(
    amount: number,
    find?: { resource: string; amount: number; label: string },
  ) {
    if (this.view !== 'mine') this.setView('mine');
    this.refreshShaftFromState();
    const { x: cx, y: cy } = this.veinPoint();
    this.layoutShaftCells(cx, cy);

    const preferCol = this.lastDigCol;
    let target =
      this.lastPointer != null
        ? findNearestFaceCell(
            this.shaftCells,
            this.cellPositions,
            this.lastPointer.x,
            this.lastPointer.y,
            140,
            { includeCleared: true },
          )
        : null;
    if (!target && preferCol != null) {
      target =
        this.shaftCells.find(
          (c) => c.role === 'face' && c.col === preferCol,
        ) ?? null;
    }
    if (!target) {
      target =
        pickLivingFaceCell(this.shaftCells) ??
        this.shaftCells.find((c) => c.role === 'face') ??
        null;
    }
    this.lastPointer = null;

    const hitPos = target
      ? (this.cellPositions.get(cellKey(target.row, target.col)) ?? { x: cx, y: cy })
      : { x: cx, y: cy };
    if (target) this.lastHitCellKey = cellKey(target.row, target.col);
    const shattered = Boolean(target?.cleared);

    this.hitFlash = 0.28;
    this.shakeT = 0.12;
    this.comboTimer = 0.85;
    this.combo = Math.min(12, this.combo + 1);

    this.spawnRockDebris(hitPos.x, hitPos.y, shattered ? 16 : 8, this.combo);
    this.spawnOreFloater(hitPos.x, hitPos.y, amount, 18 + Math.min(10, this.combo));
    if (find) {
      this.spawnFindFloater(hitPos.x, hitPos.y - 18, find.label, find.amount);
    }
  }

  triggerCraftBurst() {
    this.craftBurstT = 0.55;
    const { x, y } =
      this.view === 'forge'
        ? { x: this.width * 0.5, y: this.height * 0.48 }
        : this.veinPoint();
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
    if (this.mineBg) return uvToScreen(this.mineBg, MINE_VEIN_UV);
    return { x: this.width * MINE_VEIN_UV.x, y: this.height * MINE_VEIN_UV.y };
  }

  private stationLayout(): { id: StationId; x: number; y: number }[] {
    const ids = STATIONS.map((s) => s.id);
    const portrait = this.height > this.width * 1.05;

    // Portrait: two rows of three so six stations stay readable.
    if (portrait) {
      const insets = playSafeInsets(this.width, this.height);
      const bandTop = this.height * insets.top;
      const bandBottom = this.height * (1 - insets.bottom);
      const bandH = bandBottom - bandTop;
      const pad = Math.min(28, this.width * 0.07);
      const usable = this.width - pad * 2;
      const cols = 3;
      return ids.map((id, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const rows = Math.ceil(ids.length / cols);
        return {
          id,
          x: pad + usable * ((col + 0.5) / cols),
          y: bandTop + bandH * (0.42 + (row + 0.5) * (0.42 / Math.max(1, rows))),
        };
      });
    }

    return ids.map((id) => {
      if (this.forgeBg) {
        const p = uvToScreen(this.forgeBg, FORGE_STATION_UV[id]);
        return { id, x: p.x, y: p.y };
      }
      return {
        id,
        x: this.width * FORGE_STATION_UV[id].x,
        y: this.height * FORGE_STATION_UV[id].y,
      };
    });
  }

  /** Fallback stand point left of the dig face when no living cell exists. */
  private dwarfPoint() {
    const { x, y } = this.veinPoint();
    const short = Math.min(this.width, this.height);
    const offset = Math.min(110, Math.max(72, short * 0.14));
    return { x: x - offset, y: y + 10 };
  }

  /** Resolve the block the dwarf should mine (matches sim auto-dig preference). */
  private resolveDwarfTargetCell(): ShaftCell | null {
    this.refreshShaftFromState();
    const preferCol = this.state?.lastMineHitCol;
    if (preferCol != null) {
      const preferred = this.shaftCells.find(
        (c) => c.role === 'face' && !c.cleared && c.col === preferCol,
      );
      if (preferred) return preferred;
    }
    return pickLivingFaceCell(this.shaftCells);
  }

  /** Stand beside the target block, facing it. */
  private dwarfStandBeside(cell: ShaftCell, cx: number): { x: number; y: number; facing: number } {
    const pos = this.cellPositions.get(cellKey(cell.row, cell.col));
    if (!pos) {
      const fallback = this.dwarfPoint();
      return { x: fallback.x, y: fallback.y, facing: 1 };
    }
    const standX = this.cellSize.w * 0.62;
    // Prefer the side toward shaft center so the dwarf stays on-screen.
    const standLeft = pos.x >= cx;
    const facing = standLeft ? 1 : -1;
    return {
      x: pos.x + (standLeft ? -standX : standX),
      y: pos.y + this.cellSize.h * 0.28,
      facing,
    };
  }

  private updateDwarfFollow(dt: number) {
    const { x: cx, y: cy } = this.veinPoint();
    this.layoutShaftCells(cx, cy);
    const cell = this.resolveDwarfTargetCell();
    const target = cell
      ? this.dwarfStandBeside(cell, cx)
      : { ...this.dwarfPoint(), facing: 1 as number };

    if (!this.dwarfInitialized) {
      this.dwarfWorld.x = target.x;
      this.dwarfWorld.y = target.y;
      this.dwarfFacing = target.facing;
      this.dwarfInitialized = true;
      return;
    }

    const follow = Math.min(1, dt * 7.5);
    this.dwarfWorld.x += (target.x - this.dwarfWorld.x) * follow;
    this.dwarfWorld.y += (target.y - this.dwarfWorld.y) * follow;
    if (target.facing !== 0) this.dwarfFacing = target.facing;
  }

  private handlePointer(px: number, py: number) {
    if (this.view !== 'mine' || !this.onVeinTap) return;
    const { x, y } = this.veinPoint();
    this.layoutShaftCells(x, y);
    const hitDist = Math.max(this.cellSize.w, this.cellSize.h) * 0.85;
    const nearRock = findNearestFaceCell(
      this.shaftCells,
      this.cellPositions,
      px,
      py,
      hitDist,
    );
    // Generous shaft band so taps on the tunnel still dig
    const bandW = this.cellSize.w * (SHAFT_COLS * 0.55 + 0.5);
    const bandH = this.cellSize.h * (SHAFT_LOOKAHEAD + SHAFT_LOOKBEHIND + 1.2);
    const inShaft =
      Math.abs(px - x) <= bandW && Math.abs(py - (y + this.cellSize.h * 0.4)) <= bandH;
    if (nearRock || inShaft) {
      this.lastPointer = { x: px, y: py };
      this.lastDigCol = nearRock?.col ?? this.colFromPointer(px, x);
      this.onVeinTap(this.lastDigCol ?? undefined);
    }
  }

  private colFromPointer(px: number, cx: number): number {
    const pitch = this.cellSize.w + 3;
    const rel = (px - cx) / pitch + (SHAFT_COLS - 1) / 2;
    return Math.max(0, Math.min(SHAFT_COLS - 1, Math.round(rel)));
  }

  private refreshShaftFromState() {
    if (!this.state) return;
    this.shaftCells = buildShaftCells({
      depth: this.state.mineDepth ?? 0,
      faceDamage:
        this.state.mineFaceDamage ?? Array.from({ length: SHAFT_COLS }, () => 0),
    });
  }

  private layoutShaftCells(cx: number, cy: number) {
    const short = Math.min(this.width, this.height);
    // Full-bleed Terraria-ish tiles — dominate the play band
    const colPitch = Math.min(58, Math.max(34, short * 0.078));
    const rowPitch = Math.min(50, Math.max(30, short * 0.07));
    this.cellSize = { w: colPitch - 3, h: rowPitch - 3 };
    const faceY = cy + rowPitch * 0.15;
    this.cellPositions.clear();
    for (const cell of this.shaftCells) {
      const x = cx + (cell.col - (SHAFT_COLS - 1) / 2) * colPitch;
      const y = faceY + (cell.row - this.scrollDepth) * rowPitch;
      this.cellPositions.set(cellKey(cell.row, cell.col), { x, y });
    }
  }

  private layoutBackgrounds() {
    const insets = playSafeInsets(this.width, this.height);
    const playY = playBandCenterY(insets);
    const portrait = this.height > this.width * 1.05;
    const mineZoom = portrait ? 1.1 : 1.02;

    if (this.mineBg) {
      layoutFocusedCover(
        this.mineBg,
        this.width,
        this.height,
        MINE_FOCUS,
        { x: 0.5, y: playY },
        mineZoom,
      );
      // Keep timber/ore backdrop readable; tiles sit in the dark shaft void
      this.mineBg.alpha = 0.78;
    }
    if (this.forgeBg) {
      if (portrait) {
        // Full-bleed cover on phones; stations use a screen-space row instead of UV pedestals.
        layoutFocusedCover(
          this.forgeBg,
          this.width,
          this.height,
          FORGE_FOCUS,
          { x: 0.5, y: playY },
          1.08,
        );
      } else {
        layoutForgeHall(
          this.forgeBg,
          this.width,
          this.height,
          FORGE_FOCUS,
          { x: 0.5, y: playY },
          Object.values(FORGE_STATION_UV),
          1.06,
        );
      }
    }
  }

  private drawVignette() {
    const g = this.vignette;
    g.clear();
    const insets = playSafeInsets(this.width, this.height);
    g.rect(0, 0, this.width, this.height * insets.top);
    g.fill({ color: COLORS.void, alpha: 0.42 });
    g.rect(0, this.height * (1 - insets.bottom), this.width, this.height * insets.bottom);
    g.fill({ color: COLORS.void, alpha: 0.55 });
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
    if (this.stratumFlash > 0) this.stratumFlash = Math.max(0, this.stratumFlash - dt);
    if (this.shakeT > 0) this.shakeT = Math.max(0, this.shakeT - dt);
    if (this.craftBurstT > 0) this.craftBurstT = Math.max(0, this.craftBurstT - dt);

    if (this.state) {
      const targetDepth = this.state.mineDepth ?? 0;
      this.scrollDepth += (targetDepth - this.scrollDepth) * Math.min(1, dt * 4.5);
      this.refreshShaftFromState();
    }

    if (this.view === 'mine' && this.autoMineRate > 0) {
      this.updateDwarfFollow(dt);
      this.dwarfTimer += dt;
      this.dwarfSwingT = this.dwarfTimer / this.dwarfPeriod;
      if (this.dwarfTimer >= this.dwarfPeriod) {
        this.dwarfTimer -= this.dwarfPeriod;
        this.performDwarfStrike();
      }
    } else if (this.view !== 'mine') {
      this.dwarfGfx.clear();
      if (this.dwarfSprite) this.dwarfSprite.visible = false;
      this.dwarfLabel.visible = false;
      this.dwarfInitialized = false;
    } else {
      this.dwarfTimer = 0;
      this.dwarfSwingT = 0;
      this.dwarfInitialized = false;
    }

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
      this.redrawVeinAmbient();
      this.redrawOreFace();
      this.redrawDwarf();
    } else {
      this.hearth.clear();
      this.vein.clear();
      this.dwarfGfx.clear();
      if (this.dwarfSprite) this.dwarfSprite.visible = false;
      for (const sprite of this.rockSprites) sprite.visible = false;
      this.dwarfLabel.visible = false;
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

  /** Soft mineral bloom around the dig face — shaft tunnel, not forge fire. */
  private redrawVeinAmbient() {
    const g = this.hearth;
    g.clear();
    const { x, y } = this.veinPoint();
    const breath = 1 + Math.sin(this.pulse * 2.2) * 0.1;
    const boost = this.craftBurstT > 0 ? 1.12 : 1;
    const { w: cellW, h: cellH } = this.cellSize;
    const shaftW = cellW * SHAFT_COLS + 18;
    const shaftH = cellH * (SHAFT_LOOKAHEAD + SHAFT_LOOKBEHIND + 1.4);

    // Cool ore wash inside the open shaft (kept subtle so timber bg stays dominant)
    g.rect(x - shaftW * 0.5, y - shaftH * 0.5, shaftW, shaftH);
    g.fill({ color: COLORS.cyan, alpha: 0.045 * breath * boost });
    g.circle(x, y + cellH * 0.2, 56 * breath * boost);
    g.fill({ color: COLORS.tealLight, alpha: 0.08 });

    const cosmetic = this.state?.activeCosmetic ?? 'default';
    if (cosmetic !== 'default') {
      const tint = cosmetic === 'cyan_hearth' ? COLORS.cyan : COLORS.amber;
      g.star(x, y - shaftH * 0.42, 5, 11, 5, this.pulse);
      g.fill({ color: tint, alpha: 0.85 });
    }
  }

  private performDwarfStrike() {
    const { x: cx, y: cy } = this.veinPoint();
    this.layoutShaftCells(cx, cy);
    const cell = this.resolveDwarfTargetCell();
    const pos = cell
      ? (this.cellPositions.get(cellKey(cell.row, cell.col)) ?? { x: cx, y: cy })
      : { x: cx, y: cy };
    if (cell) this.lastHitCellKey = cellKey(cell.row, cell.col);
    // Dig is applied in the sim tick; VFX cracks the same column the sim prefers.
    const shattered = Boolean(cell && cell.hp <= cell.maxHp * 0.35);
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
    this.floaters.push({
      text: label,
      life: 0.85,
      max: 0.85,
      vy: -48 - Math.min(12, this.combo) * 2,
    });
  }

  private spawnFindFloater(x: number, y: number, labelText: string, amount: number) {
    const label = new Text({
      text: `+${amount} ${labelText}!`,
      style: {
        fontFamily: 'Fraunces, Georgia, serif',
        fontSize: 16,
        fontWeight: '600',
        fill: COLORS.amber,
        dropShadow: { color: 0x0b1c22, blur: 5, distance: 1, alpha: 0.9 },
      },
    });
    label.anchor.set(0.5, 1);
    label.x = x;
    label.y = y;
    this.floatLayer.addChild(label);
    this.floaters.push({ text: label, life: 1.25, max: 1.25, vy: -42 });
  }

  private redrawOreFace() {
    const g = this.vein;
    g.clear();
    for (const sprite of this.rockSprites) sprite.visible = false;

    const { x: cx, y: cy } = this.veinPoint();
    this.layoutShaftCells(cx, cy);
    const depth = this.state?.mineDepth ?? 0;
    const stratum = stratumAtDepth(depth);
    const { w: cellW, h: cellH } = this.cellSize;
    const shaftW = cellW * SHAFT_COLS + 18;
    const shaftH = cellH * (SHAFT_LOOKAHEAD + SHAFT_LOOKBEHIND + 1.4);

    // Soft tunnel void so painted timber/ore stays visible around the dig tiles
    g.rect(cx - shaftW * 0.5 - 8, cy - shaftH * 0.55, shaftW + 16, shaftH * 1.15);
    g.fill({ color: COLORS.void, alpha: 0.42 + this.stratumFlash * 0.12 });

    // Light shoring accents (painted backdrop already carries the main timber frame)
    this.drawShaftTimbers(g, cx, cy, shaftW, shaftH);

    // Torch bloom near painted sconces
    for (let i = 0; i < 2; i++) {
      const ty = cy - cellH * (i * 1.6 + 0.35);
      const flicker = 0.3 + Math.sin(this.pulse * 5 + i) * 0.08;
      const lx = cx - shaftW * 0.5 - 18;
      const rx = cx + shaftW * 0.5 + 18;
      g.circle(lx, ty, 14);
      g.fill({ color: COLORS.amber, alpha: flicker * 0.35 });
      g.circle(rx, ty, 14);
      g.fill({ color: COLORS.ember, alpha: flicker * 0.28 });
    }

    const ordered = [...this.shaftCells].sort((a, b) => {
      const rank = (c: ShaftCell) => (c.role === 'ahead' ? 0 : c.role === 'face' ? 1 : 2);
      return rank(a) - rank(b) || a.row - b.row || a.col - b.col;
    });

    for (const cell of ordered) {
      const pos = this.cellPositions.get(cellKey(cell.row, cell.col));
      if (!pos) continue;
      if (cell.role === 'history' || cell.cleared) {
        // Empty dug cell — faint back wall
        g.rect(pos.x - cellW * 0.5, pos.y - cellH * 0.5, cellW, cellH);
        g.fill({ color: stratum.wall, alpha: cell.role === 'history' ? 0.22 : 0.18 });
        if (cell.rare && cell.cleared) {
          g.circle(pos.x, pos.y, 4);
          g.fill({ color: cell.fleck, alpha: 0.25 });
        }
        continue;
      }
      const dim = cell.role === 'ahead' ? 0.62 : 1;
      this.drawBlockTile(g, cell, pos.x, pos.y, cellW, cellH, dim);
    }

    // Dig-face highlight
    if (this.combo === 0 && this.autoMineRate <= 0) {
      const a = 0.18 + Math.sin(this.pulse * 3) * 0.06;
      g.rect(cx - shaftW * 0.5, cy - cellH * 0.55, shaftW, cellH * 1.1);
      g.stroke({ width: 2, color: stratum.fleck, alpha: a });
    }

    if (this.stratumFlash > 0) {
      g.rect(cx - shaftW * 0.5, cy - shaftH * 0.55, shaftW, shaftH * 1.15);
      g.fill({ color: stratum.fleck, alpha: this.stratumFlash * 0.12 });
    }
  }

  /** Subtle shoring lines that lock dig tiles into the painted timber frame. */
  private drawShaftTimbers(
    g: Graphics,
    cx: number,
    cy: number,
    shaftW: number,
    shaftH: number,
  ) {
    const top = cy - shaftH * 0.55;
    const bot = top + shaftH * 1.15;
    const left = cx - shaftW * 0.5;
    const right = cx + shaftW * 0.5;

    g.rect(left - 6, top - 2, 6, bot - top + 4);
    g.fill({ color: COLORS.timberDark, alpha: 0.55 });
    g.rect(right, top - 2, 6, bot - top + 4);
    g.fill({ color: COLORS.timberDark, alpha: 0.55 });
    g.rect(left - 8, top - 8, shaftW + 16, 7);
    g.fill({ color: COLORS.timber, alpha: 0.5 });
    g.rect(left - 8, bot + 1, shaftW + 16, 5);
    g.fill({ color: COLORS.timberDark, alpha: 0.45 });
  }

  private drawBlockTile(
    g: Graphics,
    cell: ShaftCell,
    x: number,
    y: number,
    cellW: number,
    cellH: number,
    dim: number,
  ) {
    const dmg = 1 - cell.hp / cell.maxHp;
    const hit =
      this.hitFlash > 0 && this.lastHitCellKey === cellKey(cell.row, cell.col);
    const wobble = hit ? Math.sin(this.pulse * 40) * 1.4 : 0;
    const pulseRare = cell.rare ? 0.08 + Math.sin(this.pulse * 4 + cell.seed) * 0.05 : 0;

    const left = x - cellW * 0.5 + wobble;
    const top = y - cellH * 0.5;

    g.rect(left, top, cellW, cellH);
    g.fill({ color: cell.tint, alpha: dim });

    // Bevel
    g.rect(left, top, cellW, 3);
    g.fill({ color: 0xffffff, alpha: 0.08 * dim });
    g.rect(left, top + cellH - 3, cellW, 3);
    g.fill({ color: COLORS.void, alpha: 0.35 * dim });
    g.rect(left, top, cellW, cellH);
    g.stroke({ width: 1.5, color: COLORS.void, alpha: 0.55 * dim });

    // Ore flecks / rare glow
    const flecks = cell.rare ? 5 : Math.max(1, 3 - Math.floor(dmg * 2));
    for (let i = 0; i < flecks; i++) {
      const fx = x + Math.cos(cell.seed + i * 2.1) * cellW * 0.28;
      const fy = y + Math.sin(cell.seed * 1.3 + i) * cellH * 0.24;
      g.circle(fx + wobble, fy, cell.rare ? 3.2 : 2.4 - dmg * 0.5);
      g.fill({
        color: cell.fleck,
        alpha: (0.7 + pulseRare + this.hitFlash * 0.2) * dim,
      });
    }

    if (cell.rare) {
      g.rect(left + 2, top + 2, cellW - 4, cellH - 4);
      g.stroke({ width: 1.5, color: cell.fleck, alpha: (0.35 + pulseRare) * dim });
    }

    if (dmg > 0.05) {
      g.moveTo(left + cellW * 0.15, top + cellH * 0.2);
      g.lineTo(left + cellW * (0.4 + dmg * 0.3), top + cellH * (0.55 + dmg * 0.2));
      if (dmg > 0.4) {
        g.moveTo(left + cellW * 0.7, top + cellH * 0.15);
        g.lineTo(left + cellW * 0.35, top + cellH * 0.75);
      }
      g.stroke({ width: 2, color: COLORS.void, alpha: (0.75 + dmg * 0.2) * dim });
    }
  }

  private redrawDwarf() {
    const g = this.dwarfGfx;
    g.clear();
    if (this.autoMineRate <= 0) {
      if (this.dwarfSprite) this.dwarfSprite.visible = false;
      this.dwarfLabel.visible = false;
      return;
    }

    if (!this.dwarfInitialized) this.updateDwarfFollow(1);
    const { x, y } = this.dwarfWorld;
    const swing = Math.sin(this.dwarfSwingT * Math.PI * 2);
    const bob = Math.abs(swing) * 2;
    const frame = Math.min(
      DWARF_FRAME_COUNT - 1,
      Math.floor(this.dwarfSwingT * DWARF_FRAME_COUNT),
    );
    const short = Math.min(this.width, this.height);
    const scale = Math.min(0.55, Math.max(0.28, short / 1200));
    const face = this.dwarfFacing >= 0 ? 1 : -1;

    // Contact shadow (shared by sprite + procedural)
    g.ellipse(x, y + 10, 22 * (scale / 0.3), 7 * (scale / 0.3));
    g.fill({ color: COLORS.void, alpha: 0.4 });

    if (this.dwarfSprite) {
      if (this.dwarfFrames.length === DWARF_FRAME_COUNT) {
        this.dwarfSprite.texture = this.dwarfFrames[frame]!;
      }
      this.dwarfSprite.visible = true;
      this.dwarfSprite.x = x;
      this.dwarfSprite.y = y - bob;
      this.dwarfSprite.scale.set(scale * face, scale);
      this.dwarfSprite.rotation = 0;
      this.dwarfSprite.alpha = 1;
    } else {
      this.drawDwarfProcedural(g, x, y, swing * face, bob);
    }

    const cell = this.resolveDwarfTargetCell();
    this.dwarfLabel.visible = true;
    this.dwarfLabel.text = cell ? `Mining col ${cell.col + 1}` : 'Mining…';
    this.dwarfLabel.x = x;
    this.dwarfLabel.y = y + 14;
  }

  private drawDwarfProcedural(g: Graphics, x: number, y: number, swing: number, bob: number) {
    const pickAng = -0.95 + swing * 1.25;
    const s = 1.35;

    g.roundRect(x - 10 * s, y + 5 * s - bob, 7 * s, 14 * s, 2);
    g.fill(COLORS.dwarfCoat);
    g.roundRect(x + 3 * s, y + 5 * s - bob, 7 * s, 14 * s, 2);
    g.fill(COLORS.dwarfCoat);

    g.roundRect(x - 14 * s, y - 16 * s - bob, 28 * s, 24 * s, 6);
    g.fill(COLORS.dwarfCoat);

    g.circle(x, y - 26 * s - bob, 10 * s);
    g.fill(COLORS.dwarfSkin);

    g.roundRect(x - 11 * s, y - 36 * s - bob, 22 * s, 10 * s, 3);
    g.fill(COLORS.dwarfHelm);
    g.moveTo(x, y - 42 * s - bob);
    g.lineTo(x + 7 * s, y - 34 * s - bob);
    g.lineTo(x - 7 * s, y - 34 * s - bob);
    g.closePath();
    g.fill(COLORS.amber);

    g.moveTo(x - 8 * s, y - 22 * s - bob);
    g.lineTo(x, y - 8 * s - bob);
    g.lineTo(x + 8 * s, y - 22 * s - bob);
    g.closePath();
    g.fill({ color: COLORS.slate, alpha: 0.95 });

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
  }

  private isStationRunning(id: StationId): boolean {
    if (!this.state) return false;
    const st = this.state.stations[id];
    if (!st.unlocked || st.level <= 0 || !st.enabled) return false;
    const def = getStation(id);
    const runMult = stationRunMult(st);
    if (!def.inputs) return true;
    for (const [key, rate] of Object.entries(def.inputs) as [ResourceId, number][]) {
      if ((this.state.resources[key] ?? 0) < rate * runMult * 0.05) return false;
    }
    return true;
  }

  private async loadStationArt() {
    for (const def of STATIONS) {
      const url = STATION_ART[def.id];
      if (!url) continue;
      try {
        const texture = await Assets.load(url);
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

  private async loadMineArt() {
    try {
      const frames: Texture[] = [];
      for (const url of DWARF_MINE_FRAMES) {
        frames.push((await Assets.load(url)) as Texture);
      }
      this.dwarfFrames = frames;
      const sprite = new Sprite(frames[0]);
      sprite.anchor.set(0.5, 0.92);
      sprite.visible = false;
      this.dwarfSprite = sprite;
      this.mineLayer.addChild(sprite);
    } catch {
      try {
        const dwarfTex = await Assets.load(DWARF_ART);
        const sprite = new Sprite(dwarfTex);
        sprite.anchor.set(0.5, 0.98);
        sprite.visible = false;
        this.dwarfSprite = sprite;
        this.mineLayer.addChild(sprite);
      } catch {
        // Procedural redrawDwarf fallback.
      }
    }

    try {
      const rockTex = (await Assets.load(ORE_ROCK_ART)) as Texture;
      const pool = SHAFT_COLS * (SHAFT_LOOKAHEAD + SHAFT_LOOKBEHIND + 1);
      for (let i = 0; i < pool; i++) {
        const sprite = new Sprite(rockTex);
        sprite.anchor.set(0.5, 0.85);
        sprite.visible = false;
        this.rockSprites.push(sprite);
        this.oreSpritesRoot.addChild(sprite);
      }
    } catch {
      // Procedural drawShaftCell fallback.
    }
  }

  private stationDisplayScale(): number {
    // Scale with the shorter canvas axis so machines stay on pedestals in portrait.
    const short = Math.min(this.width, this.height);
    return Math.min(0.62, Math.max(0.3, short / 1100));
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

      // Contact shadow + light plinth so machines read grounded even when UV pedestals are cropped.
      g.ellipse(slot.x, slot.y + 6, 52 * baseScale, 14 * baseScale);
      g.fill({ color: COLORS.void, alpha: st.unlocked ? 0.4 : 0.24 });
      g.roundRect(slot.x - 40 * baseScale, slot.y - 4, 80 * baseScale, 14 * baseScale, 5);
      g.fill({ color: COLORS.stone, alpha: st.unlocked ? 0.35 : 0.22 });

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
      const powered = st.enabled;
      const running = this.isStationRunning(slot.id);
      const workPulse = running ? 1 + Math.sin(this.pulse * 5 + st.level) * 0.04 : 1;
      const scale = baseScale * spawnScale * workPulse;

      const poolColor = getStation(slot.id).visualTint;
      g.circle(slot.x, slot.y - 10, 26 * scale);
      g.fill({ color: poolColor, alpha: running ? 0.14 : powered ? 0.06 : 0.03 });

      if (sprite) {
        sprite.visible = true;
        sprite.x = slot.x;
        sprite.y = slot.y;
        sprite.scale.set(scale);
        sprite.alpha = running ? 1 : powered ? 0.92 : 0.55;
        sprite.tint = running ? 0xffffff : powered ? 0xdfeaf0 : 0x8fa8b0;
      } else {
        this.drawStationBody(g, slot.id, slot.x, slot.y, powered ? 1 : 0.55, running, spawnScale * workPulse);
      }

      if (label) {
        label.visible = true;
        const runMult = stationRunMult(st);
        if (!powered) label.text = `${getStation(slot.id).name} (off)`;
        else if (running && runMult < st.level) {
          label.text = `${getStation(slot.id).name} · ${runMult}/${st.level}`;
        } else if (running) label.text = `${getStation(slot.id).name} · Lv${st.level}`;
        else label.text = `${getStation(slot.id).name} (idle)`;
        label.alpha = powered ? 0.95 : 0.7;
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
            color: getStation(slot.id).visualTint,
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
    const accent = getStation(id).visualTint;

    g.roundRect(x - s * 1.1, y + s * 0.2, s * 2.2, s * 0.45, 6);
    g.fill({ color: COLORS.stone, alpha: 0.85 * alpha });

    switch (id) {
      case 'smelter': {
        g.roundRect(x - s * 0.85, y - s * 1.05, s * 1.7, s * 1.4, 8);
        g.fill({ color: COLORS.tealLight, alpha: 0.9 * alpha });
        g.roundRect(x - s * 0.45, y - s * 0.7, s * 0.9, s * 0.7, 5);
        g.fill({
          color: running ? COLORS.ember : COLORS.void,
          alpha: (running ? 0.95 : 0.5) * alpha,
        });
        if (running) {
          g.circle(x, y - s * 0.35, s * 0.28);
          g.fill({ color: COLORS.amber, alpha: 0.85 * alpha });
        }
        break;
      }
      case 'anvil': {
        g.roundRect(x - s * 0.9, y - s * 0.25, s * 1.8, s * 0.55, 4);
        g.fill({ color: COLORS.slate, alpha: 0.95 * alpha });
        g.roundRect(x - s * 0.35, y + s * 0.1, s * 0.7, s * 0.45, 3);
        g.fill({ color: COLORS.tealLight, alpha: 0.9 * alpha });
        if (running) {
          g.circle(x + s * 0.55, y - s * 0.45, 3 + Math.sin(this.pulse * 8) * 1.5);
          g.fill({ color: COLORS.amber, alpha: 0.9 * alpha });
        }
        break;
      }
      case 'enchanter': {
        g.moveTo(x, y - s * 1.1);
        g.lineTo(x + s * 0.7, y + s * 0.15);
        g.lineTo(x - s * 0.7, y + s * 0.15);
        g.closePath();
        g.fill({ color: COLORS.tealLight, alpha: 0.9 * alpha });
        g.circle(x, y - s * 0.45, s * 0.28);
        g.fill({
          color: running ? COLORS.cyan : COLORS.slate,
          alpha: (running ? 0.95 : 0.45) * alpha,
        });
        break;
      }
      case 'crucible': {
        g.ellipse(x, y - s * 0.15, s * 0.95, s * 0.55);
        g.fill({ color: COLORS.tealLight, alpha: 0.9 * alpha });
        g.ellipse(x, y - s * 0.35, s * 0.55, s * 0.28);
        g.fill({
          color: running ? 0x6bbf59 : COLORS.void,
          alpha: (running ? 0.9 : 0.45) * alpha,
        });
        break;
      }
      case 'gemcutter': {
        g.roundRect(x - s * 0.75, y - s * 0.7, s * 1.5, s * 1.05, 5);
        g.fill({ color: COLORS.tealLight, alpha: 0.9 * alpha });
        g.moveTo(x, y - s * 0.95);
        g.lineTo(x + s * 0.4, y - s * 0.35);
        g.lineTo(x - s * 0.4, y - s * 0.35);
        g.closePath();
        g.fill({
          color: running ? 0x7b8cde : COLORS.slate,
          alpha: (running ? 0.95 : 0.5) * alpha,
        });
        break;
      }
      case 'aetherforge': {
        g.roundRect(x - s * 0.9, y - s * 1.0, s * 1.8, s * 1.35, 10);
        g.fill({ color: COLORS.tealLight, alpha: 0.9 * alpha });
        g.circle(x, y - s * 0.4, s * 0.42);
        g.fill({
          color: running ? 0x9ed8e0 : COLORS.slate,
          alpha: (running ? 0.95 : 0.45) * alpha,
        });
        if (running) {
          g.star(x, y - s * 0.4, 6, s * 0.35, s * 0.16, this.pulse);
          g.fill({ color: COLORS.mist, alpha: 0.55 * alpha });
        }
        break;
      }
      default: {
        const _exhaustive: never = id;
        return _exhaustive;
      }
    }

    g.circle(x, y - s * 1.25, running ? 4 : 2.5);
    g.fill({ color: accent, alpha: (running ? 0.95 : 0.4) * alpha });
  }

  private redrawParticles() {
    const g = this.particles;
    g.clear();
    const forge = this.view === 'forge';
    const cx = forge ? this.width * 0.5 : this.veinPoint().x;
    const cy = forge ? this.height * 0.42 : this.veinPoint().y;
    const a = forge ? COLORS.amber : COLORS.cyan;
    const b = forge ? COLORS.ember : COLORS.mist;

    for (let i = 0; i < 14; i++) {
      const t = this.sparkTimer * 0.75 + i * 0.35;
      const px = cx + Math.sin(t * 1.7 + i) * (18 + i * 2);
      const py = cy - ((t * 34 + i * 15) % 100);
      g.circle(px, py, 1.5 + (i % 3) * 0.4);
      g.fill({ color: i % 2 ? a : b, alpha: forge ? 0.55 : 0.4 });
    }

    if (this.craftBurstT > 0) {
      const p = 1 - this.craftBurstT / 0.55;
      for (let i = 0; i < 16; i++) {
        const ang = (i / 16) * Math.PI * 2;
        const r = 24 + p * 90;
        g.circle(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * 0.65, 3.2 * (1 - p));
        g.fill({ color: forge ? COLORS.amber : COLORS.cyan, alpha: 1 - p });
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
