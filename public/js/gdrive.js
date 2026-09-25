/**
 * Google Drive Connector for AgyCodeUI and AGYUI SaaS
 * 
 * Simple, security-hardened connector using Google Identity Services (GIS)
 * and Google Picker API with the minimal least-privilege scope:
 * "https://www.googleapis.com/auth/drive.file".
 * 
 * Works seamlessly in:
 * 1. AgyCodeUI Chat (attaches files to chat and uploads to <workspace>/agy_uploads/)
 * 2. AGYUI Notebook (adds files to <workspace>/.agy-notebook/<id>/sources/)
 * 3. AGYUI Multi-tenant SaaS (/opt/agyui-server)
 */

class GoogleDriveConnector {
    constructor() {
        this.clientId = '';
        this.apiKey = '';
        this.accessToken = null;
        this.gisLoaded = false;
        this.gapiLoaded = false;
        this.tokenClient = null;
        this.targetMode = 'chat'; // 'chat' | 'notebook'

        this.init();
    }

    async init() {
        // 1. Recupera chiavi da localStorage o dal server
        this.loadCredentials();

        // 2. Pre-carica le librerie Google in background (non-blocking)
        this.loadGoogleLibraries().catch(err => {
            console.warn('[GDrive] Pre-caricamento librerie Google in background:', err.message);
        });
    }

    async loadCredentials() {
        // 1. Legge prioritariamente i valori configurati nel file .env del server
        try {
            const token = localStorage.getItem('agy_pin') || '';
            const res = await fetch('/api/settings/info', {
                headers: token ? { 'Authorization': token } : {}
            });
            if (res.ok) {
                const data = await res.json();
                if (data.googleClientId) {
                    this.clientId = data.googleClientId;
                    localStorage.setItem('agy_google_client_id', this.clientId);
                }
                if (data.googlePickerApiKey) {
                    this.apiKey = data.googlePickerApiKey;
                    localStorage.setItem('agy_google_picker_key', this.apiKey);
                }
            }
        } catch (e) {
            // Ignore silent failure
        }

        // 2. Se mancano dal server, fallback su localStorage
        if (!this.clientId) this.clientId = localStorage.getItem('agy_google_client_id') || '';
        if (!this.apiKey) this.apiKey = localStorage.getItem('agy_google_picker_key') || '';

        // Fallback default se non specificato
        if (!this.clientId) {
            this.clientId = '98291408330-j6hm5bbbjpduoqvd80bkofrujtpiuddd.apps.googleusercontent.com';
        }
    }

    loadGoogleLibraries() {
        const loadGIS = new Promise((resolve, reject) => {
            if (window.google?.accounts?.oauth2) {
                this.gisLoaded = true;
                return resolve();
            }
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.onload = () => {
                this.gisLoaded = true;
                resolve();
            };
            script.onerror = () => reject(new Error('Impossibile caricare Google Identity Services'));
            document.head.appendChild(script);
        });

        const loadGAPI = new Promise((resolve, reject) => {
            if (window.gapi?.picker) {
                this.gapiLoaded = true;
                return resolve();
            }
            const script = document.createElement('script');
            script.src = 'https://apis.google.com/js/api.js';
            script.async = true;
            script.defer = true;
            script.onload = () => {
                window.gapi.load('picker', () => {
                    this.gapiLoaded = true;
                    resolve();
                });
            };
            script.onerror = () => reject(new Error('Impossibile caricare Google API'));
            document.head.appendChild(script);
        });

        return Promise.all([loadGIS, loadGAPI]);
    }

    async openForChat() {
        this.targetMode = 'chat';
        await this.startPickerFlow();
    }

    async openForNotebook() {
        this.targetMode = 'notebook';
        await this.startPickerFlow();
    }

    async startPickerFlow() {
        await this.loadCredentials();

        // Se manca l'API Key, mostra il modal di configurazione
        if (!this.apiKey) {
            this.openConfigModal();
            return;
        }

        this.showToast('Connessione a Google Drive…', 'info');

        try {
            await this.loadGoogleLibraries();

            // Richiedi token se non presente o scaduto
            this.requestTokenAndOpenPicker();
        } catch (err) {
            console.error('[GDrive] Errore avvio:', err);
            this.showToast('Errore connessione Google Drive: ' + err.message, 'error');
        }
    }

    requestTokenAndOpenPicker() {
        if (!window.google?.accounts?.oauth2) {
            this.showToast('Google Identity Services non caricato.', 'error');
            return;
        }

        this.tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: this.clientId,
            scope: 'https://www.googleapis.com/auth/drive.file',
            callback: async (response) => {
                if (response.error) {
                    console.error('[GDrive] Errore token:', response);
                    this.showToast('Accesso annullato o non autorizzato.', 'warn');
                    return;
                }
                this.accessToken = response.access_token;
                this.createPicker();
            }
        });

        // Richiedi token: se l'utente ha già autorizzato l'app, il popup si chiude istantaneamente
        this.tokenClient.requestAccessToken({ prompt: '' });
    }

    createPicker() {
        if (!window.google?.picker) {
            this.showToast('Libreria Google Picker non pronta.', 'error');
            return;
        }

        try {
            const appId = this.clientId.split('-')[0] || '';

            // Vista documenti: supporta file, cartelle e documenti di testo/fogli/presentazioni
            const viewDocs = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS);
            viewDocs.setIncludeFolders(true);
            viewDocs.setSelectFolderEnabled(false);

            // Vista caricamento rapido opzionale
            const uploadView = new window.google.picker.DocsUploadView();

            const builder = new window.google.picker.PickerBuilder()
                .enableFeature(window.google.picker.Feature.NAV_HIDDEN)
                .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
                .enableFeature(window.google.picker.Feature.SUPPORT_DRIVES)
                .setAppId(appId)
                .setOAuthToken(this.accessToken)
                .addView(viewDocs)
                .addView(uploadView)
                .setDeveloperKey(this.apiKey)
                .setCallback((data) => this.handlePickerCallback(data));

            const picker = builder.build();
            picker.setVisible(true);
        } catch (err) {
            console.error('[GDrive] Errore creazione picker:', err);
            this.showToast('Errore apertura selettore: ' + err.message, 'error');
        }
    }

    async handlePickerCallback(data) {
        if (data.action === window.google.picker.Action.CANCEL) {
            return;
        }

        if (data.action === window.google.picker.Action.PICKED) {
            const docs = data[window.google.picker.Response.DOCUMENTS] || [];
            if (!docs.length) return;

            this.showToast(`Scaricamento di ${docs.length} file da Google Drive…`, 'info');

            for (const doc of docs) {
                try {
                    const file = await this.downloadFile(doc);
                    if (!file) continue;

                    if (this.targetMode === 'chat') {
                        if (window.agyChat && typeof window.agyChat.uploadAndAttach === 'function') {
                            await window.agyChat.uploadAndAttach(file);
                        } else {
                            console.error('[GDrive] window.agyChat non disponibile');
                        }
                    } else if (this.targetMode === 'notebook') {
                        if (window.agyNotebookPlugin && typeof window.agyNotebookPlugin.addSourceFile === 'function') {
                            await window.agyNotebookPlugin.addSourceFile(file);
                        } else if (typeof window.agynbAddSourceFile === 'function') {
                            await window.agynbAddSourceFile(file);
                        } else {
                            this.showToast('Nessun notebook attivo aperto per ricevere la fonte.', 'warn');
                        }
                    }
                } catch (err) {
                    console.error('[GDrive] Errore download documento:', doc.name, err);
                    this.showToast(`Errore recupero "${doc.name}": ${err.message}`, 'error');
                }
            }
        }
    }

    /**
     * Scarica o esporta il documento da Google Drive
     */
    async downloadFile(doc) {
        const fileId = doc.id;
        const mimeType = doc.mimeType;
        let fileName = doc.name;
        let downloadUrl = '';
        let targetMime = mimeType;

        // Gestione documenti proprietari Google Workspace (Docs, Sheets, Slides)
        if (mimeType === 'application/vnd.google-apps.document') {
            downloadUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=application/pdf`;
            targetMime = 'application/pdf';
            if (!fileName.toLowerCase().endsWith('.pdf')) fileName += '.pdf';
        } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
            downloadUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=text/csv`;
            targetMime = 'text/csv';
            if (!fileName.toLowerCase().endsWith('.csv')) fileName += '.csv';
        } else if (mimeType === 'application/vnd.google-apps.presentation') {
            downloadUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=application/pdf`;
            targetMime = 'application/pdf';
            if (!fileName.toLowerCase().endsWith('.pdf')) fileName += '.pdf';
        } else {
            // File binario standard o file di testo
            downloadUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;
        }

        const res = await fetch(downloadUrl, {
            headers: {
                'Authorization': `Bearer ${this.accessToken}`
            }
        });

        if (!res.ok) {
            const errText = await res.text().catch(() => '');
            throw new Error(`Google Drive API error (${res.status}): ${errText || res.statusText}`);
        }

        const blob = await res.blob();
        return new File([blob], fileName, { type: targetMime || blob.type });
    }

    // ── Modal di Configurazione Chiavi ──────────────────────────────────────
    openConfigModal() {
        const modal = document.getElementById('gdrive-config-modal');
        if (!modal) return;

        const keyInput = document.getElementById('gdrive-api-key-input');
        const clientInput = document.getElementById('gdrive-client-id-input');

        if (keyInput) keyInput.value = this.apiKey || '';
        if (clientInput) clientInput.value = this.clientId || '';

        modal.classList.remove('hidden');
    }

    syncSettingsInputs() {
        const keyInput = document.getElementById('tab-gdrive-api-key-input');
        const clientInput = document.getElementById('tab-gdrive-client-id-input');

        if (keyInput) keyInput.value = this.apiKey || '';
        if (clientInput) clientInput.value = this.clientId || '';
    }

    closeConfigModal() {
        const modal = document.getElementById('gdrive-config-modal');
        if (modal) modal.classList.add('hidden');
    }

    async saveConfigFromModal() {
        const keyInput = document.getElementById('gdrive-api-key-input');
        const clientInput = document.getElementById('gdrive-client-id-input');

        const apiKey = keyInput ? keyInput.value.trim() : '';
        const clientId = clientInput ? clientInput.value.trim() : '';

        if (!apiKey) {
            alert('Inserisci la Google Picker API Key per continuare.');
            return;
        }

        await this.saveCredentials(apiKey, clientId);
        this.closeConfigModal();
        this.showToast('Configurazione Google Drive salvata!', 'success');

        // Riprova il flusso interrotto
        this.startPickerFlow();
    }

    async saveCredentials(apiKey, clientId) {
        this.apiKey = apiKey;
        if (clientId) this.clientId = clientId;

        localStorage.setItem('agy_google_picker_key', this.apiKey);
        if (this.clientId) localStorage.setItem('agy_google_client_id', this.clientId);

        this.syncSettingsInputs();

        try {
            const pin = localStorage.getItem('agy_pin') || '';
            await fetch('/api/settings/gdrive-config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': pin
                },
                body: JSON.stringify({
                    apiKey: this.apiKey,
                    clientId: this.clientId
                })
            });
        } catch (e) {
            // Ignora fallimento server, salvato comunque in localStorage
        }
    }

    showToast(message, type = 'info') {
        if (window.agyApp && typeof window.agyApp.showToast === 'function') {
            window.agyApp.showToast(message, type);
            return;
        }

        // Fallback leggero
        const id = 'gdrive-toast';
        let toast = document.getElementById(id);
        if (!toast) {
            toast = document.createElement('div');
            toast.id = id;
            toast.style.cssText = 'position:fixed; bottom:24px; right:24px; z-index:99999; padding:10px 16px; border-radius:8px; font-size:0.82rem; font-weight:600; color:#fff; box-shadow:0 4px 14px rgba(0,0,0,0.4); transition:opacity 0.3s; pointer-events:none; font-family:sans-serif;';
            document.body.appendChild(toast);
        }

        if (type === 'error') {
            toast.style.background = '#ef4444';
        } else if (type === 'warn') {
            toast.style.background = '#f59e0b';
        } else if (type === 'success') {
            toast.style.background = '#10b981';
        } else {
            toast.style.background = '#06b6d4';
        }

        toast.textContent = message;
        toast.style.opacity = '1';

        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => {
            if (toast) toast.style.opacity = '0';
        }, 3500);
    }
}

// Inizializzazione globale
window.agyGoogleDrive = new GoogleDriveConnector();
