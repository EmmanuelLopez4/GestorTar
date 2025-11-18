import express from "express";
import { verificarSesion } from "../middleware/autentic.js"; 
import Tarea from "../models/Tarea.js"; 

const router = express.Router();

// [POST] Crea una nueva tarea (Requiere Sesión)
router.post("/", verificarSesion, async (req, res) => {
    const { titulo, descripcion, dueDate } = req.body;
    const creadorUsername = req.session.user.username.toLowerCase(); 

    try {
        if (!dueDate) {
            return res.status(400).json({ msg: "La fecha de entrega es obligatoria." });
        }

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0); 

        const fechaIngresada = new Date(dueDate);
        fechaIngresada.setHours(0, 0, 0, 0); 

        if (fechaIngresada < hoy) {
            return res.status(400).json({
                msg: "No puedes crear una tarea con una fecha anterior a hoy."
            });
        }

        // Crear la tarea
        const nueva = await Tarea.create({
            title: titulo,
            desc: descripcion,
            due: dueDate,
            fechaCreacion: new Date(),
            creadoPor: creadorUsername,
            status: 'pending'
        });

        res.json({ msg: "Tarea creada exitosamente", tarea: nueva });

    } catch (error) {
        console.error("Error al crear la tarea:", error);
        res.status(500).json({ msg: "Error interno del servidor al guardar la tarea." });
    }
});


// [GET] Obtiene todas las tareas del usuario logueado con filtros de mes/año
router.get("/", verificarSesion, async (req, res) => {
    
    const rawUsername = req.session.user.username;
    
    const lowerUsername = rawUsername.toLowerCase();
    const capitalizedUsername = lowerUsername.charAt(0).toUpperCase() + lowerUsername.slice(1);
    const upperUsername = rawUsername.toUpperCase(); 

    const possibleUsers = [lowerUsername, capitalizedUsername, upperUsername];
    
    try {
        const { mes, anio } = req.query; // 🔑 NUEVO: Capturar filtros
        let filtroFecha = {};

        if (mes && anio) {
            const mesInt = parseInt(mes);
            const anioInt = parseInt(anio);
            
            // Crear rango de fechas para el mes
            const fechaInicio = new Date(anioInt, mesInt - 1, 1);
            const fechaFin = new Date(anioInt, mesInt, 1);

            // Filtrar por fechaCreacion O fecha de vencimiento (due)
            filtroFecha = {
                $or: [
                    { fechaCreacion: { $gte: fechaInicio, $lt: fechaFin } },
                    { due: { $gte: fechaInicio, $lt: fechaFin } }
                ]
            };
        }

        // 1. Filtro base de usuario
        let finalQuery = {
            $or: [
                { creadoPor: { $in: possibleUsers } },
                { creadoPor: { $exists: false } },
                { creadoPor: null }
            ]
        };
        
        // 2. Aplicar filtro de fecha si existe
        if (mes && anio) {
            // Si hay filtro de fecha, combinamos los dos filtros con $and
            finalQuery = { $and: [finalQuery, filtroFecha] };
        }
        
        const tareasUsuario = await Tarea.find(finalQuery).sort({ fechaCreacion: -1 }); 

        if (tareasUsuario.length === 0) {
            return res.status(200).json({ msg: "No tienes tareas creadas aún.", tareas: [] });
        }

        res.json({ msg: "Tareas cargadas", tareas: tareasUsuario });

    } catch (error) {
        console.error("Error al obtener las tareas:", error);
        res.status(500).json({ msg: "Error interno del servidor al obtener las tareas." });
    }
});


// [DELETE] Elimina una tarea por ID (Ruta final acordada para el botón)
router.delete("/:id", async (req, res) => { 
    const taskId = req.params.id;

    try {
        const success = await Tarea.deleteTask(taskId);

        if (success) {
            return res.status(200).json({ msg: 'Tarea eliminada exitosamente.' });
        } else {
            return res.status(404).json({ msg: 'Tarea no encontrada.' });
        }
    } catch (error) {
        console.error(`Error al eliminar la tarea ${taskId}:`, error);
        res.status(500).json({ msg: "Error interno del servidor." });
    }
});

export default router;