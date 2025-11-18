import mongoose from "mongoose";

// Definimos un esquema simple para el usuario
const UsuarioSchema = new mongoose.Schema({
    username: { 
        type: String, 
        required: true, 
        unique: true,
        // Usamos lowercase para asegurar que las búsquedas sean insensibles a mayúsculas
        set: v => v.toLowerCase(), 
        get: v => v 
    },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    fechaRegistro: { type: Date, default: Date.now }
});

// CRÍTICO CORREGIDO: Verificamos si el modelo 'Usuario' ya existe antes de compilarlo.
// Si ya está en el registro (mongoose.models), lo devuelve.
const Usuario = mongoose.models.Usuario || mongoose.model("Usuario", UsuarioSchema);

export default Usuario;