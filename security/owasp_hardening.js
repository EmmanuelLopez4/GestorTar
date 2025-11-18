/*!
 * owasp_hardening.js
 * Medidas OWASP / hardening aplicables en frontend (demo)
 * Colocar en: AppTareas_web/seguridad/owasp_hardening.js
 */

// ==== CONFIG / HELPERS ====
(function () {
  'use strict';

  // Escapa texto para evitar inyección en el DOM (XSS)
  function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/\//g, '&#x2F;');
  }

  // Valida y "sanea" el payload de una tarea (título, descripción, fechas)
  // payload: { title, description, dueDate }
  // devuelve { ok: boolean, data: {title,description,dueDate}, errors: [] }
  function sanitizeTaskPayload(payload) {
    const errors = [];
    const out = {
      title: '',
      description: '',
      dueDate: null
    };

    // Title: requerido, max 100 chars
    if (!payload || typeof payload.title !== 'string' || payload.title.trim() === '') {
      errors.push('Título requerido.');
    } else {
      let t = payload.title.trim();
      if (t.length > 100) {
        errors.push('Título demasiado largo (max 100).');
        t = t.slice(0, 100);
      }
      out.title = escapeHTML(t);
    }

    // Description: opcional, max 1000 chars
    if (payload && typeof payload.description === 'string') {
      let d = payload.description.trim();
      if (d.length > 1000) {
        errors.push('Descripción recortada a 1000 caracteres.');
        d = d.slice(0, 1000);
      }
      out.description = escapeHTML(d);
    }

    // dueDate: opcional, si viene validar formato ISO (YYYY-MM-DD o ISO)
    if (payload && payload.dueDate) {
      const s = String(payload.dueDate).trim();
      const parsed = Date.parse(s);
      if (Number.isNaN(parsed)) {
        errors.push('Fecha de vencimiento inválida.');
      } else {
        // Guardamos en formato ISO (sin hora) para demo
        const d = new Date(parsed);
        out.dueDate = d.toISOString();
      }
    }

    return {
      ok: errors.length === 0,
      data: out,
      errors: errors
    };
  }

  // Inyecta en <head> una meta Content-Security-Policy demo (solo meta, en producción
  // la CSP debe enviarse desde el servidor en headers)
  function applyCSP() {
    try {
      const metaName = 'content-security-policy';
      // Política demo: restringe a 'self' scripts y estilos.
      // Nota: esto es sólo un ejemplo; muchas apps necesitan ajustes (fonts, cdn, etc.)
      const policy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; frame-ancestors 'none';";
      let meta = document.querySelector(`meta[http-equiv="${metaName}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('http-equiv', metaName);
        document.getElementsByTagName('head')[0].appendChild(meta);
      }
      meta.setAttribute('content', policy);
      // Nota: para una CSP real ponerla en el header HTTP desde el servidor.
    } catch (e) {
      // No bloquear la app por errores en demo
      console.warn('applyCSP: fallo al aplicar CSP demo', e);
    }
  }

  // Recorre el DOM y elimina atributos inline "on*" (onclick, onmouseover, etc.)
  // Esto ayuda a mitigar event handlers inline maliciosos en demos/legacy.
  function enforceNoInlineHandlers() {
    try {
      const all = document.getElementsByTagName('*');
      for (let i = 0; i < all.length; i++) {
        const el = all[i];
        // Copiamos la lista de atributos porque la colección es "viva"
        const attrs = Array.prototype.slice.call(el.attributes || []);
        attrs.forEach(attr => {
          if (!attr || !attr.name) return;
          const name = attr.name.toLowerCase();
          if (name.startsWith('on')) {
            try {
              el.removeAttribute(attr.name);
            } catch (remE) {
              // noop
            }
          }
        });
      }
    } catch (e) {
      console.warn('enforceNoInlineHandlers fallo', e);
    }
  }

  // Exports
  window.owasp_escapeHTML = escapeHTML;
  window.owasp_sanitizeTaskPayload = sanitizeTaskPayload;
  window.owasp_applyCSP = applyCSP;
  window.owasp_enforceNoInlineHandlers = enforceNoInlineHandlers;

  // Auto-apply lightweight front-end hardening for demo when script carga
  // (si prefieres llamar manualmente, comenta las dos líneas siguientes)
  try {
    if (document && document.readyState === 'complete') {
      applyCSP();
      enforceNoInlineHandlers();
    } else {
      window.addEventListener('load', function () {
        applyCSP();
        enforceNoInlineHandlers();
      }, { once: true });
    }
  } catch (e) {
    // ignore
  }

  /* 
   * Notas (producción):
   * - CSP real: enviarla desde servidor en header HTTP (Content-Security-Policy).
   * - Cookies con sesión: usar HttpOnly + Secure + SameSite desde servidor.
   * - Validación debe repetirse en backend (never trust client input).
   */
})();
