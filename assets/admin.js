const AdminApp = (() => {
  const PIN_SESSION_KEY = "maratonsc-admin-unlocked";
  const GITHUB_TOKEN_STORAGE_KEY = "maratonsc-github-token";
  const PIN_HASH = "158a323a7ba44870f23d96f1516dd70aa48e9a72db4ebb026b0a89e212a208ab";
  const GITHUB_REPO_CONFIG = {
    owner: "MARATONSC",
    repo: "MARATONSC.github.io",
    branch: "main",
    message: "Actualizar datos del campeonato",
  };

  const refs = {
    body: document.body,
    pinForm: document.getElementById("pin-form"),
    pinInput: document.getElementById("admin-pin"),
    pinMessage: document.getElementById("pin-message"),
    content: document.getElementById("admin-content"),
    message: document.getElementById("admin-message"),
    logout: document.getElementById("logout-admin"),
    tabs: document.querySelectorAll(".admin-tab"),
    reloadBase: document.getElementById("reload-base"),
    githubToken: document.getElementById("github-token"),
    githubRememberToken: document.getElementById("github-remember-token"),
    publishGithub: document.getElementById("publish-github"),
    summaryTeams: document.getElementById("summary-teams"),
    summaryMatches: document.getElementById("summary-matches"),
    summaryLive: document.getElementById("summary-live"),
    summaryFinished: document.getElementById("summary-finished"),
  };

  let state = {
    evento: {},
    grupos: { grupos: {}, partidos: [] },
    eliminatoria: { eliminatoria: {} },
  };
  const pendingSponsorAssets = new Map();
  let activeSection = "event";
  let activeGroupMatchFilter = "all";

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const text = (value) => String(value || "").trim();
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  })[char]);

  const setMessage = (message, isError = false) => {
    refs.message.textContent = message;
    refs.message.classList.toggle("is-error", isError);
  };

  const jsonText = (value) => `${JSON.stringify(value, null, 2)}\n`;

  const toBase64 = (value) => {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  };

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const [, content = ""] = result.split(",");
      resolve(content);
    };
    reader.onerror = () => reject(reader.error || new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });

  const imageExtension = (file) => {
    const allowedExtensions = new Set(["gif", "jpeg", "jpg", "png", "svg", "webp"]);
    const fromName = text(file?.name).match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
    if (fromName && allowedExtensions.has(fromName)) return fromName;
    const byType = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "image/svg+xml": "svg",
    };
    return byType[file?.type] || "";
  };

  const sponsorAssetSlug = (value, fallback) => {
    const slug = text(value || fallback)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    return slug || "patrocinador";
  };

  const sponsorAssetFilename = (sponsor, file, index) => {
    const extension = imageExtension(file);
    if (!extension) return "";
    const base = sponsorAssetSlug(sponsor.nombre, text(file.name).replace(/\.[a-z0-9]+$/i, "") || `patrocinador_${index + 1}`);
    return `${base}.${extension}`;
  };

  const sponsorImageFilename = (imageName) => {
    return text(imageName).replace(/^assets\/sponsors\//i, "").replace(/^\/+/, "");
  };

  const uniqueSponsorAssetFilename = (fileName, sponsors = [], sponsorIndex = -1) => {
    const used = new Set(
      sponsors
        .map((sponsor, index) => (index === sponsorIndex ? "" : sponsorImageFilename(sponsor?.imagen)))
        .filter(Boolean),
    );
    const match = fileName.match(/^(.*?)(\.[^.]+)$/);
    const base = match ? match[1] : fileName;
    const extension = match ? match[2] : "";
    let candidate = fileName;
    let counter = 2;
    while (used.has(candidate) || pendingSponsorAssets.has(`assets/sponsors/${candidate}`)) {
      candidate = `${base}_${counter}${extension}`;
      counter += 1;
    }
    return candidate;
  };

  const pendingSponsorAssetFor = (imageName) => {
    const filename = sponsorImageFilename(imageName);
    return filename ? pendingSponsorAssets.get(`assets/sponsors/${filename}`) : null;
  };

  const clearPendingSponsorAssetFor = (imageName) => {
    const filename = sponsorImageFilename(imageName);
    if (!filename) return;
    const asset = pendingSponsorAssets.get(`assets/sponsors/${filename}`);
    if (asset?.previewUrl) URL.revokeObjectURL(asset.previewUrl);
    pendingSponsorAssets.delete(`assets/sponsors/${filename}`);
  };

  const sponsorImagePath = (imageName) => {
    const raw = text(imageName);
    if (!raw) return "";
    if (/^(https?:\/\/|\/|data:)/i.test(raw)) return raw;
    const filename = sponsorImageFilename(raw);
    if (/\.[a-z0-9]+$/i.test(filename)) return `assets/sponsors/${filename}`;
    return `assets/sponsors/${filename}.jpeg`;
  };

  const sponsorUploadPreview = (sponsor) => {
    const pendingAsset = pendingSponsorAssetFor(sponsor.imagen);
    const imageSrc = pendingAsset?.previewUrl || sponsorImagePath(sponsor.imagen);
    const status = pendingAsset
      ? `<strong>Pendiente:</strong> ${escapeHtml(pendingAsset.fileName)}`
      : text(sponsor.imagen)
        ? escapeHtml(text(sponsor.imagen))
        : "Sin imagen seleccionada";

    return `
      <div class="sponsor-upload-preview">
        ${imageSrc ? `<img src="${escapeHtml(imageSrc)}" alt="" />` : `<span>Sin imagen</span>`}
        <p>${status}</p>
      </div>
    `;
  };

  const sha256 = async (value) => {
    const bytes = new TextEncoder().encode(value);
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(hash))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  };

  const unlock = async () => {
    refs.body.classList.remove("is-locked");
    sessionStorage.setItem(PIN_SESSION_KEY, "true");
    state = await MaratonDataStore.loadData();
    render();
  };

  const lock = () => {
    sessionStorage.removeItem(PIN_SESSION_KEY);
    refs.body.classList.add("is-locked");
    refs.pinInput.value = "";
    refs.pinMessage.textContent = "";
    refs.pinInput.focus();
  };

  const bindPinGate = () => {
    refs.pinForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      refs.pinMessage.textContent = "";
      try {
        if (await sha256(refs.pinInput.value) === PIN_HASH) {
          await unlock();
          return;
        }
        refs.pinMessage.textContent = "PIN incorrecto.";
        refs.pinInput.select();
      } catch (error) {
        refs.pinMessage.textContent = "No se pudo validar el PIN.";
      }
    });

    refs.logout.addEventListener("click", lock);
  };

  const input = (label, value, onInput, attrs = "") => {
    const safeValue = escapeHtml(value);
    return `
      <label class="admin-field">
        <span>${label}</span>
        <input ${attrs} value="${safeValue}" />
      </label>
    `;
  };

  const textarea = (label, value) => `
    <label class="admin-field">
      <span>${label}</span>
      <textarea spellcheck="false">${escapeHtml(value)}</textarea>
    </label>
  `;

  const ensureEventRoot = () => {
    if (state.evento.evento) return state.evento.evento;
    if (state.evento.event) return state.evento.event;
    return state.evento;
  };

  const ensureGroupsRoot = () => {
    state.grupos.grupos = state.grupos.grupos || state.grupos.groups || {};
    state.grupos.partidos = Array.isArray(state.grupos.partidos) ? state.grupos.partidos : [];
    return state.grupos;
  };

  const ensureEliminationRoot = () => {
    state.eliminatoria.eliminatoria = state.eliminatoria.eliminatoria || state.eliminatoria.elimination || {};
    const root = state.eliminatoria.eliminatoria;
    root.cuartosDeFinal = Array.isArray(root.cuartosDeFinal) ? root.cuartosDeFinal : [];
    root.semifinales = Array.isArray(root.semifinales) ? root.semifinales : [];
    root.tercerPuesto = root.tercerPuesto || {};
    root.final = root.final || {};
    return root;
  };

  const allMatches = () => {
    const groups = ensureGroupsRoot();
    const elimination = ensureEliminationRoot();
    return [
      ...groups.partidos,
      ...elimination.cuartosDeFinal,
      ...elimination.semifinales,
      elimination.tercerPuesto,
      elimination.final,
    ].filter(Boolean);
  };

  const globalDuration = () => {
    return MaratonDataStore.globalDurationMinutes({ evento: state.evento });
  };

  const setGlobalDuration = (value) => {
    const event = ensureEventRoot();
    const duration = Number(value);
    event.duracionPartidosMinutos = Number.isFinite(duration) && duration > 0 ? Math.trunc(duration) : 25;
  };

  const updateSummary = () => {
    const groups = ensureGroupsRoot().grupos;
    const teamCount = Object.values(groups).reduce((sum, teams) => {
      return sum + (Array.isArray(teams) ? teams.length : 0);
    }, 0);
    const duration = globalDuration();
    const timed = allMatches().map((match) => MaratonDataStore.getTimedStatus(match, Date.now(), duration));
    refs.summaryTeams.textContent = teamCount;
    refs.summaryMatches.textContent = allMatches().length;
    refs.summaryLive.textContent = timed.filter((status) => status === "Disputando").length;
    refs.summaryFinished.textContent = timed.filter((status) => status === "Finalizado").length;
  };

  const persistChanges = (message = "Cambios aplicados automáticamente. Ya puedes publicarlos en GitHub.") => {
    MaratonDataStore.saveStored(clone(state));
    updateSummary();
    setMessage(message);
  };

  const githubConfig = () => ({
    ...GITHUB_REPO_CONFIG,
    token: refs.githubToken.value.trim(),
  });

  const loadStoredGithubToken = () => {
    const token = localStorage.getItem(GITHUB_TOKEN_STORAGE_KEY) || "";
    refs.githubToken.value = token;
    refs.githubRememberToken.checked = Boolean(token);
  };

  const syncStoredGithubToken = () => {
    if (refs.githubRememberToken.checked && refs.githubToken.value.trim()) {
      localStorage.setItem(GITHUB_TOKEN_STORAGE_KEY, refs.githubToken.value.trim());
      return;
    }
    localStorage.removeItem(GITHUB_TOKEN_STORAGE_KEY);
  };

  const githubHeaders = (token) => ({
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  });

  const githubRequest = async (url, options = {}) => {
    const response = await fetch(url, options);
    let payload = null;
    try {
      payload = await response.json();
    } catch (error) {
      payload = null;
    }
    if (!response.ok) {
      const message = payload?.message || `Error HTTP ${response.status}`;
      throw new Error(message);
    }
    return payload;
  };

  const githubApiBase = (config) => {
    return `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}`;
  };

  const createGithubCommit = async (config, files) => {
    const base = githubApiBase(config);
    const branchRef = `heads/${encodeURIComponent(config.branch)}`;
    const currentRef = await githubRequest(`${base}/git/ref/${branchRef}`, {
      method: "GET",
      headers: githubHeaders(config.token),
    });
    const headSha = currentRef.object.sha;
    const headCommit = await githubRequest(`${base}/git/commits/${headSha}`, {
      method: "GET",
      headers: githubHeaders(config.token),
    });

    const treeItems = [];
    for (const file of files) {
      const path = Array.isArray(file) ? file[0] : file.path;
      const data = Array.isArray(file) ? file[1] : file.data;
      const content = Array.isArray(file) || file.data !== undefined ? toBase64(jsonText(data)) : file.content;
      const encoding = file.encoding || "base64";
      setMessage(`Preparando ${path}...`);
      const blob = await githubRequest(`${base}/git/blobs`, {
        method: "POST",
        headers: githubHeaders(config.token),
        body: JSON.stringify({
          content,
          encoding,
        }),
      });
      treeItems.push({
        path,
        mode: "100644",
        type: "blob",
        sha: blob.sha,
      });
    }

    setMessage("Creando commit en GitHub...");
    const tree = await githubRequest(`${base}/git/trees`, {
      method: "POST",
      headers: githubHeaders(config.token),
      body: JSON.stringify({
        base_tree: headCommit.tree.sha,
        tree: treeItems,
      }),
    });
    const commit = await githubRequest(`${base}/git/commits`, {
      method: "POST",
      headers: githubHeaders(config.token),
      body: JSON.stringify({
        message: config.message,
        tree: tree.sha,
        parents: [headSha],
      }),
    });

    setMessage("Actualizando rama...");
    await githubRequest(`${base}/git/refs/${branchRef}`, {
      method: "PATCH",
      headers: githubHeaders(config.token),
      body: JSON.stringify({
        sha: commit.sha,
        force: false,
      }),
    });
    return commit;
  };

  const publishToGithub = async () => {
    const config = githubConfig();
    if (!config.owner || !config.repo || !config.token) {
      setMessage("Rellena propietario, repositorio y token de GitHub antes de publicar.", true);
      return;
    }

    syncStoredGithubToken();
    refs.publishGithub.disabled = true;
    MaratonDataStore.saveStored(clone(state));
    const files = [
      ["data/evento.json", state.evento],
      ["data/grupos.json", state.grupos],
      ["data/eliminatoria.json", state.eliminatoria],
      ...Array.from(pendingSponsorAssets.values()).map((asset) => ({
        path: asset.path,
        content: asset.content,
        encoding: "base64",
      })),
    ];

    try {
      await createGithubCommit(config, files);
      pendingSponsorAssets.clear();
      setMessage("Datos publicados en GitHub en un único commit. GitHub Pages actualizará la web en unos minutos.");
    } catch (error) {
      setMessage(`No se pudo publicar en GitHub: ${error.message}`, true);
    } finally {
      refs.publishGithub.disabled = false;
    }
  };

  const render = () => {
    if (activeSection === "matches") activeSection = "groups";
    refs.tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.adminSection === activeSection));
    if (activeSection === "event") renderEvent();
    if (activeSection === "groups") renderGroups();
    if (activeSection === "elimination") renderElimination();
    if (activeSection === "sponsors") renderSponsors();
    if (activeSection === "json") renderJson();
    updateSummary();
  };

  const bindField = (selector, callback, eventName = "input") => {
    refs.content.querySelector(selector)?.addEventListener(eventName, (event) => {
      callback(event.target);
      persistChanges();
    });
  };

  const renderEvent = () => {
    const event = ensureEventRoot();
    refs.content.innerHTML = `
      <div class="admin-section-head">
        <div>
          <h2>Evento</h2>
          <p class="small">Datos generales visibles en el encabezado, ubicación y pie de página.</p>
        </div>
      </div>
      <div class="admin-grid">
        ${input("Organización", event.organizacion, null, 'data-field="organizacion"')}
        ${input("Fecha visible", event.fecha, null, 'data-field="fecha"')}
        ${input("Duración partidos (min.)", event.duracionPartidosMinutos || globalDuration(), null, 'type="number" min="1" data-field="duracionPartidosMinutos"')}
        ${input("Lugar", event.lugar, null, 'data-field="lugar"')}
        ${input("URL o búsqueda de Google Maps", event.mapa || event.map_url || "", null, 'data-field="mapa"')}
      </div>
    `;
    refs.content.querySelectorAll("[data-field]").forEach((field) => {
      field.addEventListener("input", () => {
        if (field.dataset.field === "duracionPartidosMinutos") {
          setGlobalDuration(field.value);
        } else {
          event[field.dataset.field] = field.value;
        }
        persistChanges();
      });
    });
  };

  const renderGroups = () => {
    const groupsRoot = ensureGroupsRoot();
    const groups = groupsRoot.grupos;
    const matchGroups = groupCodesForFilter(groups, groupsRoot.partidos);
    if (activeGroupMatchFilter !== "all" && !matchGroups.includes(activeGroupMatchFilter)) {
      activeGroupMatchFilter = "all";
    }
    const visibleMatches = groupsRoot.partidos
      .map((match, sourceIndex) => ({ match, sourceIndex }))
      .filter(({ match }) => activeGroupMatchFilter === "all" || text(match.grupo) === activeGroupMatchFilter);

    refs.content.innerHTML = `
      <div class="admin-section-head">
        <div>
          <h2>Fase de grupos</h2>
          <p class="small">Equipos, clasificación calculada y resultados de la fase de grupos.</p>
        </div>
        <button id="add-group" type="button">Añadir grupo</button>
      </div>
      <div id="admin-groups-list" class="admin-list">
        ${groupCardsMarkup(groups)}
      </div>
      <section class="admin-group-matches" aria-label="Partidos de fase de grupos">
        <div class="admin-section-head">
          <div>
            <h2>Resultados de grupos</h2>
            <p class="small">Anota aquí los partidos de la fase de grupos. Las tablas superiores se recalculan con estos resultados.</p>
          </div>
        </div>
        ${durationSetting()}
        ${groupMatchFilter(matchGroups)}
        ${matchTable(visibleMatches, "group")}
      </section>
    `;

    refs.content.querySelector("#add-group")?.addEventListener("click", () => {
      const next = window.prompt("Código del grupo", "D");
      if (!next) return;
      const code = next.trim().toUpperCase();
      if (!code) return;
      groups[code] = groups[code] || [];
      persistChanges();
      render();
    });

    bindGroupControls(groups);
    bindDurationSetting();
    bindGroupMatchFilter();
    bindMatchTable(groupsRoot.partidos, "group");
  };

  const groupCardsMarkup = (groups = {}) => {
    const standings = MaratonDataStore.calculateGroupStandings(groups, ensureGroupsRoot().partidos);
    return Object.entries(groups).map(([groupCode]) => groupCard(groupCode, standings[groupCode] || [])).join("");
  };

  const refreshAdminGroupStandings = () => {
    const groups = ensureGroupsRoot().grupos;
    const list = refs.content.querySelector("#admin-groups-list");
    if (!list) return;
    list.innerHTML = groupCardsMarkup(groups);
    bindGroupControls(groups);
  };

  const bindGroupControls = (groups) => {
    refs.content.querySelectorAll("[data-team-field]").forEach((field) => {
      field.addEventListener("input", () => {
        const teams = groups[field.dataset.group] || [];
        const team = teams[Number(field.dataset.index)];
        if (!team) return;
        team.nombre = field.value;
        persistChanges();
      });
    });

    refs.content.querySelectorAll("[data-add-team]").forEach((button) => {
      button.addEventListener("click", () => {
        groups[button.dataset.addTeam].push({ nombre: "Nuevo equipo" });
        persistChanges();
        render();
      });
    });

    refs.content.querySelectorAll("[data-delete-team]").forEach((button) => {
      button.addEventListener("click", () => {
        groups[button.dataset.group].splice(Number(button.dataset.deleteTeam), 1);
        persistChanges();
        render();
      });
    });

    refs.content.querySelectorAll("[data-delete-group]").forEach((button) => {
      button.addEventListener("click", () => {
        delete groups[button.dataset.deleteGroup];
        persistChanges();
        render();
      });
    });
  };

  const groupCard = (groupCode, teams = []) => `
    <article class="admin-card">
      <div class="admin-card-head">
        <h3>Grupo ${groupCode}</h3>
        <div class="admin-header-actions">
          <button type="button" data-add-team="${groupCode}">Añadir equipo</button>
          <button type="button" class="danger-button" data-delete-group="${groupCode}">Eliminar grupo</button>
        </div>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Equipo</th>
              <th>Pts</th>
              <th>PJ</th>
              <th>G</th>
              <th>E</th>
              <th>P</th>
              <th>GF</th>
              <th>GC</th>
              <th>Dif</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${teams.map((team) => `
              <tr class="${team.qualify ? "standing-qualified" : "standing-eliminated"}">
                <td><input data-group="${groupCode}" data-index="${team.index}" data-team-field="nombre" value="${escapeHtml(team.nombre)}" /></td>
                <td>${team.points}</td>
                <td>${team.played}</td>
                <td>${team.won}</td>
                <td>${team.drawn}</td>
                <td>${team.lost}</td>
                <td>${team.goalsFor}</td>
                <td>${team.goalsAgainst}</td>
                <td>${team.goalDifference}</td>
                <td>${team.qualify ? "Clasifica" : "Eliminado"}</td>
                <td><button type="button" class="danger-button" data-group="${groupCode}" data-delete-team="${team.index}">Eliminar</button></td>
              </tr>
            `).join("")}
            ${teams.length ? "" : `<tr class="muted"><td colspan="10">Sin equipos definidos</td></tr>`}
          </tbody>
        </table>
      </div>
    </article>
  `;

  const renderGroupMatches = () => {
    const groups = ensureGroupsRoot();
    const matchGroups = groupCodesFromMatches(groups.partidos);
    if (activeGroupMatchFilter !== "all" && !matchGroups.includes(activeGroupMatchFilter)) {
      activeGroupMatchFilter = "all";
    }
    const visibleMatches = groups.partidos
      .map((match, sourceIndex) => ({ match, sourceIndex }))
      .filter(({ match }) => activeGroupMatchFilter === "all" || text(match.grupo) === activeGroupMatchFilter);

    refs.content.innerHTML = `
      <div class="admin-section-head">
        <div>
          <h2>Partidos de grupos</h2>
          <p class="small">Goles, horarios y estado de cada partido.</p>
        </div>
      </div>
      ${durationSetting()}
      ${groupMatchFilter(matchGroups)}
      ${matchTable(visibleMatches, "group")}
    `;
    bindDurationSetting();
    bindGroupMatchFilter();
    bindMatchTable(groups.partidos, "group");
  };

  const renderElimination = () => {
    const elimination = ensureEliminationRoot();
    refs.content.innerHTML = `
      <div class="admin-section-head">
        <div>
          <h2>Eliminatoria</h2>
          <p class="small">Cruces, horarios, goles y estado de la fase eliminatoria.</p>
        </div>
      </div>
      ${durationSetting()}
      <article class="admin-card">
        <div class="admin-card-head">
          <h3>Cuartos de final</h3>
        </div>
        ${matchTable(elimination.cuartosDeFinal.map((match, sourceIndex) => ({ match, sourceIndex })), "quarter")}
      </article>
      <article class="admin-card">
        <div class="admin-card-head">
          <h3>Semifinales</h3>
        </div>
        ${matchTable(elimination.semifinales.map((match, sourceIndex) => ({ match, sourceIndex })), "semi")}
      </article>
      <article class="admin-card">
        <div class="admin-card-head"><h3>3.º y 4.º puesto</h3></div>
        ${matchTable([{ match: elimination.tercerPuesto, sourceIndex: 0 }], "third")}
      </article>
      <article class="admin-card">
        <div class="admin-card-head"><h3>Final</h3></div>
        ${matchTable([{ match: elimination.final, sourceIndex: 0 }], "final")}
      </article>
    `;
    bindDurationSetting();
    bindMatchTable(elimination.cuartosDeFinal, "quarter");
    bindMatchTable(elimination.semifinales, "semi");
    bindMatchTable([elimination.tercerPuesto], "third", false);
    bindMatchTable([elimination.final], "final", false);
  };

  const matchTable = (matches = [], key) => `
    <div class="match-editor-list">
      ${matches.length
        ? matches.map((entry) => matchRow(entry.match || {}, key, entry.sourceIndex)).join("")
        : `<p class="muted">Sin partidos cargados.</p>`}
    </div>
  `;

  const scoreForInput = (value) => value === null || value === undefined ? "" : value;

  const uniqueValues = (values = []) => {
    return [...new Set(values.map(text).filter(Boolean))];
  };

  const groupCodesFromMatches = (matches = []) => {
    return uniqueValues(matches.map((match) => match.grupo)).sort((a, b) => a.localeCompare(b, "es"));
  };

  const groupCodesForFilter = (groups = {}, matches = []) => {
    return uniqueValues([...Object.keys(groups || {}), ...matches.map((match) => match.grupo)])
      .sort((a, b) => a.localeCompare(b, "es"));
  };

  const teamNames = () => {
    const groups = ensureGroupsRoot().grupos;
    return uniqueValues(
      Object.values(groups).flatMap((teams) => {
        return Array.isArray(teams) ? teams.map((team) => team.nombre) : [];
      }),
    ).sort((a, b) => a.localeCompare(b, "es"));
  };

  const optionList = (values = [], selected = "", emptyLabel = "Por definir") => {
    const selectedText = text(selected);
    const options = uniqueValues([selectedText, ...values]);
    return [
      `<option value="" ${selectedText ? "" : "selected"}>${emptyLabel}</option>`,
      ...options.map((value) => {
        return `<option value="${escapeHtml(value)}" ${value === selectedText ? "selected" : ""}>${escapeHtml(value)}</option>`;
      }),
    ].join("");
  };

  const teamSelect = (field, match, key, index) => {
    const specialOptions = [
      "1ºA", "2ºA", "1ºB", "2ºB", "1ºC", "2ºC",
      "1ºRes", "2ºRes",
      "Ganador Q1", "Ganador Q2", "Ganador Q3", "Ganador Q4",
      "Ganador SF1", "Ganador SF2", "Perdedor SF1", "Perdedor SF2",
    ];
    const value = match[field];
    return `
      <select class="team-select" data-match-key="${key}" data-match-index="${index}" data-match-field="${field}">
        ${optionList([...teamNames(), ...specialOptions], value)}
      </select>
    `;
  };

  const groupOrPhaseLabel = (match, key) => {
    if (key !== "group") return text(match.fase) || "Sin fase";
    return text(match.grupo) ? `Grupo ${text(match.grupo)}` : "Sin grupo";
  };

  const durationSetting = () => `
    <label class="global-duration-field">
      <span>Duración global de partidos</span>
      <input type="number" min="1" value="${globalDuration()}" data-global-duration />
      <span>min.</span>
    </label>
  `;

  const groupMatchFilter = (groups = []) => `
    <label class="match-group-filter">
      <span>Grupo</span>
      <select data-group-match-filter>
        <option value="all" ${activeGroupMatchFilter === "all" ? "selected" : ""}>Todos los grupos</option>
        ${groups.map((groupCode) => `
          <option value="${escapeHtml(groupCode)}" ${activeGroupMatchFilter === groupCode ? "selected" : ""}>
            Grupo ${escapeHtml(groupCode)}
          </option>
        `).join("")}
      </select>
    </label>
  `;

  const bindGroupMatchFilter = () => {
    refs.content.querySelector("[data-group-match-filter]")?.addEventListener("change", (event) => {
      activeGroupMatchFilter = event.target.value;
      renderGroups();
    });
  };

  const bindDurationSetting = () => {
    refs.content.querySelectorAll("[data-global-duration]").forEach((field) => {
      field.addEventListener("input", () => {
        setGlobalDuration(field.value);
        persistChanges();
        refreshMatchStatuses();
      });
    });
  };

  const effectiveStatus = (match) => {
    const automaticStatus = MaratonDataStore.getTimedStatus(match, Date.now(), globalDuration());
    if (match.estadoManual === true || match.manualStatus === true) {
      return text(match.estado) || automaticStatus || "Programado";
    }
    return automaticStatus || "Programado";
  };

  const scoreControl = (label, field, match, key, index) => `
    <div class="score-stepper" aria-label="${label}">
      <span>${label}</span>
      <div>
        <button type="button" class="score-button" data-match-key="${key}" data-match-index="${index}" data-score-field="${field}" data-score-step="-1">-</button>
        <input class="score-input" type="number" min="0" data-match-key="${key}" data-match-index="${index}" data-match-field="${field}" value="${scoreForInput(match[field])}" />
        <button type="button" class="score-button" data-match-key="${key}" data-match-index="${index}" data-score-field="${field}" data-score-step="1">+</button>
      </div>
    </div>
  `;

  const matchRow = (match, key, index) => {
    const automaticStatus = MaratonDataStore.getTimedStatus(match, Date.now(), globalDuration());
    const manual = match.estadoManual === true || match.manualStatus === true;
    const currentStatus = effectiveStatus(match);
    return `
      <article class="match-editor-card">
        <div class="match-card-head">
          <span class="match-phase-badge">${escapeHtml(groupOrPhaseLabel(match, key))}</span>
          <div class="match-date-time">
            <label>
              <span>Fecha</span>
              <input class="date-input" type="date" data-match-key="${key}" data-match-index="${index}" data-match-field="fecha" value="${text(match.fecha)}" />
            </label>
            <label>
              <span>Hora</span>
              <input class="time-input" type="time" data-match-key="${key}" data-match-index="${index}" data-match-field="hora" value="${text(match.hora)}" />
            </label>
          </div>
        </div>
        <div class="match-scoreboard">
          <div class="match-team-row">
            ${teamSelect("local", match, key, index)}
            ${scoreControl("Local", "golesLocal", match, key, index)}
          </div>
          <div class="match-team-row">
            ${teamSelect("visitante", match, key, index)}
            ${scoreControl("Visitante", "golesVisitante", match, key, index)}
          </div>
        </div>
        <div class="match-state-row">
          <span>Estado</span>
          <button type="button" class="status-next-button ${escapeHtml(currentStatus)}" data-match-key="${key}" data-match-index="${index}" data-next-status>
            ${escapeHtml(currentStatus)}
          </button>
          <span class="status-pill ${automaticStatus}">${manual ? "Manual" : automaticStatus}</span>
        </div>
      </article>
    `;
  };

  const getMatchCollection = (key) => {
    const groups = ensureGroupsRoot();
    const elimination = ensureEliminationRoot();
    if (key === "group") return groups.partidos;
    if (key === "quarter") return elimination.cuartosDeFinal;
    if (key === "semi") return elimination.semifinales;
    if (key === "third") return [elimination.tercerPuesto];
    if (key === "final") return [elimination.final];
    return [];
  };

  const bindMatchTable = (matches, key) => {
    refs.content.querySelectorAll(`[data-match-key="${key}"][data-match-field]`).forEach((field) => {
      const eventName = field.type === "checkbox" || field.tagName === "SELECT" ? "change" : "input";
      field.addEventListener(eventName, () => {
        const collection = getMatchCollection(key);
        const match = collection[Number(field.dataset.matchIndex)];
        if (!match) return;
        const fieldName = field.dataset.matchField;
        if (fieldName === "golesLocal" || fieldName === "golesVisitante") {
          match[fieldName] = field.value === "" ? null : Number(field.value);
        } else if (fieldName === "duracionMinutos") {
          match[fieldName] = Number(field.value) || 25;
        } else if (fieldName === "estadoManual") {
          match.estadoManual = field.checked;
        } else {
          match[fieldName] = field.value;
        }
        updateMatchRowStatus(field.closest(".match-editor-card"), match);
        persistChanges();
        if (key === "group") refreshAdminGroupStandings();
      });
    });

    refs.content.querySelectorAll(`[data-score-step][data-match-key="${key}"]`).forEach((button) => {
      button.addEventListener("click", () => {
        const collection = getMatchCollection(key);
        const match = collection[Number(button.dataset.matchIndex)];
        if (!match) return;

        const fieldName = button.dataset.scoreField;
        const current = Number(match[fieldName]);
        const baseValue = Number.isFinite(current) ? current : 0;
        match[fieldName] = Math.max(0, baseValue + Number(button.dataset.scoreStep));

        const row = button.closest(".match-editor-card");
        const input = row?.querySelector(`[data-match-field="${fieldName}"]`);
        if (input) input.value = match[fieldName];
        updateMatchRowStatus(row, match);
        persistChanges();
        if (key === "group") refreshAdminGroupStandings();
      });
    });

    refs.content.querySelectorAll(`[data-next-status][data-match-key="${key}"]`).forEach((button) => {
      button.addEventListener("click", () => {
        const collection = getMatchCollection(key);
        const match = collection[Number(button.dataset.matchIndex)];
        if (!match) return;

        match.estado = nextStatus(effectiveStatus(match));
        match.estadoManual = true;
        updateMatchRowStatus(button.closest(".match-editor-card"), match);
        persistChanges();
        if (key === "group") refreshAdminGroupStandings();
      });
    });
  };

  const updateMatchRowStatus = (row, match) => {
    const pill = row?.querySelector(".status-pill");
    const button = row?.querySelector("[data-next-status]");
    const status = MaratonDataStore.getTimedStatus(match, Date.now(), globalDuration());
    const currentStatus = effectiveStatus(match);
    if (button) {
      button.className = `status-next-button ${currentStatus}`;
      button.textContent = currentStatus;
    }
    if (!pill) return;
    pill.className = `status-pill ${status}`;
    pill.textContent = match.estadoManual === true || match.manualStatus === true ? "Manual" : status;
  };

  const refreshMatchStatuses = () => {
    refs.content.querySelectorAll(".match-editor-card").forEach((card) => {
      const source = card.querySelector("[data-match-key]");
      if (!source) return;
      const collection = getMatchCollection(source.dataset.matchKey);
      const match = collection[Number(source.dataset.matchIndex)];
      if (match) updateMatchRowStatus(card, match);
    });
  };

  const nextStatus = (status) => {
    const order = ["Programado", "Disputando", "Finalizado"];
    const current = text(status);
    const index = order.indexOf(current);
    return order[(index + 1) % order.length];
  };

  const renderSponsors = () => {
    const event = ensureEventRoot();
    event.patrocinadores = Array.isArray(event.patrocinadores) ? event.patrocinadores : [];
    refs.content.innerHTML = `
      <div class="admin-section-head">
        <div>
          <h2>Patrocinadores</h2>
          <p class="small">Imagen y enlace de cada patrocinador.</p>
        </div>
        <button id="add-sponsor" type="button">Añadir patrocinador</button>
      </div>
      <div class="admin-list">
        ${event.patrocinadores.map((sponsor, index) => `
          <article class="admin-card">
            <div class="admin-card-head">
              <h3>Patrocinador ${index + 1}</h3>
              <button type="button" class="danger-button" data-delete-sponsor="${index}">Eliminar</button>
            </div>
            <div class="admin-grid">
              ${input("Nombre", sponsor.nombre || "", null, `data-sponsor-index="${index}" data-sponsor-field="nombre"`)}
              ${input("Imagen", sponsor.imagen || "", null, `data-sponsor-index="${index}" data-sponsor-field="imagen"`)}
              ${input("Enlace", sponsor.enlace || "", null, `data-sponsor-index="${index}" data-sponsor-field="enlace"`)}
              <label class="admin-field sponsor-file-field">
                <span>Subir foto al repositorio</span>
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" data-sponsor-file="${index}" />
              </label>
              ${sponsorUploadPreview(sponsor)}
            </div>
          </article>
        `).join("")}
      </div>
    `;

    refs.content.querySelector("#add-sponsor")?.addEventListener("click", () => {
      event.patrocinadores.push({ nombre: "", imagen: "", enlace: "" });
      persistChanges();
      render();
    });

    refs.content.querySelectorAll("[data-sponsor-field]").forEach((field) => {
      field.addEventListener("input", () => {
        const sponsor = event.patrocinadores[Number(field.dataset.sponsorIndex)];
        if (!sponsor) return;
        if (field.dataset.sponsorField === "imagen") clearPendingSponsorAssetFor(sponsor.imagen);
        sponsor[field.dataset.sponsorField] = field.value;
        persistChanges();
      });
    });

    refs.content.querySelectorAll("[data-sponsor-file]").forEach((field) => {
      field.addEventListener("change", async () => {
        const sponsorIndex = Number(field.dataset.sponsorFile);
        const sponsor = event.patrocinadores[sponsorIndex];
        const file = field.files?.[0];
        if (!sponsor || !file) return;

        if (!imageExtension(file)) {
          setMessage("Selecciona un archivo de imagen válido.", true);
          field.value = "";
          return;
        }

        const fileName = uniqueSponsorAssetFilename(
          sponsorAssetFilename(sponsor, file, sponsorIndex),
          event.patrocinadores,
          sponsorIndex,
        );
        if (!fileName) {
          setMessage("No se pudo detectar la extensión de la imagen.", true);
          field.value = "";
          return;
        }

        try {
          clearPendingSponsorAssetFor(sponsor.imagen);
          const path = `assets/sponsors/${fileName}`;
          pendingSponsorAssets.set(path, {
            path,
            content: await fileToBase64(file),
            fileName,
            originalName: file.name,
            previewUrl: URL.createObjectURL(file),
          });
          sponsor.imagen = fileName;
          persistChanges(`Foto preparada: ${fileName}. Pulsa "Publicar en GitHub" para subirla al repositorio.`);
          renderSponsors();
        } catch (error) {
          setMessage(`No se pudo preparar la foto: ${error.message}`, true);
        }
      });
    });

    refs.content.querySelectorAll("[data-delete-sponsor]").forEach((button) => {
      button.addEventListener("click", () => {
        const [deleted] = event.patrocinadores.splice(Number(button.dataset.deleteSponsor), 1);
        if (deleted) clearPendingSponsorAssetFor(deleted.imagen);
        persistChanges();
        render();
      });
    });
  };

  const renderJson = () => {
    refs.content.innerHTML = `
      <div class="admin-section-head">
        <div>
          <h2>JSON</h2>
          <p class="small">Edición avanzada de los tres archivos de datos.</p>
        </div>
      </div>
      <div class="admin-grid">
        ${textarea("evento.json", JSON.stringify(state.evento, null, 2))}
        ${textarea("grupos.json", JSON.stringify(state.grupos, null, 2))}
        ${textarea("eliminatoria.json", JSON.stringify(state.eliminatoria, null, 2))}
      </div>
      <div class="json-actions">
        <button id="apply-json" type="button">Aplicar JSON editado</button>
      </div>
    `;
    refs.content.querySelector("#apply-json")?.addEventListener("click", () => {
      const areas = refs.content.querySelectorAll("textarea");
      try {
        state.evento = JSON.parse(areas[0].value);
        state.grupos = JSON.parse(areas[1].value);
        state.eliminatoria = JSON.parse(areas[2].value);
        persistChanges("JSON aplicado y guardado automáticamente.");
        render();
      } catch (error) {
        setMessage(`JSON no válido: ${error.message}`, true);
      }
    });
  };

  const bindGlobalActions = () => {
    refs.tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        activeSection = tab.dataset.adminSection;
        render();
      });
    });
    refs.publishGithub.addEventListener("click", publishToGithub);
    refs.githubRememberToken.addEventListener("change", syncStoredGithubToken);
    refs.githubToken.addEventListener("input", () => {
      if (refs.githubRememberToken.checked) syncStoredGithubToken();
    });
    refs.reloadBase.addEventListener("click", async () => {
      const confirmed = window.confirm(
        "Se descartarán los cambios realizados en este navegador y se restaurarán los JSON publicados. Esta acción no guardará tus cambios. ¿Quieres continuar?",
      );
      if (!confirmed) return;
      state = await MaratonDataStore.loadBaseData();
      MaratonDataStore.clearStored();
      setMessage("Se han restaurado los JSON publicados y se ha borrado el guardado local.");
      render();
    });
  };

  const init = async () => {
    try {
      bindPinGate();
      bindGlobalActions();
      loadStoredGithubToken();
      if (sessionStorage.getItem(PIN_SESSION_KEY) === "true") {
        await unlock();
      } else {
        refs.pinInput.focus();
      }
    } catch (error) {
      setMessage(`No se pudieron cargar los datos: ${error.message}`, true);
    }
  };

  return { init };
})();

AdminApp.init();
