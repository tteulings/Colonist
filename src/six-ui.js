// 5–6 players: the six-up player strip and the Special Building Phase controls (window ticker, Skip).
// A mixin on ColonistFullGame (installed by game.js). Styles: themes/six.css, all scoped to
// .six-up / [data-seats] / .sbp-* so the 2–4 player chrome is untouched.
import { icon, avatarSvg } from "./themes/manager.js";
import { SBP_WINDOW_MS } from "./six.js";

const RES = ["wood", "brick", "sheep", "wheat", "ore"];
const DEV = ["knight", "roadBuilding", "yearOfPlenty", "monopoly"];
const sum = (o) => RES.reduce((a, r) => a + (o[r] || 0), 0);
const CROWN = `<svg class="sx-crown" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" fill="#FFD25A" stroke="#7A4B12" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

export const SixUiMixin = {
  /** 5–6 players: the strip shows six compact chips in one row. */
  _sixUp() {
    return (this.players?.length || 0) >= 5;
  },

  /** The single points leader (public points, at least 3) wears the crown. */
  _sixLeader() {
    const vps = this.players.map((p) => this.displayVictoryPoints(p));
    const max = Math.max(...vps);
    return max >= 3 && vps.filter((v) => v === max).length === 1 ? vps.indexOf(max) : -1;
  },

  /** Seats that build between turns right now (or just did, until the next roll): a small hammer mark. */
  _sbpMarkedSeats() {
    if (this.sbp) return this.sbp.human ? [this.currentPlayerIndex] : [];
    if (this.sbpRecent && this.phase === "pre_roll") return this.sbpRecent.seats;
    return [];
  },

  /** Key of everything the six-up chips show beyond the 4-player key (turn owner, marks, leader). */
  _sixKey() {
    return `${this._turnOwnerIndex()}:${this._sbpMarkedSeats().join(",")}:${this.sbp ? "sbp" : ""}`;
  },

  /** One six-up chip (design option A): avatar with a points badge, full name, cards + development cards. */
  _sixChip(player, { active, ready, vp, cards, dev, leader, building, awards, over }) {
    const cls = `pchip six pc-${player.id}${active ? " active" : ""}${ready ? " ready" : ""}${leader ? " leader" : ""}${building ? " building" : ""}`;
    return `<div class="${cls}" data-seat="${player.id}" role="button" tabindex="0" aria-label="${player.name}: ${vp} points, ${cards} cards, ${dev} development cards${leader ? ", in the lead" : ""}${building ? ", building" : ""}">
      <div class="sx-av">${avatarSvg(player.id)}<b class="sx-vp">${vp}</b>${leader ? CROWN : ""}${building ? `<span class="sx-sbp">${icon("build")}</span>` : ""}</div>
      <div class="pn">${player.name}</div>
      <div class="mini"><span data-stat="cards"${over ? ` class="warn" title="more than ${this.settings?.discardLimit ?? 7}: hands back half on a 7"` : ""}>${icon("cards")}${cards}</span><span>${icon("devcard")}${dev}</span></div>
      ${awards ? `<div class="bdg">${awards}</div>` : ""}</div>`;
  },

  /** Six-up chips for the whole table (called from renderScoreboard). */
  _sixChips() {
    const readyIds = this.rush && !this.setupPhase ? this.rush.ready : null;
    const owner = this._turnOwnerIndex();
    const marks = this._sbpMarkedSeats();
    const leader = this._sixLeader();
    return this.players.map((p, idx) => {
      const awards = (this.longestRoadHolder === p.id ? `<span title="Longest Road (+2 points)">${icon("longestRoad")}</span>` : "")
        + (this.largestArmyHolder === p.id ? `<span title="Largest Army (+2 points)">${icon("largestArmy")}</span>` : "");
      return this._sixChip(p, {
        active: idx === owner && !this.winner && !(this.isRush() && !this.setupPhase),
        ready: !!readyIds?.includes(p.id),
        vp: this.displayVictoryPoints(p),
        cards: sum(p.resources),
        over: sum(p.resources) > (this.settings?.discardLimit ?? 7),
        dev: DEV.reduce((s, t) => s + p.devCards[t] + p.newDevCards[t], 0) + (p.isHuman ? p.devVictoryPoints : 0),
        leader: idx === leader,
        building: marks.includes(idx),
        awards,
      });
    }).join("");
  },

  /** Strip attributes: data-seats on the strip and the app (CSS hooks for 5–6 seats). */
  _sixStripAttrs() {
    const n = String(this.players?.length || 0);
    if (this.playerStrip) {
      this.playerStrip.dataset.seats = n;
      this.playerStrip.classList.toggle("six-up", this._sixUp());
    }
    if (this.app && this.app.dataset.seats !== n) this.app.dataset.seats = n;
  },

  // ── Special Building Phase: your window ──
  _sbpWindowOpen() {
    return !!(this.sbp?.human && this.currentPlayer?.isHuman && !this.winner);
  },

  /** Whose turn starts after the build window: { short: "Bruno next", long: "Bruno is next" }. */
  _sbpNext() {
    const s = this.sbp;
    if (!s) return { short: "", long: "" };
    const p = this.players[(s.after + 1) % this.players.length];
    return p.isHuman ? { short: "your turn next", long: "Your turn is next" } : { short: `${p.name} next`, long: `${p.name} is next` };
  },

  /** The ticker line while your window is open (plain text for the desktop prompt). */
  _sbpStatus() {
    const next = this._sbpNext();
    const before = /^your/.test(next.short) ? "before your turn" : `before ${next.short.replace(/ next$/, "")}'s turn`;
    return this.sbp?.human?.built ? `Build more or tap Done · ${next.short}` : `Build or buy ${before} · no trading or cards`;
  },

  _sbpTickerHtml() {
    const s = this.sbp;
    const next = this._sbpNext().short;
    const head = s?.human?.built ? "Build more or tap Done" : "Your build window";
    return `<span class="tk-main"><b>${head}</b> <span class="sbp-sub">· ${next}</span></span><span class="sbp-time" aria-hidden="true"></span>`;
  },

  /** The countdown (seconds + a thin bar under the ticker); paused while you pick or place something. */
  _sbpPaintTimer() {
    const t = document.querySelector("#ticker");
    const h = this.sbp?.human;
    if (!t) return;
    const on = !!h && this._sbpWindowOpen();
    t.classList.toggle("sbp-ticker", on);
    if (!on) return;
    const left = Math.max(0, Math.min(1, h.leftMs / SBP_WINDOW_MS));
    t.style.setProperty("--sbp-left", left.toFixed(3));
    t.classList.toggle("sbp-held", this._sbpBusy());
    const el = t.querySelector(".sbp-time");
    if (el) el.textContent = `${Math.ceil(h.leftMs / 1000)}s`;
  },

  /** Main button: Skip (Done after a build) instead of Roll / End turn while your window is open. */
  _renderSbpControls() {
    const open = this._sbpWindowOpen();
    const slot = document.querySelector(".primary-slot");
    let btn = document.querySelector("#sbpSkipBtn");
    if (!btn && slot && open) {
      slot.insertAdjacentHTML("beforeend", `<button id="sbpSkipBtn" class="btn mainbtn sbp-skip" type="button" title="Skip (S)" hidden><span class="sx-l"></span><small class="sx-s"></small></button>`);
      btn = slot.querySelector("#sbpSkipBtn");
      btn.addEventListener("click", () => this.sbpSkip());
    }
    this.app?.classList.toggle("sbp-open", open);
    document.querySelector("#dock")?.classList.toggle("sbp-open", open);
    if (btn) {
      btn.hidden = !open;
      if (open) {
        const label = this.sbp.human.built ? "Done" : "Skip";
        const sub = this._sbpNext().long;
        if (btn.__k !== label + sub) {
          btn.__k = label + sub;
          btn.querySelector(".sx-l").textContent = label;
          btn.querySelector(".sx-s").textContent = sub;
          btn.setAttribute("aria-label", `${label}: ${sub}`);
        }
        btn.disabled = !!this.devPick;
        if (this.rollDiceBtn) this.rollDiceBtn.style.display = "none";
        if (this.endTurnBtn) this.endTurnBtn.style.display = "none";
        if (this.waitingBar) this.waitingBar.hidden = true;
      }
    }
    // Build lit, Trade and Cards quiet: only building and buying are allowed in the window
    document.querySelector("#mBuildBtn")?.classList.toggle("sbp-lit", open);
    document.querySelector("#tradeBankBtn")?.classList.toggle("sbp-off", open);
    document.querySelector("#mCardsBtn")?.classList.toggle("sbp-off", open);
    this._sbpPaintTimer();
  },
};
