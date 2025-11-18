import mongoose from "mongoose";

const EmailSubscriptionSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true, // Para asegurar que no se repitan los correos
        lowercase: true,
        trim: true,
        match: [/.+\@.+\..+/, "Por favor, introduce un correo válido"] // Simple validación de formato
    },
    fechaSuscripcion: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

const EmailSubscription = mongoose.model("EmailSubscription", EmailSubscriptionSchema);

export default EmailSubscription;