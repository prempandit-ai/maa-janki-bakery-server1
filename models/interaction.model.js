
import mongoose from "mongoose";

const interactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: false, // Can be null for guests
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
    },
    action: {
        type: String,
        enum: ["view", "click", "add_to_cart", "purchase"],
        required: true,
    },
    timestamp: {
        type: Date,
        default: Date.now,
    }
}, { timestamps: true });

const Interaction = mongoose.model("Interaction", interactionSchema);
export default Interaction;
