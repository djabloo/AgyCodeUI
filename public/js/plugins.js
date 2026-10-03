/**
 * AgyPlugins - Frontend Plugin Manager & Loader for AgyCloud
 * Manages plugin tabs, dynamic ES module loading (mount/unmount), and settings view.
 */
class AgyPlugins {
    constructor() {
        this.plugins = [];
        this.mountedPlugins = new Map(); // name -> { mod, container, api }
        this.contextListeners = [];
    }

    async init() {
        await this.loadPlugins();
        this.renderNavTabs();
    }

    async loadPlugins() {
        try {
            const token = localStorage.getItem("agy_pin") || localStorage.getItem("auth-token") || "";
            const res = await fetch(`/api/plugins${token ? "?token=" + encodeURIComponent(token) : ""}`, {
                headers: { "Authorization": token ? `Bearer ${token}` : "" }
            });
            if (res.ok) {
                const data = await res.json();
                this.plugins = data.plugins || [];
            }
        } catch (e) {
            console.error("[AgyPlugins] Errore caricamento plugin:", e);
        }
    }

    renderNavTabs() {
        const nav = document.querySelector(".nav-tabs");
        if (!nav) return;

        // Rimuovi vecchi tab plugin e separatori
        document.querySelectorAll(".plugin-nav-tab").forEach(el => el.remove());
        document.querySelectorAll(".plugin-nav-divider").forEach(el => el.remove());
        document.querySelectorAll(".plugin-tab-pane").forEach(el => el.remove());

        const enabledTabs = this.plugins.filter(p => p.enabled && p.slot === "tab");
        if (enabledTabs.length === 0) return;

        // Aggiungi divisore tra i tab principali e i plugin tab (come nello screenshot)
        const divider = document.createElement("div");
        divider.className = "nav-tab-divider plugin-nav-divider";
        nav.appendChild(divider);

        const main = document.querySelector(".main-content") || document.querySelector(".main-content-layout") || document.querySelector("main") || document.getElementById("chat-tab")?.parentElement;

        for (const p of enabledTabs) {
            // Crea bottone tab nell'header
            const tabBtn = document.createElement("button");
            tabBtn.className = "nav-tab plugin-nav-tab";
            tabBtn.setAttribute("data-tab", `plugin-tab-${p.name}`);
            tabBtn.title = p.displayName;
            tabBtn.setAttribute("aria-label", p.displayName);
            tabBtn.onclick = () => this.switchPluginTab(p.name);

            // Icona tab: inserita DIRETTAMENTE nel tabBtn (NON dentro uno span!)
            // così su mobile non viene nascosta dalla regola CSS ".nav-tab span { display: none !important; }"
            let iconMarkup = '<i data-lucide="package"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-package"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg></i>';

            if (p.name.includes("terminal")) {
                iconMarkup = '<i data-lucide="terminal"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-terminal"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" x2="20" y1="19" y2="19"></line></svg></i>';
            } else if (p.name.includes("browser")) {
                iconMarkup = '<i data-lucide="globe"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></i>';
            } else if (p.name.includes("flow")) {
                iconMarkup = '<i data-lucide="git-fork"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-git-fork"><circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="12" r="3"></circle><path d="M9 6h4a5 5 0 0 1 5 5"></path><path d="M9 18h4a5 5 0 0 0 5-5"></path></svg></i>';
            } else if (p.name.includes("pii")) {
                iconMarkup = '<i data-lucide="shield-check"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shield-check"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path><path d="m9 12 2 2 4-4"></path></svg></i>';
            } else if (p.name.includes("stats") || p.name.includes("starter")) {
                iconMarkup = '<i data-lucide="bar-chart-2"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bar-chart-2"><line x1="18" x2="18" y1="20" y2="10"></line><line x1="12" x2="12" y1="20" y2="4"></line><line x1="6" x2="6" y1="20" y2="14"></line></svg></i>';
            }

            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = iconMarkup;
            const iconEl = tempDiv.firstElementChild;

            const labelSpan = document.createElement("span");
            labelSpan.textContent = p.displayName;

            tabBtn.appendChild(iconEl);
            tabBtn.appendChild(labelSpan);
            nav.appendChild(tabBtn);

            // Crea tab pane nel DOM se non esiste
            if (main) {
                const pane = document.createElement("section");
                pane.id = `plugin-tab-${p.name}`;
                pane.className = "tab-pane plugin-tab-pane";
                pane.innerHTML = `
                    <div id="plugin-container-${p.name}" class="plugin-container" style="width:100%; height:100%; min-width:0; display:flex; flex-direction:column; overflow:hidden;"></div>
                `;
                main.appendChild(pane);
            }
        }

        if (window.lucide) window.lucide.createIcons();
    }

    async switchPluginTab(name) {
        const p = this.plugins.find(x => x.name === name);
        if (!p) return;

        const tabId = `plugin-tab-${name}`;
        if (window.agyApp) {
            window.agyApp.switchTab(tabId);
        }

        const container = document.getElementById(`plugin-container-${name}`);
        if (!container) return;

        // Se non ancora montato, monta il plugin
        if (!this.mountedPlugins.has(name)) {
            container.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:100%; color:var(--text-muted);"><i data-lucide="loader-2" class="spin-animation" style="margin-right:8px;"></i> Caricamento ${this.escapeHtml(p.displayName)}...</div>`;
            if (window.lucide) window.lucide.createIcons();

            try {
                const entryUrl = `/api/plugins/${encodeURIComponent(name)}/assets/${p.entry}?v=${encodeURIComponent(p.version || Date.now())}`;
                const mod = await import(entryUrl);
                container.innerHTML = "";

                const api = this.createPluginAPI(name);
                if (typeof mod.mount === "function") {
                    await mod.mount(container, api);
                    this.mountedPlugins.set(name, { mod, container, api });
                }
            } catch (err) {
                console.error(`[AgyPlugins] Errore mount "${name}":`, err);
                container.innerHTML = `<div style="padding:24px; color:#ef4444;"><h4>Errore durante il caricamento del plugin</h4><pre>${err.message}</pre></div>`;
            }
        }
    }

    createPluginAPI(name) {
        const self = this;
        return {
            get context() {
                const isLight = document.documentElement.getAttribute("data-theme") === "light" ||
                                document.body.classList.contains("theme-light") ||
                                document.body.classList.contains("light-theme");
                return {
                    theme: isLight ? "light" : "dark",
                    project: { name: "workspace", path: (window.agyApp && window.agyApp.currentWorkspace) || "" },
                    session: (window.agyChat && window.agyChat.activeSession) ? { id: window.agyChat.activeSession.id, title: window.agyChat.activeSession.title } : null
                };
            },
            onContextChange(cb) {
                self.contextListeners.push(cb);
                return () => {
                    const idx = self.contextListeners.indexOf(cb);
                    if (idx !== -1) self.contextListeners.splice(idx, 1);
                };
            },
            async rpc(method, path, body) {
                const token = localStorage.getItem("agy_pin") || localStorage.getItem("auth-token") || "";
                const cleanPath = path.replace(/^\//, "");
                const url = `/api/plugins/${encodeURIComponent(name)}/rpc/${cleanPath}${token ? (cleanPath.includes("?") ? "&" : "?") + "token=" + encodeURIComponent(token) : ""}`;
                const res = await fetch(url, {
                    method,
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": token ? `Bearer ${token}` : ""
                    },
                    body: body ? JSON.stringify(body) : undefined
                });
                return res.json();
            }
        };
    }

    // Gestione visualizzazione Plugins in Settings
    renderSettingsView() {
        const container = document.getElementById("plugins-list");
        if (!container) return;

        container.innerHTML = `
            <div class="plugins-settings-wrapper">
                <!-- Barra di installazione URL -->
                <div class="plugin-install-bar">
                    <div class="plugin-input-group">
                        <i data-lucide="link" class="input-icon"></i>
                        <input type="text" id="plugin-install-input" placeholder="https://github.com/utente/mio-plugin" />
                        <button class="btn btn-primary" id="plugin-install-btn" onclick="window.agyPlugins.installFromInput()">Installa</button>
                    </div>
                    <div class="plugin-security-hint">
                        <i data-lucide="shield-alert"></i>
                        <span>Installa solo plugin di cui hai verificato il codice sorgente o di autori di cui ti fidi.</span>
                    </div>
                </div>

                <!-- Sezione Official Plugins -->
                <div class="plugin-group">
                    <div class="plugin-group-header">
                        <h4>OFFICIAL PLUGINS</h4>
                        <p>Maintained by the AgyCloud team and ready for direct install.</p>
                    </div>
                    <div class="plugin-cards-grid" id="official-plugins-list">
                        ${this.renderPluginCards(this.plugins.filter(p => this.isOfficialPlugin(p.name)))}
                    </div>
                </div>

                <!-- Sezione Other Plugins -->
                <div class="plugin-group" style="margin-top: 14px;">
                    <div class="plugin-group-header">
                        <h4>OTHER PLUGINS</h4>
                        <p>Unofficial plugins and integrations from other users. Review the source before installing.</p>
                    </div>
                    <div class="plugin-cards-grid" id="other-plugins-list">
                        ${this.renderPluginCards(this.plugins.filter(p => !this.isOfficialPlugin(p.name)))}
                    </div>
                </div>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();

        // Download di un motore in corso: si ricontrolla finche' non finisce
        clearTimeout(this._installPoll);
        if (this.plugins.some(p => p.serviceState && p.serviceState.state === "installing")) {
            this._installPoll = setTimeout(async () => {
                await this.loadPlugins();
                this.renderNavTabs();
                this.renderSettingsView();
            }, 5000);
        }
    }

    isOfficialPlugin(name) {
        return name.includes("terminal") || name.includes("starter") || name.includes("stats") || name.startsWith("agycloud-plugin-") || name.startsWith("agyui-plugin-");
    }

    renderPluginCards(plugins) {
        if (!plugins || plugins.length === 0) {
            return '<div class="empty-placeholder" style="padding: 16px; font-size: 0.85rem; color: var(--text-muted);"><p>Nessun plugin in questa sezione.</p></div>';
        }

        // Installati prima, poi il resto del catalogo
        const sorted = [...plugins].sort((a, b) => (!!b.installed - !!a.installed) || (!!b.active - !!a.active) || a.displayName.localeCompare(b.displayName));
        return sorted.map(p => {
            const svc = p.serviceState ? p.serviceState.state : null;
            const isRunning = p.status === "running" || (p.enabled && !p.server);
            let statusLabel, statusClass;
            if (!p.installed) { statusLabel = "NON INSTALLATO"; statusClass = "status-disabled"; }
            else if (!p.active) { statusLabel = "SPENTO"; statusClass = "status-disabled"; }
            else if (svc === "installing") { statusLabel = "INSTALLAZIONE..."; statusClass = "status-stopped"; }
            else if (svc === "error") { statusLabel = "ERRORE"; statusClass = "status-stopped"; }
            else { statusLabel = isRunning ? "ATTIVO" : "ARRESTATO"; statusClass = isRunning ? "status-running" : "status-stopped"; }
            const iconMarkup = p.name.includes("terminal")
                ? '<i data-lucide="terminal"></i>'
                : (p.name.includes("browser")
                    ? '<i data-lucide="globe"></i>'
                : (p.name.includes("pii")
                    ? '<i data-lucide="shield-check"></i>'
                    : ((p.name.includes("stats") || p.name.includes("starter")) ? '<i data-lucide="bar-chart-2"></i>' : '<i data-lucide="package"></i>')));

            // Nota sotto la descrizione: download del motore aggiuntivo (solo dove lo gestisce l'agente)
            let note = "";
            if (svc === "installing") note = "Download del motore in corso: puo' richiedere qualche minuto, puoi continuare a lavorare.";
            else if (svc === "error") note = `Installazione non riuscita: ${p.serviceState.error || "errore sconosciuto"}. Riprova disinstallando e reinstallando.`;
            else if (!p.installed && p.serviceManaged) note = "Alla prima installazione scarica un motore aggiuntivo (alcuni GB); si spegne da solo quando non lo usi.";

            // Installato: interruttore acceso/spento (libera memoria e menu) + disinstalla (libera disco)
            const actions = (p.locked && !p.installed)
                ? `<a class="btn btn-sm" href="/dashboard#subscription" target="_blank" rel="noopener" title="Non incluso nel tuo piano">Da Hobby in su</a>`
                : p.installed
                ? `<label class="switch" title="${p.active ? "Spegni: sparisce dal menu e libera memoria" : "Accendi"}">
                       <input type="checkbox" ${p.active ? "checked" : ""} onchange="window.agyPlugins.setPluginActive('${p.name}', this.checked)" />
                       <span class="slider"></span>
                   </label>
                   ${p.server && p.active ? `<button class="plugin-action-icon-btn" title="Riavvia" onclick="window.agyPlugins.restartPlugin('${p.name}')"><i data-lucide="refresh-cw"></i></button>` : ""}
                   <button class="btn btn-sm" onclick="window.agyPlugins.uninstallPlugin('${p.name}', ${p.bundled ? "true" : "false"})">Disinstalla</button>`
                : `<button class="btn btn-primary btn-sm" onclick="window.agyPlugins.installPlugin('${p.name}')">Installa</button>`;

            return `
                <div class="plugin-card-full ${p.active ? "active-border" : ""}">
                    <div class="plugin-card-left-icon">
                        ${iconMarkup}
                    </div>
                    <div class="plugin-card-body">
                        <div class="plugin-card-title-row">
                            <span class="plugin-title">${this.escapeHtml(p.displayName)}</span>
                            <span class="plugin-badge badge-version">v${this.escapeHtml(p.version)}</span>
                            <span class="plugin-badge badge-slot">${this.escapeHtml(p.slot)}</span>
                            <span class="plugin-badge ${statusClass}">
                                <span class="status-dot"></span> ${statusLabel}
                            </span>
                            <div class="plugin-card-controls">
                                ${actions}
                            </div>
                        </div>
                        <p class="plugin-desc">${this.escapeHtml(p.description)}</p>
                        ${note ? `<p class="plugin-desc" style="color: var(--text-muted); font-style: italic;">${this.escapeHtml(note)}</p>` : ""}
                        <div class="plugin-meta-row">
                            <span class="plugin-author">${this.escapeHtml(p.author)}</span>
                            ${p.repo ? `<span class="plugin-repo"><i data-lucide="link"></i> ${this.escapeHtml(p.repo)}</span>` : ""}
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    }

    async installPlugin(name) {
        await this.togglePlugin(name, true);
    }

    async uninstallPlugin(name, bundled) {
        const msg = bundled
            ? `Disinstallare "${name}"? Potrai reinstallarlo dal catalogo quando vuoi.`
            : `Disinstallare "${name}"? I file del plugin verranno eliminati.`;
        if (!confirm(msg)) return;
        if (bundled) return this.togglePlugin(name, false);
        return this.deletePlugin(name, true);
    }

    async closePluginTab(name) {
        // Se il tab del plugin era quello attivo, torna alla Chat prima di rimuoverlo
        // (altrimenti resterebbe visibile un tab-pane orfano senza nav-tab selezionato).
        if (window.agyApp && window.agyApp.activeTab === `plugin-tab-${name}`) {
            window.agyApp.switchTab("chat-tab");
        }
        // Chiudere la scheda spegne il plugin (resta installato)
        await this.setPluginActive(name, false);
    }

    async setPluginActive(name, active) {
        const token = localStorage.getItem("agy_pin") || "";
        try {
            const res = await fetch(`/api/plugins/${encodeURIComponent(name)}/active`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", "Authorization": token },
                body: JSON.stringify({ active })
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                alert(data.error || `Operazione non riuscita (HTTP ${res.status})`);
            }
        } catch (e) {
            alert("Errore di rete: " + e.message);
        }
        // Se si spegne la scheda aperta, torna alla Chat (niente pannello orfano)
        if (!active && window.agyApp && window.agyApp.activeTab === `plugin-tab-${name}`) {
            window.agyApp.switchTab("chat-tab");
        }
        await this.loadPlugins();
        this.renderNavTabs();
        this.renderSettingsView();
    }

    async togglePlugin(name, enabled) {
        const token = localStorage.getItem("agy_pin") || "";
        try {
            const res = await fetch(`/api/plugins/${encodeURIComponent(name)}/enable`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", "Authorization": token },
                body: JSON.stringify({ enabled })
            });
            if (res.ok) {
                await this.loadPlugins();
                this.renderNavTabs();
                this.renderSettingsView();
            } else {
                const data = await res.json().catch(() => ({}));
                alert(data.error || `Operazione non riuscita (HTTP ${res.status})`);
            }
        } catch (e) {
            alert("Errore: " + e.message);
        }
    }

    async restartPlugin(name) {
        const token = localStorage.getItem("agy_pin") || "";
        try {
            const res = await fetch(`/api/plugins/${encodeURIComponent(name)}/restart`, {
                method: "POST",
                headers: { "Authorization": token }
            });
            if (res.ok) {
                await this.loadPlugins();
                this.renderSettingsView();
            }
        } catch (e) {
            alert("Errore riavvio: " + e.message);
        }
    }

    async deletePlugin(name, confirmed = false) {
        if (!confirmed && !confirm(`Vuoi disinstallare il plugin "${name}"?`)) return;
        const token = localStorage.getItem("agy_pin") || "";
        try {
            const res = await fetch(`/api/plugins/${encodeURIComponent(name)}`, {
                method: "DELETE",
                headers: { "Authorization": token }
            });
            if (res.ok) {
                await this.loadPlugins();
                this.renderNavTabs();
                this.renderSettingsView();
            }
        } catch (e) {
            alert("Errore disinstallazione: " + e.message);
        }
    }

    async installFromInput() {
        const input = document.getElementById("plugin-install-input");
        const url = input ? input.value.trim() : "";
        if (!url) {
            alert("Inserisci l'URL Git del plugin");
            return;
        }

        const btn = document.getElementById("plugin-install-btn");
        if (btn) { btn.disabled = true; btn.textContent = "Installazione..."; }

        const token = localStorage.getItem("agy_pin") || "";
        try {
            const res = await fetch("/api/plugins/install", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": token },
                body: JSON.stringify({ url })
            });
            const data = await res.json();
            if (res.ok) {
                alert("Plugin installato con successo!");
                if (input) input.value = "";
                await this.loadPlugins();
                this.renderNavTabs();
                this.renderSettingsView();
            } else {
                alert("Errore: " + (data.error || "Installazione fallita"));
            }
        } catch (e) {
            alert("Errore di connessione: " + e.message);
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = "Installa"; }
        }
    }

    escapeHtml(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }
}

window.agyPlugins = new AgyPlugins();
