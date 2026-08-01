const MaratonDataStore = (() => {
  const STORAGE_KEY = "maratonsc-admin-data";
  const AUTO_DURATION_MINUTES = 25;

  const files = {
    manifest: "data/maratonsc-data.json",
    evento: "data/evento.json",
    grupos: "data/grupos.json",
    eliminatoria: "data/eliminatoria.json",
  };

  const toText = (value) => String(value || "").trim();

  const scoreValue = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  };

  const pickField = (obj = {}, keys = [], fallback = undefined) => {
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];
    }
    return fallback;
  };

  const getStored = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch (error) {
      return {};
    }
  };

  const saveStored = (data = {}) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  };

  const clearStored = () => {
    localStorage.removeItem(STORAGE_KEY);
  };

  const loadJson = async (file) => {
    const response = await fetch(`${file}?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`No se pudo leer el archivo ${file}`);
    return response.json();
  };

  const loadBaseData = async () => {
    let manifest = {};
    try {
      manifest = await loadJson(files.manifest);
    } catch (error) {
      manifest = {
        fuentes: {
          evento: files.evento,
          grupos: files.grupos,
          eliminatoria: files.eliminatoria,
        },
      };
    }

    const sources = pickField(manifest, ["fuentes", "sources"], {});
    const [evento, grupos, eliminatoria] = await Promise.all([
      loadJson(sources.evento || files.evento),
      loadJson(sources.grupos || files.grupos),
      loadJson(sources.eliminatoria || files.eliminatoria),
    ]);

    return { manifest, evento, grupos, eliminatoria };
  };

  const loadData = async () => {
    const base = await loadBaseData();
    return {
      ...base,
      ...getStored(),
    };
  };

  const normalizeDatePart = (value) => {
    const raw = toText(value);
    if (!raw) return null;

    const direct = Date.parse(raw);
    if (!Number.isNaN(direct)) return new Date(direct);

    const ddmmy = raw.match(/^\s*(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\s*$/);
    if (!ddmmy) return null;

    const day = Number(ddmmy[1]);
    const month = Number(ddmmy[2]);
    const yearRaw = ddmmy[3];
    const year = yearRaw
      ? yearRaw.length === 2
        ? 2000 + Number(yearRaw)
        : Number(yearRaw)
      : new Date().getFullYear();
    if (Number.isNaN(day) || Number.isNaN(month) || Number.isNaN(year)) return null;

    const parsed = new Date(year, month - 1, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const normalizeTimePart = (value) => {
    const raw = toText(value);
    if (!raw) return null;
    const match = raw.match(/^\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*$/);
    if (!match) return null;

    const hour = Number(match[1]);
    const minute = Number(match[2]);
    const second = Number(match[3] || 0);
    if (Number.isNaN(hour) || Number.isNaN(minute) || Number.isNaN(second)) return null;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) return null;
    return { hour, minute, second };
  };

  const matchStartTime = (match = {}) => {
    const rawDate = toText(pickField(match, ["fecha", "fechaPartido", "fechaDelPartido", "date"], ""));
    const rawTime = toText(pickField(match, ["hora", "time", "horario"], ""));
    const parsedDate = normalizeDatePart(rawDate);
    if (!parsedDate) return null;

    const parsedTime = normalizeTimePart(rawTime);
    if (!parsedTime) return parsedDate.getTime();

    const dateTime = new Date(parsedDate);
    dateTime.setHours(parsedTime.hour, parsedTime.minute, parsedTime.second, 0);
    return dateTime.getTime();
  };

  const durationMinutesValue = (value, fallback = AUTO_DURATION_MINUTES) => {
    const duration = Number(value);
    if (!Number.isFinite(duration) || duration <= 0) return fallback;
    return Math.trunc(duration);
  };

  const eventRoot = (data = {}) => {
    const eventData = data.evento || data.event || data;
    return eventData?.evento || eventData?.event || eventData || {};
  };

  const globalDurationMinutes = (data = {}) => {
    return durationMinutesValue(
      pickField(eventRoot(data), ["duracionPartidosMinutos", "duracionMinutos", "matchDurationMinutes"], AUTO_DURATION_MINUTES),
    );
  };

  const matchDurationMinutes = (match = {}, fallback = AUTO_DURATION_MINUTES) => {
    const duration = Number(
      pickField(match, ["duracionMinutos", "durationMinutes", "duracion", "duration"], fallback),
    );
    return durationMinutesValue(duration, fallback);
  };

  const hasManualResult = (match = {}) => {
    return scoreValue(pickField(match, ["golesLocal", "scoreHome", "golesCasa"], null)) !== null
      && scoreValue(pickField(match, ["golesVisitante", "scoreAway", "golesFuera"], null)) !== null;
  };

  const teamName = (teamObj = {}) => {
    if (typeof teamObj === "string") return toText(teamObj);
    return toText(pickField(teamObj, ["nombre", "name", "equipo", "team"], "Sin nombre"));
  };

  const teamKey = (value) => {
    return toText(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  };

  const emptyStanding = (teamObj = {}, groupCode = "", index = 0) => ({
    ...teamObj,
    nombre: teamName(teamObj),
    group: groupCode,
    index,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    qualify: null,
  });

  const applyStandingResult = (standing, goalsFor, goalsAgainst) => {
    standing.played += 1;
    standing.goalsFor += goalsFor;
    standing.goalsAgainst += goalsAgainst;
    standing.goalDifference = standing.goalsFor - standing.goalsAgainst;
    if (goalsFor > goalsAgainst) {
      standing.won += 1;
      standing.points += 3;
    } else if (goalsFor < goalsAgainst) {
      standing.lost += 1;
    } else {
      standing.drawn += 1;
      standing.points += 1;
    }
  };

  const directMatchComparison = (a, b, directMatches = []) => {
    let aDirectPoints = 0;
    let bDirectPoints = 0;
    let hasDirectMatch = false;

    directMatches.forEach((match) => {
      const aHome = match.homeKey === teamKey(a.nombre);
      const aAway = match.awayKey === teamKey(a.nombre);
      const bHome = match.homeKey === teamKey(b.nombre);
      const bAway = match.awayKey === teamKey(b.nombre);
      if ((!aHome && !aAway) || (!bHome && !bAway)) return;

      const aGoals = aHome ? match.homeGoals : match.awayGoals;
      const bGoals = bHome ? match.homeGoals : match.awayGoals;
      hasDirectMatch = true;

      if (aGoals > bGoals) {
        aDirectPoints += 3;
      } else if (aGoals < bGoals) {
        bDirectPoints += 3;
      } else {
        aDirectPoints += 1;
        bDirectPoints += 1;
      }
    });

    if (!hasDirectMatch || aDirectPoints === bDirectPoints) return 0;
    return bDirectPoints - aDirectPoints;
  };

  const compareGoalDifference = (a, b) => {
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    return a.index - b.index;
  };

  const comparePairTie = (directMatches = []) => (a, b) => {
    const directComparison = directMatchComparison(a, b, directMatches);
    if (directComparison !== 0) return directComparison;
    return compareGoalDifference(a, b);
  };

  const rankStandings = (standings = [], directMatches = []) => {
    const byPoints = new Map();
    standings.forEach((standing) => {
      const bucket = byPoints.get(standing.points) || [];
      bucket.push(standing);
      byPoints.set(standing.points, bucket);
    });

    return [...byPoints.keys()]
      .sort((a, b) => b - a)
      .flatMap((points) => {
        const bucket = byPoints.get(points);
        if (bucket.length === 2) return bucket.sort(comparePairTie(directMatches));
        return bucket.sort(compareGoalDifference);
      });
  };

  const calculateGroupStandings = (groups = {}, matches = []) => {
    const result = {};

    Object.entries(groups || {}).forEach(([groupCode, teams]) => {
      const standings = Array.isArray(teams)
        ? teams.map((teamObj, index) => emptyStanding(teamObj, groupCode, index))
        : [];
      const byName = new Map(standings.map((standing) => [teamKey(standing.nombre), standing]));
      const completedGroupMatches = [];

      (Array.isArray(matches) ? matches : [])
        .filter((match) => toText(match.grupo) === toText(groupCode))
        .forEach((match) => {
          const homeGoals = scoreValue(pickField(match, ["golesLocal", "scoreHome", "golesCasa"], null));
          const awayGoals = scoreValue(pickField(match, ["golesVisitante", "scoreAway", "golesFuera"], null));
          if (homeGoals === null || awayGoals === null) return;

          const homeStanding = byName.get(teamKey(pickField(match, ["local", "teamHome", "equipoLocal", "home"], "")));
          const awayStanding = byName.get(teamKey(pickField(match, ["visitante", "teamAway", "equipoVisitante", "away"], "")));
          if (homeStanding) applyStandingResult(homeStanding, homeGoals, awayGoals);
          if (awayStanding) applyStandingResult(awayStanding, awayGoals, homeGoals);
          if (homeStanding && awayStanding) {
            completedGroupMatches.push({
              homeKey: teamKey(homeStanding.nombre),
              awayKey: teamKey(awayStanding.nombre),
              homeGoals,
              awayGoals,
            });
          }
        });

      result[groupCode] = rankStandings(standings, completedGroupMatches);
      const eliminatedCount = result[groupCode].length > 1 ? 1 : 0;
      result[groupCode].forEach((standing, position) => {
        standing.qualify = position < result[groupCode].length - eliminatedCount ? "directo" : null;
      });
    });

    return result;
  };

  const getTimedStatus = (match = {}, now = Date.now(), durationFallback = AUTO_DURATION_MINUTES) => {
    const status = toText(pickField(match, ["estado", "status"], "Programado"));
    if (status === "Disputando" || status === "Finalizado") return status;
    return "Programado";
  };

  const applyAutomaticStatusesToMatches = (matches = [], now = Date.now(), durationFallback = AUTO_DURATION_MINUTES) => {
    if (!Array.isArray(matches)) return matches;
    return matches.map((match) => ({
      ...match,
      estado: getTimedStatus(match, now, durationFallback),
    }));
  };

  const applyAutomaticStatuses = (data = {}, now = Date.now()) => {
    const copy = JSON.parse(JSON.stringify(data));
    const durationFallback = globalDurationMinutes(copy);
    if (copy.grupos?.partidos) {
      copy.grupos.partidos = applyAutomaticStatusesToMatches(copy.grupos.partidos, now, durationFallback);
    }

    const elimination = copy.eliminatoria?.eliminatoria || copy.eliminatoria;
    if (elimination?.cuartosDeFinal) {
      elimination.cuartosDeFinal = applyAutomaticStatusesToMatches(elimination.cuartosDeFinal, now, durationFallback);
    }
    if (elimination?.semifinales) {
      elimination.semifinales = applyAutomaticStatusesToMatches(elimination.semifinales, now, durationFallback);
    }
    if (elimination?.final) {
      elimination.final = {
        ...elimination.final,
        estado: getTimedStatus(elimination.final, now, durationFallback),
      };
    }
    if (elimination?.tercerPuesto) {
      elimination.tercerPuesto = {
        ...elimination.tercerPuesto,
        estado: getTimedStatus(elimination.tercerPuesto, now, durationFallback),
      };
    }
    return copy;
  };

  const downloadJson = (filename, data) => {
    const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return {
    STORAGE_KEY,
    files,
    getStored,
    saveStored,
    clearStored,
    loadData,
    loadBaseData,
    loadJson,
    downloadJson,
    applyAutomaticStatuses,
    calculateGroupStandings,
    getTimedStatus,
    matchDurationMinutes,
    globalDurationMinutes,
    toText,
  };
})();
