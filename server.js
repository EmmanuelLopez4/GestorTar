import express from "express";
import session from "express-session";
import MongoStore from 'connect-mongo'; 
import conectarBD from "./config/db.js"; 
import tareasRoutes from "./routes/tareas.js";
import emailRoutes from "./routes/email.js";
import { verificarSesion } from "./middleware/autentic.js";
import Usuario from "./models/Usuario.js"; // Se mantiene la importación del Modelo de Usuario

const app = express();
app.use(express.json());

// Configuraciones de archivos estáticos
app.use(express.static("."));
app.use(express.static("views"));
app.use(express.static("email"));


// FUNCIÓN ASÍNCRONA PRINCIPAL PARA INICIAR EL SERVIDOR
async function startServer() {
    // 1. Conectar a la base de datos y obtener la conexión
    const dbConnection = await conectarBD();

    // --- SEEDING INICIAL (Creación del usuario 'david' para pruebas) ---
    const MOCK_USERNAME = "david"; 
    const MOCK_ROLE = "admin";
    
    // El modelo Usuario ya se cargó, podemos usarlo.
    const existingUser = await Usuario.findOne({ username: MOCK_USERNAME });

    if (!existingUser) {
        await Usuario.create({
            username: MOCK_USERNAME,
            role: MOCK_ROLE
        });
        console.log(`[SEED] Usuario inicial '${MOCK_USERNAME}' (Admin) creado.`);
    }
    // ---------------------------------------------------

    // 2. Crear el store persistente DEPUÉS de que la conexión esté lista
    const sessionStore = MongoStore.create({
        client: dbConnection.client, 
        collectionName: 'sessions',
        ttl: 60 * 60 * 24 
    });

    // 3. Configuración de la sesión de Express
    app.use(
        session({
            secret: "12345",
            resave: false,
            saveUninitialized: false,
            store: sessionStore, 
            cookie: {
                secure: false, 
                httpOnly: true,
                maxAge: 1000 * 60 * 60 * 24 
            }
        })
    );
    
    // Rutas (Definidas después de app.use(session))

    // RUTA DE LOGIN: SÓLO CONSULTA SI EL USUARIO EXISTE EN LA BASE DE DATOS
    app.post("/login", async (req, res) => {
        const { username } = req.body;

        if (!username) {
            return res.status(400).json({ msg: "Usuario requerido." });
        }

        try {
            // 1. Buscar usuario por nombre (usando toLowerCase() para la búsqueda insensible)
            const user = await Usuario.findOne({ username: username.toLowerCase() });

            // 2. Verificar existencia del usuario
            if (!user) {
                return res.status(401).json({ msg: "Usuario no encontrado en la base de datos." });
            }

            // 3. Crear sesión exitosa
            req.session.user = {
                username: user.username, 
                role: user.role
            };
            
            // 4. Guardar la sesión en MongoDB
            req.session.save((err) => {
                if (err) {
                    console.error("Error guardando sesión en Mongo:", err);
                    return res.status(500).json({ msg: "Error al guardar sesión." });
                }
                res.json({ msg: "Sesión iniciada", username: user.username, role: user.role });
            });

        } catch (error) {
            console.error("Error en la verificación de login:", error);
            res.status(500).json({ msg: "Error interno del servidor." });
        }
    });

    app.get("/logout", (req, res) => {
        // Destruye la sesión de MongoDB y limpia la cookie
        req.session.destroy((err) => {
            if (err) {
                console.error("Error al destruir sesión en Mongo:", err);
                return res.status(500).json({ msg: "Error al cerrar sesión." });
            }
            res.clearCookie('connect.sid'); 
            res.status(200).json({ msg: "Sesión cerrada correctamente." });
        });
    });

    // Aplicamos el middleware de verificación
    app.use("/tareas", verificarSesion, tareasRoutes);
    app.use("/email", emailRoutes);

    // 4. Iniciar el servidor
    app.listen(3000, () => console.log("Servidor en http://localhost:3000"));
}

startServer();