import { Schema } from "mongoose";

const recentActivitySchema = new Schema({
    fileId: {
        type: Schema.Types.ObjectId,
        ref: "File",
        required: true
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    action: {
        type: String,
        enum: ["view", "edit", "download", "share"],
        required: true
    }
}, {
    timestamps: true
});

const Recent = mongoose.model("Recent", recentActivitySchema)

export default Recent;