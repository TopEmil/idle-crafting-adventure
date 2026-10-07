import { BALANCE, relicsFromReforge } from '../data/balance';
import { EXPEDITIONS } from '../data/expeditions';
import { RECIPES } from '../data/recipes';
import { RESOURCES, type ResourceId } from '../data/resources';
import { STATIONS, type StationId } from '../data/stations';
import { TALENTS, talentUpgradeCost, type TalentId } from '../data/talents';
import {
  canAfford,
  canPrestige,
  getClickPower,
  prestigeCooldownRemaining,
  stationUpgradeCostMap,
} from '../sim/economy';
import type { GameState } from '../sim/types';
import { getCraftQuickState } from './craftState';
import { expeditionActionHtml, getExpeditionRowState } from './expeditionState';
import { formatCost, formatDuration, formatMissingCost, formatNumber } from './format';
import { nextGoal } from './goals';
import {
  formatRecipeEffects,
  formatStationIO,
  formatStationUpgradeHint,
  formatTalentEffects,
  formatTalentPerLevel,
} from './effectsText';
import type { SceneView } from '../forge/sceneView';

export type PanelId = 'recipes' | 'expeditions' | 'forge' | 'ledger' | null;

export interface HudActions {
  onClickVein: () => void;
  onCraftQuick: () => void;
  onSetView: (view: SceneView) => void;
  onOpenPanel: (panel: PanelId) => void;
  onCloseOverlay: () => void;
  onCraftRecipe: (id: string) => void;
  onUnlockStation: (id: StationId) => void;
  onUpgradeStation: (id: StationId) => void;
  onToggleStation: (id: StationId) => void;
  onStartExpedition: (id: string) => void;
  onRevealExpeditionLoot: () => void;
  onClaimExpedition: (mode: 'normal' | 'ad' | 'coin') => void;
  onPrestige: () => void;
  onBuyTalent: (id: TalentId) => void;
  onTimeWarp: (viaAd: boolean) => void;
  onSkipOnboarding: () => void;
  onAdvanceOnboarding: () => void;
  onToggleMute: () => void;
}

export class Hud {
  private root: HTMLElement;
  private overlay: HTMLElement;
  private panel: PanelId = null;
  private view: SceneView = 'mine';
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
        <div class="view-row" role="tablist" aria-label="Scene">
          <button class="view-btn active" data-view="mine" type="button" role="tab" aria-selected="true">Mine</button>
          <button class="view-btn" data-view="forge" type="button" role="tab" aria-selected="false">Forge</button>
        </div>
        <div class="cta-row">
          <button class="btn btn-primary" id="btn-vein" type="button">Mine</button>
          <div class="craft-cta">
            <button class="btn btn-secondary" id="btn-craft" type="button">Craft</button>
            <div class="craft-need" id="craft-need" hidden>
              <div class="craft-need-label" id="craft-need-label"></div>
              <div class="craft-need-meter" aria-hidden="true"><span id="craft-need-meter"></span></div>
            </div>
          </div>
        </div>
        <div class="nav-row">
          <button class="nav-btn" data-panel="recipes" type="button">Recipes</button>
          <button class="nav-btn" data-panel="expeditions" type="button">Expeditions</button>
          <button class="nav-btn" data-panel="forge" type="button">Stations</button>
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
    this.root.querySelectorAll('.view-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const view = (btn as HTMLElement).dataset.view as SceneView;
        this.actions.onSetView(view);
      });
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

  setView(view: SceneView) {
    this.view = view;
    this.root.querySelectorAll('.view-btn').forEach((btn) => {
      const id = (btn as HTMLElement).dataset.view;
      const active = id === view;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    this.root.classList.toggle('view-mine', view === 'mine');
    this.root.classList.toggle('view-forge', view === 'forge');
  }

  setPanel(panel: PanelId) {
    this.panel = panel;
    this.root.querySelectorAll('.nav-btn').forEach((btn) => {
      const id = (btn as HTMLElement).dataset.panel;
      btn.classList.toggle('active', id === panel);
    });
  }

  /** Top-bar / dock chrome only — safe to call every frame with a sheet open. */
  renderChrome(state: GameState) {
    this.renderResources(state);
    this.renderGoal(state);
    this.renderCraftQuick(state);
    this.setView(this.view);
    const veinBtn = this.root.querySelector('#btn-vein') as HTMLButtonElement | null;
    if (veinBtn) {
      veinBtn.textContent = `Mine (+${formatNumber(getClickPower(state))})`;
      veinBtn.classList.toggle('btn-primary', this.view === 'mine');
      veinBtn.classList.toggle('btn-secondary', this.view === 'forge');
    }
    const craftBtn = this.root.querySelector('#btn-craft') as HTMLButtonElement | null;
    if (craftBtn) {
      craftBtn.classList.toggle('btn-primary', this.view === 'forge');
      craftBtn.classList.toggle('btn-secondary', this.view === 'mine');
    }
  }

  render(state: GameState, opts?: { notice?: string }) {
    this.renderChrome(state);

    if (this.panel) {
      this.renderPanel(state, opts?.notice);
    } else if (!this.overlay.querySelector('.modal') && !this.overlay.querySelector('.onboarding')) {
      // keep overlay empty unless modal/onboarding managed elsewhere
    }
  }

  /**
   * Update expedition timers / claim affordances without replacing the sheet DOM.
   * Full rebuilds every frame made Send/Claim taps miss their targets.
   */
  syncExpeditionProgress(state: GameState) {
    if (this.panel !== 'expeditions') return;
    if (!this.overlay.querySelector('[data-expedition-sheet]')) {
      this.renderExpeditions(state);
      return;
    }
    this.patchExpeditionRows(state);
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
        title: 'Crack the ore',
        body: 'Tap the stone cluster to chip rocks and pull Vein Ore. Each strike cracks the face.',
      },
      {
        title: 'Craft your first tool',
        body: 'Spend ore on a Copper Pick. A forge dwarf joins in and keeps mining while you craft.',
      },
      {
        title: 'Light the stations',
        body: 'Switch to the Forge view and unlock the Smelter — machines sit on the hall pedestals and keep producing.',
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

  showPrestigeConfirm(relicsPreview: number) {
    this.overlay.innerHTML = `
      <div class="modal">
        <h2>Reforge the Forge</h2>
        <p>Reset production for <strong>${relicsPreview} Relics</strong>. Spend them on permanent Talents — then wait ${BALANCE.prestigeCooldownSec / 60} min before the next Reforge.</p>
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

  private renderCraftQuick(state: GameState) {
    const craftBtn = this.root.querySelector('#btn-craft') as HTMLButtonElement | null;
    const need = this.root.querySelector('#craft-need') as HTMLElement | null;
    const needLabel = this.root.querySelector('#craft-need-label');
    const needMeter = this.root.querySelector('#craft-need-meter') as HTMLElement | null;
    if (!craftBtn) return;

    const craft = getCraftQuickState(state);
    craftBtn.textContent = craft.label;
    craftBtn.disabled = !craft.recipe || !craft.affordable;
    craftBtn.classList.toggle('btn-ready', Boolean(craft.recipe && craft.affordable));
    craftBtn.setAttribute(
      'aria-disabled',
      craftBtn.disabled ? 'true' : 'false',
    );
    if (!craft.recipe) {
      craftBtn.title = 'Every recipe is already crafted';
    } else if (!craft.affordable) {
      craftBtn.title = formatMissingCost(craft.recipe.cost, state.resources);
    } else {
      craftBtn.title = `Craft ${craft.recipe.name}`;
    }

    if (need && needLabel && needMeter) {
      if (!craft.needDetail) {
        need.hidden = true;
      } else {
        need.hidden = false;
        need.classList.toggle('craft-need-ready', craft.affordable);
        needLabel.textContent = craft.needDetail;
        needMeter.style.width = `${Math.round(craft.progress * 100)}%`;
      }
    }
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
    else if (this.panel === 'expeditions') this.renderExpeditions(state, notice);
    else if (this.panel === 'forge') this.renderForge(state, notice);
    else if (this.panel === 'ledger') this.renderLedger(state, notice);
  }

  private renderRecipes(state: GameState) {
    const owned = new Set(state.ownedRecipes);
    const rows = RECIPES.map((r) => {
      const have = owned.has(r.id);
      const unlocked = !r.requires || r.requires.every((req) => owned.has(req));
      const affordable = canAfford(state.resources, r.cost);
      const disabled = have || !unlocked || !affordable;
      const effects = formatRecipeEffects(r);
      const req = r.requires?.length
        ? `Needs ${r.requires.map((id) => RECIPES.find((x) => x.id === id)?.name ?? id).join(', ')}`
        : 'Starter recipe';
      let actionLabel = 'Craft';
      if (have) actionLabel = 'Owned';
      else if (!unlocked) actionLabel = 'Locked';
      else if (!affordable) actionLabel = 'Need more';
      const costHint =
        !have && unlocked && !affordable
          ? formatMissingCost(r.cost, state.resources)
          : formatCost(r.cost);
      return `
        <div class="row-item${!have && unlocked && !affordable ? ' row-item-blocked' : ''}">
          <div>
            <h3>${r.name}${have ? ' ✓' : ''}</h3>
            <div class="cost">${costHint} · ${r.category}</div>
            <div class="effect-line">${effects}</div>
          </div>
          <button class="btn btn-secondary" data-craft="${r.id}" type="button" ${disabled ? 'disabled' : ''} title="${have || unlocked ? '' : req}">${actionLabel}</button>
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

  private renderExpeditions(state: GameState, notice?: string) {
    const now = Date.now();
    const pending = state.pendingLoot;
    const orphanClaim = Boolean(pending) && !state.activeExpedition;

    const rows = EXPEDITIONS.map((e) => {
      const row = getExpeditionRowState(state, e, now);
      const lootHint = Object.entries(e.baseLoot)
        .map(([k, v]) => `+${v} ${k}`)
        .join(' · ');
      const showMeter = row.kind === 'locked' || row.kind === 'need_cost';
      const meter = showMeter
        ? `<div class="req-meter" data-exp-meter aria-hidden="true"><span style="width:${Math.round(row.progress * 100)}%"></span></div>`
        : `<div class="req-meter" data-exp-meter hidden aria-hidden="true"><span style="width:0%"></span></div>`;
      return `
        <div class="row-item${row.blocked ? ' row-item-blocked' : ''}" data-exp-row="${e.id}">
          <div>
            <h3>${e.name}</h3>
            <div class="cost" data-exp-status>${row.status}</div>
            ${meter}
            <div class="req-line" data-exp-req>${row.requirements}</div>
            <div class="effect-line">Loot: ${lootHint}</div>
          </div>
          <div data-exp-action data-exp-mode="${row.mode}">${expeditionActionHtml(row, e.id)}</div>
          <p>${e.description}</p>
        </div>
      `;
    }).join('');

    const orphan = orphanClaim
      ? `<div class="row-item" data-exp-orphan-claim>
          <div>
            <h3>Loot waiting</h3>
            <div class="cost">Scouts already returned — claim your haul.</div>
          </div>
          <div data-exp-action data-exp-mode="claim">
            <button class="btn btn-primary" id="exp-claim" type="button">Claim</button>
          </div>
        </div>`
      : '';

    this.overlay.innerHTML = `
      <div class="sheet" data-expedition-sheet>
        <div class="sheet-header">
          <h2>Expeditions</h2>
          <button class="icon-btn" id="sheet-close" type="button" aria-label="Close">✕</button>
        </div>
        <p class="sheet-intro">Unlock destinations with lifetime ore, spend the listed cost, then wait for scouts to return. Only one party at a time.</p>
        ${notice ? `<p class="notice">${notice}</p>` : ''}
        <div class="list">${orphan}${rows}</div>
      </div>
    `;
    this.bindSheet();
    this.bindExpeditionActions();
  }

  private patchExpeditionRows(state: GameState) {
    const now = Date.now();
    const pending = state.pendingLoot;
    const orphanClaim = Boolean(pending) && !state.activeExpedition;

    const list = this.overlay.querySelector('[data-expedition-sheet] .list');
    if (list) {
      let orphan = list.querySelector('[data-exp-orphan-claim]');
      if (orphanClaim && !orphan) {
        orphan = document.createElement('div');
        orphan.className = 'row-item';
        orphan.setAttribute('data-exp-orphan-claim', '');
        orphan.innerHTML = `
          <div>
            <h3>Loot waiting</h3>
            <div class="cost">Scouts already returned — claim your haul.</div>
          </div>
          <div data-exp-action data-exp-mode="claim">
            <button class="btn btn-primary" id="exp-claim" type="button">Claim</button>
          </div>
        `;
        list.prepend(orphan);
        this.bindExpeditionActions();
      } else if (!orphanClaim && orphan) {
        orphan.remove();
      }
    }

    for (const e of EXPEDITIONS) {
      const rowEl = this.overlay.querySelector(`[data-exp-row="${e.id}"]`);
      if (!rowEl) continue;
      const statusEl = rowEl.querySelector('[data-exp-status]');
      const reqEl = rowEl.querySelector('[data-exp-req]');
      const meterEl = rowEl.querySelector('[data-exp-meter]') as HTMLElement | null;
      const actionEl = rowEl.querySelector('[data-exp-action]') as HTMLElement | null;
      if (!statusEl || !actionEl) continue;

      const row = getExpeditionRowState(state, e, now);
      statusEl.textContent = row.status;
      if (reqEl) reqEl.textContent = row.requirements;
      rowEl.classList.toggle('row-item-blocked', row.blocked);
      if (meterEl) {
        const showMeter = row.kind === 'locked' || row.kind === 'need_cost';
        meterEl.hidden = !showMeter;
        const fill = meterEl.querySelector('span') as HTMLElement | null;
        if (fill) fill.style.width = `${Math.round(row.progress * 100)}%`;
      }

      const prevMode = actionEl.dataset.expMode;
      if (prevMode !== row.mode) {
        actionEl.dataset.expMode = row.mode;
        actionEl.innerHTML = expeditionActionHtml(row, e.id);
        this.bindExpeditionActions();
      } else if (row.mode === 'progress') {
        const bar = actionEl.querySelector('[data-exp-bar]') as HTMLElement | null;
        if (bar) bar.style.width = `${row.activePct ?? 0}%`;
        statusEl.textContent = row.status;
      } else if (
        row.mode === 'send' ||
        row.mode === 'need_cost' ||
        row.mode === 'busy' ||
        row.mode === 'claim_first' ||
        row.mode === 'locked'
      ) {
        const btn = actionEl.querySelector('[data-exp]') as HTMLButtonElement | null;
        if (btn) {
          btn.disabled = !row.canSend;
          btn.textContent = row.actionLabel;
          btn.title = row.requirements;
        }
      }
    }
  }

  private bindExpeditionActions() {
    this.overlay.querySelectorAll('[data-exp]').forEach((btn) => {
      const el = btn as HTMLElement;
      if (el.dataset.bound === '1') return;
      el.dataset.bound = '1';
      el.addEventListener('click', () => {
        this.actions.onStartExpedition(el.dataset.exp!);
      });
    });
    const claim = this.overlay.querySelector('#exp-claim') as HTMLElement | null;
    if (claim && claim.dataset.bound !== '1') {
      claim.dataset.bound = '1';
      claim.addEventListener('click', () => {
        this.actions.onRevealExpeditionLoot();
      });
    }
  }

  private renderForge(state: GameState, notice?: string) {
    const stationRows = STATIONS.map((s) => {
      const st = state.stations[s.id as StationId];
      if (!st.unlocked) {
        const prereqOk = !s.unlockRequires || state.stations[s.unlockRequires].unlocked;
        const affordable = canAfford(state.resources, s.unlockCost);
        const gate = s.unlockRequires
          ? `Requires ${STATIONS.find((x) => x.id === s.unlockRequires)?.name ?? s.unlockRequires} first`
          : 'Appears in the forge when unlocked';
        const disabled = !prereqOk || !affordable;
        let actionLabel = 'Unlock';
        if (!prereqOk) actionLabel = 'Locked';
        else if (!affordable) actionLabel = 'Need more';
        const costHint =
          prereqOk && !affordable
            ? formatMissingCost(s.unlockCost, state.resources)
            : formatCost(s.unlockCost);
        return `
          <div class="row-item${!prereqOk || !affordable ? ' row-item-blocked' : ''}">
            <div>
              <h3>${s.name}</h3>
              <div class="cost">${costHint}</div>
              <div class="effect-line">${formatStationIO(s, 1)}</div>
            </div>
            <button class="btn btn-secondary" data-unlock="${s.id}" type="button" ${disabled ? 'disabled' : ''}>${actionLabel}</button>
            <p>${s.description} <span class="muted">(${gate})</span></p>
          </div>
        `;
      }
      const cost = stationUpgradeCostMap(s.id, st.level);
      const affordable = canAfford(state.resources, cost);
      const atCap = st.level >= BALANCE.stationLevelCap;
      const disabled = atCap || !affordable;
      let actionLabel = 'Upgrade';
      if (atCap) actionLabel = 'Max';
      else if (!affordable) actionLabel = 'Need more';
      const costHint = !atCap && !affordable
        ? formatMissingCost(cost, state.resources)
        : `Upgrade ${formatCost(cost)}`;
      const powerLabel = st.enabled ? 'On' : 'Off';
      const powerClass = st.enabled ? 'btn-power is-on' : 'btn-power is-off';
      const statusHint = st.enabled
        ? 'Running when inputs are available'
        : 'Paused — turn On to resume';
      return `
        <div class="row-item${!atCap && !affordable ? ' row-item-blocked' : ''}${!st.enabled ? ' row-item-paused' : ''}">
          <div>
            <h3>${s.name} · Lv ${st.level}${st.enabled ? '' : ' · Off'}</h3>
            <div class="cost">${costHint}</div>
            <div class="effect-line">${formatStationIO(s, st.level)}</div>
            <div class="effect-line muted">${formatStationUpgradeHint(st.level)}</div>
          </div>
          <div class="row-actions">
            <button class="btn ${powerClass}" data-toggle="${s.id}" type="button" aria-pressed="${st.enabled ? 'true' : 'false'}">${powerLabel}</button>
            <button class="btn btn-secondary" data-upgrade="${s.id}" type="button" ${disabled ? 'disabled' : ''}>${actionLabel}</button>
          </div>
          <p>${s.description} <span class="muted">(${statusHint})</span></p>
        </div>
      `;
    }).join('');

    const relicsPreview = relicsFromReforge(state.lifetimeOre, state.prestigeCount);
    const coolLeft = prestigeCooldownRemaining(state);
    const prestigeReady = canPrestige(state);
    let prestigeLabel = 'Reforge';
    let prestigeHint = 'Reset production for Relics — spend them on Talents below.';
    let prestigeCost = `Gain ~${relicsPreview} Relics`;
    if (!prestigeReady && coolLeft > 0) {
      prestigeLabel = formatDuration(coolLeft);
      prestigeHint = `Reforge cools ${BALANCE.prestigeCooldownSec / 60} min between runs.`;
      prestigeCost = `Ready in ${formatDuration(coolLeft)}`;
    } else if (!prestigeReady) {
      prestigeLabel = 'Locked';
      prestigeHint = `Need ${BALANCE.prestigeMinLifetimeOre} lifetime ore, or unlock the Smelter.`;
    }

    const talentRows = TALENTS.map((t) => {
      const level = state.talents[t.id] ?? 0;
      const atMax = level >= t.maxLevel;
      const cost = atMax ? 0 : talentUpgradeCost(t, level);
      const affordable = !atMax && state.resources.relics >= cost;
      let actionLabel = `Buy · ${cost} Relic${cost === 1 ? '' : 's'}`;
      if (atMax) actionLabel = 'Max';
      else if (!affordable) actionLabel = `Need ${cost}`;
      const effectLine = level > 0
        ? formatTalentEffects(t, level)
        : formatTalentPerLevel(t);
      return `
        <div class="row-item${!atMax && !affordable ? ' row-item-blocked' : ''}">
          <div>
            <h3>${t.name} · Lv ${level}/${t.maxLevel}</h3>
            <div class="cost">${atMax ? 'Maxed' : `${cost} Relic${cost === 1 ? '' : 's'}`}</div>
            <div class="effect-line">${effectLine}</div>
          </div>
          <button class="btn btn-secondary" data-talent="${t.id}" type="button" ${atMax || !affordable ? 'disabled' : ''}>${actionLabel}</button>
          <p>${t.description}</p>
        </div>
      `;
    }).join('');

    this.overlay.innerHTML = `
      <div class="sheet">
        <div class="sheet-header">
          <h2>Stations</h2>
          <button class="icon-btn" id="sheet-close" type="button" aria-label="Close">✕</button>
        </div>
        <p class="muted">Machines sit on the Forge hall pedestals · Relics ${formatNumber(state.resources.relics)} · Cosmetic: ${state.activeCosmetic}</p>
        <div class="list">${stationRows}</div>
        <div class="row-item">
          <div>
            <h3>Reforge</h3>
            <div class="cost">${prestigeCost}</div>
          </div>
          <button class="btn btn-primary" id="btn-prestige" type="button" ${prestigeReady ? '' : 'disabled'}>${prestigeLabel}</button>
          <p>${prestigeHint}</p>
        </div>
        <h3 class="sheet-section">Talents</h3>
        <p class="muted">Permanent bonuses — survive Reforge. Spend Relics to specialize your forge.</p>
        <div class="list">${talentRows}</div>
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
    this.overlay.querySelectorAll('[data-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => this.actions.onToggleStation((btn as HTMLElement).dataset.toggle as StationId));
    });
    this.overlay.querySelectorAll('[data-upgrade]').forEach((btn) => {
      btn.addEventListener('click', () => this.actions.onUpgradeStation((btn as HTMLElement).dataset.upgrade as StationId));
    });
    this.overlay.querySelectorAll('[data-talent]').forEach((btn) => {
      btn.addEventListener('click', () => this.actions.onBuyTalent((btn as HTMLElement).dataset.talent as TalentId));
    });
    this.overlay.querySelector('#btn-prestige')?.addEventListener('click', () => {
      this.actions.onOpenPanel(null);
      this.showPrestigeConfirm(relicsPreview);
    });
    this.overlay.querySelector('#btn-warp-ad')?.addEventListener('click', () => this.actions.onTimeWarp(true));
    this.overlay.querySelector('#btn-warp-coin')?.addEventListener('click', () => this.actions.onTimeWarp(false));
  }

  private renderLedger(state: GameState, notice?: string) {
    const talentLevels = TALENTS.reduce((sum, t) => sum + (state.talents[t.id] ?? 0), 0);
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
          <div class="row-item"><div><h3>Talent levels</h3></div><div>${talentLevels}</div></div>
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
