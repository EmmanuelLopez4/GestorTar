/*!
 * security.js
 * Utilidades de seguridad / auditoría y gestión de tareas (ISO y Generales)
 */

(function () {
    'use strict';

    // KEYs para localStorage
    const AUDIT_STORAGE_KEY = 'st_audit_v1';
    const TASK_ISO_STORAGE_KEY = 'st_iso_tasks_v1';
    const AUDIT_MAX_ENTRIES = 1000;

    // Generador simple de UUID v4
    function uuidv4() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    function escapeHTML(s) {
        if (s === null || s === undefined) return '';
        return ('' + s).replace(/[&<>"']/g, c => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[c]));
    };
    window.security_escapeHTML = escapeHTML;

    // Helper: leer array de audit/tasks desde localStorage
    function _readArray(key) {
        try {
            return JSON.parse(localStorage.getItem(key) || '[]');
        } catch (e) {
            console.error(`security: Error retrieving data for key ${key}:`, e);
            return [];
        }
    }
    
    function _writeArray(key, arr) {
         try {
            if (!Array.isArray(arr)) arr = [];
            if (key === AUDIT_STORAGE_KEY && arr.length > AUDIT_MAX_ENTRIES) {
                arr = arr.slice(arr.length - AUDIT_MAX_ENTRIES);
            }
            localStorage.setItem(key, JSON.stringify(arr));
        } catch (e) {
            console.warn(`security: fallo guardando data for key ${key}`, e);
        }
    }

    // ----------------------------------------------------
    // Auditoría (Log Management)
    // ----------------------------------------------------

    function audit_append(evt) {
        const arr = _readArray(AUDIT_STORAGE_KEY);
        const nowIso = new Date().toISOString();
        const entry = {
            id: uuidv4(),
            ts: evt && evt.ts ? evt.ts : nowIso,
            level: (evt && evt.level) ? evt.level : 'info',
            message: (evt && evt.message) ? String(evt.message) : 'event',
            details: (evt && evt.details) ? evt.details : {},
            meta: (evt && evt.meta) ? evt.meta : {}
        };

        arr.push(entry);
        _writeArray(AUDIT_STORAGE_KEY, arr);
        console.log('AUDIT', entry);
        return entry;
    }

    // ----------------------------------------------------
    // Gestión de Tareas ISO (Local)
    // ----------------------------------------------------

    function security_getAllTasks() {
        return _readArray(TASK_ISO_STORAGE_KEY);
    }
    
    function security_createTask(task) { 
        if (!task.title || task.title.length < 3) {
            return { ok: false, error: "El título es muy corto." };
        }
        if (!task.phase || !['01', '02', '03', '04', '05'].includes(task.phase)) {
            return { ok: false, error: "Debes seleccionar una fase ISO válida." };
        }

        const tasks = security_getAllTasks();
        const sanitizedTask = {
            id: uuidv4(), 
            ts: new Date().toISOString(), 
            title: escapeHTML(task.title),
            desc: escapeHTML(task.desc),
            phase: task.phase,
            due: task.due,
            origin: task.origin,
            status: 'pending'
        };
        tasks.push(sanitizedTask);
        _writeArray(TASK_ISO_STORAGE_KEY, tasks);

        audit_append({
            level: 'info',
            message: 'Tarea ISO creada',
            details: { title: sanitizedTask.title, phase: sanitizedTask.phase },
            meta: { taskId: sanitizedTask.id, origin: task.origin }
        });

        return { ok: true, task: sanitizedTask };
    }
    
    function security_markTaskDone(taskId) {
        let tasks = security_getAllTasks();
        const taskIndex = tasks.findIndex(t => t.id === taskId);

        if (taskIndex !== -1 && tasks[taskIndex].status !== 'done') {
            tasks[taskIndex].status = 'done';
            _writeArray(TASK_ISO_STORAGE_KEY, tasks);
            
            audit_append({
                level: 'success',
                message: 'Tarea ISO marcada como completada',
                details: { taskId: taskId, title: tasks[taskIndex].title },
                meta: { phase: tasks[taskIndex].phase }
            });
        }
    }

    // ----------------------------------------------------
    // Obtener Tareas Generales (Servidor - MODIFICADO)
    // ----------------------------------------------------

    async function security_fetchGeneralTasksFromServer() {
        try {
            const response = await fetch('/tareas', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include' // Envía la cookie de sesión
            });

            if (response.ok) {
                const data = await response.json();
                const taskCount = data.tareas ? data.tareas.length : 0;
                
                // 🌟 DIAGNÓSTICO: Loguea cuántas tareas se recibieron 🌟
                console.log(`SECURITY: 💡 Servidor respondió OK (200). Tareas recibidas: ${taskCount}`);
                console.log("SECURITY: Respuesta del servidor para tareas:", data); 
                
                return data.tareas || [];
            } else if (response.status === 401) {
                // 🌟 DIAGNÓSTICO: Error crítico de sesión 🌟
                console.error("SECURITY: ❌ FAILED 401. La sesión expiró o no se adjuntó la cookie. Tareas no cargadas.");
                audit_append({ level: 'error', message: 'Fallo de autenticación (401) al obtener tareas.' });
                return []; 
            } else {
                console.error(`SECURITY: Error al obtener tareas del servidor (Status: ${response.status})`);
                audit_append({ level: 'error', message: `Fallo de conexión GET /tareas (Status: ${response.status})` });
                return [];
            }
        } catch (error) {
            console.error("SECURITY: Error de conexión total al obtener tareas del servidor:", error);
            audit_append({ level: 'error', message: 'Fallo de conexión total GET /tareas' });
            return [];
        }
    }
    
    
    // ----------------------------------------------------
    // Consolidación de Tareas (Async)
    // ----------------------------------------------------
window.security_getAllConsolidatedTasks = async function() {
    // 1. Obtener tareas ISO (local, síncrono)
    const isoTasks = security_getAllTasks().map(t => ({
        ...t,
        source: 'ISO (Local)', 
        type: 'iso'
    }));

    // 2. Obtener tareas Generales (Servidor, ASÍNCRONO)
    const generalTasksRaw = await security_fetchGeneralTasksFromServer();

    const generalTasks = generalTasksRaw.map(t => ({
        // Mapeo de campos de MongoDB a la estructura del cliente
        id: t._id, 
        ts: t.createdAt || t.fechaCreacion || new Date().toISOString(), 
        title: escapeHTML(t.title),
        desc: escapeHTML(t.desc),
        due: t.due,
        // 🔑 CORRECCIÓN CLAVE 1: Leer el campo 'status' del modelo de Mongoose
        status: t.status || 'pending', // Asume 'pending' si el campo no existe (para datos antiguos)
        // 🔑 CORRECCIÓN CLAVE 2: Asegurar que el ID de Mongoose se mapee como _id
        _id: t._id,
        source: 'General (MongoDB Atlas)',
        type: 'general',
        phase: 'N/A'
    }));

    // 3. Combinar y ordenar
    return [...isoTasks, ...generalTasks].sort((a, b) => new Date(b.ts) - new Date(a.ts));
}

async function security_fetchReportData(mes, anio) {
    const url = `/tareas?mes=${mes}&anio=${anio}`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include' 
        });

        if (response.ok) {
            const data = await response.json();
            // Mapeamos los datos de MongoDB para que sean fáciles de usar en el reporte
            return data.tareas.map(t => ({
                id: t._id, 
                title: t.title,
                status: t.status || 'pending', 
                due: t.due,
                fechaCreacion: t.fechaCreacion,
                source: 'General (MongoDB Atlas)'
            })) || [];
        } else {
            console.error(`SECURITY: Error ${response.status} al obtener reporte.`);
            return null;
        }
    } catch (error) {
        console.error("SECURITY: Error de conexión en reporte:", error);
        return null;
    }
}
window.security_fetchReportData = security_fetchReportData;

})();