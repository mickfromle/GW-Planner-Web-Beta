window.GWPlannerEngine = (() => {
  const { DAYS, MISSION_LOADS, missionVp } = window.GWPlannerData;
  const ATTACKS_PER_PLAYER = 18;
  const MAX_DAYS_PER_PLAYER = 2;
  const BATTLE_START_UTC_MINUTES = 7 * 60 + 30;
  const BATTLE_DURATION_MINUTES = 22 * 60;
  const PVP_HANDOFF_TARGET_MINUTES = 4 * 60;
  const PVP_SUPPORT_TARGET_MINUTES = 3 * 60;
  const MAX_CRITICAL_PATH_IDLE_MINUTES = 2 * 60;
  const C_UNLOCK_BUFFER_MINUTES = 30;
  // General rule for PvP and PvZ: one attack takes at most ~5 minutes.
  const ATTACK_DURATION_MINUTES = 5;
  const STEP_MINUTES = ATTACK_DURATION_MINUTES;
  // A coordinated double action is simultaneous, so it uses one attack slot.
  const DOUBLE_BLOCK_MINUTES = ATTACK_DURATION_MINUTES;

  const STACK_TARGETS = [
    { sector:"20A", missionLevel:54, earliestOffsetMinutes:0, preferredOffsetMinutes:0 },
    { sector:"20B", missionLevel:54, earliestOffsetMinutes:0, preferredOffsetMinutes:60 },
    { sector:"20A", missionLevel:53, earliestOffsetMinutes:0, preferredOffsetMinutes:90 },
    { sector:"20B", missionLevel:53, earliestOffsetMinutes:0, preferredOffsetMinutes:120 },
    { sector:"20C", missionLevel:53, earliestOffsetMinutes:120, preferredOffsetMinutes:180 },
  ];

  const EIGHT_V_EIGHT_TARGETS = [
    { sector:"20A", missionLevel:54, earliestOffsetMinutes:0, preferredOffsetMinutes:0 },
    { sector:"20B", missionLevel:54, earliestOffsetMinutes:0, preferredOffsetMinutes:60 },
    {
      sector:"20D",
      missionLevel:54,
      earliestOffsetMinutes:PVP_HANDOFF_TARGET_MINUTES,
      preferredOffsetMinutes:PVP_HANDOFF_TARGET_MINUTES,
    },
  ];

  const PHASE_ORDER = { OPENING:0, FLEX:1, PVP_SUPPORT:2, PVP_CORE_AB:3, OPEN_C:4, PVP_CORE_C:5 };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function nextTuesdayIso(from = new Date()) {
    const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
    const day = d.getUTCDay();
    const delta = (2 - day + 7) % 7;
    d.setUTCDate(d.getUTCDate() + delta);
    return d.toISOString().slice(0,10);
  }

  function addDaysIso(iso, days) {
    const [y,m,d] = iso.split("-").map(Number);
    const date = new Date(Date.UTC(y,m-1,d));
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0,10);
  }

  function emptyWeek(week, startIso) {
    const weekStart = startIso || addDaysIso(nextTuesdayIso(), (week - 1) * 7);
    const days = {};
    DAYS.forEach(day => {
      days[day.id] = {
        teamSize: 6,
        playerIds: [],
        unavailablePlayerIds: [],
        pvpCorePlayerIds: [],
      };
    });
    return { week, weekStart, battleStartUtcMinutes:BATTLE_START_UTC_MINUTES, days };
  }

  function inheritWeek(previous, week) {
    const result = clone(previous);
    result.week = week;
    result.weekStart = addDaysIso(previous.weekStart, 7);
    DAYS.forEach(day => {
      result.days[day.id].unavailablePlayerIds = [];
    });
    return result;
  }

  function dateForDay(weekPlan, dayId) {
    const index = DAYS.findIndex(x => x.id === dayId);
    return addDaysIso(weekPlan.weekStart, Math.max(0,index));
  }

  function battleStartDate(weekPlan, dayId) {
    const iso = dateForDay(weekPlan, dayId);
    const [y,m,d] = iso.split("-").map(Number);
    const hour = Math.floor((weekPlan.battleStartUtcMinutes ?? BATTLE_START_UTC_MINUTES) / 60);
    const minute = (weekPlan.battleStartUtcMinutes ?? BATTLE_START_UTC_MINUTES) % 60;
    return new Date(Date.UTC(y,m-1,d,hour,minute));
  }

  function localParts(instant, timeZone) {
    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone,
        weekday:"short",
        hour:"2-digit",
        minute:"2-digit",
        hourCycle:"h23",
        timeZoneName:"short",
      });
      const parts = formatter.formatToParts(instant);
      const get = type => parts.find(p => p.type === type)?.value || "";
      let hour = Number(get("hour"));
      if (hour === 24) hour = 0;
      return {
        weekday:get("weekday"),
        hour,
        minute:Number(get("minute")),
        zone:get("timeZoneName"),
      };
    } catch (_) {
      return { weekday:"", hour:instant.getUTCHours(), minute:instant.getUTCMinutes(), zone:"UTC" };
    }
  }

  function localMinutes(instant, timeZone) {
    const p = localParts(instant,timeZone);
    return p.hour * 60 + p.minute;
  }

  function defaultPreferredWindow(timeZone) {
    const start = new Date(Date.UTC(2026,6,1,7,30));
    const end = new Date(Date.UTC(2026,6,1,20,0));
    return [localMinutes(start,timeZone), localMinutes(end,timeZone)];
  }

  function preferredWindow(player) {
    const legacy = player.preferredStartMinutes === 8 * 60 && player.preferredEndMinutes === 23 * 60;
    if (legacy) return defaultPreferredWindow(player.timeZoneId);
    return [
      Number.isFinite(player.preferredStartMinutes) ? player.preferredStartMinutes : defaultPreferredWindow(player.timeZoneId)[0],
      Number.isFinite(player.preferredEndMinutes) ? player.preferredEndMinutes : defaultPreferredWindow(player.timeZoneId)[1],
    ];
  }

  function isPreferredLocalTime(player, instant) {
    let [start,end] = preferredWindow(player);
    start = Math.max(0,Math.min(1439,start));
    end = Math.max(0,Math.min(1440,end));
    const minute = localMinutes(instant,player.timeZoneId);
    if (start === end) return true;
    if (end === 1440) return minute >= start;
    if (start < end) return minute >= start && minute < end;
    return minute >= start || minute < end;
  }

  function earliestPreferredOffset(player, weekPlan, dayId, targetOffsetMinutes = 0) {
    const battle = battleStartDate(weekPlan,dayId);
    let offset = Math.ceil(Math.max(0,targetOffsetMinutes) / STEP_MINUTES) * STEP_MINUTES;
    while (offset < BATTLE_DURATION_MINUTES) {
      const instant = new Date(battle.getTime() + offset * 60000);
      if (isPreferredLocalTime(player,instant)) return offset;
      offset += STEP_MINUTES;
    }
    return null;
  }

  function hasPreferredSlot(player, weekPlan, dayId, targetOffsetMinutes = 0) {
    return earliestPreferredOffset(player,weekPlan,dayId,targetOffsetMinutes) !== null;
  }

  function timingPenalty(player, weekPlan, dayId, targetOffsetMinutes) {
    const offset = earliestPreferredOffset(player,weekPlan,dayId,targetOffsetMinutes);
    return offset === null ? 100000 : Math.abs(offset - targetOffsetMinutes);
  }

  function isPreferredAtOffset(player, weekPlan, dayId, offsetMinutes) {
    if (offsetMinutes < 0 || offsetMinutes >= BATTLE_DURATION_MINUTES) return false;
    const instant = new Date(battleStartDate(weekPlan,dayId).getTime() + offsetMinutes * 60000);
    return isPreferredLocalTime(player,instant);
  }

  function sharedPreferredOffsets(first, second, weekPlan, dayId) {
    const offsets=[];
    for(let offset=0; offset<BATTLE_DURATION_MINUTES; offset+=STEP_MINUTES) {
      if(
        isPreferredAtOffset(first,weekPlan,dayId,offset) &&
        isPreferredAtOffset(second,weekPlan,dayId,offset)
      ) offsets.push(offset);
    }
    return offsets;
  }

  function longestConsecutiveOverlap(offsets) {
    if(!offsets.length) return 0;
    let longest=1,current=1;
    for(let i=1;i<offsets.length;i++) {
      if(offsets[i]-offsets[i-1]===STEP_MINUTES) {
        current++;
        longest=Math.max(longest,current);
      } else {
        current=1;
      }
    }
    return longest;
  }

  function bestPartnerOverlapSlots(player, possiblePartners, weekPlan, dayId) {
    let best=0;
    possiblePartners.forEach(partner=>{
      if(partner.id===player.id) return;
      best=Math.max(
        best,
        longestConsecutiveOverlap(
          sharedPreferredOffsets(player,partner,weekPlan,dayId)
        )
      );
    });
    return best;
  }

  function doublePreference(player) {
    if(["PREFERRED","ALLOWED","DO_NOT_USE"].includes(player?.doubleAttackPreference)) {
      return player.doubleAttackPreference;
    }
    return player?.preferredSpare ? "PREFERRED" : "ALLOWED";
  }

  function canDouble(player) {
    return doublePreference(player) !== "DO_NOT_USE";
  }

  function prefersDouble(player) {
    return doublePreference(player) === "PREFERRED";
  }

  function linkedPair(first, second) {
    return (first?.linkedAccountIds || []).includes(second?.id) ||
      (second?.linkedAccountIds || []).includes(first?.id);
  }

  function bestDoubleAttackPair(players, weekPlan, dayId, coreSet=new Set()) {
    const rolePenalty=p=>p.role==="PVZ"?0:p.role==="BOTH"?1:2;
    const eligible=players.filter(canDouble);
    const candidates=[];
    for(let i=0;i<eligible.length;i++) {
      for(let j=i+1;j<eligible.length;j++) {
        const first=eligible[i],second=eligible[j];
        const offsets=sharedPreferredOffsets(first,second,weekPlan,dayId);
        if(!offsets.length) continue;
        candidates.push({
          first,second,
          linked:linkedPair(first,second)?1:0,
          longestOverlap:longestConsecutiveOverlap(offsets),
          totalOverlap:offsets.length,
          firstOffset:offsets[0],
          preferredCount:(prefersDouble(first)?1:0)+(prefersDouble(second)?1:0),
          nonCoreCount:(coreSet.has(first.id)?0:1)+(coreSet.has(second.id)?0:1),
          rolePenalty:rolePenalty(first)+rolePenalty(second),
          starPenalty:(first.pvpStars||0)+(second.pvpStars||0),
        });
      }
    }
    candidates.sort((a,b)=>
      b.linked-a.linked ||
      b.longestOverlap-a.longestOverlap ||
      b.totalOverlap-a.totalOverlap ||
      b.preferredCount-a.preferredCount ||
      b.nonCoreCount-a.nonCoreCount ||
      a.rolePenalty-b.rolePenalty ||
      a.starPenalty-b.starPenalty ||
      a.firstOffset-b.firstOffset ||
      byName(a.first,b.first) ||
      byName(a.second,b.second)
    );
    const best=candidates[0];
    if(!best) return null;
    const prefRank=p=>doublePreference(p)==="PREFERRED"?0:doublePreference(p)==="ALLOWED"?1:2;
    const ordered=[best.first,best.second].sort((a,b)=>
      prefRank(a)-prefRank(b) ||
      ((coreSet.has(a.id)?1:0)-(coreSet.has(b.id)?1:0)) ||
      rolePenalty(a)-rolePenalty(b) ||
      (a.pvpStars||0)-(b.pvpStars||0) ||
      byName(a,b)
    );
    return ordered;
  }

  function zoneAbbreviation(timeZone, instant) {
    const offsetMinutes = (() => {
      const local = localParts(instant,timeZone);
      const utcWeekday = instant.getUTCDay();
      const weekdayMap = {Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
      let dayDelta = (weekdayMap[local.weekday] ?? utcWeekday) - utcWeekday;
      if(dayDelta > 3) dayDelta -= 7;
      if(dayDelta < -3) dayDelta += 7;
      return dayDelta*1440 + (local.hour*60+local.minute) -
        (instant.getUTCHours()*60+instant.getUTCMinutes());
    })();

    const daylight = {
      "Europe/Berlin": offsetMinutes===120 ? "CEST" : "CET",
      "Europe/London": offsetMinutes===60 ? "BST" : "GMT",
      "America/New_York": offsetMinutes===-240 ? "EDT" : "EST",
      "America/Chicago": offsetMinutes===-300 ? "CDT" : "CST",
      "America/Denver": offsetMinutes===-360 ? "MDT" : "MST",
      "America/Phoenix": "MST",
      "America/Los_Angeles": offsetMinutes===-420 ? "PDT" : "PST",
      "America/Anchorage": offsetMinutes===-480 ? "AKDT" : "AKST",
      "Pacific/Honolulu": "HST",
    };
    return daylight[timeZone] || localParts(instant,timeZone).zone;
  }

  function localTimeLabel(player, weekPlan, dayId, offsetMinutes) {
    const instant = new Date(battleStartDate(weekPlan,dayId).getTime() + offsetMinutes * 60000);
    const p = localParts(instant,player.timeZoneId);
    return `${p.weekday} ${String(p.hour).padStart(2,"0")}:${String(p.minute).padStart(2,"0")} ${zoneAbbreviation(player.timeZoneId,instant)}`;
  }

  function utcTimeLabel(weekPlan, dayId, offsetMinutes) {
    const instant = new Date(battleStartDate(weekPlan,dayId).getTime() + offsetMinutes * 60000);
    return `${String(instant.getUTCHours()).padStart(2,"0")}:${String(instant.getUTCMinutes()).padStart(2,"0")} UTC`;
  }

  function pvpCapable(player) {
    return player.role === "PVP" || player.role === "BOTH";
  }

  function byName(a,b) {
    return (a.name || "").localeCompare(b.name || "",undefined,{sensitivity:"base"});
  }

  function createAttackLoads(players, dayPlan, weekPlan=null, dayId=null) {
    if (!dayPlan || dayPlan.teamSize === 0) return [];
    const missionLoad = MISSION_LOADS[dayPlan.teamSize];
    if (!missionLoad) return [];

    const byId = new Map(players.map(p => [p.id,p]));
    const selected = dayPlan.playerIds.map(id => byId.get(id)).filter(Boolean);
    if (selected.length !== dayPlan.teamSize) return [];

    const coreSet = new Set(dayPlan.pvpCorePlayerIds || []);
    const pvpCore = (dayPlan.pvpCorePlayerIds || [])
      .map(id => byId.get(id))
      .filter(p => p && pvpCapable(p));

    const pvpOthers = selected
      .filter(p => pvpCapable(p) && !coreSet.has(p.id))
      .sort((a,b) =>
        (b.pvpStars || 0) - (a.pvpStars || 0) ||
        (a.role === "PVP" ? 0 : 1) - (b.role === "PVP" ? 0 : 1) ||
        byName(a,b)
      );

    const pvpOrder = [];
    [...pvpCore,...pvpOthers].forEach(p => {
      if (!pvpOrder.some(x => x.id === p.id)) pvpOrder.push(p);
    });
    if (pvpOrder.length < missionLoad.minimumPvpCapablePlayers) return [];

    const targetOrder = [...selected].sort((a,b) => {
      const av = coreSet.has(a.id) ? 0 : 1;
      const bv = coreSet.has(b.id) ? 0 : 1;
      if (av !== bv) return av - bv;
      const roleRank = r => r === "PVP" ? 0 : r === "BOTH" ? 1 : 2;
      if (roleRank(a.role) !== roleRank(b.role)) return roleRank(a.role) - roleRank(b.role);
      if ((a.pvpStars||0) !== (b.pvpStars||0)) return (b.pvpStars||0) - (a.pvpStars||0);
      return byName(a,b);
    });

    const doubleEligible=selected.filter(canDouble);
    if(missionLoad.spareAttacks>0 && doubleEligible.length<2) return [];

    const linkedEligibleCount=new Map(
      doubleEligible.map(player=>[
        player.id,
        doubleEligible.filter(other=>other.id!==player.id && linkedPair(player,other)).length
      ])
    );

    const overlapScore = new Map(
      doubleEligible.map(player=>[
        player.id,
        weekPlan && dayId
          ? bestPartnerOverlapSlots(player,doubleEligible,weekPlan,dayId)
          : 0,
      ])
    );

    const prefRank=p=>doublePreference(p)==="PREFERRED"?0:doublePreference(p)==="ALLOWED"?1:2;
    const spareOrder = [...doubleEligible].sort((a,b) => {
      const pr=prefRank(a)-prefRank(b); if(pr!==0) return pr;
      const al=linkedEligibleCount.get(a.id)||0,bl=linkedEligibleCount.get(b.id)||0;
      if(al!==bl) return bl-al;
      const ao=overlapScore.get(a.id)||0,bo=overlapScore.get(b.id)||0;
      if(ao!==bo) return bo-ao;
      const ac = coreSet.has(a.id) ? 1 : 0;
      const bc = coreSet.has(b.id) ? 1 : 0;
      if (ac !== bc) return ac - bc;
      const roleRank = r => r === "PVZ" ? 0 : r === "BOTH" ? 1 : 2;
      if (roleRank(a.role) !== roleRank(b.role)) return roleRank(a.role) - roleRank(b.role);
      if ((a.pvpStars||0) !== (b.pvpStars||0)) return (a.pvpStars||0) - (b.pvpStars||0);
      return byName(a,b);
    });

    const targetMissions = new Map(selected.map(p => [p.id,ATTACKS_PER_PLAYER]));

    // Every DOUBLE mission consumes one attack from both players.
    // Reserve all required double attacks on one coordinated pair.
    if (missionLoad.spareAttacks > 0) {
      const timePair = weekPlan && dayId
        ? bestDoubleAttackPair(doubleEligible,weekPlan,dayId,coreSet)
        : null;
      const anchor = timePair?.[0] || spareOrder[0];
      if (!anchor) return [];
      const partner = timePair?.[1] || doubleEligible
        .filter(p => p.id !== anchor.id)
        .sort((a,b) => {
          const al=linkedPair(anchor,a)?1:0,bl=linkedPair(anchor,b)?1:0;
          if(al!==bl) return bl-al;
          const ap=prefRank(a),bp=prefRank(b); if(ap!==bp) return ap-bp;
          const ao=overlapScore.get(a.id)||0,bo=overlapScore.get(b.id)||0;
          if(ao!==bo) return bo-ao;
          const rank = r => r === "PVZ" ? 0 : r === "BOTH" ? 1 : 2;
          if (rank(a.role) !== rank(b.role)) return rank(a.role) - rank(b.role);
          const ac = coreSet.has(a.id) ? 1 : 0;
          const bc = coreSet.has(b.id) ? 1 : 0;
          if (ac !== bc) return ac - bc;
          if ((a.pvpStars||0) !== (b.pvpStars||0)) return (a.pvpStars||0) - (b.pvpStars||0);
          return byName(a,b);
        })[0];
      if (!partner) return [];

      for (const player of [anchor,partner]) {
        const current = targetMissions.get(player.id);
        if (current < missionLoad.spareAttacks) return [];
        targetMissions.set(player.id,current - missionLoad.spareAttacks);
      }
    }

    const missionCount =
      missionLoad.pvpAttacks + missionLoad.pvzAttacks - missionLoad.spareAttacks;
    if ([...targetMissions.values()].reduce((a,b)=>a+b,0) !== missionCount) return [];

    const pvpIds = new Set(pvpOrder.map(p => p.id));
    let pvpShortage = missionLoad.pvpAttacks - pvpOrder.reduce((sum,p)=>sum + targetMissions.get(p.id),0);
    while (pvpShortage > 0) {
      const receiver = pvpOrder.find(p => targetMissions.get(p.id) < ATTACKS_PER_PLAYER);
      const donor = [...targetOrder].reverse().find(p => !pvpIds.has(p.id) && targetMissions.get(p.id) > 0);
      if (!receiver || !donor) return [];
      targetMissions.set(receiver.id,targetMissions.get(receiver.id)+1);
      targetMissions.set(donor.id,targetMissions.get(donor.id)-1);
      pvpShortage--;
    }

    let remainingPvp = missionLoad.pvpAttacks;
    const pvpByPlayer = new Map(selected.map(p => [p.id,0]));
    pvpOrder.forEach(player => {
      if (remainingPvp <= 0) return;
      const amount = Math.min(targetMissions.get(player.id),remainingPvp);
      pvpByPlayer.set(player.id,amount);
      remainingPvp -= amount;
    });
    if (remainingPvp > 0) return [];

    let remainingPvz =
      missionLoad.pvzAttacks - missionLoad.spareAttacks;
    const pvzByPlayer = new Map(selected.map(p => [p.id,0]));
    const pvzOrder = [...selected].sort((a,b) => {
      const rank = r => r === "PVZ" ? 0 : r === "BOTH" ? 1 : 2;
      if (rank(a.role) !== rank(b.role)) return rank(a.role)-rank(b.role);
      const ac = coreSet.has(a.id) ? 1 : 0;
      const bc = coreSet.has(b.id) ? 1 : 0;
      if (ac !== bc) return ac-bc;
      if ((a.pvpStars||0) !== (b.pvpStars||0)) return (a.pvpStars||0)-(b.pvpStars||0);
      return byName(a,b);
    });
    pvzOrder.forEach(player => {
      if (remainingPvz <= 0) return;
      const free = Math.max(0,targetMissions.get(player.id)-pvpByPlayer.get(player.id));
      const amount = Math.min(free,remainingPvz);
      pvzByPlayer.set(player.id,amount);
      remainingPvz -= amount;
    });
    if (remainingPvz > 0) return [];

    return selected.map(player => {
      const pvp = pvpByPlayer.get(player.id);
      const pvz = pvzByPlayer.get(player.id);
      const normal = targetMissions.get(player.id);
      return {
        playerId:player.id,
        pvpAttacks:pvp,
        pvzAttacks:pvz,
        spareAttacks:ATTACKS_PER_PLAYER-normal,
        primaryPvp:coreSet.has(player.id),
      };
    });
  }

  function createTimeline(players, weekPlan, dayId) {
    const dayPlan = weekPlan.days[dayId];
    if (!dayPlan || dayPlan.teamSize === 0) return [];

    const byId = new Map(players.map(p => [p.id,p]));
    const loads = new Map(createAttackLoads(players,dayPlan,weekPlan,dayId).map(x => [x.playerId,x]));
    const islands = createIslandAssignments(players,weekPlan,dayId);
    if (!islands.length) return [];

    const missionsByPlayer = new Map();
    islands.flatMap(x => x.missions)
      .filter(m => m.active && m.playerId)
      .forEach(m => {
        if (!missionsByPlayer.has(m.playerId)) missionsByPlayer.set(m.playerId,[]);
        missionsByPlayer.get(m.playerId).push(m);
      });

    const countMissions = (playerId,sectors,kind=null) =>
      (missionsByPlayer.get(playerId)||[]).filter(m =>
        sectors.has(m.island.slice(-1)) && (!kind || m.kind===kind)
      ).length;

    const abSectors = new Set(["A","B"]);
    const abPvzStarts = new Map();
    const abPvzCompletions = new Map();

    dayPlan.playerIds.forEach(playerId => {
      const count=countMissions(playerId,abSectors,"PVZ");
      if(!count) return;
      const player=byId.get(playerId);
      if(!player) return;
      const startOffset=earliestPreferredOffset(player,weekPlan,dayId,0);
      if(startOffset===null) return;
      abPvzStarts.set(playerId,startOffset);
      abPvzCompletions.set(playerId,startOffset+count*ATTACK_DURATION_MINUTES);
    });

    const abPvzComplete=abPvzCompletions.size
      ? Math.max(...abPvzCompletions.values())
      : 0;

    const abPvpStarts = new Map();
    const abPvpCompletions = new Map();

    dayPlan.playerIds.forEach(playerId => {
      const count=countMissions(playerId,abSectors,"PVP");
      if(!count) return;
      const player=byId.get(playerId);
      if(!player) return;
      const startOffset=earliestPreferredOffset(player,weekPlan,dayId,abPvzComplete);
      if(startOffset===null) return;
      abPvpStarts.set(playerId,startOffset);
      abPvpCompletions.set(playerId,startOffset+count*ATTACK_DURATION_MINUTES);
    });

    // C is locked until every active A/B mission has been completed.
    const abComplete=Math.max(
      abPvzComplete,
      abPvpCompletions.size ? Math.max(...abPvpCompletions.values()) : 0
    );

    const cPvzStarts = new Map();
    const cPvzCompletions = new Map();

    dayPlan.playerIds.forEach(playerId => {
      const count=countMissions(playerId,new Set(["C"]),"PVZ");
      if(!count) return;
      const player=byId.get(playerId);
      if(!player) return;
      const startOffset=earliestPreferredOffset(player,weekPlan,dayId,abComplete);
      if(startOffset===null) return;
      cPvzStarts.set(playerId,startOffset);
      cPvzCompletions.set(playerId,startOffset+count*ATTACK_DURATION_MINUTES);
    });

    const cPvzComplete=Math.max(
      abComplete,
      cPvzCompletions.size ? Math.max(...cPvzCompletions.values()) : abComplete
    );

    const cPvpStarts = new Map();
    dayPlan.playerIds.forEach(playerId => {
      const count=countMissions(playerId,new Set(["C"]),"PVP");
      if(!count) return;
      const player=byId.get(playerId);
      if(!player) return;
      const startOffset=earliestPreferredOffset(player,weekPlan,dayId,cPvzComplete);
      if(startOffset===null) return;
      cPvpStarts.set(playerId,startOffset);
    });

    const entries=dayPlan.playerIds.map(playerId => {
      const player=byId.get(playerId);
      if(!player) return null;
      const load=loads.get(playerId);
      const abPvzCount=countMissions(playerId,abSectors,"PVZ");
      const abPvpCount=countMissions(playerId,abSectors,"PVP");
      const cPvzCount=countMissions(playerId,new Set(["C"]),"PVZ");
      const cPvpCount=countMissions(playerId,new Set(["C"]),"PVP");
      const dCount=countMissions(playerId,new Set(["D"]));
      const coreIndex=(dayPlan.pvpCorePlayerIds||[]).indexOf(playerId);

      let phase="FLEX";
      let offset=null;

      if(cPvzCount>0 && abPvzCount===0 && abPvpCount===0){
        phase="OPEN_C";
        offset=cPvzStarts.get(playerId) ?? null;
      } else if(cPvpCount>0 && abPvzCount===0 && abPvpCount===0){
        phase="PVP_CORE_C";
        offset=cPvpStarts.get(playerId) ?? null;
      } else if(abPvzCount>0){
        phase="OPENING";
        offset=abPvzStarts.get(playerId) ?? null;
      } else if(abPvpCount>0){
        phase=coreIndex>=0 ? "PVP_CORE_AB" : "PVP_SUPPORT";
        offset=abPvpStarts.get(playerId) ?? null;
      } else if(dCount>0){
        phase="FLEX";
        offset=earliestPreferredOffset(player,weekPlan,dayId,0);
      } else {
        offset=earliestPreferredOffset(player,weekPlan,dayId,0);
      }

      if(offset===null) return null;
      return {
        playerId,
        phase,
        suggestedOffsetMinutes:offset,
        localTimeLabel:localTimeLabel(player,weekPlan,dayId,offset),
        utcTimeLabel:utcTimeLabel(weekPlan,dayId,offset),
        needsStacking:(load?.spareAttacks||0)>0,
      };
    }).filter(Boolean);

    return entries.sort((a,b) =>
      a.suggestedOffsetMinutes-b.suggestedOffsetMinutes ||
      PHASE_ORDER[a.phase]-PHASE_ORDER[b.phase]
    );
  }

  function criticalPathIdleMinutes(players,weekPlan,dayId) {
    const dayPlan=weekPlan.days[dayId];
    if(!dayPlan || dayPlan.teamSize===0) return 0;

    const islands=createIslandAssignments(players,weekPlan,dayId);
    if(!islands.length) return null;

    const timeline=createTimeline(players,weekPlan,dayId);
    const starts=new Map(timeline.map(x=>[x.playerId,x.suggestedOffsetMinutes]));
    const missionsByPlayer=new Map();

    islands.flatMap(x=>x.missions)
      .filter(m=>m.active && m.playerId)
      .forEach(m=>{
        if(!missionsByPlayer.has(m.playerId)) missionsByPlayer.set(m.playerId,[]);
        missionsByPlayer.get(m.playerId).push(m);
      });

    const count=(playerId,sectors,kind=null)=>
      (missionsByPlayer.get(playerId)||[]).filter(m=>
        sectors.has(m.island.slice(-1)) && (!kind || m.kind===kind)
      ).length;

    const ab=new Set(["A","B"]);

    const abPvzComplete=Math.max(
      0,
      ...dayPlan.playerIds.map(playerId=>{
        const n=count(playerId,ab,"PVZ");
        return n>0 && starts.has(playerId)
          ? starts.get(playerId)+n*ATTACK_DURATION_MINUTES
          : 0;
      })
    );

    const abPvpStarts=dayPlan.playerIds
      .filter(playerId=>count(playerId,ab,"PVP")>0 && starts.has(playerId))
      .map(playerId=>starts.get(playerId));
    const firstAbPvpStart=abPvpStarts.length ? Math.min(...abPvpStarts) : null;

    const abPvpComplete=Math.max(
      abPvzComplete,
      ...dayPlan.playerIds.map(playerId=>{
        const n=count(playerId,ab,"PVP");
        return n>0 && starts.has(playerId)
          ? starts.get(playerId)+n*ATTACK_DURATION_MINUTES
          : 0;
      })
    );

    const cPvzStarts=dayPlan.playerIds
      .filter(playerId=>count(playerId,new Set(["C"]),"PVZ")>0 && starts.has(playerId))
      .map(playerId=>starts.get(playerId));
    const firstCPvzStart=cPvzStarts.length ? Math.min(...cPvzStarts) : null;

    const cPvzComplete=Math.max(
      abPvpComplete,
      ...dayPlan.playerIds.map(playerId=>{
        const n=count(playerId,new Set(["C"]),"PVZ");
        return n>0 && starts.has(playerId)
          ? starts.get(playerId)+n*ATTACK_DURATION_MINUTES
          : 0;
      })
    );

    const cPvpStarts=dayPlan.playerIds
      .filter(playerId=>count(playerId,new Set(["C"]),"PVP")>0 && starts.has(playerId))
      .map(playerId=>starts.get(playerId));
    const firstCPvpStart=cPvpStarts.length ? Math.min(...cPvpStarts) : null;

    const abIdle=firstAbPvpStart===null ? 0 : Math.max(0,firstAbPvpStart-abPvzComplete);
    const cOpenIdle=firstCPvzStart===null ? 0 : Math.max(0,firstCPvzStart-abPvpComplete);
    const cPvpIdle=firstCPvpStart===null ? 0 : Math.max(0,firstCPvpStart-cPvzComplete);

    return Math.max(abIdle,cOpenIdle,cPvpIdle);
  }

  function findStackOverlap(sparePlayer, possiblePartners, weekPlan, dayId, spareAttacks, target) {
    const earliest=target.earliestOffsetMinutes||0;
    const preferred=target.preferredOffsetMinutes||0;
    const candidates=[];
    const start=Math.ceil(Math.max(0,earliest)/STEP_MINUTES)*STEP_MINUTES;

    for(let offset=start; offset<BATTLE_DURATION_MINUTES; offset+=STEP_MINUTES) {
      if(!isPreferredAtOffset(sparePlayer,weekPlan,dayId,offset)) continue;
      possiblePartners
        .filter(p=>canDouble(p) && isPreferredAtOffset(p,weekPlan,dayId,offset))
        .forEach(partner=>{
          candidates.push({
            partner,
            offset,
            linked:linkedPair(sparePlayer,partner)?1:0,
            distance:Math.abs(offset-preferred),
            overlapStrength:bestPartnerOverlapSlots(
              sparePlayer,[partner],weekPlan,dayId
            ),
          });
        });
    }

    candidates.sort((a,b)=>{
      if(a.linked!==b.linked) return b.linked-a.linked;
      if(a.distance!==b.distance) return a.distance-b.distance;
      if(a.overlapStrength!==b.overlapStrength) return b.overlapStrength-a.overlapStrength;
      const ap=doublePreference(a.partner),bp=doublePreference(b.partner);
      const ar=ap==="PREFERRED"?0:ap==="ALLOWED"?1:2;
      const br=bp==="PREFERRED"?0:bp==="ALLOWED"?1:2;
      if(ar!==br) return ar-br;
      const rank=r=>r==="PVZ"?0:r==="BOTH"?1:2;
      if(rank(a.partner.role)!==rank(b.partner.role)) return rank(a.partner.role)-rank(b.partner.role);
      if((a.partner.pvpStars||0)!==(b.partner.pvpStars||0)) return (a.partner.pvpStars||0)-(b.partner.pvpStars||0);
      if(a.offset!==b.offset) return a.offset-b.offset;
      return byName(a.partner,b.partner);
    });

    const best=candidates[0];
    if(!best) return null;
    return {
      sparePlayerId:sparePlayer.id,
      partnerPlayerId:best.partner.id,
      targetSector:target.sector,
      targetMissionLevel:target.missionLevel,
      spareAttacks,
      suggestedOffsetMinutes:best.offset,
      sparePlayerLocalTime:localTimeLabel(sparePlayer,weekPlan,dayId,best.offset),
      partnerLocalTime:localTimeLabel(best.partner,weekPlan,dayId,best.offset),
      utcTime:utcTimeLabel(weekPlan,dayId,best.offset),
    };
  }


  function createStackPlan(players, weekPlan, dayId) {
    const dayPlan = weekPlan.days[dayId];
    if (!dayPlan || dayPlan.teamSize === 0) return null;
    const missionLoad = MISSION_LOADS[dayPlan.teamSize];
    if (!missionLoad?.requiresStacking) return null;

    const byId = new Map(players.map(p => [p.id,p]));
    const selected = dayPlan.playerIds.map(id => byId.get(id)).filter(Boolean);
    const loads = new Map(createAttackLoads(players,dayPlan,weekPlan,dayId).map(x => [x.playerId,x]));
    const sparePlayers = selected.filter(p => (loads.get(p.id)?.spareAttacks || 0) > 0);

    // 8v8 uses one shared pair for four DOUBLE missions. Both players
    // reserve four attacks in total. Time-zone overlap has priority.
    // A/B remain the early default; 20D becomes preferable when the
    // pair's common play window is later in the battle.
    if (
      dayPlan.teamSize === 8 &&
      missionLoad.spareAttacks === 4 &&
      sparePlayers.length === 2 &&
      sparePlayers.every(p => (loads.get(p.id)?.spareAttacks || 0) === 4)
    ) {
      const pair=bestDoubleAttackPair(
        sparePlayers,
        weekPlan,
        dayId,
        new Set(dayPlan.pvpCorePlayerIds||[])
      ) || sparePlayers;
      const first=pair[0],second=pair[1];

      const targetPairs=[];
      for(let i=0;i<EIGHT_V_EIGHT_TARGETS.length-1;i++){
        for(let j=i+1;j<EIGHT_V_EIGHT_TARGETS.length;j++){
          targetPairs.push({
            firstTarget:EIGHT_V_EIGHT_TARGETS[i],
            secondTarget:EIGHT_V_EIGHT_TARGETS[j],
            orderIndex:i*10+j,
          });
        }
      }

      const choices=targetPairs.map(pairChoice=>{
        const firstTarget=pairChoice.firstTarget;
        const secondTarget=pairChoice.secondTarget;
        const earliest=Math.max(
          0,
          firstTarget.earliestOffsetMinutes||0,
          (secondTarget.earliestOffsetMinutes||0)-DOUBLE_BLOCK_MINUTES
        );
        let start=earliest;

        while(start<BATTLE_DURATION_MINUTES-DOUBLE_BLOCK_MINUTES){
          const secondStart=start+DOUBLE_BLOCK_MINUTES;
          const bothAvailable=
            isPreferredAtOffset(first,weekPlan,dayId,start) &&
            isPreferredAtOffset(second,weekPlan,dayId,start) &&
            isPreferredAtOffset(first,weekPlan,dayId,secondStart) &&
            isPreferredAtOffset(second,weekPlan,dayId,secondStart);
          if(bothAvailable) break;
          start+=DOUBLE_BLOCK_MINUTES;
        }

        if(start>=BATTLE_DURATION_MINUTES-DOUBLE_BLOCK_MINUTES) return null;

        const secondStart=start+DOUBLE_BLOCK_MINUTES;
        const timingDistance=
          Math.abs(start-(firstTarget.preferredOffsetMinutes||0)) +
          Math.abs(secondStart-(secondTarget.preferredOffsetMinutes||0));

        return {
          ...pairChoice,
          startOffsetMinutes:start,
          flowCost:timingDistance+Math.floor(start/4),
        };
      }).filter(Boolean).sort((a,b)=>
        a.flowCost-b.flowCost ||
        a.startOffsetMinutes-b.startOffsetMinutes ||
        a.orderIndex-b.orderIndex
      );

      const best=choices[0];
      if(!best){
        return {
          targetIsland:20,
          missionVp:60,
          missionRp:42,
          totalSpareAttacks:missionLoad.spareAttacks,
          assignments:[],
          complete:false,
        };
      }

      const firstOffset=best.startOffsetMinutes;
      const secondOffset=firstOffset+DOUBLE_BLOCK_MINUTES;
      const makeAssignment=(sparePlayer,partner,target,offset)=>({
        sparePlayerId:sparePlayer.id,
        partnerPlayerId:partner.id,
        targetSector:target.sector,
        targetMissionLevel:target.missionLevel,
        spareAttacks:2,
        suggestedOffsetMinutes:offset,
        sparePlayerLocalTime:localTimeLabel(sparePlayer,weekPlan,dayId,offset),
        partnerLocalTime:localTimeLabel(partner,weekPlan,dayId,offset),
        utcTime:utcTimeLabel(weekPlan,dayId,offset),
      });

      const sharedAssignments=[
        makeAssignment(first,second,best.firstTarget,firstOffset),
        makeAssignment(second,first,best.secondTarget,secondOffset),
      ];

      return {
        targetIsland:20,
        missionVp:60,
        missionRp:42,
        totalSpareAttacks:missionLoad.spareAttacks,
        assignments:sharedAssignments,
        complete:true,
      };
    }

    const pair=bestDoubleAttackPair(
      sparePlayers,
      weekPlan,
      dayId,
      new Set(dayPlan.pvpCorePlayerIds||[])
    ) || (sparePlayers.length>=2 ? [sparePlayers[0],sparePlayers[1]] : null);

    if(!pair){
      return {
        targetIsland:20,
        missionVp:60,
        missionRp:42,
        totalSpareAttacks:missionLoad.spareAttacks,
        assignments:[],
        complete:false,
      };
    }

    const first=pair[0],second=pair[1];
    const assignments = [];
    let targetIndex = 0;
    let remaining = missionLoad.spareAttacks;

    while (remaining > 0) {
      const chunk = Math.min(2,remaining);
      const target = STACK_TARGETS[targetIndex % STACK_TARGETS.length];
      const found = findStackOverlap(
        first,
        [second],
        weekPlan,
        dayId,
        chunk,
        target,
      );
      if (found) assignments.push(found);
      remaining -= chunk;
      targetIndex++;
    }

    return {
      targetIsland:20,
      missionVp:60,
      missionRp:42,
      totalSpareAttacks:missionLoad.spareAttacks,
      assignments,
      complete:
        assignments.reduce((sum,x)=>sum+x.spareAttacks,0) === missionLoad.spareAttacks,
    };
  }

  // Exact PvZ mission-strength levels from the JJ day-by-day plan.
  function jjMissionLevel(island,row,column,kind) {
    if(kind !== "PVZ") return null;
    const number=Number.parseInt(island,10);
    const base=({11:48,18:49,12:50,19:51,20:52})[number];
    if(!base) return null;
    const sector=island.slice(-1);
    const pairOffset=sector==="C"
      ? Math.floor(column/2)
      : (column>=3?1:0);
    return base+row+pairOffset;
  }

  function fullTemplate(island, activePositions = null) {
    const sector = island.slice(-1);
    const columns = sector === "C" ? 4 : 6;
    const pattern = sector === "C" ?
      ["PVZ","PVP","PVZ","PVP"] :
      ["PVZ","PVZ","PVP","PVZ","PVZ","PVP"];
    const missions = [];
    for (let row=0; row<2; row++) {
      pattern.forEach((kind,column) => {
        const key = `${row}:${column}`;
        const active = !activePositions || activePositions.has(key);
        const number = Number.parseInt(island,10);
        const isMaxPvz = number === 20 && row === 1 && kind === "PVZ" &&
          (sector === "C" ? column === 2 : column === 3 || column === 4);
        const missionLevel=jjMissionLevel(island,row,column,kind);
        missions.push({ island,row,column,kind,missionLevel,active,isMaxPvz,playerId:null });
      });
    }
    return { island,rows:2,columns,missions };
  }

  function islandNumber(island) { return Number.parseInt(island,10) || 999; }
  function sectorOrder(island) { return ({A:0,B:1,C:2,D:3})[island.slice(-1)] ?? 4; }
  function unlockPhase(island) { return island.endsWith("C") ? 1 : 0; }
  function missionKey(m) { return `${m.island}:${m.row}:${m.column}`; }

  function createIslandAssignments(players, weekPlan, dayId) {
    const dayPlan = weekPlan.days[dayId];
    if (!dayPlan || dayPlan.teamSize === 0) return [];
    const byId = new Map(players.map(p => [p.id,p]));
    const selected = dayPlan.playerIds.map(id => byId.get(id)).filter(Boolean);
    if (selected.length !== dayPlan.teamSize) return [];

    const missionLoad = MISSION_LOADS[dayPlan.teamSize];
    const loadsList = createAttackLoads(players,dayPlan,weekPlan,dayId);
    const loads = new Map(loadsList.map(x => [x.playerId,x]));
    if (loads.size !== selected.length) return [];

    const islands = missionLoad.islands.map(x => fullTemplate(x));
    if (missionLoad.soloMax20dAttacks > 0 && !islands.some(x => x.island === "20D")) {
      const positions = new Set(["1:3","1:4"].slice(0,missionLoad.soloMax20dAttacks));
      islands.push(fullTemplate("20D",positions));
    }

    const stackPlan =
      missionLoad.requiresStacking
        ? createStackPlan(players,weekPlan,dayId)
        : null;

    const isReservedDoubleMission = mission =>
      !!stackPlan &&
      mission.isMaxPvz &&
      stackPlan.assignments.some(assignment =>
        assignment.targetSector === mission.island &&
        assignment.targetMissionLevel === mission.missionLevel
      );

    const preferredOffsets = new Map(selected.map(player => [
      player.id,
      earliestPreferredOffset(player,weekPlan,dayId,0) ?? 999999
    ]));
    const coreSet = new Set(dayPlan.pvpCorePlayerIds || []);
    const assignments = new Map();

    function playerOrder(kind) {
      return selected
        .filter(p => {
          const l=loads.get(p.id);
          return kind === "PVP" ? l?.pvpAttacks > 0 : l?.pvzAttacks > 0;
        })
        .sort((a,b) => {
          if (kind === "PVP") {
            // Closing priority: non-core/weaker PvP first, strongest core
            // players last so 5-star cores receive the closing missions.
            const ac = coreSet.has(a.id) ? 1 : 0;
            const bc = coreSet.has(b.id) ? 1 : 0;
            if (ac !== bc) return ac-bc;
            if ((a.pvpStars||0)!==(b.pvpStars||0)) return (a.pvpStars||0)-(b.pvpStars||0);
            const at = preferredOffsets.get(a.id) ?? 999999;
            const bt = preferredOffsets.get(b.id) ?? 999999;
            if (at !== bt) return at-bt;
          } else {
            const at = preferredOffsets.get(a.id) ?? 999999;
            const bt = preferredOffsets.get(b.id) ?? 999999;
            if (at !== bt) return at-bt;
            const rank = r => r === "PVZ" ? 0 : r === "BOTH" ? 1 : 2;
            if (rank(a.role)!==rank(b.role)) return rank(a.role)-rank(b.role);
            if ((a.pvpStars||0)!==(b.pvpStars||0)) return (a.pvpStars||0)-(b.pvpStars||0);
          }
          return byName(a,b);
        });
    }

    ["PVZ","PVP"].forEach(kind => {
      const slots = islands
        .flatMap(x => x.missions)
        .filter(m => m.active && m.kind === kind && !isReservedDoubleMission(m))
        .sort((a,b) =>
          unlockPhase(a.island)-unlockPhase(b.island) ||
          islandNumber(a.island)-islandNumber(b.island) ||
          sectorOrder(a.island)-sectorOrder(b.island) ||
          a.row-b.row || a.column-b.column
        );
      let missionIndex = 0;
      playerOrder(kind).forEach(player => {
        const load=loads.get(player.id);
        const amount=kind==="PVP"?load.pvpAttacks:load.pvzAttacks;
        for(let i=0;i<amount;i++) {
          const m=slots[missionIndex++];
          if (!m) return;
          assignments.set(missionKey(m),player.id);
        }
      });
    });

    return islands.map(island => ({
      ...island,
      missions:island.missions.map(m => ({...m,playerId:assignments.get(missionKey(m)) || null})),
    })).sort((a,b)=>islandNumber(a.island)-islandNumber(b.island)||sectorOrder(a.island)-sectorOrder(b.island));
  }

  class Dinic {
    constructor(n) {
      this.n=n;
      this.graph=Array.from({length:n},()=>[]);
    }
    addEdge(from,to,capacity) {
      const forward={to,rev:this.graph[to].length,capacity,originalCapacity:capacity};
      const reverse={to:from,rev:this.graph[from].length,capacity:0,originalCapacity:0};
      this.graph[from].push(forward);
      this.graph[to].push(reverse);
      return forward;
    }
    maxFlow(source,sink) {
      let total=0;
      while(true) {
        const level=Array(this.n).fill(-1);
        const q=[source];
        level[source]=0;
        for(let qi=0;qi<q.length;qi++) {
          const node=q[qi];
          this.graph[node].forEach(edge=>{
            if(edge.capacity>0 && level[edge.to]<0) {
              level[edge.to]=level[node]+1;
              q.push(edge.to);
            }
          });
        }
        if(level[sink]<0) break;
        const next=Array(this.n).fill(0);
        const send=(node,pushed)=>{
          if(node===sink) return pushed;
          while(next[node]<this.graph[node].length) {
            const edge=this.graph[node][next[node]];
            if(edge.capacity>0 && level[edge.to]===level[node]+1) {
              const sent=send(edge.to,Math.min(pushed,edge.capacity));
              if(sent>0) {
                edge.capacity-=sent;
                this.graph[edge.to][edge.rev].capacity+=sent;
                return sent;
              }
            }
            next[node]++;
          }
          return 0;
        };
        while(true) {
          const pushed=send(source,Number.MAX_SAFE_INTEGER);
          if(!pushed) break;
          total+=pushed;
        }
      }
      return total;
    }
  }

  function fail(plan, requiredSlots, type, day=null, required=0, available=0) {
    return {
      success:false,
      plan,
      requiredSlots,
      assignedSlots:Object.values(plan.days).reduce((s,d)=>s+d.playerIds.length,0),
      failure:{type,day,required,available},
    };
  }

  function autoPlan(players, currentPlan) {
    const current=clone(currentPlan);
    const requiredSlots=DAYS.reduce((sum,d)=>sum+(current.days[d.id].teamSize||0),0);

    for(const day of DAYS) {
      const dp=current.days[day.id];
      if(dp.teamSize===0) continue;
      const available=players.filter(p=>!dp.unavailablePlayerIds.includes(p.id));
      if(available.length<dp.teamSize) return fail(current,requiredSlots,"DAILY_SHORTAGE",day.id,dp.teamSize,available.length);

      const playable=available.filter(p=>hasPreferredSlot(p,current,day.id));
      if(playable.length<dp.teamSize) return fail(current,requiredSlots,"TIME_WINDOW",day.id,dp.teamSize,playable.length);

      const load=MISSION_LOADS[dp.teamSize];
      const pvp=playable.filter(pvpCapable);
      if(pvp.length<load.minimumPvpCapablePlayers) return fail(current,requiredSlots,"PVP_COVERAGE",day.id,load.minimumPvpCapablePlayers,pvp.length);

      const pvpAtHandoff=pvp.filter(p=>hasPreferredSlot(p,current,day.id,PVP_HANDOFF_TARGET_MINUTES));
      if(pvpAtHandoff.length<load.minimumPvpCapablePlayers) return fail(current,requiredSlots,"PVP_TIMING",day.id,load.minimumPvpCapablePlayers,pvpAtHandoff.length);
    }

    const weeklyCapacity=players.length*MAX_DAYS_PER_PLAYER;
    if(weeklyCapacity<requiredSlots) return fail(current,requiredSlots,"WEEKLY_CAPACITY",null,requiredSlots,weeklyCapacity);

    const source=0;
    const pvpDayOffset=1;
    const generalDayOffset=pvpDayOffset+DAYS.length;
    const dayPlayerOffset=generalDayOffset+DAYS.length;
    const dayPlayerCount=DAYS.length*players.length;
    const playerOffset=dayPlayerOffset+dayPlayerCount;
    const sink=playerOffset+players.length;
    const graph=new Dinic(sink+1);
    const dayPlayerNode=(di,pi)=>dayPlayerOffset+di*players.length+pi;
    const playerIndexById=new Map(players.map((p,i)=>[p.id,i]));
    const selectedEdges=[];

    DAYS.forEach((day,dayIndex)=>{
      const dp=current.days[day.id];
      if(dp.teamSize===0) return;
      const load=MISSION_LOADS[dp.teamSize];
      graph.addEdge(source,pvpDayOffset+dayIndex,load.minimumPvpCapablePlayers);
      graph.addEdge(source,generalDayOffset+dayIndex,dp.teamSize-load.minimumPvpCapablePlayers);

      const available=players.filter(p=>
        !dp.unavailablePlayerIds.includes(p.id) &&
        hasPreferredSlot(p,current,day.id)
      );
      const retained=new Set(dp.playerIds);
      const stackingOverlap=new Map(
        available.map(player=>[
          player.id,
          load.requiresStacking
            ? bestPartnerOverlapSlots(player,available,current,day.id)
            : 0,
        ])
      );

      const pvpCandidates=available.filter(pvpCapable).sort((a,b)=>{
        const ar=retained.has(a.id)?0:1, br=retained.has(b.id)?0:1;
        if(ar!==br) return ar-br;
        if((a.pvpStars||0)!==(b.pvpStars||0)) return (b.pvpStars||0)-(a.pvpStars||0);
        const ap=timingPenalty(a,current,day.id,PVP_HANDOFF_TARGET_MINUTES);
        const bp=timingPenalty(b,current,day.id,PVP_HANDOFF_TARGET_MINUTES);
        if(ap!==bp) return ap-bp;
        if((a.role==="PVP")!==(b.role==="PVP")) return a.role==="PVP"?-1:1;
        return byName(a,b);
      });
      pvpCandidates.forEach(p=>{
        const pi=playerIndexById.get(p.id);
        graph.addEdge(pvpDayOffset+dayIndex,dayPlayerNode(dayIndex,pi),1);
      });

      const generalCandidates=[...available].sort((a,b)=>{
        const ao=stackingOverlap.get(a.id)||0,bo=stackingOverlap.get(b.id)||0;
        if(ao!==bo) return bo-ao;
        const ar=retained.has(a.id)?0:1, br=retained.has(b.id)?0:1;
        if(ar!==br) return ar-br;
        const ap=timingPenalty(a,current,day.id,0);
        const bp=timingPenalty(b,current,day.id,0);
        if(ap!==bp) return ap-bp;
        const rank=r=>r==="PVZ"?0:r==="BOTH"?1:2;
        if(rank(a.role)!==rank(b.role)) return rank(a.role)-rank(b.role);
        if((a.pvpStars||0)!==(b.pvpStars||0)) return (a.pvpStars||0)-(b.pvpStars||0);
        return byName(a,b);
      });
      generalCandidates.forEach(p=>{
        const pi=playerIndexById.get(p.id);
        graph.addEdge(generalDayOffset+dayIndex,dayPlayerNode(dayIndex,pi),1);
      });

      available.forEach(p=>{
        const pi=playerIndexById.get(p.id);
        const edge=graph.addEdge(dayPlayerNode(dayIndex,pi),playerOffset+pi,1);
        selectedEdges.push({day:day.id,playerId:p.id,edge});
      });
    });

    players.forEach((_,i)=>graph.addEdge(playerOffset+i,sink,MAX_DAYS_PER_PLAYER));
    const flow=graph.maxFlow(source,sink);
    if(flow<requiredSlots) return fail(current,requiredSlots,"AVAILABILITY_CONFLICT",null,requiredSlots,flow);

    const selectedByDay=Object.fromEntries(DAYS.map(d=>[d.id,[]]));
    selectedEdges.forEach(x=>{
      if(x.edge.originalCapacity===1 && x.edge.capacity===0) selectedByDay[x.day].push(x.playerId);
    });
    const byId=new Map(players.map(p=>[p.id,p]));

    DAYS.forEach(day=>{
      const dp=current.days[day.id];
      if(dp.teamSize===0) {
        dp.playerIds=[];
        dp.pvpCorePlayerIds=[];
        return;
      }
      const selected=selectedByDay[day.id];
      const ordered=dp.playerIds.filter(id=>selected.includes(id))
        .concat(selected.filter(id=>!dp.playerIds.includes(id)))
        .slice(0,dp.teamSize);
      const load=MISSION_LOADS[dp.teamSize];
      const core=ordered.map(id=>byId.get(id)).filter(Boolean).filter(pvpCapable).sort((a,b)=>{
        if((a.pvpStars||0)!==(b.pvpStars||0)) return (b.pvpStars||0)-(a.pvpStars||0);
        const ap=timingPenalty(a,current,day.id,PVP_HANDOFF_TARGET_MINUTES);
        const bp=timingPenalty(b,current,day.id,PVP_HANDOFF_TARGET_MINUTES);
        if(ap!==bp) return ap-bp;
        if((a.role==="PVP")!==(b.role==="PVP")) return a.role==="PVP"?-1:1;
        return byName(a,b);
      }).slice(0,load.primaryPvpPlayers).map(p=>p.id);
      dp.playerIds=ordered;
      dp.pvpCorePlayerIds=core;
    });

    for(const day of DAYS) {
      const dp=current.days[day.id];
      if(dp.teamSize===0) continue;

      const dependencyTimeline=createTimeline(players,current,day.id);
      const scheduledPlayers=new Set(dependencyTimeline.map(x=>x.playerId));
      if(scheduledPlayers.size<dp.teamSize) {
        return fail(
          current,
          requiredSlots,
          "PVP_TIMING",
          day.id,
          dp.teamSize,
          scheduledPlayers.size
        );
      }

      const criticalIdle=criticalPathIdleMinutes(players,current,day.id);
      if(
        criticalIdle===null ||
        criticalIdle>MAX_CRITICAL_PATH_IDLE_MINUTES
      ) {
        return fail(
          current,
          requiredSlots,
          "PVP_TIMING",
          day.id,
          MAX_CRITICAL_PATH_IDLE_MINUTES,
          criticalIdle===null ? 999999 : criticalIdle
        );
      }

      const load=MISSION_LOADS[dp.teamSize];
      if(load.requiresStacking) {
        const stack=createStackPlan(players,current,day.id);
        if(!stack?.complete) {
          const available=stack?.assignments.reduce((s,x)=>s+x.spareAttacks,0) || 0;
          return fail(current,requiredSlots,"STACKING_WINDOW",day.id,load.spareAttacks,available);
        }
      }
    }

    return {success:true,plan:current,assignedSlots:requiredSlots,requiredSlots,failure:null};
  }

  function playerVpTargets(players, weekPlan, dayId) {
    const dayPlan=weekPlan.days[dayId];
    const islands=createIslandAssignments(players,weekPlan,dayId);
    const loads=new Map(createAttackLoads(players,dayPlan,weekPlan,dayId).map(x=>[x.playerId,x]));
    const totals=new Map(dayPlan.playerIds.map(id=>[id,0]));
    islands.forEach(island=>{
      island.missions.forEach(m=>{
        if(!m.active || !m.playerId) return;
        totals.set(m.playerId,(totals.get(m.playerId)||0)+missionVp(island.island,m.row,m.column));
      });
    });
    dayPlan.playerIds.forEach(id=>{
      totals.set(id,(totals.get(id)||0)+((loads.get(id)?.spareAttacks||0)*60));
    });
    return totals;
  }

  function isPlanValid(players, plan) {
    return DAYS.every(day=>{
      const dp=plan.days[day.id];
      if(dp.teamSize===0) return dp.playerIds.length===0 && dp.pvpCorePlayerIds.length===0;
      return dp.playerIds.length===dp.teamSize &&
        new Set(dp.playerIds).size===dp.teamSize &&
        createAttackLoads(players,dp,plan,day.id).length===dp.teamSize;
    });
  }

  return {
    ATTACKS_PER_PLAYER,
    ATTACK_DURATION_MINUTES,
    MAX_DAYS_PER_PLAYER,
    BATTLE_START_UTC_MINUTES,
    BATTLE_DURATION_MINUTES,
    PVP_HANDOFF_TARGET_MINUTES,
    nextTuesdayIso,
    addDaysIso,
    emptyWeek,
    inheritWeek,
    dateForDay,
    defaultPreferredWindow,
    earliestPreferredOffset,
    hasPreferredSlot,
    timingPenalty,
    localTimeLabel,
    utcTimeLabel,
    createAttackLoads,
    createTimeline,
    createStackPlan,
    createIslandAssignments,
    autoPlan,
    playerVpTargets,
    isPlanValid,
  };
})();
