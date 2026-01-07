"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = connectDB;
const mongoose_1 = __importDefault(require("mongoose"));
async function connectDB() {
    const uri = process.env.MONGO_URI || "mongodb://localhost:27017/edms";
    // eslint-disable-next-line no-console
    console.log("Connecting to MongoDB:", uri);
    await mongoose_1.default.connect(uri);
    // eslint-disable-next-line no-console
    console.log("MongoDB connected");
}
