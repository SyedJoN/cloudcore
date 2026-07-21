import mongoose from "mongoose";
import { connectDB } from "./db.js";

await connectDB();
const client = mongoose.connection.getClient();

try {
  const db = mongoose.connection.db;
  const command = "collMod";

  await db.command({
    [command]: "directories",
    validator: {
      $jsonSchema: {
        bsonType: "object",

        required: [
          "_id",
          "name",
          "userId",
          "parentDirId",
          "__v",
          "createdAt",
          "updatedAt",
        ],
        properties: {
          _id: {
            bsonType: "objectId",
          },
          name: {
            bsonType: "string",
          },
          size: {
            bsonType: ["int", "long", "double"],
          },
          userId: {
            bsonType: "objectId",
          },
          isPublic: {
            bsonType: "bool",
          },
          publicRole: {
            bsonType: "string",
            enum: ["viewer", "editor", "commenter"],
          },
          parentDirId: {
            bsonType: ["objectId", "null"],
          },
          path: {
            bsonType: "array",
            items: {
              bsonType: "objectId",
            },
          },
          isDeleted: {
            bsonType: "bool",
          },
          __v: {
            bsonType: "int",
          },
          createdAt: {
            bsonType: "date",
          },
          updatedAt: {
            bsonType: "date",
          },
        },
        additionalProperties: false,
      },
    },
    validationAction: "error",
    validationLevel: "strict",
  });

  await db.command({
    [command]: "files",
    validator: {
      $jsonSchema: {
        bsonType: "object",

        required: [
          "_id",
          "name",
          "extension",
          "parentDirId",
          "userId",
          "__v",
          "createdAt",
          "updatedAt",
        ],
        properties: {
          _id: {
            bsonType: "objectId",
          },
          name: {
            bsonType: "string",
          },

          extension: {
            bsonType: "string",
          },
          size: {
            bsonType: ["int", "long", "double"],
          },
          parentDirId: {
            bsonType: ["objectId", "null"],
          },
          path: {
            bsonType: "array",
            items: {
              bsonType: "objectId",
            },
          },
          userId: {
            bsonType: "objectId",
          },
          isPublic: {
            bsonType: "bool",
          },
          publicRole: {
            bsonType: "string",
            enum: ["viewer", "editor", "commenter"],
          },
          isDeleted: {
            bsonType: "bool",
          },
          __v: {
            bsonType: "int",
          },
          createdAt: {
            bsonType: "date",
          },
          updatedAt: {
            bsonType: "date",
          },
        },
        additionalProperties: false,
      },
    },
    validationAction: "error",
    validationLevel: "strict",
  });
  await db.command({
    [command]: "users",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: [
          "_id",
          "name",
          "email",
          "parentDirId",
          "provider",
          "__v",
          "createdAt",
          "updatedAt",
        ],
        properties: {
          _id: {
            bsonType: "objectId",
          },
          name: {
            bsonType: "string",
            minLength: 3,
            description: "name field should be atleast 3 characters.",
          },
          email: {
            bsonType: "string",
            pattern: "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+.[A-Za-z]{2,}$",
            description: "please enter a valid email",
          },
          password: {
            bsonType: ["null", "string"],
          },
          avatar: {
            bsonType: ["null", "string"],
          },
          parentDirId: {
            bsonType: ["objectId", "null"],
          },

          provider: {
            enum: ["local", "google"],
          },
          role: {
            enum: ["superuser", "admin", "manager", "user"],
          },
          totalStorage: {
           bsonType: ["int", "long", "double"]
          },
          cooldown: {
            bsonType: ["null", "date"],
          },
          isDeleted: {
            bsonType: "bool",
          },
          deletedAt: {
            bsonType: ["null", "date"],
          },
          __v: {
            bsonType: "int",
          },
          createdAt: {
            bsonType: "date",
          },
          updatedAt: {
            bsonType: "date",
          },
        },
        additionalProperties: false,
      },
    },
    validationAction: "error",
    validationLevel: "strict",
  });
} catch (err) {
  console.log("Error setting up the database", err);
} finally {
  await client.close();
}
