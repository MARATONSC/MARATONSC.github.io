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

  const getTimedStatus = (match = {}, now = Date.now(), durationFallback = AUTO_DURATION_MINUTES) => {
    const status = toText(pickField(match, ["estado", "status"], "Programado"));
    if (status === "Finalizado" && hasManualResult(match)) return "Finalizado";
    if (match.estadoManual === true || match.manualStatus === true) return status || "Programado";

    const start = matchStartTime(match);
    if (start === null) return status || "Programado";

    const end = start + durationMinutesValue(durationFallback) * 60 * 1000;
    if (now < start) return "Programado";
    if (now < end) return "Disputando";
    return "Finalizado";
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
    getTimedStatus,
    matchDurationMinutes,
    globalDurationMinutes,
    toText,
  };
})();
