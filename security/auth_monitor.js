/*!
 * auth_monitor.js
 * Registro y control de intentos de acceso no autorizado (demo en localStorage)
 * Colocar en: AppTareas_web/seguridad/auth_monitor.js
 */

(function () {
  'use strict';

  // Configuraciones paramétricas (ajustables)
  const STORAGE_KEY = 'st_auth_attempts_v1';
  const MAX_ATTEMPTS_15MIN = 5;
  const WINDOW_15MIN_MS = 15 * 60 * 1000;
  const BLOCK_15MIN_MS = 15 * 60 * 1000;

  const MAX_ATTEMPTS_1H = 10;
  const WINDOW_1H_MS = 60 * 60 * 1000;
  const BLOCK_1H_MS = 60 * 60 * 1000;

  // Helper: lee el storage completo (obj)
  function _loadAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      return JSON.parse(raw) || {};
    } catch (e) {
      console.warn('auth_monitor: fallo parse localStorage', e);
      return {};
    }
  }

  function _saveAll(obj) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {
      console.warn('auth_monitor: fallo guardando storage', e);
    }
  }

  function _now() {
    return Date.now();
  }

  // Normaliza nombre de usuario para la key (demo)
  function _keyFor(username) {
    return String(username || 'unknown').toLowerCase();
  }

  // Limpia intentos antiguos para evitar acumulación
  function _pruneAttempts(record) {
    if (!record || !Array.isArray(record.attempts)) return record;
    const limit = _now() - WINDOW_1H_MS; // eliminamos > 1h
    record.attempts = record.attempts.filter(ts => ts >= limit);
    return record;
  }

  // Añade una entrada de auditoría (usa security_audit_append si existe)
  function _audit(level, msg, meta) {
    try {
      if (window && typeof window.security_audit_append === 'function') {
        window.security_audit_append({
          ts: new Date().toISOString(),
          level: level || 'info',
          message: msg,
          meta: meta || {}
        });
      } else {
        // Fallback: console log (no persistido)
        console.log('AUDIT', level, msg, meta || {});
      }
    } catch (e) {
      console.warn('auth_monitor: fallo audit', e);
    }
  }

  // Registra un intento fallido para username
  function auth_recordFailedLogin(username) {
    const k = _keyFor(username);
    const all = _loadAll();
    let rec = all[k] || { attempts: [], blockedUntil: null };

    if (!Array.isArray(rec.attempts)) rec.attempts = [];

    // Push timestamp
    const now = _now();
    rec.attempts.push(now);

    // Prune
    rec = _pruneAttempts(rec);

    // Evaluate 15min window
    const since15 = now - WINDOW_15MIN_MS;
    const c15 = rec.attempts.filter(ts => ts >= since15).length;

    // Evaluate 1h window
    const since1h = now - WINDOW_1H_MS;
    const c1h = rec.attempts.filter(ts => ts >= since1h).length;

    // Determine blocking
    let blockedReason = null;
    if (c15 >= MAX_ATTEMPTS_15MIN) {
      rec.blockedUntil = now + BLOCK_15MIN_MS;
      blockedReason = `blocked_15min_after_${c15}_attempts`;
    } else if (c1h >= MAX_ATTEMPTS_1H) {
      rec.blockedUntil = now + BLOCK_1H_MS;
      blockedReason = `blocked_1h_after_${c1h}_attempts`;
    } else {
      // if not blocked, keep blockedUntil if still in future
      if (rec.blockedUntil && rec.blockedUntil <= now) {
        rec.blockedUntil = null;
      }
    }

    // Save
    all[k] = rec;
    _saveAll(all);

    // Audit
    _audit('warning', 'failed_login_recorded', { username: k, now: new Date(now).toISOString(), attempts_last_15min: c15, attempts_last_1h: c1h, blockedReason });

    return {
      ok: true,
      attempts_15min: c15,
      attempts_1h: c1h,
      blocked: !!blockedReason,
      blockedReason,
      blockedUntil: rec.blockedUntil ? new Date(rec.blockedUntil).toISOString() : null
    };
  }

  // Revisa si el usuario puede intentar (si está bloqueado, devuelve false y unlockAt)
  function auth_canAttempt(username) {
    const k = _keyFor(username);
    const all = _loadAll();
    const rec = all[k] || { attempts: [], blockedUntil: null };
    const now = _now();
    if (rec.blockedUntil && rec.blockedUntil > now) {
      return { ok: false, reason: 'temporarily_blocked', unlockAt: new Date(rec.blockedUntil).toISOString() };
    }
    return { ok: true };
  }

  // Resetear intentos (login exitoso)
  function auth_resetAttempts(username) {
    const k = _keyFor(username);
    const all = _loadAll();
    if (all[k]) {
      delete all[k];
      _saveAll(all);
      _audit('info', 'reset_attempts', { username: k });
    }
    return { ok: true };
  }

  // Devuelve toda la estructura (para panel admin / auditoría demo)
  function auth_getAll() {
    return _loadAll();
  }

  // Exports
  window.auth_recordFailedLogin = auth_recordFailedLogin;
  window.auth_canAttempt = auth_canAttempt;
  window.auth_resetAttempts = auth_resetAttempts;
  window.auth_getAll = auth_getAll;

  // For convenience, attach a tiny debug helper (no-op in prod)
  window.auth_monitor_config = {
    STORAGE_KEY,
    MAX_ATTEMPTS_15MIN,
    WINDOW_15MIN_MS,
    BLOCK_15MIN_MS,
    MAX_ATTEMPTS_1H,
    WINDOW_1H_MS,
    BLOCK_1H_MS
  };

})();
