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
            fontSize: window.innerWidth < 600 ? 12 : 14,
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
}

window.agyTerminal = new AgyTerminal();
