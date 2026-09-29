/**
 * Autenticazione di agycodeui: tre modalita', scelte dall'ambiente.
 *
 *   pin      AUTH_PIN impostato (self-hosted classico): il token e' il PIN stesso.
 *   account  AUTH_MODE=account (VPS dedicata AgyCloud): un solo account
 *            username/password creato alla prima registrazione, come in
 *            claudecodeui. Il token e' una sessione firmata HMAC.
 *   none     nessuna delle due: container SaaS dietro al gateway (che fa gia'
 *            l'autenticazione) o server legato a 127.0.0.1.
 *
 * La prima registrazione in modalita' account richiede SETUP_TOKEN: la VPS e'
 * raggiungibile da internet appena nasce, e senza questo segreto chiunque
 * arrivasse per primo all'indirizzo potrebbe registrarsi al posto del cliente.
 * Il token arriva al cliente solo tramite il link di attivazione nella
 * dashboard AgyCloud e smette di servire appena l'account esiste.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const AUTH_PIN = process.env.AUTH_PIN || '';
const SETUP_TOKEN = process.env.SETUP_TOKEN || '';
const SESSION_DAYS = parseInt(process.env.AUTH_SESSION_DAYS || '30', 10);
const ACCOUNT_FILE = process.env.AUTH_ACCOUNT_FILE || path.join(__dirname, 'data', 'auth.json');

const mode = AUTH_PIN ? 'pin' : (process.env.AUTH_MODE === 'account' ? 'account' : 'none');

function safeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
}

let account = null;
function loadAccount() {
    if (account) return account;
    try {
        account = JSON.parse(fs.readFileSync(ACCOUNT_FILE, 'utf8'));
    } catch (_) {
        account = null;
    }
    return account;
}

function hashPassword(password, salt) {
    return crypto.scryptSync(password, salt, 64).toString('hex');
}

function sign(payload) {
    return crypto.createHmac('sha256', loadAccount().secret).update(payload).digest('base64url');
}

function issueToken(username) {
    const payload = Buffer.from(JSON.stringify({ u: username, exp: Date.now() + SESSION_DAYS * 86400000 })).toString('base64url');
    return `acc.${payload}.${sign(payload)}`;
}

function sessionOk(token) {
    const acc = loadAccount();
    if (!acc || typeof token !== 'string' || !token.startsWith('acc.')) return false;
    const [, payload, sig] = token.split('.');
    if (!payload || !sig || !safeEqual(sig, sign(payload))) return false;
    try {
        const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        return data.u === acc.username && data.exp > Date.now();
    } catch (_) {
        return false;
    }
}

function tokenOk(token) {
    if (mode === 'pin') return safeEqual(token, AUTH_PIN);
    if (mode === 'account') return sessionOk(token);
    return false;
}

function setupRequired() {
    return mode === 'account' && !loadAccount();
}

function validateCredentials(username, password) {
    if (typeof username !== 'string' || !/^[a-zA-Z0-9._@-]{3,64}$/.test(username.trim())) {
        return 'Username non valido (3-64 caratteri: lettere, numeri, . _ @ -).';
    }
    if (typeof password !== 'string' || password.length < 10) {
        return 'La password deve avere almeno 10 caratteri.';
    }
    return null;
}

/** Crea l'unico account. Ritorna { token } oppure { status, error }. */
function register({ username, password, setupToken }) {
    if (mode !== 'account') return { status: 404, error: 'Registrazione non disponibile.' };
    if (loadAccount()) return { status: 409, error: 'Account gia\' creato. Accedi con le tue credenziali.' };
    if (!SETUP_TOKEN || !safeEqual(setupToken, SETUP_TOKEN)) {
        return { status: 403, error: 'Link di attivazione non valido. Aprilo dalla dashboard AgyCloud.' };
    }
    const invalid = validateCredentials(username, password);
    if (invalid) return { status: 400, error: invalid };

    const salt = crypto.randomBytes(16).toString('hex');
    const data = {
        username: username.trim(),
        salt,
        passwordHash: hashPassword(password, salt),
        secret: crypto.randomBytes(32).toString('hex'),
        createdAt: new Date().toISOString(),
    };
    fs.mkdirSync(path.dirname(ACCOUNT_FILE), { recursive: true });
    // 'wx' fallisce se il file esiste gia': due registrazioni simultanee non
    // possono sovrascriversi a vicenda.
    try {
        fs.writeFileSync(ACCOUNT_FILE, JSON.stringify(data, null, 2), { mode: 0o600, flag: 'wx' });
    } catch (e) {
        if (e.code === 'EEXIST') return { status: 409, error: 'Account gia\' creato. Accedi con le tue credenziali.' };
        throw e;
    }
    account = data;
    return { token: issueToken(data.username), username: data.username };
}

/** Verifica le credenziali. Ritorna { token } oppure { status, error }. */
function login({ username, password }) {
    if (mode !== 'account') return { status: 404, error: 'Login non disponibile.' };
    const acc = loadAccount();
    if (!acc) return { status: 409, error: 'Nessun account ancora creato.' };
    const okUser = safeEqual(String(username || '').trim(), acc.username);
    const okPass = typeof password === 'string'
        && safeEqual(hashPassword(password, acc.salt), acc.passwordHash);
    if (!okUser || !okPass) return { status: 401, error: 'Username o password errati.' };
    return { token: issueToken(acc.username), username: acc.username };
}

function username() {
    const acc = loadAccount();
    return acc ? acc.username : null;
}

module.exports = {
    mode,
    enabled: mode !== 'none',
    tokenOk,
    setupRequired,
    register,
    login,
    username,
};
