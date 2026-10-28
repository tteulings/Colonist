// Pass & play (hot-seat): 2–6 people share one phone, optionally with bots. A mixin on ColonistFullGame
// (installed by game.js). Styles: themes/hotseat.css.
//
// One human "holds the phone" at a time: the viewer (viewerId). Only the viewer's hand, development
// cards and secret points are ever drawn; everyone else shows public counts. Whenever a different
// human has to act (their turn or set-up placement, a discard on a 7, a trade offer made to them, their
// build window at a 5–6 player table) a full-screen cover in that player's colour asks to pass the phone,
// and nothing private is drawn until they tap "I'm <name>". While only bots act, every hand is hidden.
import { avatarSvg, icon } from "./themes/manager.js";

const RES = ["wood", "brick", "sheep", "wheat", "ore"];
const sum = (o) => RES.reduce((a, r) => a + (o?.[r] || 0), 0);
const has = (hand, cost) => RES.every((r) => (hand[r] || 0) >= (cost[r] || 0));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export const HotseatMixin = {
  /** More than one human at the table (Classic only): pass & play is on. */
  get hotseat() {
    return !!this.players && this.players.filter((p) => p.isHuman).length > 1;
  },

  /** The human whose private cards the screen shows ("you"): the viewer in pass & play, else the only human. */
  _me() {
    const ps = this.players;
    if (!ps) return undefined;
    if (this.hotseat) {
      const v = ps[this.viewerId];
      if (v?.isHuman) return v;
    }
    return ps.find((p) => p.isHuman);
  },

  /** Seat 0 of a solo game is "You" (log grammar: "You discard" vs "Blaauw discards"). */
  _you(p) {
    return !!p?.isHuman && !this.hotseat;
  },

  /** May the screen show this player's hidden information (dev cards, secret points)? */
  _seesPrivate(p) {
    if (!p?.isHuman) return false;
    if (!this.hotseat) return true;
    return p.id === this.viewerId && !this.handHidden;
  },

  /** Which human must hold the phone right now (null: only bots act, or nobody). */
  _hsTarget() {
    if (!this.hotseat || this.winner || this.onboardingHold || !this.players?.length) return null;
    if (this.pendingDiscard?.player?.isHuman) return this.pendingDiscard.player.id;
    const pit = this.pendingIncomingTrade;
    if (pit?.to?.isHuman) return pit.to.id;
    // ⚓ Seafarers: a person picks their gold card (also on someone else's roll)
    const gold = this.sea?.gold?.find((x) => this.players[x.pid] && this._isInteractive(this.players[x.pid]));
    if (gold) return gold.pid;
    const cur = this.currentPlayer;
    if (!cur || !this._isInteractive(cur)) return null;
    if (this.setupPhase) return this.setupAction ? cur.id : null;
    return cur.id;
  },

  /** Another human answers for a moment (a trade made to them, a discard): the turn owner's buttons wait. */
  _hsAway() {
    if (!this.hotseat) return false;
    const t = this._hsTarget();
    return t != null && t !== this.currentPlayer?.id;
  },

  /** Run at the start of every render: hide hands when no human acts, ask for the phone when one must. */
  _hsSync() {
    const app = document.getElementById("app");
    if (!this.hotseat) {
      this.handHidden = false;
      this._hsHideCover();
      app?.classList.remove("hs-hidden", "hs-away", "hs-on");
      return;
    }
    if (this.viewerId == null || !this.players[this.viewerId]?.isHuman) this.viewerId = this.players.find((p) => p.isHuman).id;
    const t = this._hsTarget();
    if (t == null) {
      if (!this.handHidden) { this.handHidden = true; this._invalidateUI?.(); }
      this._hsHideCover();
    } else if (t === this.viewerId && this.handHidden && this._hsLastAck === t && this.hsCoverOn == null) {
      // v0.86: the same person who last tapped "I'm …" acts again (after bot turns / a bot's offer): the
      // phone never left them, so no cover: their hand just opens again (notes that waited become toasts)
      this.handHidden = false;
      this._hsReveal(t);
      this._invalidateUI?.();
    } else if (t !== this.viewerId || this.handHidden) {
      if (t !== this.viewerId || !this.handHidden) this._invalidateUI?.();
      this.viewerId = t;
      this.handHidden = true;
      this._hsShowCover(t);
    } else {
      this._hsHideCover();
    }
    app?.classList.add("hs-on");
    app?.classList.toggle("hs-hidden", !!this.handHidden);
    app?.classList.toggle("hs-away", this._hsAway());
  },

  /** The line under the name on the cover: why this player gets the phone. */
  _hsWhy(pid) {
    if (this._hsNote && this._hsNote.pid === pid) return this._hsNote.html;
    const pd = this.pendingDiscard;
    if (pd?.player?.id === pid) return `Rolled 7 · hand back ${pd.count} cards`;
    const pit = this.pendingIncomingTrade;
    if (pit?.to?.id === pid) return `${avatarSvg(pit.fromPlayer.id)}${esc(pit.fromPlayer.name)} offers you a trade`;
    if (this.sea?.goldFor?.(pid)) return "Pick your gold";
    if (this.pendingAction === "robber" || this.robberBusy || this.robberVictimOptions?.length) return "Move the robber";
    if (this.setupPhase) return this.setupAction === "road" ? "Place your road" : "Place your settlement";
    if (this.phase === "sbp") return "Build window";
    return "Your turn";
  },

  _hsShowCover(pid) {
    const p = this.players[pid];
    let el = this._hsCoverEl;
    if (!el) {
      el = document.createElement("div");
      el.id = "hsCover";
      el.setAttribute("role", "dialog");
      el.setAttribute("aria-modal", "true");
      el.addEventListener("click", (e) => { if (e.target.closest(".hs-go")) this._hsAck(); });
      document.body.appendChild(el);
      this._hsCoverEl = el;
    }
    if (this._hsLastAck !== pid) this._hsLastAck = null; // the phone may be on its way to someone else now
    const why = this._hsWhy(pid);
    const secrets = this._hsSecrets?.[pid] || []; // only for this player's eyes: which card was stolen
    const key = `${pid}|${p.name}|${why}|${secrets.join("|")}`;
    el.hidden = false;
    this.hsCoverOn = pid;
    if (el.dataset.key === key) return;
    el.dataset.key = key;
    el.className = `hs-cover pc-${pid}`;
    el.setAttribute("aria-label", `Pass the phone to ${p.name}`);
    el.innerHTML = `${avatarSvg(pid, "hs-av")}<p class="hs-pass">Pass the phone to</p><h2 class="hs-name">${esc(p.name)}</h2>
      <p class="hs-why">${why}</p>${secrets.map((h) => `<p class="hs-why hs-secret">${h}</p>`).join("")}
      <button type="button" class="hs-go" data-hs-go="${pid}">I'm ${esc(p.name)} · show my hand</button>
      <p class="hs-foot">Hands stay hidden until you tap</p>`;
    // a cover over an open sheet: put the sheets away (their contents belong to the previous holder)
    this.hideTradePanel?.();
    this.hideDevCardPicker?.();
    this._hideVPTooltip?.();
  },

  _hsHideCover() {
    this.hsCoverOn = null;
    if (this._hsCoverEl && !this._hsCoverEl.hidden) { this._hsCoverEl.hidden = true; this._hsCoverEl.dataset.key = ""; }
  },

  /** "I'm Blaauw": show that player's hand. */
  _hsAck() {
    if (this.hsCoverOn == null) return;
    this.viewerId = this.hsCoverOn;
    this._hsLastAck = this.viewerId; // v0.86: who holds the phone now (no cover again until someone else must act)
    this.handHidden = false;
    this._hsNote = null;
    if (this._hsSecrets) delete this._hsSecrets[this.viewerId];
    this._hsHideCover();
    this._guardPrimaryTap?.(500);
    this.sfx?.click?.();
    this._invalidateUI?.();
    this.render();
  },

  /** No cover for the same holder: what the cover would have said privately is shown as toasts instead. */
  _hsReveal(pid) {
    const lines = [...(this._hsNote?.pid === pid ? [this._hsNote.html] : []), ...(this._hsSecrets?.[pid] || [])];
    this._hsNote = null;
    if (this._hsSecrets) delete this._hsSecrets[pid];
    lines.forEach((h) => this.pushToast?.(String(h).replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<[^>]+>/g, "").trim()));
  },

  /** A steal names the card only to the thief and the victim: a toast when they hold the phone, else a line on their next cover. */
  _hsStealNotes(thief, victim, label) {
    const keep = (pid, html) => {
      this._hsSecrets = this._hsSecrets || {};
      this._hsSecrets[pid] = [...(this._hsSecrets[pid] || []), html].slice(-3);
    };
    if (victim.isHuman) {
      if (this._seesPrivate(victim)) this.pushToast(`${esc(thief.name)} stole your ${label}`);
      else keep(victim.id, `${avatarSvg(thief.id)}${esc(thief.name)} stole your ${label}`);
    }
    if (thief.isHuman) {
      if (this._seesPrivate(thief)) this.pushToast(`You stole ${esc(victim.name)}'s ${label}`);
      else keep(thief.id, `${avatarSvg(victim.id)}You stole ${esc(victim.name)}'s ${label}`);
    }
  },

  /** Trade sheet: ask another human directly. A cover hands them the phone; they accept or decline. */
  _hsAsk(partner) {
    const player = this.currentPlayer;
    if (!this.hotseat || !player?.isHuman || !partner?.isHuman || partner === player || this.phase !== "main") return;
    const offer = { ...this.tradeOffer };
    const request = { ...this.tradeRequest };
    if (!sum(offer) || !sum(request)) { this._tradeHint("Pick what you give and what you get."); return; }
    if (RES.some((r) => offer[r] > 0 && request[r] > 0)) { this._tradeHint("Can't give and get the same resource."); return; }
    if (!has(player.resources, offer)) { this._tradeHint("You don't have those cards."); return; }
    const serial = this.turnSerial;
    this.addLog(`${player.name} offers ${partner.name} a trade.`);
    this.closeTradeModal();
    this.showIncomingTrade(player, offer, request, partner).then(this._guard((accepted) => {
      const word = accepted ? "said yes" : "said no";
      if (this.currentPlayer === player && this.turnSerial === serial) {
        this._hsNote = { pid: player.id, html: `${avatarSvg(partner.id)}${esc(partner.name)} ${word}${accepted ? ` ${icon("check")}` : ""}` };
      }
      if (accepted) { this.tradeOffer = Object.fromEntries(RES.map((r) => [r, 0])); this.tradeRequest = Object.fromEntries(RES.map((r) => [r, 0])); }
      this.render();
    }));
  },
};
