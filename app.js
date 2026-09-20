(() => {
  const D = window.GWPlannerData;
  const E = window.GWPlannerEngine;
  const KEY = "gw_planner_web_beta_v1";
  const byId = id => document.getElementById(id);
  const el = {
    weekTabs:byId("weekTabs"), weekStart:byId("weekStart"), teamSizeGrid:byId("teamSizeGrid"),
    saveSetupBtn:byId("saveSetupBtn"), playerCount:byId("playerCount"), playerList:byId("playerList"),
    addPlayerBtn:byId("addPlayerBtn"), playerDataBtn:byId("playerDataBtn"), autoPlanBtn:byId("autoPlanBtn"), planSection:byId("planSection"),
    planTitle:byId("planTitle"), dayTabs:byId("dayTabs"), viewTabs:byId("viewTabs"),
    planPreview:byId("planPreview"), exportBtn:byId("exportBtn"), playerDialog:byId("playerDialog"),
    playerForm:byId("playerForm"), playerDialogTitle:byId("playerDialogTitle"), playerId:byId("playerId"),
    playerName:byId("playerName"), playerShortCode:byId("playerShortCode"), playerColor:byId("playerColor"), playerColorPalette:byId("playerColorPalette"), countrySearch:byId("countrySearch"), playerCountry:byId("playerCountry"),
    timeZoneField:byId("timeZoneField"), playerTimeZone:byId("playerTimeZone"), playerRole:byId("playerRole"),
    playerStars:byId("playerStars"), starsField:byId("starsField"), playStart:byId("playStart"),
    playEnd:byId("playEnd"), linkedAccountsList:byId("linkedAccountsList"), doublePreference:byId("doublePreference"), deletePlayerBtn:byId("deletePlayerBtn"),
    exportDialog:byId("exportDialog"), exportForm:byId("exportForm"), exportRange:byId("exportRange"),
    exportStatus:byId("exportStatus"), toast:byId("toast"), captureRoot:byId("captureRoot"),
    playerDataDialog:byId("playerDataDialog"), downloadPlayerTemplateBtn:byId("downloadPlayerTemplateBtn"),
    importPlayersBtn:byId("importPlayersBtn"), createBackupBtn:byId("createBackupBtn"),
    restoreBackupBtn:byId("restoreBackupBtn"), playerWorkbookInput:byId("playerWorkbookInput"),
    backupInput:byId("backupInput"), reviewDialog:byId("reviewDialog"),
    reviewDialogTitle:byId("reviewDialogTitle"), reviewDialogMessage:byId("reviewDialogMessage"),
    reviewCancelBtn:byId("reviewCancelBtn"), reviewConfirmBtn:byId("reviewConfirmBtn")
  };

  function normalizeShortCode(value) {
    return [...String(value || "").trim().toUpperCase()]
      .filter(ch=>/[\p{L}\p{N}]/u.test(ch))
      .slice(0,3)
      .join("");
  }
  function defaultShortCode(name) {
    const parts=String(name || "").trim().split(/\s+/)
      .map(part=>[...part].filter(ch=>/[\p{L}\p{N}]/u.test(ch)).join(""))
      .filter(Boolean);
    if(!parts.length) return "";
    const raw=parts.length>=2
      ? parts.slice(0,3).map(part=>[...part].find(ch=>/\p{L}/u.test(ch)) || [...part][0]).join("")
      : [...parts[0]].slice(0,2).join("");
    return normalizeShortCode(raw);
  }
  function uniqueShortCode(name, preferred, used) {
    const compact=[...String(name || "").toUpperCase()]
      .filter(ch=>/[\p{L}\p{N}]/u.test(ch)).join("");
    const base=defaultShortCode(name) || "P";
    const candidates=[
      normalizeShortCode(preferred),
      base,
      normalizeShortCode(compact.slice(0,3)),
      compact.length>=2 ? normalizeShortCode(compact[0]+compact[compact.length-1]) : "",
      compact.length>=3 ? normalizeShortCode(compact[0]+compact[1]+compact[compact.length-1]) : ""
    ].filter(Boolean);
    for(const code of [...new Set(candidates)]) {
      if(!used.has(code.toUpperCase())) return code;
    }
    for(let i=1;i<=99;i++) {
      const code=normalizeShortCode(base.slice(0,1)+String(i).padStart(2,"0"));
      if(!used.has(code.toUpperCase())) return code;
    }
    return base;
  }
  function playerCode(player) {
    return normalizeShortCode(player && player.shortCode) ||
      defaultShortCode(player && player.name) ||
      "P";
  }
  function suggestShortCode(name, excludingId) {
    const used=new Set(state.players
      .filter(p=>p.id!==excludingId)
      .map(p=>playerCode(p).toUpperCase()));
    return uniqueShortCode(name,"",used);
  }

  function normalizeColorHex(value) {
    const text=String(value || "").trim().toUpperCase();
    return /^#[0-9A-F]{6}$/.test(text) ? text : "";
  }
  function uniquePlayerColor(preferred, used) {
    const normalized=normalizeColorHex(preferred);
    if(normalized && !used.has(normalized)) return normalized;
    return D.PLAYER_COLORS
      .map(x=>x.toUpperCase())
      .find(x=>!used.has(x)) || D.PLAYER_COLORS[0].toUpperCase();
  }
  function playerColor(player) {
    return normalizeColorHex(player && player.colorHex) ||
      D.PLAYER_COLORS[0].toUpperCase();
  }
  function suggestPlayerColor(excludingId) {
    const used=new Set(state.players
      .filter(p=>p.id!==excludingId)
      .map(p=>playerColor(p)));
    return uniquePlayerColor("",used);
  }

  function renderPlayerColorPalette(excludingId) {
    const currentWeek=week();
    const sharedPlayerIds=new Set();
    if(excludingId) {
      D.DAYS.forEach(day=>{
        const dp=currentWeek.days[day.id];
        if(dp.playerIds.includes(excludingId)) {
          dp.playerIds.forEach(id=>{ if(id!==excludingId) sharedPlayerIds.add(id); });
        }
      });
    }

    const used=new Set(state.players
      .filter(p=>sharedPlayerIds.has(p.id))
      .map(p=>playerColor(p)));
    const current=normalizeColorHex(el.playerColor.value) || suggestPlayerColor(excludingId);
    const available=D.PLAYER_COLORS
      .map(x=>x.toUpperCase())
      .filter(x=>x===current || !used.has(x));

    if(!available.includes(current)) available.unshift(current);
    el.playerColorPalette.innerHTML="";
    available.forEach(hex=>{
      const swatch=document.createElement("button");
      swatch.type="button";
      swatch.className="player-color-swatch"+(hex===normalizeColorHex(el.playerColor.value)?" selected":"");
      swatch.style.background=hex;
      swatch.style.color=contrast(hex);
      swatch.textContent=hex===normalizeColorHex(el.playerColor.value)?"✓":"";
      swatch.setAttribute("aria-label","Select "+hex);
      swatch.onclick=()=>{
        el.playerColor.value=hex.toLowerCase();
        renderPlayerColorPalette(excludingId);
      };
      el.playerColorPalette.appendChild(swatch);
    });
  }

  function freshState() {
    return { version:1, selectedWeek:1, players:[], weeks:{ "1":E.emptyWeek(1) } };
  }
  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) || "null");
      if (parsed && Array.isArray(parsed.players) && parsed.weeks) return parsed;
    } catch (_) {}
    return freshState();
  }

  let state = loadState();
  {
    const usedCodes=new Set();
    state.players.forEach((player,index)=>{
      player.shortCode=uniqueShortCode(player.name,player.shortCode,usedCodes);
      usedCodes.add(player.shortCode.toUpperCase());
      player.colorHex=normalizeColorHex(player.colorHex) ||
        D.PLAYER_COLORS[index % D.PLAYER_COLORS.length].toUpperCase();
      const legacyPreferred=!!player.preferredSpare;
      player.doubleAttackPreference=
        ["PREFERRED","ALLOWED","DO_NOT_USE"].includes(player.doubleAttackPreference)
          ? player.doubleAttackPreference
          : (legacyPreferred?"PREFERRED":"ALLOWED");
      player.preferredSpare=player.doubleAttackPreference==="PREFERRED";
      player.linkedAccountIds=Array.isArray(player.linkedAccountIds)
        ? [...new Set(player.linkedAccountIds.filter(Boolean))]
        : [];
    });

    // Normalize linked accounts into symmetric owner groups.
    const byId=new Map(state.players.map(p=>[p.id,p]));
    const seen=new Set();
    state.players.forEach(player=>{
      if(seen.has(player.id)) return;
      const group=new Set([player.id]);
      const queue=[player.id];
      while(queue.length){
        const id=queue.shift();
        const current=byId.get(id);
        if(!current) continue;
        (current.linkedAccountIds||[]).forEach(linkedId=>{
          if(byId.has(linkedId) && !group.has(linkedId)){
            group.add(linkedId);
            queue.push(linkedId);
          }
        });
        state.players.forEach(other=>{
          if((other.linkedAccountIds||[]).includes(id) && !group.has(other.id)){
            group.add(other.id);
            queue.push(other.id);
          }
        });
      }
      group.forEach(id=>{
        const current=byId.get(id);
        if(current) current.linkedAccountIds=[...group].filter(x=>x!==id);
        seen.add(id);
      });
    });
  }
  state.selectedWeek = Math.max(1, Math.min(4, state.selectedWeek || 1));
  let selectedDay = D.DAYS[0].id;
  let selectedView = "MAP";
  let shortCodeTouched = false;
  let toastTimer = null;
  let reviewAction = null;

  function showReview({
    title,
    message,
    html=false,
    confirmLabel="OK",
    cancelLabel="CANCEL",
    showCancel=true,
    onConfirm=null,
  }) {
    reviewAction=onConfirm;
    el.reviewDialogTitle.textContent=title;
    if(html) el.reviewDialogMessage.innerHTML=message;
    else el.reviewDialogMessage.textContent=message;
    el.reviewConfirmBtn.textContent=confirmLabel;
    el.reviewCancelBtn.textContent=cancelLabel;
    el.reviewCancelBtn.classList.toggle("hidden",!showCancel);
    if(!el.reviewDialog.open)el.reviewDialog.showModal();
  }

  function closeReview() {
    reviewAction=null;
    if(el.reviewDialog.open)el.reviewDialog.close();
  }

  function saveState() { localStorage.setItem(KEY, JSON.stringify(state)); }
  function ensureWeek(n) {
    const key = String(n);
    if (state.weeks[key]) return state.weeks[key];
    state.weeks[key] = n > 1 ? E.inheritWeek(ensureWeek(n - 1), n) : E.emptyWeek(1);
    saveState();
    return state.weeks[key];
  }
  function week() { return ensureWeek(state.selectedWeek); }
  function esc(v) {
    return String(v == null ? "" : v).replaceAll("&","&amp;").replaceAll("<","&lt;")
      .replaceAll(">","&gt;").replaceAll('"',"&quot;");
  }
  function toast(msg) {
    clearTimeout(toastTimer);
    el.toast.textContent = msg;
    el.toast.classList.add("show");
    toastTimer = setTimeout(() => el.toast.classList.remove("show"), 2800);
  }
  function roleLabel(role) { return role === "PVP" ? "PvP" : role === "PVZ" ? "PvZ" : "Both"; }
  function formatTime(minutes) {
    if (minutes === 1440) return "24:00";
    return String(Math.floor(minutes / 60) % 24).padStart(2,"0") + ":" + String(minutes % 60).padStart(2,"0");
  }
  function fillTimeSelect(select, include24) {
    select.innerHTML = "";
    const end = include24 ? 1440 : 1410;
    for (let m=0; m<=end; m+=30) {
      const o = document.createElement("option");
      o.value = String(m); o.textContent = formatTime(m); select.appendChild(o);
    }
  }

  function renderWeeks() {
    el.weekTabs.innerHTML = "";
    for (let n=1; n<=4; n++) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "tab" + (n === state.selectedWeek ? " active" : "");
      b.textContent = "W" + n;
      b.onclick = () => { state.selectedWeek=n; ensureWeek(n); saveState(); renderAll(); };
      el.weekTabs.appendChild(b);
    }
  }

  function renderSetup() {
    const w = week();
    el.weekStart.value = w.weekStart;
    el.teamSizeGrid.innerHTML = "";
    D.DAYS.forEach(day => {
      const label = document.createElement("label");
      const span = document.createElement("span"); span.textContent = day.short;
      const select = document.createElement("select"); select.dataset.day = day.id;
      const br = document.createElement("option"); br.value="0"; br.textContent="BREAK"; select.appendChild(br);
      for (let size=3; size<=10; size++) {
        const o=document.createElement("option"); o.value=String(size); o.textContent=size+"v"+size; select.appendChild(o);
      }
      select.value=String(w.days[day.id].teamSize);
      label.append(span,select); el.teamSizeGrid.appendChild(label);
    });
  }

  function saveSetup(notify) {
    const w=week();
    w.weekStart=el.weekStart.value || w.weekStart;
    el.teamSizeGrid.querySelectorAll("select[data-day]").forEach(s => {
      const dp=w.days[s.dataset.day]; dp.teamSize=Number(s.value);
      if (dp.teamSize===0) { dp.playerIds=[]; dp.pvpCorePlayerIds=[]; }
    });
    saveState(); renderPlan();
    if (notify) toast("Team sizes saved.");
  }

  function renderPlayers() {
    const w=week();
    const players=[...state.players].sort((a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:"base"}));
    const playersById=new Map(players.map(p=>[p.id,p]));
    el.playerCount.textContent=players.length+" / 20 players";
    el.playerList.innerHTML="";
    if (!players.length) {
      el.playerList.innerHTML='<div class="muted compact">No players yet. Add the guild members you want the planner to use.</div>';
      return;
    }
    players.forEach(p => {
      const row=document.createElement("div"); row.className="player-row";
      const main=document.createElement("div"); main.className="player-main";
      const stars=p.role!=="PVZ" ? " · "+"★".repeat(p.pvpStars || 3) : "";
      const spare=p.doubleAttackPreference==="PREFERRED"
        ? " · DOUBLE"
        : p.doubleAttackPreference==="DO_NOT_USE"
          ? " · NO DOUBLE"
          : "";
      const linkedNames=(p.linkedAccountIds||[])
        .map(id=>playersById.get(id)?.name)
        .filter(Boolean)
        .sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:"base"}));
      const linkedLine=linkedNames.length
        ? '<div class="player-linked">LINKED · '+esc(linkedNames.join(", "))+'</div>'
        : "";
      main.innerHTML='<img class="flag" src="'+esc(D.flagUrl(p.countryCode))+'" alt=""><div><div class="player-name">'+esc(p.name)+'</div><div class="player-meta"><span class="roster-code" style="background:'+playerColor(p)+';color:'+contrast(playerColor(p))+'">'+esc(playerCode(p))+'</span> · '+esc(roleLabel(p.role))+stars+spare+'</div>'+linkedLine+'</div>';
      main.onclick=()=>openPlayer(p.id);
      const edit=document.createElement("button"); edit.type="button"; edit.className="btn btn-secondary"; edit.textContent="EDIT"; edit.onclick=()=>openPlayer(p.id);
      const avail=document.createElement("div"); avail.className="availability";
      D.DAYS.forEach(day => {
        const available=!w.days[day.id].unavailablePlayerIds.includes(p.id);
        const chip=document.createElement("button"); chip.type="button"; chip.className="avail-chip"+(available?" on":"");
        chip.textContent=(available?"✓":"×")+" "+day.short;
        chip.onclick=()=>{
          const dp=w.days[day.id]; const set=new Set(dp.unavailablePlayerIds);
          if (available) {
            set.add(p.id); dp.playerIds=dp.playerIds.filter(x=>x!==p.id); dp.pvpCorePlayerIds=dp.pvpCorePlayerIds.filter(x=>x!==p.id);
          } else set.delete(p.id);
          dp.unavailablePlayerIds=[...set]; saveState(); renderPlayers(); renderPlan();
        };
        avail.appendChild(chip);
      });
      row.append(main,edit,avail); el.playerList.appendChild(row);
    });
  }

  function populateCountries(query, selected) {
    const q=(query||"").trim().toLowerCase();
    const list=D.COUNTRIES.filter(c=>!q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
    el.playerCountry.innerHTML="";
    list.forEach(c => {
      const o=document.createElement("option"); o.value=c.code; o.textContent=c.name; o.selected=c.code===selected; el.playerCountry.appendChild(o);
    });
  }
  function populateZones(country, preferred, resetWindow) {
    let zones=D.timeZonesForCountry(country);
    if (!zones.length) zones=[{id:Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",label:"Default time zone"}];
    el.playerTimeZone.innerHTML="";
    zones.forEach(z => {
      const o=document.createElement("option"); o.value=z.id; o.textContent=z.label; o.selected=z.id===preferred; el.playerTimeZone.appendChild(o);
    });
    if (preferred && !zones.some(z=>z.id===preferred)) {
      const o=document.createElement("option"); o.value=preferred; o.textContent=preferred.split("/").pop().replaceAll("_"," "); o.selected=true; el.playerTimeZone.prepend(o);
    }
    el.timeZoneField.classList.toggle("hidden", el.playerTimeZone.options.length<=1);
    if (resetWindow) setDefaultWindow();
  }
  function setDefaultWindow() {
    const range=E.defaultPreferredWindow(el.playerTimeZone.value || "UTC");
    el.playStart.value=String(Math.round(range[0]/30)*30 % 1440);
    let end=Math.round(range[1]/30)*30; if (end===0) end=1440; el.playEnd.value=String(Math.min(1440,end));
  }
  function renderLinkedAccounts(currentId,selectedIds=[]) {
    const selected=new Set(selectedIds || []);
    el.linkedAccountsList.innerHTML="";
    const candidates=[...state.players]
      .filter(p=>p.id!==currentId)
      .sort((a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:"base"}));

    if(!candidates.length){
      el.linkedAccountsList.innerHTML='<div class="muted compact">No other accounts available.</div>';
      return;
    }

    candidates.forEach(account=>{
      const label=document.createElement("label");
      const input=document.createElement("input");
      input.type="checkbox";
      input.value=account.id;
      input.checked=selected.has(account.id);
      const text=document.createElement("span");
      text.textContent=account.name;
      label.append(input,text);
      el.linkedAccountsList.appendChild(label);
    });
  }

  function selectedLinkedAccounts() {
    return [...el.linkedAccountsList.querySelectorAll('input[type="checkbox"]:checked')]
      .map(x=>x.value);
  }

  function applyLinkedAccountGroup(playerId,requestedIds,previousLinkedIds=[]) {
    const byId=new Map(state.players.map(p=>[p.id,p]));
    const previousGroup=new Set([playerId,...(previousLinkedIds||[])]);
    const requested=new Set(
      (requestedIds||[]).filter(id=>id!==playerId && byId.has(id))
    );

    [...requested].filter(id=>!previousGroup.has(id)).forEach(id=>{
      const account=byId.get(id);
      (account?.linkedAccountIds||[]).forEach(groupId=>{
        if(groupId!==playerId && byId.has(groupId)) requested.add(groupId);
      });
    });

    const current=byId.get(playerId);
    const inheritedMainId=
      current?.accountType==="SECOND" &&
      current?.mainAccountId &&
      requested.has(current.mainAccountId)
        ? current.mainAccountId
        : null;
    const mainId=requested.size ? (inheritedMainId || playerId) : null;
    const finalGroup=new Set([playerId,...requested]);
    const main=mainId ? byId.get(mainId) : null;

    state.players.forEach(account=>{
      if(finalGroup.has(account.id)){
        account.linkedAccountIds=[...finalGroup].filter(id=>id!==account.id);
        if(mainId && account.id===mainId){
          account.accountType="MAIN";
          account.mainAccountId=null;
        } else if(mainId){
          account.accountType="SECOND";
          account.mainAccountId=mainId;
          if(main){
            account.countryCode=main.countryCode;
            account.timeZoneId=main.timeZoneId;
          }
        }
      } else {
        account.linkedAccountIds=(account.linkedAccountIds||[])
          .filter(id=>!finalGroup.has(id));
      }
    });
  }
  async function requestDetachedAccountLocations(accounts) {
    const resolved=new Map();
    for(const account of accounts){
      const location=await chooseDetachedAccountLocation(account);
      if(!location)return null;
      resolved.set(account.id,location);
    }
    return resolved;
  }

  function chooseDetachedAccountLocation(account) {
    return new Promise(resolve=>{
      const dialog=document.createElement("dialog");
      dialog.className="modal";
      const card=document.createElement("form");
      card.method="dialog";
      card.className="modal-card";

      const head=document.createElement("div");
      head.className="modal-head";
      const titleWrap=document.createElement("div");
      const kicker=document.createElement("div");
      kicker.className="section-kicker";
      kicker.textContent="SECOND ACCOUNT REMOVED";
      const title=document.createElement("h2");
      title.textContent=account.name;
      titleWrap.append(kicker,title);
      head.appendChild(titleWrap);

      const info=document.createElement("p");
      info.className="muted";
      info.textContent="Which country does this account belong to now?";

      const countryLabel=document.createElement("label");
      countryLabel.className="field";
      const countryText=document.createElement("span");
      countryText.textContent="COUNTRY";
      const country=document.createElement("select");
      D.COUNTRIES.forEach(item=>{
        const option=document.createElement("option");
        option.value=item.code;
        option.textContent=item.name;
        if(item.code===account.countryCode)option.selected=true;
        country.appendChild(option);
      });
      countryLabel.append(countryText,country);

      const zoneLabel=document.createElement("label");
      zoneLabel.className="field";
      const zoneText=document.createElement("span");
      zoneText.textContent="REGION / TIME ZONE";
      const zone=document.createElement("select");
      zoneLabel.append(zoneText,zone);

      const refillZones=()=>{
        let zones=D.timeZonesForCountry(country.value);
        if(!zones.length){
          zones=[{id:Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC",label:"Default time zone"}];
        }
        zone.innerHTML="";
        zones.forEach(item=>{
          const option=document.createElement("option");
          option.value=item.id;
          option.textContent=item.label;
          zone.appendChild(option);
        });
        zoneLabel.classList.toggle("hidden",zones.length<=1);
      };
      country.onchange=refillZones;
      refillZones();

      const actions=document.createElement("div");
      actions.className="modal-actions";
      const cancel=document.createElement("button");
      cancel.type="button";
      cancel.className="btn btn-secondary";
      cancel.textContent="CANCEL";
      const save=document.createElement("button");
      save.type="button";
      save.className="btn btn-primary";
      save.textContent="SAVE COUNTRY";
      actions.append(cancel,save);

      card.append(head,info,countryLabel,zoneLabel,actions);
      dialog.appendChild(card);
      document.body.appendChild(dialog);

      const close=value=>{
        try{if(dialog.open)dialog.close();}catch(_){}
        dialog.remove();
        resolve(value);
      };
      cancel.onclick=()=>close(null);
      save.onclick=()=>close({
        countryCode:country.value,
        timeZoneId:zone.value
      });
      dialog.addEventListener("cancel",event=>{
        event.preventDefault();
        close(null);
      });
      openModalSafe(dialog);
    });
  }

  function openPlayer(id) {
    const p=id ? state.players.find(x=>x.id===id) : null;
    el.playerDialogTitle.textContent=p?"Edit player":"Add player"; el.playerId.value=p?p.id:""; el.playerName.value=p?p.name:"";
    el.playerShortCode.value=p?playerCode(p):""; shortCodeTouched=!!p;
    el.playerColor.value=(p?playerColor(p):suggestPlayerColor(null)).toLowerCase();
    el.countrySearch.value=""; const country=p?p.countryCode:"DE"; populateCountries("",country); populateZones(country,p?p.timeZoneId:null,false);
    el.playerRole.value=p?p.role:"PVZ"; el.playerStars.value=String(p && p.pvpStars ? p.pvpStars : 3);
    el.starsField.classList.toggle("hidden",el.playerRole.value==="PVZ");
    el.doublePreference.value=p?.doubleAttackPreference || (p?.preferredSpare?"PREFERRED":"ALLOWED");
    renderLinkedAccounts(p?.id || null,p?.linkedAccountIds || []);
    if (p) { el.playStart.value=String(p.preferredStartMinutes); el.playEnd.value=String(p.preferredEndMinutes); } else setDefaultWindow();
    el.deletePlayerBtn.classList.toggle("hidden",!p); el.playerDialog.showModal();
  }
  function closePlayer() { if (el.playerDialog.open) el.playerDialog.close(); }
  async function savePlayer(event) {
    event.preventDefault();
    const id=el.playerId.value || (crypto.randomUUID ? crypto.randomUUID() : "p"+Date.now());
    const existing=state.players.find(x=>x.id===id);
    const previousLinkedIds=existing?.linkedAccountIds || [];
    const name=el.playerName.value.trim(); if (!name) return;
    if (state.players.some(p=>p.id!==id && p.name.trim().toLowerCase()===name.toLowerCase())) return toast("A player with this name already exists.");
    const shortCode=normalizeShortCode(el.playerShortCode.value) || suggestShortCode(name,id);
    if (state.players.some(p=>p.id!==id && playerCode(p).toLowerCase()===shortCode.toLowerCase())) return toast("This short code is already used by another player.");
    const colorHex=normalizeColorHex(el.playerColor.value) || suggestPlayerColor(id);
    const role=el.playerRole.value;
    const doubleAttackPreference=["PREFERRED","ALLOWED","DO_NOT_USE"].includes(el.doublePreference.value)
      ? el.doublePreference.value
      : "ALLOWED";
    const linkedAccountIds=selectedLinkedAccounts();
    const detachedSecondAccounts=(previousLinkedIds||[])
      .filter(linkedId=>!linkedAccountIds.includes(linkedId))
      .map(linkedId=>state.players.find(x=>x.id===linkedId))
      .filter(account=>account && account.accountType==="SECOND" && account.mainAccountId===id);

    const selfDetachedFromMain=
      !!existing &&
      existing.accountType==="SECOND" &&
      !!existing.mainAccountId &&
      previousLinkedIds.includes(existing.mainAccountId) &&
      !linkedAccountIds.includes(existing.mainAccountId);

    const locationRequests=[...detachedSecondAccounts];

    // If the account being edited is detached from its main account,
    // Player Edit already contains the user's chosen country/time zone.
    // Only ask for accounts removed from another player's link group.
    const detachedLocations=locationRequests.length
      ? await requestDetachedAccountLocations(locationRequests)
      : new Map();
    if(detachedLocations===null)return;

    const p={id,name,shortCode,colorHex,countryCode:el.playerCountry.value,timeZoneId:el.playerTimeZone.value,role,
      pvpStars:role==="PVZ"?null:Number(el.playerStars.value),preferredStartMinutes:Number(el.playStart.value),
      preferredEndMinutes:Number(el.playEnd.value),preferredSpare:doubleAttackPreference==="PREFERRED",
      doubleAttackPreference,
      accountType:selfDetachedFromMain?"MAIN":(existing?.accountType||"MAIN"),
      mainAccountId:selfDetachedFromMain?null:(existing?.mainAccountId||null),
      linkedAccountIds};
    const i=state.players.findIndex(x=>x.id===id); if (i>=0) state.players[i]=p; else state.players.push(p);
    applyLinkedAccountGroup(id,linkedAccountIds,previousLinkedIds);

    detachedLocations.forEach((location,accountId)=>{
      const detached=state.players.find(x=>x.id===accountId);
      if(!detached)return;
      detached.countryCode=location.countryCode;
      detached.timeZoneId=location.timeZoneId;
      detached.accountType="MAIN";
      detached.mainAccountId=null;
      detached.linkedAccountIds=[];
    });

    saveState(); closePlayer(); renderPlayers(); renderPlan(); toast("Player saved.");
  }
  function deletePlayer() {
    const id=el.playerId.value; const p=state.players.find(x=>x.id===id);
    if (!p || !confirm("Delete "+p.name+"?")) return;
    state.players=state.players
      .filter(x=>x.id!==id)
      .map(x=>({...x,linkedAccountIds:(x.linkedAccountIds||[]).filter(linkedId=>linkedId!==id)}));
    Object.values(state.weeks).forEach(w=>D.DAYS.forEach(day=>{
      const dp=w.days[day.id]; dp.playerIds=dp.playerIds.filter(x=>x!==id); dp.pvpCorePlayerIds=dp.pvpCorePlayerIds.filter(x=>x!==id); dp.unavailablePlayerIds=dp.unavailablePlayerIds.filter(x=>x!==id);
    }));
    saveState(); closePlayer(); renderAll(); toast("Player deleted.");
  }

  function failureText(f) {
    const day=(D.DAYS.find(d=>d.id===f.day)||{}).label || "";
    if (f.type==="DAILY_SHORTAGE") return day+": needs "+f.required+" players, only "+f.available+" are available.";
    if (f.type==="TIME_WINDOW") return day+": only "+f.available+" of "+f.required+" players fit their local play windows.";
    if (f.type==="PVP_COVERAGE") return day+": needs "+f.required+" PvP-capable players, only "+f.available+" are available.";
    if (f.type==="PVP_TIMING") return day+": only "+f.available+" of "+f.required+" PvP players fit the PvP handoff timing.";
    if (f.type==="STACKING_WINDOW") return day+": only "+f.available+" of "+f.required+" spare attacks can be coordinated for stacking.";
    if (f.type==="WEEKLY_CAPACITY") return "The week needs "+f.required+" player slots, but the roster can provide only "+f.available+" with the two-day limit.";
    if (f.type==="AVAILABILITY_CONFLICT") return "The selected availability cannot fill every game while keeping the two-day limit.";
    return "The plan could not be created.";
  }
  function createPlan() {
    saveSetup(false);
    if (!state.players.length) return toast("Add players first.");

    const weekNumber=state.selectedWeek;
    const current=week();
    const hadAssignments=D.DAYS.some(d=>current.days[d.id].playerIds.length>0);
    const before=JSON.stringify(current);

    el.autoPlanBtn.disabled=true;
    el.autoPlanBtn.textContent="RECALCULATING…";

    setTimeout(()=>{
      const result=E.autoPlan(state.players,current);
      el.autoPlanBtn.disabled=false;

      if (!result.success) {
        renderPlan();
        return toast(failureText(result.failure));
      }

      const unchanged=hadAssignments && before===JSON.stringify(result.plan);
      state.weeks[String(weekNumber)]=result.plan; saveState();

      const first=D.DAYS.find(d=>result.plan.days[d.id].teamSize>0);
      selectedDay=first?first.id:D.DAYS[0].id;
      selectedView="MAP";

      renderPlan();
      el.planSection.scrollIntoView({behavior:"smooth",block:"start"});

      if (!hadAssignments) toast("Week "+weekNumber+" planned.");
      else if (unchanged) toast("Week "+weekNumber+" recalculated · no changes needed.");
      else toast("Week "+weekNumber+" recalculated · plan updated.");
    },80);
  }

  function colorMap(w,dayId) {
    const ids=[...(w.days[dayId]?.playerIds || [])];
    const players=new Map(state.players.map(p=>[p.id,p]));
    const candidates=D.PLAYER_COLORS
      .slice(0,Math.min(ids.length,D.PLAYER_COLORS.length))
      .map(x=>x.toUpperCase());
    const result=new Map();

    ids.forEach(id=>{
      const preferred=players.has(id) ? playerColor(players.get(id)) : "";
      const idx=candidates.indexOf(preferred);
      if(idx>=0) {
        result.set(id,preferred);
        candidates.splice(idx,1);
      }
    });

    ids.forEach(id=>{
      if(result.has(id)) return;
      const next=candidates.length
        ? candidates.shift()
        : D.PLAYER_COLORS[result.size%D.PLAYER_COLORS.length].toUpperCase();
      result.set(id,next);
    });
    return result;
  }
  function contrast(hex) {
    const s=hex.replace("#",""),r=parseInt(s.slice(0,2),16),g=parseInt(s.slice(2,4),16),b=parseInt(s.slice(4,6),16);
    return (.299*r+.587*g+.114*b)>150?"#141719":"#fff";
  }
  function sheetHeader(w,dayId) {
    const d=D.DAYS.find(x=>x.id===dayId),end=E.addDaysIso(w.weekStart,5);
    return '<div class="sheet-header">'+
      '<div class="sheet-brand">GW TACTICS<small>GUILD WAR PLANNER</small></div>'+
      '<div class="sheet-day">'+esc(d.label)+'</div>'+
      '<div class="sheet-week"><strong>WEEK '+w.week+'</strong><span>'+esc(w.weekStart)+' – '+esc(end)+'</span></div>'+
      '</div>';
  }
  function mapView(w,dayId) {
    const dp=w.days[dayId]; if(dp.teamSize===0)return '<div class="section-title">BREAK</div>';
    const load=D.MISSION_LOADS[dp.teamSize],islands=E.createIslandAssignments(state.players,w,dayId),colors=colorMap(w,dayId),players=new Map(state.players.map(p=>[p.id,p])),stack=E.createStackPlan(state.players,w,dayId);
    let out='<div class="metrics"><div class="metric"><strong>'+dp.playerIds.length+'/'+dp.teamSize+'</strong><span>PLAYERS</span></div><div class="metric"><strong>'+load.pvpAttacks+'</strong><span>PVP ATTACKS</span></div><div class="metric"><strong>'+load.pvzAttacks+'</strong><span>PVZ ATTACKS</span></div><div class="metric"><strong>'+load.spareAttacks+'</strong><span>STACK ATTACKS</span></div></div>';
    out+='<div class="sector-plan"><div><span>SECTOR PLAN</span><strong>'+esc(load.maxSectorPlan)+'</strong></div><div class="sector-score">MAX VP '+load.maxVp+' <b>·</b> SECTOR SCORE '+load.maxSectorScore+'</div></div><div class="section-title section-title-line"><span>ISLAND ASSIGNMENTS</span></div>';
    const islandNumbers=[...new Set(islands.map(island=>Number(String(island.island).slice(0,-1))))].sort((a,b)=>a-b);
    out+='<div class="island-grid" style="--island-groups:'+Math.max(1,islandNumbers.length)+'">';
    islands.forEach(island=>{
      const number=Number(String(island.island).slice(0,-1));
      const sector=String(island.island).slice(-1);
      const groupColumn=Math.max(0,islandNumbers.indexOf(number))+1;
      const sectorRow=sector==="A"?1:sector==="B"?2:sector==="C"?3:sector==="D"?4:1;
      out+='<div class="island-card" style="grid-column:'+groupColumn+';grid-row:'+sectorRow+'"><div class="island-name">'+esc(island.island)+'</div><div class="mission-grid">';
      island.missions.forEach(m=>{
        const doubleAssignment=m.active&&m.isMaxPvz&&stack
          ? stack.assignments.find(x=>x.targetSector===island.island&&x.targetMissionLevel===m.missionLevel)
          : null;
        const p=players.get(m.playerId);
        let bg=m.active?(colors.get(m.playerId)||"#373e42"):"#1c2124";
        let text=m.active?esc(p?playerCode(p):"—"):"";
        let textColor=m.active?contrast(bg):"#8fa0a8";
        const label=!m.active?"—":doubleAssignment?"DOUBLE":m.kind==="PVP"?"PvP":String(m.missionLevel??"PvZ");
        const lc=!m.active?"#2d3235":"#c6d0d5";
        if(doubleAssignment){
          const canonical=stack.assignments[0]||doubleAssignment;
          const firstPlayer=players.get(canonical.sparePlayerId);
          const secondPlayer=players.get(canonical.partnerPlayerId);
          const first=firstPlayer?playerCode(firstPlayer):canonical.sparePlayerId.slice(0,3).toUpperCase();
          const second=secondPlayer?playerCode(secondPlayer):canonical.partnerPlayerId.slice(0,3).toUpperCase();
          const firstColor=colors.get(canonical.sparePlayerId)||"#373e42";
          const secondColor=colors.get(canonical.partnerPlayerId)||"#373e42";
          bg='linear-gradient(180deg,'+firstColor+' 0 50%,'+secondColor+' 50% 100%)';
          text='<span>'+esc(first)+'</span><span>'+esc(second)+'</span>';
          textColor="#fff";
        }
        const offset=island.columns===4?1:0;
        const gridColumn=m.column+1+offset;
        const gridRow=m.row+1;
        out+='<div class="mission-cell '+(m.active?"":"inactive")+'" style="grid-column:'+gridColumn+';grid-row:'+gridRow+'"><div class="mission-label" style="background:'+lc+'">'+label+'</div><div class="mission-player '+(doubleAssignment?"double-names":"")+'" style="background:'+bg+';color:'+textColor+'">'+text+'</div></div>';
      });
      out+='</div></div>';
    });
    return out+'</div>'+playersView(w,dayId);
  }
  function playersView(w,dayId) {
    const dp=w.days[dayId]; if(dp.teamSize===0)return '<div class="section-title">BREAK</div>';
    const players=new Map(state.players.map(p=>[p.id,p])),loads=new Map(E.createAttackLoads(state.players,dp,w,dayId).map(x=>[x.playerId,x])),colors=colorMap(w,dayId);
    const stack=E.createStackPlan(state.players,w,dayId),vp=E.playerVpTargets(state.players,w,dayId);
    const timelineOrder=new Map(E.createTimeline(state.players,w,dayId).map((x,i)=>[x.playerId,i]));
    const orderedPlayerIds=[...dp.playerIds].sort((a,b)=>(timelineOrder.get(a)??999999)-(timelineOrder.get(b)??999999));
    let out='<div class="assignments-block"><div class="section-title assignments-title"><span>PLAYER ASSIGNMENTS</span><small>'+dp.playerIds.length+' PLAYERS</small></div><div class="table-wrap"><table class="assignment-table"><thead><tr><th>PLAYER</th><th>VPS</th><th>ROLE</th><th>PVP</th><th>PVZ</th><th>STACKING</th></tr></thead><tbody>';
    orderedPlayerIds.forEach(id=>{
      const p=players.get(id),l=loads.get(id),stacks=(stack?stack.assignments:[])
        .filter(x=>x.sparePlayerId===id||(x.partnerPlayerId===id&&(l?.spareAttacks||0)>0))
        .map(x=>x.targetSector+" "+x.targetMissionLevel+" x"+x.spareAttacks)
        .join(" / ")||"—";
      const color=colors.get(id)||"#373e42",code=p?playerCode(p):id.slice(0,3).toUpperCase();
      out+='<tr><td><div class="player-cell"><span class="player-code" style="background:'+color+';color:'+contrast(color)+'">'+esc(code)+'</span><strong>'+esc(p?p.name:id)+'</strong></div></td><td class="num"><span class="vp-chip">'+(vp.get(id)||0)+'</span></td><td><span class="role-chip role-'+esc(p?p.role:"PVZ")+'">'+esc(roleLabel(p?p.role:"PVZ"))+'</span></td><td class="num"><span class="stat-chip">'+(l?l.pvpAttacks:0)+'</span></td><td class="num"><span class="stat-chip">'+(l?l.pvzAttacks:0)+'</span></td><td><span class="stack-chip '+(stacks==="—"?"empty":"active")+'">'+esc(stacks)+'</span></td></tr>';
    });
    return out+'</tbody></table></div></div>';
  }
  function phaseLabel(p) { return p==="OPENING"?"OPEN A/B":p==="PVP_SUPPORT"?"PVP SUPPORT":p==="PVP_CORE_AB"?"PVP CORE / A/B":p==="PVP_CORE_C"?"PVP CORE / C":"FLEX / D"; }
  function timelineView(w,dayId) {
    const dp=w.days[dayId]; if(dp.teamSize===0)return '<div class="section-title">BREAK</div>';
    const players=new Map(state.players.map(p=>[p.id,p])),loads=new Map(E.createAttackLoads(state.players,dp,w,dayId).map(x=>[x.playerId,x])),timeline=E.createTimeline(state.players,w,dayId),stack=E.createStackPlan(state.players,w,dayId);
    let out='<div class="section-title">TIMELINE</div><div class="timeline-list">';
    timeline.forEach(x=>{out+='<div class="timeline-row"><div class="time">'+esc(x.localTimeLabel)+' · '+esc(x.utcTimeLabel)+'</div><div><strong>'+esc((players.get(x.playerId)||{}).name||x.playerId)+'</strong> · '+esc(phaseLabel(x.phase))+'</div></div>';});
    out+='</div>';
    if(stack){
      out+='<div class="section-title">STACKING PLAN</div><div class="stack-list">';
      const canonical=stack.assignments[0]||null;
      stack.assignments.forEach(x=>{
        const firstId=canonical?.sparePlayerId||x.sparePlayerId;
        const secondId=canonical?.partnerPlayerId||x.partnerPlayerId;
        const spareName=(players.get(firstId)||{}).name||firstId;
        const partnerName=(players.get(secondId)||{}).name||secondId;
        const shared=(loads.get(x.sparePlayerId)?.spareAttacks||0)>0&&(loads.get(x.partnerPlayerId)?.spareAttacks||0)>0;
        const detail=shared
          ? '<strong>'+esc(spareName)+'</strong> + '+esc(partnerName)+' · '+esc(x.targetSector)+' · '+x.spareAttacks+' attacks'
          : '<strong>'+esc(spareName)+'</strong> · '+esc(x.targetSector)+' '+x.targetMissionLevel+' x'+x.spareAttacks+' · with '+esc(partnerName);
        out+='<div class="stack-row"><div class="time">'+esc(x.utcTime)+'</div><div>'+detail+'</div></div>';
      });
      out+='</div>';
    }
    return out;
  }
  function sheet(w,dayId,view,capture) {
    const body=view==="MAP"?mapView(w,dayId):timelineView(w,dayId);
    return '<div class="plan-sheet '+(capture?"capture":"")+'">'+sheetHeader(w,dayId)+body+'</div>';
  }

  function renderPlan() {
    const w=week(),hasAssignments=D.DAYS.some(d=>w.days[d.id].playerIds.length>0),valid=hasAssignments&&E.isPlanValid(state.players,w);
    el.autoPlanBtn.textContent=hasAssignments?"REPLAN WEEK "+w.week:"AUTO PLAN WEEK "+w.week;
    el.planSection.classList.toggle("hidden",!valid); if(!valid)return;
    const availableDays=D.DAYS.filter(d=>{
      const dp=w.days[d.id];
      return dp && dp.teamSize>0 && dp.playerIds.length>0;
    });
    if(!w.days[selectedDay] || !availableDays.some(d=>d.id===selectedDay)){
      selectedDay=(availableDays[0]||D.DAYS[0]).id;
    }
    el.planTitle.textContent="Week "+w.week+" preview";
    el.dayTabs.innerHTML="";
    D.DAYS.forEach(d=>{
      const dp=w.days[d.id];
      const available=!!dp && dp.teamSize>0 && dp.playerIds.length>0;
      const b=document.createElement("button");
      b.type="button";
      b.className="tab"+(d.id===selectedDay?" active":"")+(!available?" unavailable":"");
      b.textContent=d.short;
      b.disabled=!available;
      if(available)b.onclick=()=>{selectedDay=d.id;renderPlan();};
      el.dayTabs.appendChild(b);
    });
    el.viewTabs.innerHTML="";
    ["MAP","TIMELINE"].forEach(v=>{const b=document.createElement("button");b.type="button";b.className="tab"+(v===selectedView?" active":"");b.textContent=v;b.onclick=()=>{selectedView=v;renderPlan();};el.viewTabs.appendChild(b);});
    el.planPreview.innerHTML=sheet(w,selectedDay,selectedView,false);
  }

  function openExport() {
    const w=week(); if(!E.isPlanValid(state.players,w))return toast("Create a complete plan first.");
    el.exportRange.innerHTML="";
    D.DAYS.forEach(d=>{const o=document.createElement("option");o.value=d.id;o.textContent=d.label;o.selected=d.id===selectedDay;el.exportRange.appendChild(o);});
    const all=document.createElement("option");all.value="WEEK";all.textContent="Whole week";el.exportRange.appendChild(all);
    el.exportStatus.textContent="";el.exportDialog.showModal();
  }
  function canvasBlob(canvas){return new Promise(resolve=>canvas.toBlob(resolve,"image/png",1));}
  async function captureFile(w,dayId,view) {
    el.captureRoot.innerHTML=sheet(w,dayId,view,true);
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const canvas=await html2canvas(el.captureRoot.firstElementChild,{scale:2,backgroundColor:"#080a0c",useCORS:true,logging:false,width:1440,windowWidth:1440});
    const blob=await canvasBlob(canvas);el.captureRoot.innerHTML="";
    const day=(D.DAYS.find(d=>d.id===dayId)||{}).label||dayId;
    return new File([blob],"GW_Tactics_Week_"+w.week+"_"+day+"_"+view+".png",{type:"image/png"});
  }
  async function exportSelected(event) {
    event.preventDefault();
    const views=[...el.exportForm.querySelectorAll('input[name="exportView"]:checked')].map(x=>x.value);
    if(!views.length){el.exportStatus.textContent="Select at least one screenshot.";return;}
    const w=week(),range=el.exportRange.value,days=range==="WEEK"?D.DAYS.map(d=>d.id):[range],total=days.length*views.length,files=[];
    try{
      for(const d of days)for(const v of views){el.exportStatus.textContent="Creating screenshot "+(files.length+1)+" of "+total+"…";files.push(await captureFile(w,d,v));}
      el.exportStatus.textContent="Ready.";
      if(navigator.canShare&&navigator.canShare({files})&&navigator.share)await navigator.share({title:"GW Tactics · Week "+w.week,text:"GW Planner",files});
      else for(const file of files){const url=URL.createObjectURL(file),a=document.createElement("a");a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);await new Promise(r=>setTimeout(r,120));}
      if(el.exportDialog.open)el.exportDialog.close();
    }catch(err){if(err&&err.name!=="AbortError"){console.error(err);el.exportStatus.textContent="Export failed. Please try again.";}}
  }

  function downloadBlob(blob,name) {
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),4000);
  }

  function xmlEscape(value) {
    return String(value)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&apos;");
  }

  async function downloadPlayerTemplate() {
    if(!window.XLSX || !window.JSZip) {
      toast("Template tools are not available.");
      return;
    }

    const headers=[
      "Account Name","Country","Region / Time Zone","Role","PvP Strength",
      "Local Play From","Local Play Until","Double Attacks",
      "Linked Account 1","Linked Account 2","Linked Account 3","Linked Account 4"
    ];
    const countries=[...D.COUNTRIES]
      .map(c=>c.name+" ["+c.code+"]")
      .sort((a,b)=>a.localeCompare(b));
    const zones=(window.moment?.tz?.names?.() || ["UTC"])
      .slice()
      .sort()
      .map(id=>id.split("/").map(x=>x.replaceAll("_"," ")).join(" · ")+" ["+id+"]");
    const roles=["PvP","PvZ","both"];
    const strengths=["1","2","3","4","5"];
    const doubleOptions=[
      "Preferred for double attacks",
      "Allowed for double attacks",
      "Do not use for double attacks"
    ];
    const times=[];
    for(let h=0;h<24;h++){
      times.push(String(h).padStart(2,"0")+":00");
      times.push(String(h).padStart(2,"0")+":30");
    }
    times.push("24:00");

    const rows=[headers];
    for(let i=0;i<100;i++) rows.push(Array(headers.length).fill(""));
    const playerSheet=XLSX.utils.aoa_to_sheet(rows);
    playerSheet["!cols"]=[
      {wch:24},{wch:28},{wch:30},{wch:14},{wch:14},{wch:18},{wch:18},{wch:29},
      {wch:24},{wch:24},{wch:24},{wch:24}
    ];

    const instructionRows=[
      ["GW Tactics · Player Data Template"],
      ["How to fill it"],
      ["1. Account Name is the only free-text field."],
      ["2. Use the dropdowns for Country, Time Zone, Role, PvP Strength, Play Time and Double Attacks."],
      ["3. Linked Account dropdowns automatically use the Account Names entered in the Players sheet."],
      ["4. If one real person controls several accounts, select the other account names in Linked Account 1–4."],
      ["5. You do not need to enter the reverse link twice; GW Tactics builds the complete linked-account group during import."],
      ["6. PvP Strength is ignored for PvZ-only accounts."],
      ["7. Do not rename the Players sheet or its column headers."],
      ["8. Save the workbook as .xlsx and import it into GW Tactics."]
    ];
    const instructionSheet=XLSX.utils.aoa_to_sheet(instructionRows);
    instructionSheet["!cols"]=[{wch:100}];

    const max=Math.max(countries.length,zones.length,roles.length,strengths.length,doubleOptions.length,times.length);
    const listRows=[["Countries","Time Zones","Roles","PvP Strength","Double Attacks","Times"]];
    for(let i=0;i<max;i++){
      listRows.push([
        countries[i]||"",zones[i]||"",roles[i]||"",strengths[i]||"",
        doubleOptions[i]||"",times[i]||""
      ]);
    }
    const listSheet=XLSX.utils.aoa_to_sheet(listRows);
    listSheet["!cols"]=[{wch:34},{wch:34},{wch:18},{wch:18},{wch:30},{wch:16}];

    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,playerSheet,"Players");
    XLSX.utils.book_append_sheet(wb,instructionSheet,"Instructions");
    XLSX.utils.book_append_sheet(wb,listSheet,"Lists");
    wb.Workbook=wb.Workbook||{};
    wb.Workbook.Sheets=[
      {Hidden:0},
      {Hidden:0},
      {Hidden:1},
    ];

    const bytes=XLSX.write(wb,{type:"array",bookType:"xlsx"});
    const zip=await JSZip.loadAsync(bytes);
    const sheetPath="xl/worksheets/sheet1.xml";
    let xml=await zip.file(sheetPath).async("string");

    const validation=(sqref,formula)=>
      '<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="'+sqref+'"><formula1>'+
      xmlEscape(formula)+'</formula1></dataValidation>';

    const validations=[
      validation("B2:B101","INDIRECT(\"'Lists'!$A$2:$A$"+(countries.length+1)+"\")"),
      validation("C2:C101","INDIRECT(\"'Lists'!$B$2:$B$"+(zones.length+1)+"\")"),
      validation("D2:D101","INDIRECT(\"'Lists'!$C$2:$C$"+(roles.length+1)+"\")"),
      validation("E2:E101","INDIRECT(\"'Lists'!$D$2:$D$"+(strengths.length+1)+"\")"),
      validation("F2:G101","INDIRECT(\"'Lists'!$F$2:$F$"+(times.length+1)+"\")"),
      validation("H2:H101","INDIRECT(\"'Lists'!$E$2:$E$"+(doubleOptions.length+1)+"\")"),
      validation("I2:L101","$A$2:$A$101")
    ].join("");

    xml=xml.replace("</sheetData>",'</sheetData><dataValidations count="7">'+validations+'</dataValidations>');
    zip.file(sheetPath,xml);
    const blob=await zip.generateAsync({
      type:"blob",
      mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    downloadBlob(blob,"gw_tactics_player_template.xlsx");
    toast("Player template created.");
  }

  function countryCodeFromTemplate(value) {
    const text=String(value||"").trim();
    const match=text.match(/\[([^\]]+)]\s*$/);
    return (match?match[1]:text).trim().toUpperCase();
  }

  function timeZoneFromTemplate(value) {
    const text=String(value||"").trim();
    const match=text.match(/\[([^\]]+)]\s*$/);
    return (match?match[1]:text).trim();
  }

  function minutesFromTemplate(value) {
    const text=String(value||"").trim();
    const match=text.match(/^(\d{1,2}):(\d{2})$/);
    if(!match)return null;
    const h=Number(match[1]),m=Number(match[2]);
    if(h===24&&m===0)return 1440;
    if(h<0||h>23||m<0||m>59)return null;
    return h*60+m;
  }

  function roleFromTemplate(value) {
    const v=String(value||"").trim().toLowerCase().replaceAll(" ","");
    if(v==="pvp")return "PVP";
    if(v==="pvz")return "PVZ";
    if(v==="both"||v==="pvp+pvz"||v==="pvz+pvp")return "BOTH";
    return null;
  }

  function doubleFromTemplate(value) {
    const v=String(value||"").trim().toLowerCase();
    if(v.startsWith("preferred"))return "PREFERRED";
    if(v.startsWith("allowed"))return "ALLOWED";
    if(v.startsWith("do not use"))return "DO_NOT_USE";
    return null;
  }

  function zoneIsValid(zone) {
    try {
      new Intl.DateTimeFormat("en-US",{timeZone:zone}).format(new Date());
      return true;
    } catch (_) { return false; }
  }

  function importWorkbookRows(rows) {
    const existingByName=new Map(state.players.map(p=>[p.name.trim().toLowerCase(),p]));
    const parsed=[];
    const warnings=[];
    const seen=new Set();
    const filledCount=rows.filter(row=>String(row["Account Name"]||"").trim()).length;

    rows.forEach((row,index)=>{
      const rowNo=index+2;
      const name=String(row["Account Name"]||"").trim();
      if(!name)return;
      const key=name.toLowerCase();
      if(seen.has(key)){warnings.push("Row "+rowNo+": duplicate account name "+name);return;}
      seen.add(key);

      const countryCode=countryCodeFromTemplate(row["Country"]);
      const timeZoneId=timeZoneFromTemplate(row["Region / Time Zone"]);
      const role=roleFromTemplate(row["Role"]);
      const stars=Number(row["PvP Strength"]);
      const from=minutesFromTemplate(row["Local Play From"]);
      const until=minutesFromTemplate(row["Local Play Until"]);
      const doubleAttackPreference=doubleFromTemplate(row["Double Attacks"]);
      const bad=[];
      if(!countryCode)bad.push("Country");
      if(!timeZoneId||!zoneIsValid(timeZoneId))bad.push("Time Zone");
      if(!role)bad.push("Role");
      if(role&&role!=="PVZ"&&(!Number.isFinite(stars)||stars<1||stars>5))bad.push("PvP Strength");
      if(from===null)bad.push("Local Play From");
      if(until===null)bad.push("Local Play Until");
      if(!doubleAttackPreference)bad.push("Double Attacks");
      if(bad.length){warnings.push("Row "+rowNo+" ("+name+"): "+bad.join(", "));return;}

      const existing=existingByName.get(key)||null;
      parsed.push({
        id:existing?.id||(crypto.randomUUID?crypto.randomUUID():"p"+Date.now()+"_"+rowNo),
        name,countryCode,timeZoneId,role,pvpStars:role==="PVZ"?null:stars,
        preferredStartMinutes:from,preferredEndMinutes:until,doubleAttackPreference,
        linkedNames:["Linked Account 1","Linked Account 2","Linked Account 3","Linked Account 4"]
          .map(h=>String(row[h]||"").trim())
          .filter(x=>x&&x.toLowerCase()!==key)
          .filter((x,i,a)=>a.findIndex(y=>y.toLowerCase()===x.toLowerCase())===i),
        existing
      });
    });

    const knownNames=new Set([...state.players.map(p=>p.name.toLowerCase()),...parsed.map(p=>p.name.toLowerCase())]);
    parsed.forEach(p=>p.linkedNames.forEach(name=>{
      if(!knownNames.has(name.toLowerCase()))warnings.push("Linked account '"+name+"' for "+p.name+" was not found.");
    }));

    return {
      parsed,warnings,
      newCount:parsed.filter(p=>!p.existing).length,
      updateCount:parsed.filter(p=>!!p.existing).length,
      skippedCount:Math.max(0,filledCount-parsed.length)
    };
  }

  function applyWorkbookImport(plan) {
    const importedIds=new Set(plan.parsed.map(p=>p.id));

    plan.parsed.forEach(row=>{
      const current=row.existing;
      const player={
        id:row.id,name:row.name,
        shortCode:current?playerCode(current):suggestShortCode(row.name,row.id),
        colorHex:current?playerColor(current):suggestPlayerColor(row.id),
        countryCode:row.countryCode,timeZoneId:row.timeZoneId,role:row.role,pvpStars:row.pvpStars,
        preferredStartMinutes:row.preferredStartMinutes,preferredEndMinutes:row.preferredEndMinutes,
        preferredSpare:row.doubleAttackPreference==="PREFERRED",
        doubleAttackPreference:row.doubleAttackPreference,linkedAccountIds:[]
      };
      const i=state.players.findIndex(p=>p.id===row.id);
      if(i>=0)state.players[i]=player;else state.players.push(player);
    });

    state.players.forEach(p=>{
      if(importedIds.has(p.id))p.linkedAccountIds=[];
      else p.linkedAccountIds=(p.linkedAccountIds||[]).filter(id=>!importedIds.has(id));
    });

    const byName=new Map(state.players.map(p=>[p.name.toLowerCase(),p.id]));
    const byId=new Map(state.players.map(p=>[p.id,p]));
    const adjacency=new Map(state.players.map(p=>[p.id,new Set()]));
    plan.parsed.forEach(row=>{
      row.linkedNames.forEach(name=>{
        const id=byName.get(name.toLowerCase());
        if(!id||id===row.id)return;
        adjacency.get(row.id).add(id);
        adjacency.get(id).add(row.id);
      });
    });

    const visited=new Set();
    importedIds.forEach(root=>{
      if(visited.has(root))return;
      const group=new Set([root]),queue=[root];visited.add(root);
      while(queue.length){
        const cur=queue.shift();
        (adjacency.get(cur)||[]).forEach(next=>{
          if(!group.has(next)){group.add(next);visited.add(next);queue.push(next);}
        });
      }
      group.forEach(id=>{
        const p=byId.get(id);
        if(p)p.linkedAccountIds=[...group].filter(x=>x!==id);
      });
    });

    saveState();renderPlayers();renderPlan();
  }

  async function handlePlayerWorkbook(file) {
    try {
      const bytes=await file.arrayBuffer();
      const wb=XLSX.read(bytes,{type:"array"});
      const sheet=wb.Sheets["Players"]||wb.Sheets[wb.SheetNames[0]];
      if(!sheet)throw new Error("Players sheet missing");
      const rows=XLSX.utils.sheet_to_json(sheet,{defval:"",raw:false});
      const plan=importWorkbookRows(rows);
      if(!plan.parsed.length){
        const details=plan.warnings.length
          ? "\n\n"+plan.warnings.slice(0,8).map(x=>"• "+x).join("\n")
          : "";
        showReview({
          title:"IMPORT PLAYERS",
          message:"No valid players were found."+details,
          confirmLabel:"OK",
          showCancel:false,
        });
        return;
      }
      const newNames=plan.parsed.filter(p=>!p.existing).map(p=>p.name).sort((a,b)=>a.localeCompare(b));
      const updateNames=plan.parsed.filter(p=>!!p.existing).map(p=>p.name).sort((a,b)=>a.localeCompare(b));
      const links=plan.parsed
        .filter(p=>p.linkedNames.length)
        .map(p=>p.name+" → "+p.linkedNames.join(", "));

      const listHtml=(items,limit,icon="•")=>{
        if(!items.length)return "";
        const shown=items.slice(0,limit).map(x=>"<li><span>"+icon+"</span>"+esc(x)+"</li>").join("");
        const more=items.length>limit
          ? "<li class=\"review-more\"><span>+</span>"+(items.length-limit)+" more</li>"
          : "";
        return "<ul class=\"review-list\">"+shown+more+"</ul>";
      };
      const message=
        "<div class=\"import-summary-grid\">"+
          "<div class=\"import-stat good\"><strong>"+plan.newCount+"</strong><span>NEW</span></div>"+
          "<div class=\"import-stat info\"><strong>"+plan.updateCount+"</strong><span>UPDATES</span></div>"+
          "<div class=\"import-stat "+(plan.warnings.length?"warn":"quiet")+"\"><strong>"+plan.warnings.length+"</strong><span>WARNINGS</span></div>"+
        "</div>"+
        (newNames.length
          ? "<section class=\"review-section\"><h3>NEW PLAYERS</h3>"+listHtml(newNames,10,"＋")+"</section>"
          : "")+
        (updateNames.length
          ? "<section class=\"review-section\"><h3>UPDATES</h3>"+listHtml(updateNames,10,"↻")+"</section>"
          : "")+
        (links.length
          ? "<section class=\"review-section linked\"><h3>LINKED ACCOUNTS</h3>"+listHtml(links,8,"↔")+"</section>"
          : "")+
        (plan.warnings.length
          ? "<section class=\"review-section warnings\"><h3>WARNINGS</h3>"+listHtml(plan.warnings,6,"!")+"</section>"
          : "")+
        "<div class=\"review-question\">Import the valid rows now?</div>";

      showReview({
        title:"IMPORT PLAYERS",
        message,
        html:true,
        confirmLabel:"IMPORT PLAYERS",
        onConfirm:()=>{
          applyWorkbookImport(plan);
          if(el.playerDataDialog.open)el.playerDataDialog.close();

          const names=plan.parsed
            .map(p=>p.name)
            .sort((a,b)=>a.localeCompare(b));
          let result=plan.newCount+" new players · "+plan.updateCount+" updated players";
          if(names.length)result+="\n\n"+names.slice(0,14).map(x=>"✓ "+x).join("\n");
          if(names.length>14)result+="\n… +"+(names.length-14);
          if(plan.skippedCount>0)result+="\n\n"+plan.skippedCount+" row(s) were skipped because of invalid or duplicate data.";

          showReview({
            title:"IMPORT COMPLETE",
            message:result,
            confirmLabel:"OK",
            showCancel:false,
          });
        },
      });
    } catch(err) {
      console.error(err);
      toast("The selected workbook could not be read.");
    }
  }

  function createPlannerBackup() {
    const payload={
      format:"GW_TACTICS_PLANNER_BACKUP",
      version:1,
      createdAt:new Date().toISOString(),
      state
    };
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    downloadBlob(blob,"GW_Tactics_Backup_"+new Date().toISOString().slice(0,10)+".gwtactics");
    toast("Planner backup created.");
  }

  async function restorePlannerBackup(file) {
    try {
      const parsed=JSON.parse(await file.text());
      if(parsed?.format!=="GW_TACTICS_PLANNER_BACKUP"||parsed?.version!==1||!parsed?.state?.players||!parsed?.state?.weeks){
        throw new Error("Invalid backup");
      }
      const playerCount=Array.isArray(parsed.state.players)?parsed.state.players.length:0;
      const savedWeekCount=parsed.state.weeks?Object.keys(parsed.state.weeks).length:0;
      const restoreMessage=
        "Backup contains "+playerCount+" players · "+savedWeekCount+" saved weeks.\n\n"+
        "This replaces the current Planner players, linked accounts, availability and saved week plans. Continue?";

      showReview({
        title:"RESTORE BACKUP",
        message:restoreMessage,
        confirmLabel:"RESTORE BACKUP",
        onConfirm:()=>{
          state=parsed.state;
          state.selectedWeek=Math.max(1,Math.min(4,state.selectedWeek||1));
          selectedDay=D.DAYS[0].id;selectedView="MAP";
          saveState();renderAll();
          if(el.playerDataDialog.open)el.playerDataDialog.close();

          showReview({
            title:"BACKUP RESTORED",
            message:"Restored "+playerCount+" players and "+savedWeekCount+" saved weeks.",
            confirmLabel:"OK",
            showCancel:false,
          });
        },
      });
    } catch(err) {
      console.error(err);
      toast("The selected backup could not be restored.");
    }
  }

  function openModalSafe(dialog) {
    if (!dialog) return;
    try {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else {
        dialog.setAttribute("open","");
        dialog.open=true;
      }
    } catch (err) {
      console.error(err);
      dialog.setAttribute("open","");
      dialog.open=true;
    }
  }

  function runUiAction(action, fallbackMessage) {
    try { action(); }
    catch (err) {
      console.error(err);
      toast(fallbackMessage || "Something went wrong. Please reload the page.");
    }
  }

  function renderAll(){renderWeeks();renderSetup();renderPlayers();renderPlan();}
  el.saveSetupBtn.onclick=()=>runUiAction(()=>saveSetup(true),"Could not save the setup."); el.addPlayerBtn.onclick=()=>runUiAction(()=>openPlayer(),"Could not open player editor."); el.playerDataBtn.onclick=()=>runUiAction(()=>openModalSafe(el.playerDataDialog),"Could not open Player Data."); el.autoPlanBtn.onclick=()=>runUiAction(()=>createPlan(),"Could not create the plan."); el.exportBtn.onclick=()=>runUiAction(()=>openExport(),"Could not open export.");
  el.playerForm.addEventListener("submit",savePlayer); el.deletePlayerBtn.onclick=deletePlayer; el.exportForm.addEventListener("submit",exportSelected);
  document.querySelectorAll("[data-close-player]").forEach(x=>x.onclick=closePlayer);
  document.querySelectorAll("[data-close-player-data]").forEach(x=>x.onclick=()=>el.playerDataDialog.close());
  el.downloadPlayerTemplateBtn.onclick=downloadPlayerTemplate;
  el.importPlayersBtn.onclick=()=>{el.playerWorkbookInput.value="";el.playerWorkbookInput.click();};
  el.createBackupBtn.onclick=createPlannerBackup;
  el.restoreBackupBtn.onclick=()=>{el.backupInput.value="";el.backupInput.click();};
  el.playerWorkbookInput.onchange=()=>{const file=el.playerWorkbookInput.files?.[0];if(file)handlePlayerWorkbook(file);};
  el.backupInput.onchange=()=>{const file=el.backupInput.files?.[0];if(file)restorePlannerBackup(file);};
  document.querySelectorAll("[data-close-export]").forEach(x=>x.onclick=()=>el.exportDialog.close());
  document.querySelectorAll("[data-close-review]").forEach(x=>x.onclick=closeReview);
  el.reviewCancelBtn.onclick=closeReview;
  el.reviewConfirmBtn.onclick=()=>{
    const action=reviewAction;
    closeReview();
    if(action)action();
  };
  el.playerName.oninput=()=>{
    if(!shortCodeTouched) el.playerShortCode.value=suggestShortCode(el.playerName.value,el.playerId.value || null);
  };
  el.playerShortCode.oninput=()=>{
    shortCodeTouched=true;
    const normalized=normalizeShortCode(el.playerShortCode.value);
    if(el.playerShortCode.value!==normalized) el.playerShortCode.value=normalized;
  };
  el.countrySearch.oninput=()=>populateCountries(el.countrySearch.value,el.playerCountry.value);
  el.playerCountry.onchange=()=>populateZones(el.playerCountry.value,null,true);
  el.playerTimeZone.onchange=setDefaultWindow;
  el.playerRole.onchange=()=>el.starsField.classList.toggle("hidden",el.playerRole.value==="PVZ");
  fillTimeSelect(el.playStart,false);fillTimeSelect(el.playEnd,true);renderAll();
})();
