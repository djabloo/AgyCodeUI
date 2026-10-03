/**
 * Servizi esterni dei plugin (es. il motore Rizzo-PII del plugin PII).
 *
 * Un plugin puo' dichiarare nel manifest `"service": "<nome>"`. Dove i servizi
 * li gestisce un agente sull'host (VPS dedicate AgyCloud, variabile
 * PLUGIN_AGENT_SOCKET), installare il plugin scarica il servizio, disinstallarlo
 * libera il disco, e prima di ogni uso il servizio viene avviato (si spegne da
 * solo quando resta inattivo). Senza agente (self-hosted, container SaaS) il
 * servizio e' gia' gestito altrove: tutte le funzioni qui sono no-op.
 *
 * L'agente accetta solo i servizi del suo catalogo (vedi
 * orchestrator/node/plugin-agent.py in agycloud): da qui si passa solo il nome.
 */

const http = require('http');

const SOCKET = process.env.PLUGIN_AGENT_SOCKET || '';
const NAME_RE = /^[a-z0-9][a-z0-9-]{0,40}$/;

function enabled() {
    return !!SOCKET;
}

function call(method, path, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        const req = http.request({ socketPath: SOCKET, path, method, timeout: timeoutMs }, (res) => {
            let raw = '';
            res.on('data', (c) => { raw += c; });
            res.on('end', () => {
                let data = {};
                try { data = raw ? JSON.parse(raw) : {}; } catch (_) { data = { error: raw }; }
                if (res.statusCode >= 400) {
                    const err = new Error(data.error || `HTTP ${res.statusCode}`);
                    err.status = res.statusCode;
                    return reject(err);
                }
                resolve(data);
            });
        });
        req.on('timeout', () => req.destroy(new Error('Agente plugin: timeout')));
        req.on('error', reject);
        req.end();
    });
}

function checkName(service) {
    if (!NAME_RE.test(String(service || ''))) throw new Error(`Nome servizio non valido: ${service}`);
    return service;
}

/** Stato del servizio: { state: 'absent'|'installing'|'stopped'|'running'|'error', ... } */
async function status(service) {
    if (!enabled()) return { state: 'external' };
    return call('GET', `/status/${checkName(service)}`);
}

/** Avvia il download/installazione (asincrono lato agente: seguire con status()). */
async function install(service) {
    if (!enabled()) return { state: 'external' };
    return call('POST', `/install/${checkName(service)}`);
}

/** Ferma e rimuove il servizio, liberando il disco. */
async function uninstall(service) {
    if (!enabled()) return { state: 'external' };
    return call('POST', `/uninstall/${checkName(service)}`, 60000);
}

/** Ferma il servizio tenendo l'immagine: riaccenderlo non riscarica nulla. */
async function stop(service) {
    if (!enabled()) return { state: 'external' };
    return call('POST', `/stop/${checkName(service)}`, 60000);
}

/** Garantisce il servizio acceso e pronto prima di usarlo (avvio a freddo: fino a ~2 min). */
async function ensureRunning(service) {
    if (!enabled()) return { state: 'external' };
    return call('POST', `/ensure/${checkName(service)}`, 180000);
}

module.exports = { enabled, status, install, uninstall, stop, ensureRunning };
