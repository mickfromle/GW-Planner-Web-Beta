(() => {
  const D = window.GWPlannerData;
  const E = window.GWPlannerEngine;
  const KEY = "gw_planner_web_beta_v1";
  const byId = id => document.getElementById(id);
  const el = {
    weekTabs:byId("weekTabs"), weekStart:byId("weekStart"), teamSizeGrid:byId("teamSizeGrid"),
    saveSetupBtn:byId("saveSetupBtn"), playerCount:byId("playerCount"), playerList:byId("playerList"),
    addPlayerBtn:byId("addPlayerBtn"), autoPlanBtn:byId("autoPlanBtn"), planSection:byId("planSection"),
    planTitle:byId("planTitle"), dayTabs:byId("dayTabs"), viewTabs:byId("viewTabs"),
    planPreview:byId("planPreview"), exportBtn:byId("exportBtn"), playerDialog:byId("playerDialog"),
    playerForm:byId("playerForm"), playerDialogTitle:byId("playerDialogTitle"), playerId:byId("playerId"),
    playerName:byId("playerName"), countrySearch:byId("countrySearch"), playerCountry:byId("playerCountry"),
    timeZoneField:byId("timeZoneField"), playerTimeZone:byId("playerTimeZone"), playerRole:byId("playerRole"),
    playerStars:byId("playerStars"), starsField:byId("starsField"), playStart:byId("playStart"),
    playEnd:byId("playEnd"), spareToggle:byId("spareToggle"), deletePlayerBtn:byId("deletePlayerBtn"),
    exportDialog:byId("exportDialog"), exportForm:byId("exportForm"), exportRange:byId("exportRange"),
    exportStatus:byId("exportStatus"), toast:byId("toast"), captureRoot:byId("captureRoot")
  };

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
  state.selectedWeek = Math.max(1, Math.min(4, state.selectedWeek || 1));
  let selectedDay = D.DAYS[0].id;
  let selectedView = "MAP";
  let editingSpare = false;
  let toastTimer = null;

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
      const spare=p.preferredSpare ? " · SPARE" : "";
      main.innerHTML='<img class="flag" src="'+esc(D.flagUrl(p.countryCode))+'" alt=""><div><div class="player-name">'+esc(p.name)+'</div><div class="player-meta">'+esc(roleLabel(p.role))+stars+spare+'</div></div>';
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
  function updateSpare() {
    el.spareToggle.classList.toggle("on",editingSpare);
    el.spareToggle.textContent=editingSpare?"✓ PREFERRED FOR SPARE":"NOT PREFERRED FOR SPARE";
  }
  function openPlayer(id) {
    const p=id ? state.players.find(x=>x.id===id) : null;
    el.playerDialogTitle.textContent=p?"Edit player":"Add player"; el.playerId.value=p?p.id:""; el.playerName.value=p?p.name:"";
    el.countrySearch.value=""; const country=p?p.countryCode:"DE"; populateCountries("",country); populateZones(country,p?p.timeZoneId:null,false);
    el.playerRole.value=p?p.role:"PVZ"; el.playerStars.value=String(p && p.pvpStars ? p.pvpStars : 3);
    el.starsField.classList.toggle("hidden",el.playerRole.value==="PVZ"); editingSpare=!!(p&&p.preferredSpare); updateSpare();
    if (p) { el.playStart.value=String(p.preferredStartMinutes); el.playEnd.value=String(p.preferredEndMinutes); } else setDefaultWindow();
    el.deletePlayerBtn.classList.toggle("hidden",!p); el.playerDialog.showModal();
  }
  function closePlayer() { if (el.playerDialog.open) el.playerDialog.close(); }
  function savePlayer(event) {
    event.preventDefault();
    const id=el.playerId.value || (crypto.randomUUID ? crypto.randomUUID() : "p"+Date.now());
    const name=el.playerName.value.trim(); if (!name) return;
    if (state.players.some(p=>p.id!==id && p.name.trim().toLowerCase()===name.toLowerCase())) return toast("A player with this name already exists.");
    const role=el.playerRole.value;
    const p={id,name,countryCode:el.playerCountry.value,timeZoneId:el.playerTimeZone.value,role,
      pvpStars:role==="PVZ"?null:Number(el.playerStars.value),preferredStartMinutes:Number(el.playStart.value),
      preferredEndMinutes:Number(el.playEnd.value),preferredSpare:editingSpare};
    const i=state.players.findIndex(x=>x.id===id); if (i>=0) state.players[i]=p; else state.players.push(p);
    saveState(); closePlayer(); renderPlayers(); renderPlan(); toast("Player saved.");
  }
  function deletePlayer() {
    const id=el.playerId.value; const p=state.players.find(x=>x.id===id);
    if (!p || !confirm("Delete "+p.name+"?")) return;
    state.players=state.players.filter(x=>x.id!==id);
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
    const result=E.autoPlan(state.players,week());
    if (!result.success) return toast(failureText(result.failure));
    state.weeks[String(state.selectedWeek)]=result.plan; saveState();
    const first=D.DAYS.find(d=>result.plan.days[d.id].teamSize>0); selectedDay=first?first.id:D.DAYS[0].id; selectedView="MAP";
    renderPlan(); el.planSection.scrollIntoView({behavior:"smooth",block:"start"}); toast("GW plan created.");
  }

  function colorMap(w) {
    const ids=[]; D.DAYS.forEach(d=>w.days[d.id].playerIds.forEach(id=>{if(!ids.includes(id))ids.push(id);}));
    return new Map(ids.map((id,i)=>[id,D.PLAYER_COLORS[i%D.PLAYER_COLORS.length]]));
  }
  function contrast(hex) {
    const s=hex.replace("#",""),r=parseInt(s.slice(0,2),16),g=parseInt(s.slice(2,4),16),b=parseInt(s.slice(4,6),16);
    return (.299*r+.587*g+.114*b)>150?"#141719":"#fff";
  }
  function sheetHeader(w,dayId) {
    const d=D.DAYS.find(x=>x.id===dayId),dp=w.days[dayId],end=E.addDaysIso(w.weekStart,5),date=E.dateForDay(w,dayId);
    return '<div class="sheet-header"><div class="sheet-brand">GW TACTICS<small>GUILD WAR PLANNER</small></div><div class="sheet-week"><strong>WEEK '+w.week+'</strong><span>'+esc(w.weekStart)+' – '+esc(end)+'</span></div></div>'+
      '<div class="day-head"><h3>'+esc(d.label)+' · '+esc(date)+'</h3><div class="right"><strong>'+(dp.teamSize===0?"BREAK":dp.teamSize+"v"+dp.teamSize)+'</strong><span class="ready">'+(dp.teamSize===0?"":"READY")+'</span></div></div>';
  }
  function mapView(w,dayId) {
    const dp=w.days[dayId]; if(dp.teamSize===0)return '<div class="section-title">BREAK</div>';
    const load=D.MISSION_LOADS[dp.teamSize],islands=E.createIslandAssignments(state.players,w,dayId),colors=colorMap(w),players=new Map(state.players.map(p=>[p.id,p]));
    let out='<div class="metrics"><div class="metric"><strong>'+dp.playerIds.length+'/'+dp.teamSize+'</strong><span>PLAYERS</span></div><div class="metric"><strong>'+load.pvpAttacks+'</strong><span>PVP</span></div><div class="metric"><strong>'+load.pvzAttacks+'</strong><span>PVZ</span></div><div class="metric"><strong>'+load.spareAttacks+'</strong><span>SPARE</span></div></div>';
    out+='<div class="sector-plan">MAX: '+esc(load.maxSectorPlan)+'</div><div class="section-title">ISLAND ASSIGNMENTS</div><div class="legend">PvZ · H = PvP · MAX = highest-value PvZ</div><div class="island-grid">';
    islands.forEach(island=>{
      out+='<div class="island-card"><div class="island-name">'+esc(island.island)+'</div><div class="mission-grid" style="grid-template-columns:repeat('+island.columns+',1fr)">';
      island.missions.forEach(m=>{
        const p=players.get(m.playerId),bg=m.active?(colors.get(m.playerId)||"#373e42"):"#1c2124";
        const label=!m.active?"—":m.kind==="PVP"?"H":m.isMaxPvz?"MAX":"PvZ";
        const lc=!m.active?"#2d3235":m.kind==="PVP"?"#e0c64f":"#c6d0d5";
        out+='<div class="mission-cell '+(m.active?"":"inactive")+' '+(m.isMaxPvz&&m.active?"max":"")+'"><div class="mission-label" style="background:'+lc+'">'+label+'</div><div class="mission-player" style="background:'+bg+';color:'+contrast(bg)+'">'+(m.active?esc(p?p.name:"—"):"")+'</div></div>';
      });
      out+='</div></div>';
    });
    return out+'</div>';
  }
  function playersView(w,dayId) {
    const dp=w.days[dayId]; if(dp.teamSize===0)return '<div class="section-title">BREAK</div>';
    const players=new Map(state.players.map(p=>[p.id,p])),loads=new Map(E.createAttackLoads(state.players,dp).map(x=>[x.playerId,x]));
    const stack=E.createStackPlan(state.players,w,dayId),vp=E.playerVpTargets(state.players,w,dayId);
    let out='<div class="section-title">PLAYER ASSIGNMENTS</div><div class="table-wrap"><table class="assignment-table"><thead><tr><th>PLAYER</th><th>ROLE</th><th>PVP</th><th>PVZ</th><th>STACKING</th><th>VPS</th></tr></thead><tbody>';
    dp.playerIds.forEach(id=>{
      const p=players.get(id),l=loads.get(id),stacks=(stack?stack.assignments:[]).filter(x=>x.sparePlayerId===id).map(x=>x.targetSector+" "+x.targetMissionLevel+" x"+x.spareAttacks).join(" / ")||"—";
      out+='<tr><td><strong>'+esc(p?p.name:id)+'</strong></td><td class="role-'+esc(p?p.role:"PVZ")+'">'+esc(roleLabel(p?p.role:"PVZ"))+'</td><td class="num">'+(l?l.pvpAttacks:0)+'</td><td class="num">'+(l?l.pvzAttacks:0)+'</td><td>'+esc(stacks)+'</td><td><strong>'+(vp.get(id)||0)+'</strong></td></tr>';
    });
    return out+'</tbody></table></div>';
  }
  function phaseLabel(p) { return p==="OPENING"?"OPEN A/B":p==="PVP_SUPPORT"?"PVP SUPPORT":p==="PVP_CORE"?"PVP CORE / C":"FLEX"; }
  function timelineView(w,dayId) {
    const dp=w.days[dayId]; if(dp.teamSize===0)return '<div class="section-title">BREAK</div>';
    const players=new Map(state.players.map(p=>[p.id,p])),timeline=E.createTimeline(state.players,w,dayId),stack=E.createStackPlan(state.players,w,dayId);
    let out='<div class="section-title">TIMELINE</div><div class="timeline-list">';
    timeline.forEach(x=>{out+='<div class="timeline-row"><div class="time">'+esc(x.localTimeLabel)+' · '+esc(x.utcTimeLabel)+'</div><div><strong>'+esc((players.get(x.playerId)||{}).name||x.playerId)+'</strong> · '+esc(phaseLabel(x.phase))+'</div></div>';});
    out+='</div>';
    if(stack){
      out+='<div class="section-title">STACKING PLAN</div><div class="stack-list">';
      stack.assignments.forEach(x=>{out+='<div class="stack-row"><div class="time">'+esc(x.utcTime)+'</div><div><strong>'+esc((players.get(x.sparePlayerId)||{}).name||x.sparePlayerId)+'</strong> · '+esc(x.targetSector)+' '+x.targetMissionLevel+' x'+x.spareAttacks+' · with '+esc((players.get(x.partnerPlayerId)||{}).name||x.partnerPlayerId)+'</div></div>';});
      out+='</div>';
    }
    return out;
  }
  function sheet(w,dayId,view,capture) {
    const body=view==="MAP"?mapView(w,dayId):view==="PLAYERS"?playersView(w,dayId):timelineView(w,dayId);
    return '<div class="plan-sheet '+(capture?"capture":"")+'">'+sheetHeader(w,dayId)+body+'</div>';
  }

  function renderPlan() {
    const w=week(),valid=D.DAYS.some(d=>w.days[d.id].playerIds.length>0)&&E.isPlanValid(state.players,w);
    el.planSection.classList.toggle("hidden",!valid); if(!valid)return;
    if(!w.days[selectedDay])selectedDay=D.DAYS[0].id;
    el.planTitle.textContent="Week "+w.week+" preview";
    el.dayTabs.innerHTML="";
    D.DAYS.forEach(d=>{const b=document.createElement("button");b.type="button";b.className="tab"+(d.id===selectedDay?" active":"");b.textContent=d.short;b.onclick=()=>{selectedDay=d.id;renderPlan();};el.dayTabs.appendChild(b);});
    el.viewTabs.innerHTML="";
    ["MAP","PLAYERS","TIMELINE"].forEach(v=>{const b=document.createElement("button");b.type="button";b.className="tab"+(v===selectedView?" active":"");b.textContent=v;b.onclick=()=>{selectedView=v;renderPlan();};el.viewTabs.appendChild(b);});
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

  function renderAll(){renderWeeks();renderSetup();renderPlayers();renderPlan();}
  el.saveSetupBtn.onclick=()=>saveSetup(true); el.addPlayerBtn.onclick=()=>openPlayer(); el.autoPlanBtn.onclick=createPlan; el.exportBtn.onclick=openExport;
  el.playerForm.addEventListener("submit",savePlayer); el.deletePlayerBtn.onclick=deletePlayer; el.exportForm.addEventListener("submit",exportSelected);
  document.querySelectorAll("[data-close-player]").forEach(x=>x.onclick=closePlayer);
  document.querySelectorAll("[data-close-export]").forEach(x=>x.onclick=()=>el.exportDialog.close());
  el.countrySearch.oninput=()=>populateCountries(el.countrySearch.value,el.playerCountry.value);
  el.playerCountry.onchange=()=>populateZones(el.playerCountry.value,null,true);
  el.playerTimeZone.onchange=setDefaultWindow;
  el.playerRole.onchange=()=>el.starsField.classList.toggle("hidden",el.playerRole.value==="PVZ");
  el.spareToggle.onclick=()=>{editingSpare=!editingSpare;updateSpare();};
  fillTimeSelect(el.playStart,false);fillTimeSelect(el.playEnd,true);renderAll();
})();
