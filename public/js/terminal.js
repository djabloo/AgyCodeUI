class AgyTerminal {
    constructor() {
        this.term = null;
        this.fitAddon = null;
        this.socket = null;
        this.container = document.getElementById('terminal-container');
    }

    init(socket) {
        this.socket = socket;

        // Inizializza xterm.js
        this.term = new Terminal({
            cursorBlink: true,
            cursorStyle: 'block',
            // Font leggermente più compatto: le schermate TUI di agy (Termini, login, trust)
            // hanno ~30 righe e nascondono i pulsanti [Done] se il terminale è troppo basso.
            fontSize: window.innerWidth < 600 ? 12 : 13,
            lineHeight: 1.05,
            fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace',
            theme: {
                background: '#000000',
                foreground: '#f0f6fc',
                cursor: '#58a6ff',
                selectionBackground: '#1f6feb40',
                black: '#0d1117',
                red: '#fa7970',
                green: '#7ce38b',
                yellow: '#faa356',
                blue: '#77bdfb',
                magenta: '#cea5fb',
                cyan: '#a2d2fb',
                white: '#f0f6fc'
            },
            convertEol: true,
            scrollback: 5000,
            allowProposedApi: true
        });

        // Addons
        this.fitAddon = new FitAddon.FitAddon();
        this.term.loadAddon(this.fitAddon);

        if (typeof WebLinksAddon !== 'undefined') {
            this.term.loadAddon(new WebLinksAddon.WebLinksAddon());
        }

        this.term.open(this.container);
        this.fit();

        // Eventi Socket <-> Terminale
        this.socket.on('terminal-output', (data) => {
            this.term.write(data);
        });

        this.term.onData((data) => {
            this.send(data);
        });

        // Ctrl+C con testo selezionato = copia (non interrompe il processo); senza selezione = Ctrl+C normale
        this.term.attachCustomKeyEventHandler((e) => {
            if (e.type !== 'keydown') return true;
            if (e.ctrlKey && !e.shiftKey && !e.altKey && (e.key === 'c' || e.key === 'C') && this.term.hasSelection()) {
                this.copySelection();
                return false;
            }
            return true;
        });

        // Gestione ridimensionamento automatico della finestra/schermo mobile
        window.addEventListener('resize', () => this.fit());
        window.addEventListener('orientationchange', () => setTimeout(() => this.fit(), 200));

        // Gestione tastiera virtuale mobile tramite visualViewport
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', () => {
                setTimeout(() => this.fit(), 100);
            });
        }
    }

    send(data) {
        if (this.socket && this.socket.connected) {
            this.socket.emit('terminal-input', data);
        }
    }

    fit() {
        if (!this.fitAddon || !this.term) return;
        try {
            this.fitAddon.fit();
            if (this.socket && this.socket.connected) {
                this.socket.emit('resize', {
                    cols: this.term.cols,
                    rows: this.term.rows
                });
            }
        } catch (e) {
            console.warn('[Terminal] Fit error:', e);
        }
    }

    clear() {
        if (this.term) {
            this.term.clear();
        }
    }

    /**
     * Copia negli appunti il testo selezionato nel terminale
     */
    async copySelection() {
        if (!this.term) return;
        const text = this.term.getSelection();
        if (!text) {
            this.flash('Seleziona prima del testo nel terminale');
            return;
        }
        try {
            await navigator.clipboard.writeText(text);
            this.term.clearSelection();
            this.flash('Copiato');
        } catch (e) {
            // Fallback per browser senza Clipboard API (o senza HTTPS)
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); this.flash('Copiato'); } catch (err) { this.flash('Copia non riuscita'); }
            document.body.removeChild(ta);
        }
        this.term.focus();
    }

    /**
     * Incolla il contenuto degli appunti nel terminale
     */
    async pasteClipboard() {
        if (!this.term) return;
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                this.send(text);
                this.flash('Incollato');
            } else {
                this.flash('Appunti vuoti');
            }
        } catch (e) {
            this.flash('Il browser non permette la lettura degli appunti: usa Ctrl+Shift+V o tasto destro → Incolla');
        }
        this.term.focus();
    }

    /**
     * Piccolo avviso temporaneo sopra il terminale
     */
    flash(text) {
        let el = document.getElementById('terminal-flash');
        if (!el) {
            el = document.createElement('div');
            el.id = 'terminal-flash';
            el.className = 'terminal-flash';
            const wrapper = document.getElementById('terminal-wrapper') || document.body;
            wrapper.appendChild(el);
        }
        el.textContent = text;
        el.classList.add('show');
        clearTimeout(this._flashTimer);
        this._flashTimer = setTimeout(() => el.classList.remove('show'), 1800);
    }
}

window.agyTerminal = new AgyTerminal();
