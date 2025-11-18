import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function conectarBD() {
    try {
        // 1. CONEXIÓN A MONGODB ATLAS
        await mongoose.connect(process.env.SECRET_MONGO);
        console.log("MongoDB Atlas conectado");
        
        // Devolvemos el objeto de conexión. Esto es CRUCIAL para MongoStore.
        return mongoose.connection; 
    } catch (err) {
        console.error("Error en conexión:", err);
        // Si la conexión falla, detenemos el proceso
        process.exit(1); 
    }
}

export default conectarBD;