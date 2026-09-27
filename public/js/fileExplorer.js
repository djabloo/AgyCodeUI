/**
 * AgyCodeUI File Explorer & Code/Image Editor
 * Features: Ace Code Editor with syntax highlighting & auto-save, Image Previewer with zoom,
 * file creation/deletion, path copy & prompt insertion.
 */

class AgyFiles {
    constructor() {
        this.currentPath = '';
        this.currentViewingFilePath = '';
        this.currentViewingFileName = '';
        this.currentImageUrl = null;
        this.imageZoom = 1;
        this.isDirty = false;
        this.ignoreChange = false;
        this.aceEditor = null;

        // Elements
        this.listEl = document.getElementById('file-list');
        this.breadcrumbsEl = document.getElementById('file-breadcrumbs');
        this.viewerEl = document.getElementById('file-viewer');
        this.viewerFilenameEl = document.getElementById('viewer-filename');
        this.viewerIconEl = document.getElementById('viewer-icon');
        this.viewerDirtyBadgeEl = document.getElementById('viewer-dirty-badge');
        this.saveBtnEl = document.getElementById('viewer-save-btn');
        this.codeContainerEl = document.getElementById('code-editor-container');
        this.imageContainerEl = document.getElementById('image-viewer-container');
        this.imagePreviewEl = document.getElementById('image-preview-el');
        this.imageZoomLevelEl = document.getElementById('image-zoom-level');
        this.fallbackEl = document.getElementById('fallback-editor');
        this.statusbarModeEl = document.getElementById('statusbar-mode');
        this.statusbarInfoEl = document.getElementById('statusbar-info');
        this.statusbarSizeEl = document.getElementById('statusbar-size');
        this.statusbarMsgEl = document.getElementById('statusbar-msg');

        this.initListEvents();
        this.initKeyboardShortcuts();
    }

    initListEvents() {
        if (!this.listEl) return;
        this.listEl.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.file-item-delete-btn');
            if (deleteBtn) {
                e.stopPropagation();
                const itemPath = deleteBtn.dataset.path || '';
                const isDir = deleteBtn.dataset.isDir === 'true';
                this.deleteItem(itemPath, isDir);
                return;
            }

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

    initKeyboardShortcuts() {
        window.addEventListener('keydown', (e) => {
            if (!this.viewerEl || this.viewerEl.classList.contains('hidden')) return;

            // Esc to close viewer
            if (e.key === 'Escape') {
                e.preventDefault();
                this.closeViewer();
                return;
            }

            // Ctrl+S or Cmd+S to save
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                this.saveCurrentFile();
            }
        });
    }

    initAceEditor() {
        if (this.aceEditor || !window.ace) return;

        try {
            this.aceEditor = ace.edit('ace-editor');
            this.aceEditor.setTheme('ace/theme/tomorrow_night');
            this.aceEditor.setFontSize('13.5px');
            this.aceEditor.setShowPrintMargin(false);
            this.aceEditor.getSession().setTabSize(2);
            this.aceEditor.getSession().setUseSoftTabs(true);
            this.aceEditor.getSession().setUseWrapMode(true);
            this.aceEditor.setOptions({
                enableBasicAutocompletion: true,
                enableLiveAutocompletion: true,
                enableSnippets: true,
                showLineNumbers: true,
                tabSize: 2
            });

            this.aceEditor.commands.addCommand({
                name: 'save',
                bindKey: { win: 'Ctrl-S', mac: 'Command-S' },
                exec: () => {
                    this.saveCurrentFile();
                }
            });

            this.aceEditor.session.on('change', () => {
                if (this.ignoreChange) return;
                this.setDirty(true);
                this.updateEditorStats();
            });

            this.aceEditor.selection.on('changeCursor', () => {
                this.updateEditorStats();
            });
        } catch (err) {
            console.warn('Inizializzazione Ace Editor fallita, utilizzo fallback:', err);
            this.aceEditor = null;
            if (this.fallbackEl) {
                this.fallbackEl.classList.remove('hidden');
                document.getElementById('ace-editor').classList.add('hidden');
                this.fallbackEl.addEventListener('input', () => {
                    this.setDirty(true);
                    this.updateEditorStats();
                });
            }
        }
    }

    setDirty(isDirty) {
        this.isDirty = isDirty;
        if (this.viewerDirtyBadgeEl) {
            if (isDirty) {
                this.viewerDirtyBadgeEl.classList.remove('hidden');
            } else {
                this.viewerDirtyBadgeEl.classList.add('hidden');
            }
        }
    }

    setStatusMsg(msg, type = '') {
        if (!this.statusbarMsgEl) return;
        this.statusbarMsgEl.textContent = msg;
        this.statusbarMsgEl.className = 'statusbar-msg ' + (type || '');
    }

    isImageFile(filePath) {
        if (!filePath) return false;
        const exts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'];
        const lower = filePath.toLowerCase();
        return exts.some(ext => lower.endsWith(ext));
    }

    getFileIcon(name, isDir) {
        if (isDir) return 'folder';
        const lower = name.toLowerCase();
        if (this.isImageFile(lower)) return 'image';
        if (/\.(js|jsx|ts|tsx|vue|svelte|json|html|css|scss|py|sh|bash|sql|php|rb|go|rs|c|cpp|h|java|yaml|yml|toml|env)$/i.test(lower)) {
            return 'file-code';
        }
        if (/\.(md|txt|log|rst|csv|tsv)$/i.test(lower)) return 'file-text';
        if (/\.(zip|tar|gz|bz2|7z|rar)$/i.test(lower)) return 'archive';
        if (/\.(mp3|wav|ogg|m4a|flac)$/i.test(lower)) return 'music';
        if (/\.(mp4|webm|mkv|mov|avi)$/i.test(lower)) return 'video';
        if (/\.pdf$/i.test(lower)) return 'file';
        return 'file';
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
            const icon = this.getFileIcon(item.name, item.isDir);
            const safePath = this.escapeHtml(item.path);
            const safeName = this.escapeHtml(item.name);
            
            html += `
                <div class="file-item ${item.isDir ? 'is-dir' : ''}" data-path="${safePath}" data-name="${safeName}" data-is-dir="${item.isDir ? 'true' : 'false'}">
                    <i data-lucide="${icon}"></i>
                    <span>${safeName}</span>
                    <div class="file-item-actions">
                        <button class="file-item-btn file-item-delete-btn" data-path="${safePath}" data-is-dir="${item.isDir ? 'true' : 'false'}" title="Elimina ${item.isDir ? 'cartella' : 'file'}">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </div>
            `;
        }

        this.listEl.innerHTML = html;
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    async viewFile(path, name) {
        if (this.isDirty && !confirm(`Il file "${this.currentViewingFileName}" ha modifiche non salvate. Vuoi abbandonarle?`)) {
            return;
        }

        this.currentViewingFilePath = path;
        this.currentViewingFileName = name;
        this.setDirty(false);
        this.setStatusMsg('Caricamento...');

        if (this.viewerFilenameEl) this.viewerFilenameEl.textContent = name;
        const iconName = this.getFileIcon(name, false);
        if (this.viewerIconEl) {
            this.viewerIconEl.setAttribute('data-lucide', iconName);
        }

        const isImg = this.isImageFile(path);

        if (isImg) {
            await this.openImageViewer(path, name);
        } else {
            await this.openCodeEditor(path, name);
        }

        if (this.viewerEl) this.viewerEl.classList.remove('hidden');
        if (window.lucide) window.lucide.createIcons();
    }

    async openImageViewer(path, name) {
        if (this.codeContainerEl) this.codeContainerEl.classList.add('hidden');
        if (this.imageContainerEl) this.imageContainerEl.classList.remove('hidden');
        if (this.saveBtnEl) this.saveBtnEl.classList.add('hidden');

        // Revoke previous blob url
        if (this.currentImageUrl) {
            URL.revokeObjectURL(this.currentImageUrl);
            this.currentImageUrl = null;
        }

        this.resetImageZoom();
        const ext = path.split('.').pop().toLowerCase();
        if (this.statusbarModeEl) this.statusbarModeEl.textContent = `image/${ext}`;
        if (this.statusbarInfoEl) this.statusbarInfoEl.textContent = 'Caricamento...';

        const token = localStorage.getItem('agy_pin') || '';
        try {
            const res = await fetch(`/api/files/raw?path=${encodeURIComponent(path)}`, {
                headers: { 'Authorization': token }
            });
            if (!res.ok) {
                throw new Error(`Impossibile caricare l'immagine (${res.status})`);
            }

            const blob = await res.blob();
            this.currentImageUrl = URL.createObjectURL(blob);
            if (this.imagePreviewEl) {
                this.imagePreviewEl.onload = () => {
                    const w = this.imagePreviewEl.naturalWidth;
                    const h = this.imagePreviewEl.naturalHeight;
                    if (this.statusbarInfoEl) this.statusbarInfoEl.textContent = `${w} × ${h} px`;
                    if (this.statusbarSizeEl) this.statusbarSizeEl.textContent = this.formatBytes(blob.size);
                    this.setStatusMsg('Pronto');
                };
                this.imagePreviewEl.src = this.currentImageUrl;
            }
        } catch (err) {
            this.setStatusMsg('Errore: ' + err.message, 'error');
            alert('Errore caricamento immagine: ' + err.message);
        }
    }

    async openCodeEditor(path, name) {
        if (this.imageContainerEl) this.imageContainerEl.classList.add('hidden');
        if (this.codeContainerEl) this.codeContainerEl.classList.remove('hidden');
        if (this.saveBtnEl) this.saveBtnEl.classList.remove('hidden');

        this.initAceEditor();

        const token = localStorage.getItem('agy_pin') || '';
        try {
            const res = await fetch(`/api/files/content?path=${encodeURIComponent(path)}`, {
                headers: { 'Authorization': token }
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Impossibile leggere il file');
            }
            const data = await res.json();
            const content = data.content || '';

            // Detect ace mode
            let mode = 'text';
            if (window.ace && ace.require) {
                try {
                    const modelist = ace.require('ace/ext/modelist');
                    if (modelist) {
                        mode = modelist.getModeForPath(path).mode;
                    }
                } catch (e) {}
            }

            if (this.aceEditor) {
                this.ignoreChange = true;
                this.aceEditor.getSession().setMode(mode);
                this.aceEditor.setValue(content, -1);
                this.aceEditor.getSession().getUndoManager().reset();
                this.ignoreChange = false;
                this.setDirty(false);
                this.aceEditor.focus();
            } else if (this.fallbackEl) {
                this.fallbackEl.value = content;
                this.setDirty(false);
            }

            const modeName = mode.replace('ace/mode/', '');
            if (this.statusbarModeEl) this.statusbarModeEl.textContent = modeName;
            this.updateEditorStats(content.length);
            this.setStatusMsg('Pronto');
        } catch (err) {
            this.setStatusMsg('Errore: ' + err.message, 'error');
            alert('Errore apertura file: ' + err.message);
        }
    }

    updateEditorStats(byteLength = null) {
        if (this.aceEditor) {
            const session = this.aceEditor.getSession();
            const lines = session.getLength();
            const cursor = this.aceEditor.getCursorPosition();
            if (this.statusbarInfoEl) {
                this.statusbarInfoEl.textContent = `${lines} righe (Ln ${cursor.row + 1}, Col ${cursor.column + 1})`;
            }
            const len = byteLength !== null ? byteLength : new Blob([session.getValue()]).size;
            if (this.statusbarSizeEl) {
                this.statusbarSizeEl.textContent = this.formatBytes(len);
            }
        } else if (this.fallbackEl) {
            const val = this.fallbackEl.value;
            const lines = val.split('\n').length;
            if (this.statusbarInfoEl) {
                this.statusbarInfoEl.textContent = `${lines} righe`;
            }
            const len = byteLength !== null ? byteLength : new Blob([val]).size;
            if (this.statusbarSizeEl) {
                this.statusbarSizeEl.textContent = this.formatBytes(len);
            }
        }
    }

    async saveCurrentFile() {
        if (!this.currentViewingFilePath || this.isImageFile(this.currentViewingFilePath)) return;

        const content = this.aceEditor ? this.aceEditor.getValue() : (this.fallbackEl ? this.fallbackEl.value : '');
        const token = localStorage.getItem('agy_pin') || '';

        this.setStatusMsg('Salvataggio in corso...');

        try {
            const res = await fetch('/api/files/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token
                },
                body: JSON.stringify({
                    path: this.currentViewingFilePath,
                    content: content
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Errore salvataggio file');
            }

            const result = await res.json();
            this.setDirty(false);
            if (this.statusbarSizeEl && result.size !== undefined) {
                this.statusbarSizeEl.textContent = this.formatBytes(result.size);
            }
            const now = new Date().toLocaleTimeString();
            this.setStatusMsg(`Salvato alle ${now}`, 'success');
        } catch (err) {
            this.setStatusMsg('Errore salvataggio: ' + err.message, 'error');
            alert('Errore durante il salvataggio: ' + err.message);
        }
    }

    // Image Zoom Handlers
    zoomImage(delta) {
        this.imageZoom = Math.max(0.1, Math.min(5, Math.round((this.imageZoom + delta) * 10) / 10));
        this.applyImageZoom();
    }

    resetImageZoom() {
        this.imageZoom = 1;
        this.applyImageZoom();
    }

    fitImageZoom() {
        if (!this.imagePreviewEl || !this.imageContainerEl) return;
        const stage = document.getElementById('image-stage-wrapper');
        if (!stage || !this.imagePreviewEl.naturalWidth) return;

        const availableW = stage.clientWidth - 48;
        const availableH = stage.clientHeight - 48;
        const scaleW = availableW / this.imagePreviewEl.naturalWidth;
        const scaleH = availableH / this.imagePreviewEl.naturalHeight;
        this.imageZoom = Math.min(1, Math.min(scaleW, scaleH));
        this.applyImageZoom();
    }

    applyImageZoom() {
        if (this.imagePreviewEl) {
            this.imagePreviewEl.style.transform = `scale(${this.imageZoom})`;
        }
        if (this.imageZoomLevelEl) {
            this.imageZoomLevelEl.textContent = `${Math.round(this.imageZoom * 100)}%`;
        }
    }

    downloadCurrentFile() {
        if (!this.currentViewingFilePath) return;
        const token = localStorage.getItem('agy_pin') || '';
        const url = `/api/files/raw?path=${encodeURIComponent(this.currentViewingFilePath)}&token=${encodeURIComponent(token)}`;
        const a = document.createElement('a');
        a.href = url;
        a.download = this.currentViewingFileName || 'download';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    async createNewItem(isDir = false) {
        const typeLabel = isDir ? 'della nuova cartella' : 'del nuovo file';
        const name = prompt(`Inserisci il nome ${typeLabel}:`);
        if (!name || !name.trim()) return;

        const cleanName = name.trim();
        const fullPath = this.currentPath ? `${this.currentPath}/${cleanName}` : cleanName;
        const token = localStorage.getItem('agy_pin') || '';

        try {
            const res = await fetch('/api/files/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token
                },
                body: JSON.stringify({
                    path: fullPath,
                    isDir: isDir
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Errore creazione elemento');
            }

            this.refresh();
            if (!isDir) {
                this.viewFile(fullPath, cleanName);
            }
        } catch (err) {
            alert('Errore: ' + err.message);
        }
    }

    async deleteItem(itemPath, isDir) {
        const typeLabel = isDir ? 'la cartella' : 'il file';
        const confirmMsg = `Sei sicuro di voler eliminare definitivamente ${typeLabel} "${itemPath}"?`;
        if (!confirm(confirmMsg)) return;

        const token = localStorage.getItem('agy_pin') || '';
        try {
            const res = await fetch(`/api/files/delete?path=${encodeURIComponent(itemPath)}`, {
                method: 'DELETE',
                headers: { 'Authorization': token }
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Errore eliminazione elemento');
            }

            if (this.currentViewingFilePath === itemPath) {
                this.closeViewer();
            }

            this.refresh();
        } catch (err) {
            alert('Errore eliminazione: ' + err.message);
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
                this.setStatusMsg('Percorso copiato negli appunti!', 'success');
            }).catch(() => {
                alert('Percorso: ' + this.currentViewingFilePath);
            });
        }
    }

    closeViewer() {
        if (this.isDirty && !confirm(`Il file "${this.currentViewingFileName}" ha modifiche non salvate. Vuoi chiudere e abbandonarle?`)) {
            return;
        }

        if (this.currentImageUrl) {
            URL.revokeObjectURL(this.currentImageUrl);
            this.currentImageUrl = null;
        }

        this.setDirty(false);
        this.currentViewingFilePath = '';
        this.currentViewingFileName = '';

        if (this.viewerEl) {
            this.viewerEl.classList.add('hidden');
        }
    }

    refresh() {
        this.loadDir(this.currentPath);
    }

    formatBytes(bytes) {
        if (bytes === 0 || bytes === undefined || bytes === null) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
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
