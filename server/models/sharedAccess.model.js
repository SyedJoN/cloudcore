import mongoose, { Schema } from "mongoose";

/**
 * Records the first time an item was shared with a given user — mirrors
 * Google Drive's `file.sharedWithMeTime`.
 *
 * Written once, when a user first gets *direct* access to an item (see
 * giveAccessById). Later role changes for that same user/item pair don't
 * touch it — same as Drive, where re-sharing or changing someone's role
 * doesn't reset when it says the file was shared with them.
 *
 * For access a user gets *through* a shared ancestor folder rather than a
 * direct grant, resolveRole looks up this same collection keyed by that
 * ancestor's id instead of the descendant's — there's no separate grant
 * event for the descendant, so the ancestor's record is the only source
 * of truth for "when this became visible to them."
 */
const sharedAccessSchema = new Schema(
  {
    itemId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    itemType: {
      type: String,
      enum: ["file", "folder"],
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sharedWithMeTime: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// One record per (item, user) — the upsert in giveAccessById relies on this.
sharedAccessSchema.index({ itemId: 1, itemType: 1, userId: 1 }, { unique: true });

const SharedAccess = mongoose.model("SharedAccess", sharedAccessSchema);
export default SharedAccess;