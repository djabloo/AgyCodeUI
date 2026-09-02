class AgyFiles {
    constructor() {
        this.currentPath = '';
        this.listEl = document.getElementById('file-list');
        this.breadcrumbsEl = document.getElementById('file-breadcrumbs');
        this.viewerEl = document.getElementById('file-viewer');
        this.viewerFilenameEl = document.getElementById('viewer-filename');
        this.viewerCodeEl = document.getElementById('viewer-code');
        this.currentViewingFilePath = '';

        if (this.listEl) {
            this.listEl.addEventListener('click', (e) => {
                const itemEl = e.target.closest('.file-item');
                if (!itemEl) return;
                const isDir = itemEl.dataset.isDir === 'true';
                const itemPath = itemEl.dataset.path || '';
                const itemName = itemEl.dataset.name || '';
                if (isDir) {
                    this.loadDir(itemPath);
                } else {
                    this.viewFile(itemPath, itemName);
                }
            });
        }
    }

    async loadDir(relPath = '') {
        const token = localStorage.getItem('agy_pin') || '';
        try {
            const res = await fetch(`/api/files/tree?path=${encodeURIComponent(relPath)}`, {
                headers: { 'Authorization': token }
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Errore durante il caricamento dei file');
            }
            const data = await res.json();
            this.currentPath = data.currentPath || '';
            this.renderBreadcrumbs(data.currentPath);
            this.renderList(data.items);
        } catch (err) {
            if (this.listEl) {
                this.listEl.innerHTML = `<p class="error-text" style="padding:12px;">${this.escapeHtml(err.message)}</p>`;
            }
        }
    }

    renderBreadcrumbs(pathStr) {
        if (!this.breadcrumbsEl) return;
        let html = `<span class="crumb" onclick="window.agyFiles.loadDir('')">/</span>`;
        if (pathStr) {
            const parts = pathStr.split('/').filter(Boolean);
            let accumulated = '';
            for (let i = 0; i < parts.length; i++) {
                accumulated += (accumulated ? '/' : '') + parts[i];
                const safeAccum = this.escapeHtml(accumulated);
                const safePart = this.escapeHtml(parts[i]);
                html += ` <span style="color:var(--text-muted)">/</span> <span class="crumb" onclick="window.agyFiles.loadDir('${safeAccum}')">${safePart}</span>`;
            }
        }
        this.breadcrumbsEl.innerHTML = html;
    }

    renderList(items) {
        if (!this.listEl) return;
        if (!items || items.length === 0) {
            this.listEl.innerHTML = `<p style="padding: 16px; color: var(--text-muted); font-size: 0.85rem;">Cartella vuota</p>`;
            return;
        }

        let html = '';
        if (this.currentPath) {
            const parts = this.currentPath.split('/').filter(Boolean);
            const parent = parts.slice(0, -1).join('/');
            html += `
                <div class="file-item is-dir" data-path="${this.escapeHtml(parent)}" data-is-dir="true">
                    <i data-lucide="corner-left-up"></i>
                    <span>.. (Cartella superiore)</span>
                </div>
            `;
        }

        for (const item of items) {
            const icon = item.isDir ? 'folder' : 'file-text';
            const safePath = this.escapeHtml(item.path);
            const safeName = this.escapeHtml(item.name);
            
            html += `
                <div class="file-item ${item.isDir ? 'is-dir' : ''}" data-path="${safePath}" data-name="${safeName}" data-is-dir="${item.isDir ? 'true' : 'false'}">
                    <i data-lucide="${icon}"></i>
                    <span>${safeName}</span>
                </div>
            `;
        }

        this.listEl.innerHTML = html;
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    async viewFile(path, name) {
        const token = localStorage.getItem('agy_pin') || '';
        try {
            const res = await fetch(`/api/files/content?path=${encodeURIComponent(path)}`, {
                headers: { 'Authorization': token }
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                alert(err.error || 'Impossibile leggere il file');
                return;
            }
            const data = await res.json();
            this.currentViewingFilePath = path;
            if (this.viewerFilenameEl) this.viewerFilenameEl.textContent = name;
            if (this.viewerCodeEl) this.viewerCodeEl.textContent = data.content;
            if (this.viewerEl) this.viewerEl.classList.remove('hidden');
            if (window.lucide) {
                window.lucide.createIcons();
            }
        } catch (e) {
            alert('Errore apertura file: ' + e.message);
        }
    }

    insertCurrentPathToPrompt() {
        if (this.currentViewingFilePath && window.agyApp) {
            const input = document.getElementById('prompt-input');
            if (input) {
                const current = input.value;
                const sep = current && !current.endsWith(' ') ? ' ' : '';
                window.agyApp.insertPrompt(current + sep + this.currentViewingFilePath);
            }
            this.closeViewer();
        }
    }

    copyCurrentPath() {
        if (this.currentViewingFilePath) {
            navigator.clipboard.writeText(this.currentViewingFilePath).then(() => {
                alert('Percorso copiato: ' + this.currentViewingFilePath);
            }).catch(() => {});
        }
    }

    closeViewer() {
        if (this.viewerEl) {
            this.viewerEl.classList.add('hidden');
        }
    }

    refresh() {
        this.loadDir(this.currentPath);
    }

    escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

window.agyFiles = new AgyFiles();
