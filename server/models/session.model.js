import mongoose, { Schema } from "mongoose";

const sessionSchema = new Schema(
  {
    userId: {
        type: Schema.Types.ObjectId,
        required: true
    },
    createdAt: {
        type: Date,
        expires: 3600,
        default: Date.now
    }
  }
   
);

const Session = mongoose.model("Session", sessionSchema);
export default Session;
