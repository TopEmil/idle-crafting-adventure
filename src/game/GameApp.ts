import { SIM_DT, BALANCE } from '../data/balance';
import type { ExpeditionId } from '../data/expeditions';
import type { RecipeId } from '../data/recipes';
import type { ResourceId } from '../data/resources';
import type { StationId } from '../data/stations';
import type { TalentId } from '../data/talents';
import { AudioBus } from '../audio/audio';
import { ForgeScene } from '../forge/ForgeScene';
import { createAdGate } from '../platform/ads';
import { createPlatformBridge } from '../platform/crazygames';
import {
  claimAchievement,
  listReadyAchievements,
} from '../sim/achievements';
import type { AchievementId } from '../data/achievements';
import { stratumAtDepth } from '../data/strata';
import {
  applyOfflineProgress,
  availableRecipes,
  buySquadSlot,
  buyTalent,
  canAfford,
  claimExpedition,
  clickVein,
  completeExpeditionIfReady,
  craftRecipe,
  drainStationGainFloaters,
  getAutoMineRate,
  prestige,
  rushExpedition,
  startExpedition,
  adjustStationRunLevel,
  tickProductionDetailed,
  type StationTickGain,
  toggleStation,
  unlockStation,
  upgradeStation,
} from '../sim/economy';
import { maybeSubmitLeaderboardScore } from '../sim/leaderboardSync';
import { recipeCost } from '../sim/pricing';
import {
  applyResourceOffer,
  canSuggestResourceOffer,
  markResourceOfferShown,
  nextResourceOffer,
  resourceLabel,
  type ResourceOffer,
} from '../sim/resourceOffer';
import { deserializeState, loadLocalState, SAVE_KEY, saveLocalState, serializeState } from '../sim/save';
import type { GameState } from '../sim/types';
import { Hud, type PanelId } from '../ui/hud';
import { formatAchievementRewardLine, formatRecipeEffects } from '../ui/effectsText';
import { getRecipe } from '../data/recipes';
import type { SceneView } from '../forge/sceneView';

export class GameApp {
  private state: GameState;
  private scene: ForgeScene;
  private hud: Hud;
  private audio = new AudioBus();
  private platform = createPlatformBridge();
  private ads = createAdGate();
  private accum = 0;
  private lastFrame = performance.now();
  private panel: PanelId = null;
  private overlayMode:
    | 'none'
    | 'offline'
    | 'loot'
    | 'onboarding'
    | 'milestone'
    | 'prestige'
    | 'resource_offer' = 'none';
  private notice = '';
  private saveTimer = 0;
  private running = false;
  private pausedForAd = false;
  private lastStratumId = '';
  private pendingResourceOffer: ResourceOffer | null = null;
  /** Keys `${id}:${level}` already toasted as ready-to-claim. */
  private notifiedReadyAchievements = new Set<string>();
  /** Fractional leftovers until a whole-unit +N floater can fire. */
  private stationGainPending: Partial<
    Record<StationId, Partial<Record<ResourceId, number>>>
  > = {};

  constructor(
    canvas: HTMLCanvasElement,
    hudRoot: HTMLElement,
    overlayRoot: HTMLElement,
  ) {
    this.state = loadLocalState();
    this.scene = new ForgeScene(canvas);
    this.hud = new Hud(hudRoot, overlayRoot, {
      onClickVein: () => this.handleClickVein(),
      onCraftQuick: () => this.handleCraftQuick(),
      onSetView: (view) => this.setSceneView(view),
      onOpenPanel: (p) => this.openPanel(p),
      onCloseOverlay: () => this.closeOverlay(),
      onCraftRecipe: (id) => this.handleCraft(id as RecipeId),
      onUnlockStation: (id) => this.handleUnlock(id),
      onUpgradeStation: (id) => this.handleUpgrade(id),
      onToggleStation: (id) => this.handleToggleStation(id),
      onAdjustStationSpeed: (id, delta) => this.handleAdjustStationSpeed(id, delta),
      onStartExpedition: (id) => this.handleStartExpedition(id as ExpeditionId),
      onRushExpedition: (id) => void this.handleRushExpedition(id as ExpeditionId),
      onBuySquadSlot: () => this.handleBuySquadSlot(),
      onRevealExpeditionLoot: () => this.revealExpeditionLoot(),
      onClaimExpedition: (mode) => void this.handleClaim(mode),
      onPrestige: () => void this.handlePrestige(),
      onBuyTalent: (id) => this.handleBuyTalent(id),
      onClaimAchievement: (id) => this.handleClaimAchievement(id),
      onResourceOffer: (mode) => void this.handleResourceOffer(mode),
      onSkipOnboarding: () => this.finishOnboarding(),
      onAdvanceOnboarding: () => this.advanceOnboarding(),
      onToggleMute: () => {
        const muted = this.audio.toggleMute();
        this.hud.setMuted(muted);
      },
    });
  }

  async start() {
    await this.platform.init();
    this.platform.loadingStart();
    await this.scene.ready();

    const cloud = await this.platform.loadCloud(SAVE_KEY);
    if (cloud) {
      const parsed = deserializeState(cloud);
      if (parsed && parsed.lastSaveAt > this.state.lastSaveAt) {
        this.state = parsed;
      }
    }

    const offline = applyOfflineProgress(this.state);
    this.state = offline.state;
    this.applyAchievements(true);
    this.scene.sync(this.state);
    this.scene.resize();

    window.addEventListener('resize', () => this.scene.resize());
    this.installInputGuards();

    this.scene.setVeinTapHandler((col) => this.handleClickVein(col));
    this.scene.setAutoMineRate(getAutoMineRate(this.state));

    this.platform.loadingStop();
    this.platform.gameplayStart();
    this.running = true;
    this.audio.startBed();

    if (offline.event && offline.event.type === 'offline_summary' && Object.keys(offline.event.gains).length) {
      this.overlayMode = 'offline';
      this.platform.gameplayStop();
      this.hud.showOfflineSummary(offline.event.seconds, offline.event.gains);
    } else if (!this.state.onboardingDone) {
      this.overlayMode = 'onboarding';
      this.hud.showOnboarding(this.state.onboardingStep);
    }

    this.refreshHud();
    requestAnimationFrame((t) => this.frame(t));
  }

  private frame(now: number) {
    if (!this.running) return;
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;

    if (!this.pausedForAd && this.overlayMode === 'none') {
      this.accum += dt;
      while (this.accum >= SIM_DT) {
        const tick = tickProductionDetailed(this.state, SIM_DT);
        this.state = tick.state;
        if (tick.autoOreGained > 0) {
          this.scene.reportAutoOre(tick.autoOreGained);
        }
        this.emitStationGainFloaters(tick.stationGains);
        this.applyAchievements(true);
        const ready = completeExpeditionIfReady(this.state);
        this.state = ready.state;
        if (ready.event) {
          this.scene.triggerExpeditionReturn();
          this.audio.claim();
          this.showLootModal();
          break;
        }
        this.accum -= SIM_DT;
      }
      // Offline / reload can leave pendingLoot without firing expedition_ready.
      // Always surface the claim modal once the player is free to interact.
      if (this.state.pendingLoot && this.overlayMode === 'none') {
        this.showLootModal();
      } else if (this.overlayMode === 'none' && !this.panel) {
        this.maybeShowResourceOffer();
      }
      this.scene.setAutoMineRate(getAutoMineRate(this.state));
      this.scene.sync(this.state);
      this.announceStratumIfNew();
    }

    this.saveTimer += dt;
    if (this.saveTimer >= 5) {
      this.saveTimer = 0;
      void this.persist();
    }

    // Keep chrome live while a sheet is open, but never rebuild the Expeditions
    // sheet every frame — full innerHTML replaces steal click/tap events (Send
    // felt broken). Progress bars patch in place instead.
    if (this.overlayMode === 'none' && this.panel) {
      this.refreshHudChrome();
      if (this.panel === 'expeditions') {
        this.hud.syncExpeditionProgress(this.state);
      } else if (this.panel === 'achievements') {
        this.hud.syncAchievementsProgress(this.state);
      }
    } else if (this.overlayMode === 'none' && !this.panel) {
      this.refreshHudLight();
    }

    requestAnimationFrame((t) => this.frame(t));
  }

  private refreshHud() {
    this.hud.setPanel(this.panel);
    this.hud.setView(this.scene.getView());
    this.hud.render(this.state, { notice: this.notice });
  }

  /** Resources / goals / CTAs only — does not rebuild open sheets. */
  private refreshHudChrome() {
    this.hud.setPanel(this.panel);
    this.hud.setView(this.scene.getView());
    this.hud.renderChrome(this.state);
  }

  private refreshHudLight() {
    this.hud.setView(this.scene.getView());
    this.hud.render(this.state);
  }

  private setSceneView(view: SceneView) {
    this.scene.setView(view);
    this.hud.setView(view);
    this.refreshHudLight();
  }

  private async persist() {
    saveLocalState(this.state);
    await this.platform.saveCloud(SAVE_KEY, serializeState(this.state));
    await this.syncLeaderboard();
  }

  private async syncLeaderboard() {
    const result = await maybeSubmitLeaderboardScore(this.state, (score) =>
      this.platform.submitLeaderboardScore(score),
    );
    this.state = result.state;
    if (result.submitted) {
      saveLocalState(this.state);
    }
  }

  private openPanel(panel: PanelId) {
    if (
      this.overlayMode === 'loot' ||
      this.overlayMode === 'offline' ||
      this.overlayMode === 'prestige' ||
      this.overlayMode === 'resource_offer'
    ) {
      return;
    }
    // Opening nav must NEVER request ads
    if (this.panel === panel) {
      this.panel = null;
      this.hud.clearOverlay();
      this.hud.setPanel(null);
      this.platform.gameplayStart();
      return;
    }
    if (panel === 'forge') {
      this.setSceneView('forge');
    }
    this.panel = panel;
    this.notice = '';
    this.overlayMode = 'none';
    this.platform.gameplayStop();
    this.refreshHud();
  }

  private closeOverlay() {
    const was = this.overlayMode;
    this.overlayMode = 'none';
    // Always dismiss sheets/modals fully. Re-rendering an open panel here made the
    // sheet ✕ button appear to do nothing (clear → immediately reopen).
    this.panel = null;
    this.hud.clearOverlay();
    this.hud.setPanel(null);
    this.platform.gameplayStart();
    this.refreshHudLight();

    if (was === 'loot' || was === 'prestige' || was === 'milestone') {
      void this.maybeMidgame(was === 'loot' ? 'expedition_claim' : was === 'prestige' ? 'prestige' : 'milestone');
    }
  }

  private emitStationGainFloaters(gains: StationTickGain[]) {
    if (!gains.length) return;
    const drained = drainStationGainFloaters(this.stationGainPending, gains);
    this.stationGainPending = drained.pending;
    for (const floater of drained.floaters) {
      this.scene.triggerStationGain(
        floater.stationId,
        floater.resource,
        floater.amount,
      );
    }
  }

  private handleClickVein(col?: number) {
    void this.audio.unlock();
    if (this.overlayMode === 'onboarding' && this.state.onboardingStep === 0) {
      // allow click during first step
    } else if (this.overlayMode !== 'none' && this.overlayMode !== 'onboarding') {
      return;
    }
    if (this.scene.getView() !== 'mine') {
      this.setSceneView('mine');
    }
    const digCol = col ?? this.scene.getPendingDigCol() ?? undefined;
    const { state, event } = clickVein(this.state, { col: digCol, mode: 'player' });
    this.state = state;
    this.scene.sync(this.state);
    this.applyAchievements(true);
    const amount = event.type === 'click_vein' ? event.amount : 1;
    const find = event.type === 'click_vein' ? event.find : undefined;
    this.scene.triggerVeinHit(amount, find);
    this.hud.pulseVeinButton();
    this.audio.click(this.scene.getCombo());
    if (find) {
      this.hud.toast(`Found ${find.amount} ${find.label}!`, 'gain');
    }
    this.announceStratumIfNew();
    if (!this.state.onboardingDone && this.state.onboardingStep === 0 && this.state.resources.ore >= 3) {
      this.state.onboardingStep = 1;
      this.hud.showOnboarding(1);
    }
    this.refreshHudLight();
  }

  /** Toast when the dig face enters a new stratum (depth milestones). */
  private announceStratumIfNew() {
    const stratum = stratumAtDepth(this.state.mineDepth ?? 0);
    if (!this.lastStratumId) {
      this.lastStratumId = stratum.id;
      return;
    }
    if (this.lastStratumId === stratum.id) return;
    this.lastStratumId = stratum.id;
    const bonus = stratum.discoveryBonus;
    const bonusBits = bonus
      ? Object.entries(bonus)
          .map(([k, v]) => `+${v} ${k}`)
          .join(', ')
      : '';
    this.hud.toast(
      bonusBits ? `Reached ${stratum.name} · ${bonusBits}` : `Reached ${stratum.name}`,
      'gain',
    );
  }

  private handleCraftQuick() {
    const next = availableRecipes(this.state)[0];
    if (!next) return;
    if (!canAfford(this.state.resources, recipeCost(next))) {
      this.hud.toast('Not enough resources', 'info');
      this.refreshHudLight();
      return;
    }
    this.handleCraft(next.id);
  }

  private handleCraft(id: RecipeId) {
    const result = craftRecipe(this.state, id);
    if (!result.ok) {
      this.notice = result.reason;
      this.refreshHud();
      return;
    }
    this.state = result.state;
    this.applyAchievements(true);
    this.audio.craft();
    this.scene.triggerCraftBurst();
    this.scene.setAutoMineRate(getAutoMineRate(this.state));
    this.hud.toast(`${getRecipe(id).name}: ${formatRecipeEffects(getRecipe(id))}`, 'gain');
    if (!this.state.onboardingDone && this.state.onboardingStep <= 1) {
      this.state.onboardingStep = 2;
      this.overlayMode = 'onboarding';
      this.setSceneView('forge');
      this.hud.showOnboarding(2);
    }
    this.refreshHud();
    void this.persist();
  }

  private handleUnlock(id: StationId) {
    const result = unlockStation(this.state, id);
    if (!result.ok) {
      this.notice = result.reason;
      this.refreshHud();
      return;
    }
    this.state = result.state;
    this.applyAchievements(true);
    this.audio.craft();
    this.scene.triggerCraftBurst();
    this.scene.triggerStationUnlock(id);
    this.scene.sync(this.state);
    const pretty = id.charAt(0).toUpperCase() + id.slice(1);
    this.hud.toast(`${pretty} built in the forge`, 'gain');
    if (id === 'smelter' && this.state.milestones.firstStation) {
      this.overlayMode = 'milestone';
      this.panel = null;
      this.hud.setPanel(null);
      this.hud.showMilestone(
        'Smelter lit',
        'The Smelter appears beside the hearth and converts Ore → Emberglass automatically while fueled.',
      );
      this.platform.gameplayStop();
    } else {
      this.refreshHud();
    }
    void this.persist();
  }

  private handleUpgrade(id: StationId) {
    const result = upgradeStation(this.state, id);
    if (!result.ok) {
      this.notice = result.reason;
      this.refreshHud();
      return;
    }
    this.state = result.state;
    this.audio.click();
    this.scene.triggerStationPuff(id);
    this.scene.sync(this.state);
    this.hud.toast(`${id} → Lv ${result.state.stations[id].level}`, 'gain');
    this.refreshHud();
  }

  private handleToggleStation(id: StationId) {
    const result = toggleStation(this.state, id);
    if (!result.ok) {
      this.notice = result.reason;
      this.refreshHud();
      return;
    }
    this.state = result.state;
    this.audio.click();
    this.scene.sync(this.state);
    const on = this.state.stations[id].enabled;
    const pretty = id.charAt(0).toUpperCase() + id.slice(1);
    this.hud.toast(on ? `${pretty} On` : `${pretty} Off`, on ? 'gain' : 'info');
    this.refreshHud();
    void this.persist();
  }

  private handleAdjustStationSpeed(id: StationId, delta: number) {
    const result = adjustStationRunLevel(this.state, id, delta);
    if (!result.ok) {
      this.notice = result.reason;
      this.refreshHud();
      return;
    }
    this.state = result.state;
    this.audio.click();
    this.scene.sync(this.state);
    const st = this.state.stations[id];
    const pretty = id.charAt(0).toUpperCase() + id.slice(1);
    this.hud.toast(`${pretty} speed ${st.runLevel}/${st.level}`, 'info');
    this.refreshHud();
    void this.persist();
  }

  private handleStartExpedition(id: ExpeditionId) {
    const result = startExpedition(this.state, id);
    if (!result.ok) {
      this.notice = result.reason;
      this.refreshHud();
      return;
    }
    this.state = result.state;
    this.audio.click();
    this.hud.toast('Scouts dispatched', 'info');
    this.refreshHud();
    void this.persist();
  }

  /** Rewarded ad: finish an en-route squad immediately. */
  private async handleRushExpedition(id: ExpeditionId) {
    if (!this.platform.adsEnabled) {
      this.notice = 'Ads disabled — wait for the squad, or buy more squads with Relics.';
      this.refreshHud();
      return;
    }
    if (this.platform.adblock) {
      this.notice = 'Ad blocked — rush unavailable.';
      this.refreshHud();
      return;
    }
    const gate = this.ads.canShowRewarded(this.state);
    if (!gate.ok) {
      this.notice = 'Reward boost cooling down.';
      this.refreshHud();
      return;
    }

    this.pausedForAd = true;
    this.platform.gameplayStop();
    this.audio.pauseForAd();
    const adResult = await this.ads.runAd(this.platform, 'rewarded', {});
    this.audio.resumeAfterAd();
    this.pausedForAd = false;
    this.platform.gameplayStart();

    if (adResult.status !== 'finished') {
      this.notice = 'No reward — ad did not complete.';
      this.refreshHud();
      return;
    }

    this.state = this.ads.markRewardedUsed(this.state);
    const rushed = rushExpedition(this.state, id);
    if (!rushed.ok) {
      this.notice = rushed.reason;
      this.refreshHud();
      return;
    }
    this.state = rushed.state;
    const ready = completeExpeditionIfReady(this.state);
    this.state = ready.state;
    this.audio.claim();
    if (ready.event) {
      this.scene.triggerExpeditionReturn();
      this.showLootModal();
    } else {
      this.hud.toast('Squad rushed home', 'gain');
      this.refreshHud();
    }
    void this.persist();
  }

  private handleBuySquadSlot() {
    const result = buySquadSlot(this.state);
    if (!result.ok) {
      this.notice = result.reason;
      this.refreshHud();
      return;
    }
    this.state = result.state;
    this.audio.craft();
    this.scene.triggerCraftBurst();
    this.hud.toast('Extra squad unlocked', 'gain');
    this.notice = '';
    this.refreshHud();
    void this.persist();
  }

  /** Ensure pending loot is rolled, then open the claim modal. */
  private revealExpeditionLoot() {
    const ready = completeExpeditionIfReady(this.state);
    this.state = ready.state;
    if (ready.event) {
      this.scene.triggerExpeditionReturn();
      this.audio.claim();
    }
    this.showLootModal();
  }

  private showLootModal() {
    if (!this.state.pendingLoot) return;
    this.overlayMode = 'loot';
    this.panel = null;
    this.hud.setPanel(null);
    this.platform.gameplayStop();
    const rewardGate = this.ads.canShowRewarded(this.state);
    this.hud.showExpeditionReturn(this.state.pendingLoot, {
      canReward: rewardGate.ok,
      adblock: this.platform.adblock,
      adsDisabled: !this.platform.adsEnabled,
      coinAlt: this.state.resources.ore >= BALANCE.rewardBoostOreCost,
    });
  }

  private async handleClaim(mode: 'normal' | 'ad' | 'coin') {
    let doubled = false;
    if (mode === 'coin') {
      if (this.state.resources.ore >= BALANCE.rewardBoostOreCost) {
        this.state = structuredClone(this.state);
        this.state.resources.ore -= BALANCE.rewardBoostOreCost;
        doubled = true;
      }
    } else if (mode === 'ad') {
      if (!this.platform.adsEnabled) {
        this.notice = 'Ads disabled — use Claim or the ore option.';
      } else if (this.platform.adblock) {
        this.notice = 'Ad blocked — claiming normal loot.';
      } else {
        const gate = this.ads.canShowRewarded(this.state);
        if (gate.ok) {
          this.pausedForAd = true;
          this.platform.gameplayStop();
          this.audio.pauseForAd();
          const result = await this.ads.runAd(this.platform, 'rewarded', {});
          this.audio.resumeAfterAd();
          this.pausedForAd = false;
          if (result.status === 'finished') {
            doubled = true;
            this.state = this.ads.markRewardedUsed(this.state);
          } else {
            this.notice = 'Ad unavailable — normal loot claimed.';
          }
        }
      }
    }

    const result = claimExpedition(this.state, doubled);
    if (!result.ok) {
      this.notice = result.reason;
      this.closeOverlay();
      this.refreshHudLight();
      return;
    }
    this.state = result.state;
    this.applyAchievements(true);
    this.audio.claim();
    this.platform.happytime();
    this.closeOverlay();
    void this.persist();
  }

  private async handlePrestige() {
    const result = prestige(this.state);
    if (!result.ok) {
      this.notice = result.reason;
      this.closeOverlay();
      return;
    }
    this.state = result.state;
    this.stationGainPending = {};
    this.applyAchievements(true);
    this.audio.prestige();
    this.scene.triggerCraftBurst();
    this.scene.sync(this.state);
    this.overlayMode = 'prestige';
    this.hud.showMilestone(
      'Forge Reforged',
      `You gained ${result.relics} Relics. Spend them on the Talents page — next Reforge in ${BALANCE.prestigeCooldownSec / 60} min.`,
    );
    void this.persist();
  }

  private handleBuyTalent(id: TalentId) {
    const result = buyTalent(this.state, id);
    if (!result.ok) {
      this.notice = result.reason;
      this.refreshHud();
      return;
    }
    this.state = result.state;
    this.audio.craft();
    this.scene.triggerCraftBurst();
    this.notice = '';
    void this.persist();
    this.refreshHud();
  }

  private maybeShowResourceOffer() {
    if (!this.platform.adsEnabled || this.platform.adblock) return;
    if (!this.ads.canShowRewarded(this.state).ok) return;
    if (!canSuggestResourceOffer(this.state)) return;

    const offer = nextResourceOffer(this.state);
    if (!offer) return;

    this.pendingResourceOffer = offer;
    this.state = markResourceOfferShown(this.state);
    this.overlayMode = 'resource_offer';
    this.panel = null;
    this.hud.setPanel(null);
    this.platform.gameplayStop();
    this.hud.showResourceOffer({
      resourceName: resourceLabel(offer.resource),
      amount: offer.amount,
      reason: offer.reason,
    });
  }

  private async handleResourceOffer(mode: 'ad' | 'dismiss') {
    const offer = this.pendingResourceOffer;
    this.pendingResourceOffer = null;

    if (mode === 'dismiss' || !offer) {
      this.closeOverlay();
      return;
    }

    if (!this.platform.adsEnabled) {
      this.notice = 'Rewarded ads disabled in this environment.';
      this.closeOverlay();
      return;
    }
    if (this.platform.adblock) {
      this.notice = 'Ad blocked — resource boost unavailable.';
      this.closeOverlay();
      return;
    }

    const gate = this.ads.canShowRewarded(this.state);
    if (!gate.ok) {
      this.notice = 'Reward boost cooling down.';
      this.closeOverlay();
      return;
    }

    this.pausedForAd = true;
    this.audio.pauseForAd();
    const result = await this.ads.runAd(this.platform, 'rewarded', {});
    this.audio.resumeAfterAd();
    this.pausedForAd = false;

    if (result.status !== 'finished') {
      this.notice = 'No reward — ad did not complete.';
      this.closeOverlay();
      return;
    }

    this.state = this.ads.markRewardedUsed(this.state);
    const granted = applyResourceOffer(this.state, offer);
    this.state = granted.state;
    this.applyAchievements(true);
    this.audio.claim();
    this.hud.toast(`+${offer.amount} ${resourceLabel(offer.resource)}`, 'gain');
    this.scene.sync(this.state);
    this.closeOverlay();
    void this.persist();
  }

  /** Notify when achievements become claimable — never auto-grants rewards. */
  private applyAchievements(toast: boolean) {
    const ready = listReadyAchievements(this.state);
    if (!toast || ready.length === 0) return;
    for (const { tier, def } of ready) {
      const key = `${def.id}:${tier.level}`;
      if (this.notifiedReadyAchievements.has(key)) continue;
      this.notifiedReadyAchievements.add(key);
      this.hud.toast(`${tier.name} ready — claim in Awards`, 'gain');
    }
  }

  private handleClaimAchievement(id: AchievementId) {
    const result = claimAchievement(this.state, id);
    if (!result.ok) {
      this.notice = result.reason;
      this.refreshHud();
      return;
    }
    this.state = result.state;
    this.notifiedReadyAchievements.delete(`${id}:${result.tier.level}`);
    this.audio.claim();
    this.hud.toast(
      `${result.tier.name}: ${formatAchievementRewardLine(result.tier)}`,
      'gain',
    );
    this.scene.setAutoMineRate(getAutoMineRate(this.state));
    this.scene.sync(this.state);
    this.notice = '';
    this.refreshHud();
    void this.persist();
  }

  private advanceOnboarding() {
    if (this.state.onboardingStep >= 2) {
      this.finishOnboarding();
      return;
    }
    this.state.onboardingStep += 1;
    if (this.state.onboardingStep >= 2) {
      this.setSceneView('forge');
    }
    this.hud.showOnboarding(this.state.onboardingStep);
  }

  private finishOnboarding() {
    this.state.onboardingDone = true;
    this.overlayMode = 'none';
    this.hud.clearOverlay();
    this.platform.gameplayStart();
    this.refreshHudLight();
    void this.persist();
  }

  private async maybeMidgame(trigger: 'expedition_claim' | 'prestige' | 'milestone') {
    if (!this.ads.canShowMidgame(this.state, trigger)) return;
    if (!this.platform.adsEnabled) return;

    this.pausedForAd = true;
    this.platform.gameplayStop();
    this.audio.pauseForAd();
    await this.ads.runAd(this.platform, 'midgame', {});
    this.audio.resumeAfterAd();
    this.pausedForAd = false;
    this.state = this.ads.markMidgameShown(this.state);
    this.platform.gameplayStart();
  }

  private installInputGuards() {
    const block = (e: KeyboardEvent) => {
      const keys = [' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Spacebar'];
      if (keys.includes(e.key)) {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', block, { passive: false });
    document.body.addEventListener(
      'touchmove',
      (e) => {
        const target = e.target;
        if (!(target instanceof Element)) {
          e.preventDefault();
          return;
        }
        // Allow native scrolling inside sheet lists / modals (iOS Safari).
        if (target.closest('.sheet .list, .sheet, .modal, .onboarding')) {
          return;
        }
        e.preventDefault();
      },
      { passive: false },
    );
  }
}
