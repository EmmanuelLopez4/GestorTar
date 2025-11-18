import express from "express";
import EmailSubscription from "../models/EmailSubscription.js";

const router = express.Router();

// POST /email - Ruta pública para guardar correos en la base de datos
router.post("/", async (req, res) => {
    const { email } = req.body;

    // REGISTRO DE DEBUG: Confirma qué valor está recibiendo el servidor
    console.log("-> Solicitud POST /email recibida. Correo:", email); 

    if (!email) {
        // Esto solo ocurre si el cliente no envía el campo 'email'
        return res.status(400).json({ msg: "El correo electrónico es obligatorio." });
    }

    try {
        // Usa el modelo confirmado para crear el documento
        const nuevaSuscripcion = await EmailSubscription.create({
            email: email
        });

        res.json({ msg: "Correo guardado con éxito. ¡Gracias!", email: nuevaSuscripcion.email });

    } catch (error) {
        // Manejar error de duplicado (código 11000)
        if (error.code === 11000) {
            return res.status(409).json({ msg: "Este correo ya está registrado." });
        }
        console.error("ERROR CRÍTICO DE BD:", error); // REGISTRO DE DEBUG
        res.status(500).json({ msg: "Error interno del servidor al procesar el correo." });
    }
});

export default router;