import mongoose from "mongoose";
import User from "../../models/user.model.js";
import { fgaClient } from "../../services/openFGAService.js";

export const resolveObjectPermissions = async (objectName) => {
  const allTuples = [];
  let continuationToken;

  do {
    const response = await fgaClient.read(
      {
        tuple_key: {
          object: objectName,
        },
      },
      continuationToken
        ? { continuationToken }
        : undefined
    );

    allTuples.push(
      ...(response.tuples || [])
    );

    continuationToken =
      response.continuation_token;
  } while (continuationToken);

  const collaborators = allTuples
    .filter(
      (tuple) =>
        tuple.key.object === objectName &&
        tuple.key.user?.startsWith("user:") &&
        ["owner", "reader", "writer"].includes(
          tuple.key.relation
        )
    )
    .map((tuple) => ({
      userId: tuple.key.user.slice(5),
      relation: tuple.key.relation,
    }));

  if (!collaborators.length) {
    return [];
  }

  const userIds = collaborators
    .map((c) => c.userId)
    .filter((id) =>
      mongoose.isValidObjectId(id)
    );

  if (!userIds.length) {
    return [];
  }

  const users = await User.find({
    _id: {
      $in: userIds,
    },
  })
    .select("name email avatar")
    .lean();

  const relationMap = new Map();

  for (const collaborator of collaborators) {
    relationMap.set(
      collaborator.userId,
      collaborator.relation
    );
  }

  return users
    .map((user) => {
      const relation =
        relationMap.get(
          user._id.toString()
        );

      if (!relation) {
        return null;
      }

      return {
        user,
        relation,
      };
    })
    .filter(Boolean);
};