import mongoose from "mongoose";

const TareaSchema = new mongoose.Schema({
    title: { type: String, required: true },
    desc: { type: String, required: false },
    due: { type: Date, required: false },
    creadoPor: { type: String, required: false },
    fechaCreacion: { type: Date, default: Date.now },
    // Campos añadidos
    status: { 
        type: String, 
        enum: ['pending', 'done'],
        default: 'pending' 
    }, 
    completedAt: { type: Date, required: false }
}, {
    timestamps: true
});

TareaSchema.statics.deleteTask = async function(taskId) {
    try {
        // Usa deleteOne para remover el documento por su ID
        const result = await this.deleteOne({ _id: taskId });
        
        // Devuelve true si se eliminó un documento
        return result.deletedCount === 1; 
    } catch (error) {
        console.error("Error en Mongoose al eliminar la tarea:", error);
        return false;
    }
};

const collectionName = "TareasGest";

const Tarea = mongoose.models.Tarea || mongoose.model(
    'Tarea',
    TareaSchema,
    collectionName
);

export default Tarea;