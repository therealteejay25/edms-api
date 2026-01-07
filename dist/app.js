"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const morgan_1 = __importDefault(require("morgan"));
const routes_1 = __importDefault(require("./routes"));
const app = (0, express_1.default)();
app.use((0, morgan_1.default)("dev"));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)());
const FRONTEND = "https://zentra-kappa.vercel.app";
app.use((0, cors_1.default)({
    origin: FRONTEND,
    credentials: true,
}));
app.use("/uploads", express_1.default.static("uploads"));
app.use("/api", routes_1.default);
app.get("/", (_req, res) => res.json({ ok: true, service: "EDMS API" }));
// Basic error handler
app.use((err, _req, res, _next) => {
    // eslint-disable-next-line no-console
    console.error(err);
    res
        .status(err.status || 500)
        .json({ message: err.message || "Internal server error" });
});
exports.default = app;
