import { BALANCE } from '../data/balance';
import { EXPEDITIONS } from '../data/expeditions';
import { RECIPES } from '../data/recipes';
import { RESOURCES, type ResourceId } from '../data/resources';
import { STATIONS, type StationId } from '../data/stations';
import {
  availableExpeditions,
  availableRecipes,
  canPrestige,
  getClickPower,
  stationUpgradeCostMap,
} from '../sim/economy';
import { prestigeMult } from '../data/balance';
import type { GameState } from '../sim/types';
import { formatCost, formatDuration, formatNumber } from './format';
import { nextGoal } from './goals';
import {
  formatRecipeEffects,
  formatStationIO,
  formatStationUpgradeHint,
} from './effectsText';

export type PanelId = 'recipes' | 'expeditions' | 'forge' | 'ledger' | null;

export interface HudActions {
  onClickVein: () => void;
  onCraftQuick: () => void;
  onOpenPanel: (panel: PanelId) => void;
  onCloseOverlay: () => void;
  onCraftRecipe: (id: string) => void;
  onUnlockStation: (id: StationId) => void;
  onUpgradeStation: (id: StationId) => void;
  onStartExpedition: (id: string) => void;
  onClaimExpedition: (mode: 'normal' | 'ad' | 'coin') => void;
  onPrestige: () => void;
  onTimeWarp: (viaAd: boolean) => void;
  onSkipOnboarding: () => void;
  onAdvanceOnboarding: () => void;
  onToggleMute: () => void;
}

export class Hud {
  private root: HTMLElement;
  private overlay: HTMLElement;
  private panel: PanelId = null;
  private actions: HudActions;
  private lastResources: Partial<Record<ResourceId, number>> = {};
  private floatRoot: HTMLElement | null = null;

  constructor(root: HTMLElement, overlay: HTMLElement, actions: HudActions) {
    this.root = root;
    this.overlay = overlay;
    this.actions = actions;
    this.root.innerHTML = `
      <div class="top-bar">
        <div class="brand-spacer" aria-hidden="true"></div>
        <div class="resources" id="resources"></div>
        <button class="icon-btn" id="btn-mute" type="button" aria-label="Mute">♪</button>
      </div>
      <div class="mid-space">
        <div class="goal-strip" id="goal-strip" hidden>
          <div class="goal-copy">
            <div class="goal-title" id="goal-title">Next goal</div>
            <div class="goal-detail" id="goal-detail"></div>
          </div>
          <div class="goal-meter"><span id="goal-meter"></span></div>
        </div>
        <div class="float-layer" id="float-layer" aria-hidden="true"></div>
      </div>
      <div class="bottom-dock">
        <div class="cta-row">
          <button class="btn btn-primary" id="btn-vein" type="button">Tap Vein</button>
          <button class="btn btn-secondary" id="btn-craft" type="button">Craft</button>
        </div>
        <div class="nav-row">
          <button class="nav-btn" data-panel="recipes" type="button">Recipes</button>
          <button class="nav-btn" data-panel="expeditions" type="button">Expeditions</button>
          <button class="nav-btn" data-panel="forge" type="button">Forge</button>
          <button class="nav-btn" data-panel="ledger" type="button">Ledger</button>
        </div>
      </div>
    `;
    this.floatRoot = this.root.querySelector('#float-layer');

    this.root.querySelector('#btn-vein')?.addEventListener('click', () => this.actions.onClickVein());
    this.root.querySelector('#btn-craft')?.addEventListener('click', () => this.actions.onCraftQuick());
    this.root.querySelector('#btn-mute')?.addEventListener('click', () => {
      this.actions.onToggleMute();
    });
    this.root.querySelectorAll('.nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const panel = (btn as HTMLElement).dataset.panel as PanelId;
        this.actions.onOpenPanel(panel);
      });
    });
  }

  setMuted(muted: boolean) {
    const btn = this.root.querySelector('#btn-mute');
    if (btn) btn.textContent = muted ? '🔇' : '♪';
  }

  setPanel(panel: PanelId) {
    this.panel = panel;
    this.root.querySelectorAll('.nav-btn').forEach((btn) => {
      const id = (btn as HTMLElement).dataset.panel;
      btn.classList.toggle('active', id === panel);
    });
  }

  render(state: GameState, opts?: { notice?: string }) {
    this.renderResources(state);
    this.renderGoal(state);
    const craftBtn = this.root.querySelector('#btn-craft') as HTMLButtonElement | null;
    const next = availableRecipes(state)[0];
    if (craftBtn) {
      const goal = nextGoal(state);
      craftBtn.textContent = next ? `Craft ${next.name}` : 'Crafted out';
      craftBtn.disabled = !next;
      craftBtn.classList.toggle('btn-ready', Boolean(next && goal.ready && goal.id.startsWith('recipe:')));
    }
    const veinBtn = this.root.querySelector('#btn-vein') as HTMLButtonElement | null;
    if (veinBtn) {
      veinBtn.textContent = `Tap Vein (+${formatNumber(getClickPower(state))})`;
    }

    if (this.panel) {
      this.renderPanel(state, opts?.notice);
    } else if (!this.overlay.querySelector('.modal') && !this.overlay.querySelector('.onboarding')) {
      // keep overlay empty unless modal/onboarding managed elsewhere
    }
  }

  /** Short HUD toast — e.g. craft / unlock feedback */
  toast(message: string, kind: 'gain' | 'info' = 'info') {
    if (!this.floatRoot) return;
    const el = document.createElement('div');
    el.className = `hud-toast hud-toast-${kind}`;
    el.textContent = message;
    this.floatRoot.appendChild(el);
    window.setTimeout(() => el.classList.add('show'), 10);
    window.setTimeout(() => {
      el.classList.remove('show');
      window.setTimeout(() => el.remove(), 280);
    }, 1400);
  }

  pulseVeinButton() {
    const veinBtn = this.root.querySelector('#btn-vein');
    veinBtn?.classList.remove('btn-pulse');
    // reflow
    void (veinBtn as HTMLElement | null)?.offsetWidth;
    veinBtn?.classList.add('btn-pulse');
  }

  private renderGoal(state: GameState) {
    const strip = this.root.querySelector('#goal-strip') as HTMLElement | null;
    if (!strip) return;
    const goal = nextGoal(state);
    strip.hidden = false;
    strip.classList.toggle('goal-ready', goal.ready);
    const title = this.root.querySelector('#goal-title');
    const detail = this.root.querySelector('#goal-detail');
    const meter = this.root.querySelector('#goal-meter') as HTMLElement | null;
    if (title) title.textContent = goal.ready ? `Ready · ${goal.title}` : goal.title;
    if (detail) detail.textContent = goal.detail;
    if (meter) meter.style.width = `${Math.round(goal.progress * 100)}%`;
  }

  showOnboarding(step: number) {
    const copy = [
      {
        title: 'The vein answers',
        body: 'Tap the glowing ore vein to gather Vein Ore. Your forge wakes with every strike.',
      },
      {
        title: 'Craft your first tool',
        body: 'Spend ore on a Copper Pick. Better tools mean richer taps.',
      },
      {
        title: 'Light the stations',
        body: 'Unlock the Smelter when you can — auto production keeps the cavern alive.',
      },
    ];
    const item = copy[Math.min(step, copy.length - 1)];
    this.overlay.innerHTML = `
      <div class="onboarding">
        <h2>${item.title}</h2>
        <p>${item.body}</p>
        <div class="modal-actions">
          <button class="btn btn-primary" id="ob-next" type="button">${step >= 2 ? 'Begin' : 'Next'}</button>
          <button class="btn btn-ghost" id="ob-skip" type="button">Skip</button>
        </div>
      </div>
    `;
    this.markOverlayOpen();
    this.overlay.querySelector('#ob-next')?.addEventListener('click', () => this.actions.onAdvanceOnboarding());
    this.overlay.querySelector('#ob-skip')?.addEventListener('click', () => this.actions.onSkipOnboarding());
  }

  showOfflineSummary(seconds: number, gains: Partial<Record<ResourceId, number>>) {
    const items = (Object.entries(gains) as [ResourceId, number][])
      .map(([id, amount]) => {
        const name = RESOURCES.find((r) => r.id === id)?.name ?? id;
        return `<li><span>${name}</span><span>+${formatNumber(amount)}</span></li>`;
      })
      .join('');
    this.overlay.innerHTML = `
      <div class="modal">
        <h2>While you were away</h2>
        <p>The forge worked for ${formatDuration(seconds)} (offline cap applies).</p>
        <ul class="loot-list">${items || '<li><span>Quiet cavern</span><span>—</span></li>'}</ul>
        <div class="modal-actions">
          <button class="btn btn-primary" id="offline-ok" type="button">Collect</button>
        </div>
      </div>
    `;
    this.markOverlayOpen();
    this.overlay.querySelector('#offline-ok')?.addEventListener('click', () => this.actions.onCloseOverlay());
  }

  showExpeditionReturn(
    loot: Partial<Record<ResourceId, number>>,
    options: { canReward: boolean; adblock: boolean; adsDisabled: boolean; coinAlt: boolean },
  ) {
    const items = (Object.entries(loot) as [ResourceId, number][])
      .map(([id, amount]) => {
        const name = RESOURCES.find((r) => r.id === id)?.short ?? id;
        return `<li><span>${name}</span><span>+${formatNumber(amount)}</span></li>`;
      })
      .join('');

    let rewardBlock = '';
    if (options.adsDisabled) {
      rewardBlock = options.coinAlt
        ? `<button class="btn btn-secondary" id="claim-coin" type="button">2× for ${BALANCE.timeWarpCoinCost} Ore</button>`
        : `<p class="notice">Bonus rewards unavailable in this build.</p>`;
    } else if (options.adblock) {
      rewardBlock = `<p class="notice">Ad blocked — reward boost unavailable. Game stays fully playable.</p>`;
    } else if (options.canReward) {
      rewardBlock = `
        <button class="btn btn-reward" id="claim-double" type="button">▶ 2× Loot</button>
        ${options.coinAlt ? `<button class="btn btn-secondary" id="claim-coin" type="button">2× for ${BALANCE.timeWarpCoinCost} Ore</button>` : ''}
      `;
    } else {
      rewardBlock = `<p class="muted">Reward boost cooling down…</p>`;
    }

    this.overlay.innerHTML = `
      <div class="modal">
        <h2>Scouts returned</h2>
        <p>Cyan trails fade as the pack hits the forge floor.</p>
        <ul class="loot-list">${items}</ul>
        <div class="modal-actions">
          <button class="btn btn-primary" id="claim-normal" type="button">Claim</button>
          ${rewardBlock}
          <button class="btn btn-ghost" id="claim-nothanks" type="button">No thanks</button>
        </div>
      </div>
    `;
    this.markOverlayOpen();
    this.overlay.querySelector('#claim-normal')?.addEventListener('click', () => this.actions.onClaimExpedition('normal'));
    this.overlay.querySelector('#claim-nothanks')?.addEventListener('click', () => this.actions.onClaimExpedition('normal'));
    this.overlay.querySelector('#claim-double')?.addEventListener('click', () => this.actions.onClaimExpedition('ad'));
    this.overlay.querySelector('#claim-coin')?.addEventListener('click', () => this.actions.onClaimExpedition('coin'));
  }

  showPrestigeConfirm(relicsPreview: number, mult: number) {
    this.overlay.innerHTML = `
      <div class="modal">
        <h2>Reforge the Forge</h2>
        <p>Reset production for <strong>${relicsPreview} Relics</strong>. Permanent power becomes ×${mult.toFixed(2)}.</p>
        <div class="modal-actions">
          <button class="btn btn-primary" id="prestige-yes" type="button">Reforge</button>
          <button class="btn btn-ghost" id="prestige-no" type="button">Not yet</button>
        </div>
      </div>
    `;
    this.markOverlayOpen();
    this.overlay.querySelector('#prestige-yes')?.addEventListener('click', () => this.actions.onPrestige());
    this.overlay.querySelector('#prestige-no')?.addEventListener('click', () => this.actions.onCloseOverlay());
  }

  showMilestone(title: string, body: string) {
    this.overlay.innerHTML = `
      <div class="modal">
        <h2>${title}</h2>
        <p>${body}</p>
        <div class="modal-actions">
          <button class="btn btn-primary" id="ms-ok" type="button">Continue</button>
        </div>
      </div>
    `;
    this.markOverlayOpen();
    this.overlay.querySelector('#ms-ok')?.addEventListener('click', () => this.actions.onCloseOverlay());
  }

  clearOverlay() {
    this.overlay.innerHTML = '';
    this.overlay.classList.remove('is-open');
    this.overlay.onclick = null;
  }

  private renderResources(state: GameState) {
    const el = this.root.querySelector('#resources');
    if (!el) return;
    el.innerHTML = RESOURCES.map((r) => {
      const value = state.resources[r.id];
      if (r.id === 'relics' && value <= 0 && state.totalRelicsEarned <= 0) return '';
      const prev = this.lastResources[r.id] ?? value;
      const grew = value > prev + 0.01;
      return `<div class="res-chip${grew ? ' res-pop' : ''}" data-res="${r.id}"><span class="dot" style="background:${r.color};color:${r.color}"></span>${r.short} ${formatNumber(value)}</div>`;
    }).join('');
    this.lastResources = { ...state.resources };
  }

  private renderPanel(state: GameState, notice?: string) {
    if (this.panel === 'recipes') this.renderRecipes(state);
    else if (this.panel === 'expeditions') this.renderExpeditions(state);
    else if (this.panel === 'forge') this.renderForge(state, notice);
    else if (this.panel === 'ledger') this.renderLedger(state, notice);
  }

  private renderRecipes(state: GameState) {
    const owned = new Set(state.ownedRecipes);
    const rows = RECIPES.map((r) => {
      const have = owned.has(r.id);
      const unlocked = !r.requires || r.requires.every((req) => owned.has(req));
      const disabled = have || !unlocked;
      const effects = formatRecipeEffects(r);
      const req = r.requires?.length
        ? `Needs ${r.requires.map((id) => RECIPES.find((x) => x.id === id)?.name ?? id).join(', ')}`
        : 'Starter recipe';
      return `
        <div class="row-item">
          <div>
            <h3>${r.name}${have ? ' ✓' : ''}</h3>
            <div class="cost">${formatCost(r.cost)} · ${r.category}</div>
            <div class="effect-line">${effects}</div>
          </div>
          <button class="btn btn-secondary" data-craft="${r.id}" type="button" ${disabled ? 'disabled' : ''}>${have ? 'Owned' : 'Craft'}</button>
          <p>${r.description} <span class="muted">(${req})</span></p>
        </div>
      `;
    }).join('');

    this.overlay.innerHTML = `
      <div class="sheet">
        <div class="sheet-header">
          <h2>Recipes</h2>
          <button class="icon-btn" id="sheet-close" type="button" aria-label="Close">✕</button>
        </div>
        <div class="list">${rows}</div>
      </div>
    `;
    this.bindSheet();
    this.overlay.querySelectorAll('[data-craft]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.craft!;
        this.actions.onCraftRecipe(id);
      });
    });
  }

  private renderExpeditions(state: GameState) {
    const unlocked = new Set(availableExpeditions(state).map((e) => e.id));
    const active = state.activeExpedition;
    const now = Date.now();

    const rows = EXPEDITIONS.map((e) => {
      const isUnlocked = unlocked.has(e.id);
      let status = formatCost(e.cost) + ` · ${formatDuration(e.durationSec)}`;
      let action = `<button class="btn btn-secondary" data-exp="${e.id}" type="button" ${!isUnlocked || active ? 'disabled' : ''}>Send</button>`;
      if (!isUnlocked) {
        status = `Unlock at ${formatNumber(e.unlockAtOreProduced)} lifetime ore`;
        action = `<button class="btn btn-secondary" type="button" disabled>Locked</button>`;
      }
      if (active?.id === e.id) {
        const left = Math.max(0, (active.endsAt - now) / 1000);
        const pct = Math.min(100, ((e.durationSec - left) / e.durationSec) * 100);
        status = left > 0 ? `Returning in ${formatDuration(left)}` : 'Ready to claim';
        action = `<div class="progress-bar" style="width:88px"><span style="width:${pct}%"></span></div>`;
      }
      const lootHint = Object.entries(e.baseLoot)
        .map(([k, v]) => `+${v} ${k}`)
        .join(' · ');
      return `
        <div class="row-item">
          <div>
            <h3>${e.name}</h3>
            <div class="cost">${status}</div>
            <div class="effect-line">Loot: ${lootHint}</div>
          </div>
          ${action}
          <p>${e.description}</p>
        </div>
      `;
    }).join('');

    this.overlay.innerHTML = `
      <div class="sheet">
        <div class="sheet-header">
          <h2>Expeditions</h2>
          <button class="icon-btn" id="sheet-close" type="button" aria-label="Close">✕</button>
        </div>
        <div class="list">${rows}</div>
      </div>
    `;
    this.bindSheet();
    this.overlay.querySelectorAll('[data-exp]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.actions.onStartExpedition((btn as HTMLElement).dataset.exp!);
      });
    });
  }

  private renderForge(state: GameState, notice?: string) {
    const stationRows = STATIONS.map((s) => {
      const st = state.stations[s.id as StationId];
      if (!st.unlocked) {
        const gate = s.unlockRequires
          ? `Requires ${STATIONS.find((x) => x.id === s.unlockRequires)?.name ?? s.unlockRequires} first`
          : 'Appears in the forge when unlocked';
        return `
          <div class="row-item">
            <div>
              <h3>${s.name}</h3>
              <div class="cost">${formatCost(s.unlockCost)}</div>
              <div class="effect-line">${formatStationIO(s, 1)}</div>
            </div>
            <button class="btn btn-secondary" data-unlock="${s.id}" type="button">Unlock</button>
            <p>${s.description} <span class="muted">(${gate})</span></p>
          </div>
        `;
      }
      const cost = stationUpgradeCostMap(s.id, st.level);
      return `
        <div class="row-item">
          <div>
            <h3>${s.name} · Lv ${st.level}</h3>
            <div class="cost">Upgrade ${formatCost(cost)}</div>
            <div class="effect-line">${formatStationIO(s, st.level)}</div>
            <div class="effect-line muted">${formatStationUpgradeHint(st.level)}</div>
          </div>
          <button class="btn btn-secondary" data-upgrade="${s.id}" type="button">Upgrade</button>
          <p>${s.description} <span class="muted">(runs automatically when inputs are available)</span></p>
        </div>
      `;
    }).join('');

    const relicsPreview = Math.max(1, Math.floor(1 + state.lifetimeOre * 0.015 + state.prestigeCount * 0.5));
    const nextMult = prestigeMult(state.totalRelicsEarned + relicsPreview);

    this.overlay.innerHTML = `
      <div class="sheet">
        <div class="sheet-header">
          <h2>Forge</h2>
          <button class="icon-btn" id="sheet-close" type="button" aria-label="Close">✕</button>
        </div>
        <p class="muted">Prestige mult ×${prestigeMult(state.totalRelicsEarned).toFixed(2)} · Cosmetic: ${state.activeCosmetic}</p>
        <div class="list">${stationRows}</div>
        <div class="row-item">
          <div>
            <h3>Reforge</h3>
            <div class="cost">Gain ~${relicsPreview} Relics → ×${nextMult.toFixed(2)}</div>
          </div>
          <button class="btn btn-primary" id="btn-prestige" type="button" ${canPrestige(state) ? '' : 'disabled'}>Reforge</button>
          <p>Reset production for permanent power and a forge crest.</p>
        </div>
        <div class="row-item">
          <div>
            <h3>Time Warp</h3>
            <div class="cost">+${BALANCE.timeWarpSeconds / 60} min production</div>
          </div>
          <button class="btn btn-reward" id="btn-warp-ad" type="button">▶ Warp</button>
          <p>Optional rewarded boost. Equal coin spend available below.</p>
        </div>
        <button class="btn btn-secondary" id="btn-warp-coin" type="button">Warp for ${BALANCE.timeWarpCoinCost} Ore</button>
        ${notice ? `<p class="notice">${notice}</p>` : ''}
      </div>
    `;
    this.bindSheet();
    this.overlay.querySelectorAll('[data-unlock]').forEach((btn) => {
      btn.addEventListener('click', () => this.actions.onUnlockStation((btn as HTMLElement).dataset.unlock as StationId));
    });
    this.overlay.querySelectorAll('[data-upgrade]').forEach((btn) => {
      btn.addEventListener('click', () => this.actions.onUpgradeStation((btn as HTMLElement).dataset.upgrade as StationId));
    });
    this.overlay.querySelector('#btn-prestige')?.addEventListener('click', () => {
      this.actions.onOpenPanel(null);
      // prestige confirm via dedicated flow
      const preview = relicsPreview;
      this.showPrestigeConfirm(preview, nextMult);
    });
    this.overlay.querySelector('#btn-warp-ad')?.addEventListener('click', () => this.actions.onTimeWarp(true));
    this.overlay.querySelector('#btn-warp-coin')?.addEventListener('click', () => this.actions.onTimeWarp(false));
  }

  private renderLedger(state: GameState, notice?: string) {
    this.overlay.innerHTML = `
      <div class="sheet">
        <div class="sheet-header">
          <h2>Ledger</h2>
          <button class="icon-btn" id="sheet-close" type="button" aria-label="Close">✕</button>
        </div>
        <div class="list">
          <div class="row-item"><div><h3>Lifetime ore</h3></div><div>${formatNumber(state.lifetimeOre)}</div></div>
          <div class="row-item"><div><h3>Play time</h3></div><div>${formatDuration(state.playTimeSec)}</div></div>
          <div class="row-item"><div><h3>Reforges</h3></div><div>${state.prestigeCount}</div></div>
          <div class="row-item"><div><h3>Relics earned</h3></div><div>${formatNumber(state.totalRelicsEarned)}</div></div>
          <div class="row-item"><div><h3>Recipes owned</h3></div><div>${state.ownedRecipes.length}/${RECIPES.length}</div></div>
        </div>
        ${notice ? `<p class="notice">${notice}</p>` : ''}
        <p class="muted" style="margin-top:12px">Collection banner slot reserved — shown only when this panel stays open.</p>
      </div>
    `;
    this.bindSheet();
  }

  private bindSheet() {
    this.overlay.classList.add('is-open');
    this.overlay.querySelector('#sheet-close')?.addEventListener('click', () => this.actions.onCloseOverlay());
    const sheet = this.overlay.querySelector('.sheet');
    sheet?.addEventListener('click', (e) => e.stopPropagation());
    // Backdrop tap dismisses — needed on mobile where the sheet covers the nav row.
    this.overlay.onclick = () => this.actions.onCloseOverlay();
  }

  private markOverlayOpen() {
    this.overlay.classList.add('is-open');
    // Modals/onboarding manage their own dismiss controls — don't inherit sheet backdrop taps.
    this.overlay.onclick = null;
  }
}
