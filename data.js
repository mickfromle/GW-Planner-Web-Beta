window.GWPlannerData = (() => {
  const DAYS = [
    { id: "TUESDAY", short: "TU", label: "Tuesday" },
    { id: "WEDNESDAY", short: "WE", label: "Wednesday" },
    { id: "THURSDAY", short: "TH", label: "Thursday" },
    { id: "FRIDAY", short: "FR", label: "Friday" },
    { id: "SATURDAY", short: "SA", label: "Saturday" },
    { id: "SUNDAY", short: "SU", label: "Sunday" },
  ];

  const MISSION_LOADS = {
    3: { teamSize:3, islands:["20A","20B","20C","20D"], pvpAttacks:16, pvzAttacks:28, spareAttacks:10, maxSectorPlan:"20ABC + 20D", maxVp:4488, maxSectorScore:2000, soloMax20dAttacks:0 },
    4: { teamSize:4, islands:["19A","19B","19C","20A","20B","20C"], pvpAttacks:24, pvzAttacks:42, spareAttacks:6, maxSectorPlan:"19ABC + 20ABC + 2x 20D MAX PvZ", maxVp:6180, maxSectorScore:3060, soloMax20dAttacks:2 },
    5: { teamSize:5, islands:["19A","19B","19C","19D","20A","20B","20C","20D"], pvpAttacks:32, pvzAttacks:56, spareAttacks:2, maxSectorPlan:"19ABC + 20ABC + 19D + 20D", maxVp:7694, maxSectorScore:3910, soloMax20dAttacks:0 },
    6: { teamSize:6, islands:["12A","12B","12C","19A","19B","19C","20A","20B","20C","20D"], pvpAttacks:40, pvzAttacks:68, spareAttacks:0, maxSectorPlan:"12ABC + 19ABC + 20ABC + 20D", maxVp:9293, maxSectorScore:4920, soloMax20dAttacks:0 },
    7: { teamSize:7, islands:["12A","12B","12C","19A","19B","19C","19D","20A","20B","20C","20D"], pvpAttacks:44, pvzAttacks:76, spareAttacks:6, maxSectorPlan:"12ABC + 19ABC + 20ABC + 19D + 20D", maxVp:10564, maxSectorScore:5335, soloMax20dAttacks:0 },
    8: { teamSize:8, islands:["18A","18B","18C","12A","12B","12C","19A","19B","19C","20A","20B","20C","20D"], pvpAttacks:52, pvzAttacks:88, spareAttacks:4, maxSectorPlan:"12ABC + 18ABC + 19ABC + 20ABC + 20D", maxVp:12028, maxSectorScore:6275, soloMax20dAttacks:0 },
    9: { teamSize:9, islands:["11A","11B","11C","18A","18B","18C","12A","12B","12C","19A","19B","19C","20A","20B","20C"], pvpAttacks:60, pvzAttacks:102, spareAttacks:0, maxSectorPlan:"11ABC + 12ABC + 18ABC + 19ABC + 20ABC + 2x 20D MAX PvZ", maxVp:13315, maxSectorScore:7125, soloMax20dAttacks:2 },
    10:{ teamSize:10,islands:["11A","11B","11C","18A","18B","18C","12A","12B","12C","19A","19B","19C","20A","20B","20C","20D"], pvpAttacks:64, pvzAttacks:108, spareAttacks:8, maxSectorPlan:"11ABC + 12ABC + 18ABC + 19ABC + 20ABC + 20D", maxVp:14638, maxSectorScore:7560, soloMax20dAttacks:0 },
  };

  Object.values(MISSION_LOADS).forEach(load => {
    load.totalAttacks = load.teamSize * 18;
    load.missionAttacks = load.pvpAttacks + load.pvzAttacks;
    load.requiresStacking = load.spareAttacks > 0;
    load.minimumPvpCapablePlayers = Math.ceil(load.pvpAttacks / 18);
    load.primaryPvpPlayers = Math.max(1, Math.floor(load.pvpAttacks / 18));
    load.spareTargetIsland = load.spareAttacks > 0 ? 20 : null;
    load.spareMissionVp = load.spareAttacks > 0 ? 60 : 0;
    load.spareMissionRp = load.spareAttacks > 0 ? 42 : 0;
  });

  const COUNTRY_CODES = (
    "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW"
  ).split(" ");

  const EXTRA_REGIONS = [
    { code:"GB-ENG", name:"England", zoneCountry:"GB", flagCode:"gb-eng" },
    { code:"GB-SCT", name:"Scotland", zoneCountry:"GB", flagCode:"gb-sct" },
    { code:"GB-WLS", name:"Wales", zoneCountry:"GB", flagCode:"gb-wls" },
    { code:"GB-NIR", name:"Northern Ireland", zoneCountry:"GB", flagCode:"gb-nir" },
    { code:"TW-TH", name:"Taiwan (Thailand time)", zoneCountry:"TH", flagCode:"tw" },
    { code:"IC", name:"Canary Islands", zoneCountry:"ES", flagCode:"ic" },
    { code:"CQ", name:"Sark", zoneCountry:"GG", flagCode:"cq" },
    { code:"XK", name:"Kosovo", zoneCountry:"RS", flagCode:"xk" },
    { code:"DG", name:"Diego Garcia", zoneCountry:"IO", flagCode:"dg" },
  ];

  const displayNames = (() => {
    try { return new Intl.DisplayNames(["en"], { type:"region" }); }
    catch (_) { return null; }
  })();

  const COUNTRIES = COUNTRY_CODES.map(code => ({
    code,
    name: displayNames?.of(code) || code,
    zoneCountry: code,
    flagCode: code.toLowerCase(),
  }))
  .filter(x => x.name && x.name !== x.code)
  .concat(EXTRA_REGIONS)
  .sort((a,b) => a.name.localeCompare(b.name));

  const CURATED_TIMEZONES = {
    DE: [["Europe/Berlin","Germany"]],
    GB: [["Europe/London","London"]],
    "GB-ENG": [["Europe/London","London"]],
    "GB-SCT": [["Europe/London","London"]],
    "GB-WLS": [["Europe/London","London"]],
    "GB-NIR": [["Europe/London","London"]],
    "TW-TH": [["Asia/Bangkok","Thailand · UTC+7"]],
    IC: [["Atlantic/Canary","Canary Islands"]],
    CQ: [["Europe/Guernsey","Sark"]],
    XK: [["Europe/Belgrade","Kosovo"]],
    DG: [["Indian/Chagos","Diego Garcia"]],
    US: [
      ["America/New_York","Eastern"],
      ["America/Chicago","Central"],
      ["America/Denver","Mountain"],
      ["America/Phoenix","Mountain · Arizona"],
      ["America/Los_Angeles","Pacific"],
      ["America/Anchorage","Alaska"],
      ["Pacific/Honolulu","Hawaii"],
    ],
    CA: [
      ["America/St_Johns","Newfoundland"],
      ["America/Halifax","Atlantic"],
      ["America/Toronto","Eastern"],
      ["America/Winnipeg","Central"],
      ["America/Regina","Saskatchewan"],
      ["America/Edmonton","Mountain"],
      ["America/Whitehorse","Yukon"],
      ["America/Vancouver","Pacific"],
    ],
    AU: [
      ["Australia/Perth","Western"],
      ["Australia/Darwin","Central · Northern Territory"],
      ["Australia/Adelaide","Central · South Australia"],
      ["Australia/Brisbane","Eastern · Queensland"],
      ["Australia/Sydney","Eastern · NSW / VIC / TAS"],
      ["Australia/Lord_Howe","Lord Howe Island"],
    ],
    BR: [
      ["America/Noronha","Fernando de Noronha"],
      ["America/Sao_Paulo","Brasília / São Paulo"],
      ["America/Manaus","Amazon"],
      ["America/Rio_Branco","Acre"],
    ],
    MX: [
      ["America/Cancun","Quintana Roo"],
      ["America/Mexico_City","Central"],
      ["America/Mazatlan","Pacific"],
      ["America/Hermosillo","Sonora"],
      ["America/Tijuana","Baja California"],
    ],
    RU: [
      ["Europe/Kaliningrad","Kaliningrad"],
      ["Europe/Moscow","Moscow"],
      ["Europe/Samara","Samara"],
      ["Asia/Yekaterinburg","Yekaterinburg"],
      ["Asia/Omsk","Omsk"],
      ["Asia/Krasnoyarsk","Krasnoyarsk"],
      ["Asia/Irkutsk","Irkutsk"],
      ["Asia/Yakutsk","Yakutsk"],
      ["Asia/Vladivostok","Vladivostok"],
      ["Asia/Magadan","Magadan"],
      ["Asia/Kamchatka","Kamchatka"],
    ],
    ID: [["Asia/Jakarta","Western Indonesia"],["Asia/Makassar","Central Indonesia"],["Asia/Jayapura","Eastern Indonesia"]],
    CN: [["Asia/Shanghai","China Standard"],["Asia/Urumqi","Xinjiang"]],
    ES: [["Europe/Madrid","Mainland"],["Atlantic/Canary","Canary Islands"]],
    PT: [["Europe/Lisbon","Mainland / Madeira"],["Atlantic/Azores","Azores"]],
    CL: [["America/Santiago","Mainland"],["Pacific/Easter","Easter Island"]],
    NZ: [["Pacific/Auckland","Mainland"],["Pacific/Chatham","Chatham Islands"]],
    EC: [["America/Guayaquil","Mainland"],["Pacific/Galapagos","Galápagos"]],
    CD: [["Africa/Kinshasa","Western DR Congo"],["Africa/Lubumbashi","Eastern DR Congo"]],
    MN: [["Asia/Hovd","Western Mongolia"],["Asia/Ulaanbaatar","Central / Eastern Mongolia"]],
    PG: [["Pacific/Port_Moresby","Papua New Guinea"],["Pacific/Bougainville","Bougainville"]],
    FM: [["Pacific/Chuuk","Chuuk"],["Pacific/Pohnpei","Pohnpei"],["Pacific/Kosrae","Kosrae"]],
    KI: [["Pacific/Tarawa","Gilbert Islands"],["Pacific/Kanton","Phoenix Islands"],["Pacific/Kiritimati","Line Islands"]],
    GL: [["America/Nuuk","Nuuk / most of Greenland"],["America/Danmarkshavn","Danmarkshavn"],["America/Scoresbysund","Ittoqqortoormiit"],["America/Thule","Pituffik"]],
  };

  const PLAYER_COLORS = [
    "#e53935","#f4d03f","#20c55c","#1694ff","#ff8c32","#8d5a3b","#9d53eb","#24cdcd",
    "#ed4fb2","#75cb34","#597dff","#ff6c92","#4fb1a3","#eabb2e","#3cbeee","#b15dd0",
    "#d35353","#5dcb93","#828ced","#e671c9"
  ];

  const VP_VALUES_ABD = {
    11:[40,40,20,42,42,20,42,42,20,45,45,20],
    18:[42,42,20,45,45,20,45,45,20,48,48,20],
    12:[45,45,20,48,48,20,48,48,20,52,52,20],
    19:[48,48,20,52,52,20,52,52,20,56,56,20],
    20:[52,52,20,56,56,20,56,56,20,60,60,20],
  };
  const VP_VALUES_C = {
    11:[40,20,42,20,42,20,45,20],
    18:[42,20,45,20,45,20,48,20],
    12:[45,20,48,20,48,20,52,20],
    19:[48,20,52,20,52,20,56,20],
    20:[52,20,56,20,56,20,60,20],
  };

  function timeZonesForCountry(countryCode) {
    const curated = CURATED_TIMEZONES[countryCode];
    if (curated?.length) return curated.map(([id,label]) => ({id,label}));

    const country = COUNTRIES.find(x => x.code === countryCode);
    const zoneCountry = country?.zoneCountry || countryCode;
    try {
      const zones = window.moment?.tz?.zonesForCountry(zoneCountry) || [];
      return zones.map(id => ({
        id,
        label: id.split("/").pop().replaceAll("_"," "),
      }));
    } catch (_) {
      return [];
    }
  }

  function flagUrl(countryCode) {
    const customFlags = {
      IC:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40">' +
        '<path fill="#fff" d="M0 0h20v40H0z"/><path fill="#0667a6" d="M20 0h20v40H20z"/>' +
        '<path fill="#fc0" d="M40 0h20v40H40z"/></svg>',
      EH:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40">' +
        '<path d="M0 0h60v13.34H0z"/><path fill="#fff" d="M0 13.33h60v13.34H0z"/>' +
        '<path fill="#007a3d" d="M0 26.66h60V40H0z"/><path fill="#ce1126" d="M0 0l24 20L0 40z"/></svg>',
      SO:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40">' +
        '<path fill="#4189dd" d="M0 0h60v40H0z"/><path fill="#fff" d="M30 8l2.8 8.5h9l-7.3 5.3 2.8 8.4-7.3-5.2-7.3 5.2 2.8-8.4-7.3-5.3h9z"/></svg>',
      CQ:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40">' +
        '<path fill="#fff" d="M0 0h60v40H0z"/><path fill="#d71920" d="M25 0h10v40H25zM0 15h60v10H0z"/>' +
        '<path fill="#f2c500" d="M8 5h5v4H8zM15 9h5v4h-5z"/></svg>',
      XK:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40">' +
        '<path fill="#244aa5" d="M0 0h60v40H0z"/><path fill="#d4af37" d="M25 17l8-2 5 5-3 7-7 2-5-5z"/>' +
        '<g fill="#fff"><circle cx="15" cy="11" r="1.4"/><circle cx="21" cy="8" r="1.4"/><circle cx="27" cy="6" r="1.4"/><circle cx="33" cy="6" r="1.4"/><circle cx="39" cy="8" r="1.4"/><circle cx="45" cy="11" r="1.4"/></g></svg>',
      DG:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40">' +
        '<path fill="#fff" d="M0 0h60v40H0z"/><path fill="#1e5aa8" d="M0 5h60v4H0zM0 13h60v4H0zM0 21h60v4H0zM0 29h60v4H0zM0 37h60v3H0z"/>' +
        '<path fill="#0a3b78" d="M0 0h24v16H0z"/><path fill="#d71920" d="M10 0h4v16h-4zM0 6h24v4H0z"/>' +
        '<path fill="#138a36" d="M41 18l4-8 2 8 7-2-5 6 6 3h-8l-2 9-2-9h-8l6-3-6-6z"/></svg>'
    };
    if (customFlags[countryCode]) {
      return "data:image/svg+xml;charset=UTF-8," +
        encodeURIComponent(customFlags[countryCode]);
    }
    const country = COUNTRIES.find(x => x.code === countryCode);
    const code = country?.flagCode || countryCode.toLowerCase();
    return `https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.3.2/flags/4x3/${code}.svg`;
  }

  function missionVp(island, row, column) {
    const number = Number.parseInt(island, 10);
    const sector = island.slice(-1);
    if (sector === "C") {
      return VP_VALUES_C[number]?.[row * 4 + column] || 0;
    }
    return VP_VALUES_ABD[number]?.[row * 6 + column] || 0;
  }

  return {
    DAYS,
    MISSION_LOADS,
    COUNTRIES,
    CURATED_TIMEZONES,
    PLAYER_COLORS,
    timeZonesForCountry,
    flagUrl,
    missionVp,
  };
})();
