import Tarea from "../models/Tarea.js"; // <--- CORREGIDO: Importación por defecto

// Middleware para verificar que haya una sesión activa y un usuario
export function verificarSesion(req, res, next) {
    // DIAGNÓSTICO: Imprime la sesión que recibe el servidor
    console.log("DIAGNÓSTICO SESIÓN -> req.session:", req.session);
    console.log("DIAGNÓSTICO SESIÓN -> req.session.user:", req.session?.user);

    // Verificamos si existe la sesión Y si el objeto de usuario contiene el username
    if (req.session && req.session.user && req.session.user.username) {
        // Todo OK, pasar a la siguiente función de la ruta
        next();
    } else {
        // NO AUTORIZADO
        // Esto es lo que provoca el 401 en el cliente
        return res.status(401).json({ msg: "No autorizado. La sesión no está activa o expiró." });
    }
}

export function verificarAdmin(req, res, next) {
    // Asume que req.session.user.role existe
    if (!req.session.user || req.session.user.role !== "admin") {
        return res.status(403).json({ error: "Solo administradores" });
    }
    next();
}