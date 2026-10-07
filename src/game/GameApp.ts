import { SIM_DT, BALANCE, prestigeMult } from '../data/balance';
import type { ExpeditionId } from '../data/expeditions';
import type { RecipeId } from '../data/recipes';
import type { StationId } from '../data/stations';
import { AudioBus } from '../audio/audio';
import { ForgeScene } from '../forge/ForgeScene';
import { createAdGate } from '../platform/ads';
import { createPlatformBridge } from '../platform/crazygames';
import {
  applyOfflineProgress,
  applyTimeWarp,
  availableRecipes,
  claimExpedition,
  clickVein,
  completeExpeditionIfReady,
  craftRecipe,
  getAutoMineRate,
  prestige,
  startExpedition,
  tickProduction,
  unlockStation,
  upgradeStation,
} from '../sim/economy';
import { deserializeState, loadLocalState, SAVE_KEY, saveLocalState, serializeState } from '../sim/save';
import type { GameState } from '../sim/types';
import { Hud, type PanelId } from '../ui/hud';
import { formatRecipeEffects } from '../ui/effectsText';
import { getRecipe } from '../data/recipes';

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
  private overlayMode: 'none' | 'offline' | 'loot' | 'onboarding' | 'milestone' | 'prestige' = 'none';
  private notice = '';
  private saveTimer = 0;
  private running = false;
  private pausedForAd = false;

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
      onOpenPanel: (p) => this.openPanel(p),
      onCloseOverlay: () => this.closeOverlay(),
      onCraftRecipe: (id) => this.handleCraft(id as RecipeId),
      onUnlockStation: (id) => this.handleUnlock(id),
      onUpgradeStation: (id) => this.handleUpgrade(id),
      onStartExpedition: (id) => this.handleStartExpedition(id as ExpeditionId),
      onClaimExpedition: (mode) => void this.handleClaim(mode),
      onPrestige: () => void this.handlePrestige(),
      onTimeWarp: (viaAd) => void this.handleTimeWarp(viaAd),
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
    this.scene.sync(this.state);
    this.scene.resize();

    window.addEventListener('resize', () => this.scene.resize());
    this.installInputGuards();

    this.scene.setVeinTapHandler(() => this.handleClickVein());
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
        this.state = tickProduction(this.state, SIM_DT);
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
      this.scene.setAutoMineRate(getAutoMineRate(this.state));
      this.scene.sync(this.state);
    }

    this.saveTimer += dt;
    if (this.saveTimer >= 5) {
      this.saveTimer = 0;
      void this.persist();
    }

    // Refresh expedition progress UI periodically when panel open
    if (this.panel === 'expeditions' && this.overlayMode === 'none') {
      this.refreshHud();
    } else if (this.overlayMode === 'none' && !this.panel) {
      this.refreshHudLight();
    }

    requestAnimationFrame((t) => this.frame(t));
  }

  private refreshHud() {
    this.hud.setPanel(this.panel);
    this.hud.render(this.state, { notice: this.notice });
  }

  private refreshHudLight() {
    this.hud.render(this.state);
  }

  private async persist() {
    saveLocalState(this.state);
    await this.platform.saveCloud(SAVE_KEY, serializeState(this.state));
  }

  private openPanel(panel: PanelId) {
    if (this.overlayMode === 'loot' || this.overlayMode === 'offline' || this.overlayMode === 'prestige') {
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

  private handleClickVein() {
    void this.audio.unlock();
    if (this.overlayMode === 'onboarding' && this.state.onboardingStep === 0) {
      // allow click during first step
    } else if (this.overlayMode !== 'none' && this.overlayMode !== 'onboarding') {
      return;
    }
    const { state, event } = clickVein(this.state);
    this.state = state;
    const amount = event.type === 'click_vein' ? event.amount : 1;
    this.scene.triggerVeinHit(amount);
    this.hud.pulseVeinButton();
    this.audio.click(this.scene.getCombo());
    if (!this.state.onboardingDone && this.state.onboardingStep === 0 && this.state.resources.ore >= 3) {
      this.state.onboardingStep = 1;
      this.hud.showOnboarding(1);
    }
    this.refreshHudLight();
  }

  private handleCraftQuick() {
    const next = availableRecipes(this.state)[0];
    if (!next) return;
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
    this.audio.craft();
    this.scene.triggerCraftBurst();
    this.scene.setAutoMineRate(getAutoMineRate(this.state));
    this.hud.toast(`${getRecipe(id).name}: ${formatRecipeEffects(getRecipe(id))}`, 'gain');
    if (!this.state.onboardingDone && this.state.onboardingStep <= 1) {
      this.state.onboardingStep = 2;
      this.overlayMode = 'onboarding';
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
    this.audio.craft();
    this.scene.triggerCraftBurst();
    this.scene.triggerStationUnlock(id);
    this.scene.sync(this.state);
    const pretty = id.charAt(0).toUpperCase() + id.slice(1);
    this.hud.toast(`${pretty} built in the forge`, 'gain');
    if (id === 'smelter' && result.state.milestones.firstStation) {
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
      coinAlt: this.state.resources.ore >= BALANCE.timeWarpCoinCost,
    });
  }

  private async handleClaim(mode: 'normal' | 'ad' | 'coin') {
    let doubled = false;
    if (mode === 'coin') {
      if (this.state.resources.ore >= BALANCE.timeWarpCoinCost) {
        this.state = structuredClone(this.state);
        this.state.resources.ore -= BALANCE.timeWarpCoinCost;
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
    if (!result.ok) return;
    this.state = result.state;
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
    this.audio.prestige();
    this.scene.triggerCraftBurst();
    this.scene.sync(this.state);
    this.overlayMode = 'prestige';
    this.hud.showMilestone(
      'Forge Reforged',
      `You gained ${result.relics} Relics. Permanent mult ×${prestigeMult(this.state.totalRelicsEarned).toFixed(2)}.`,
    );
    void this.persist();
  }

  private async handleTimeWarp(viaAd: boolean) {
    if (viaAd) {
      if (!this.platform.adsEnabled) {
        this.notice = 'Rewarded ads disabled in this environment.';
        this.refreshHud();
        return;
      }
      if (this.platform.adblock) {
        this.notice = 'Ad blocked — time warp unavailable. Try the ore option.';
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
      this.audio.pauseForAd();
      const result = await this.ads.runAd(this.platform, 'rewarded', {});
      this.audio.resumeAfterAd();
      this.pausedForAd = false;
      if (result.status !== 'finished') {
        this.notice = 'No reward — ad did not complete.';
        this.refreshHud();
        return;
      }
      this.state = this.ads.markRewardedUsed(this.state);
    } else {
      if (this.state.resources.ore < BALANCE.timeWarpCoinCost) {
        this.notice = 'Not enough ore.';
        this.refreshHud();
        return;
      }
      this.state = structuredClone(this.state);
      this.state.resources.ore -= BALANCE.timeWarpCoinCost;
    }

    const warped = applyTimeWarp(this.state, BALANCE.timeWarpSeconds);
    this.state = warped.state;
    this.audio.craft();
    this.notice = `Warped ${BALANCE.timeWarpSeconds / 60} minutes.`;
    this.scene.sync(this.state);
    this.refreshHud();
    void this.persist();
  }

  private advanceOnboarding() {
    if (this.state.onboardingStep >= 2) {
      this.finishOnboarding();
      return;
    }
    this.state.onboardingStep += 1;
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
