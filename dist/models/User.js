"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
// Lazy load bcrypt to handle cases where native bindings aren't available
let bcrypt;
try {
    bcrypt = require("bcrypt");
}
catch (err) {
    console.warn("bcrypt not available - password hashing disabled. Install build tools to enable.");
    bcrypt = null;
}
const UserSchema = new mongoose_1.Schema({
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String },
    name: { type: String, required: true },
    role: {
        type: String,
        enum: ["admin", "department_lead", "user"],
        default: "user",
    },
    // org mirrors activeOrg for existing code paths
    org: { type: mongoose_1.Schema.Types.ObjectId, ref: "Organization", required: true },
    orgs: { type: [mongoose_1.Schema.Types.ObjectId], ref: "Organization", default: [] },
    activeOrg: { type: mongoose_1.Schema.Types.ObjectId, ref: "Organization" },
    department: { type: String },
    isActive: { type: Boolean, default: true },
    zohoId: { type: String },
    zohoAccessToken: { type: String },
    zohoRefreshToken: { type: String },
}, { timestamps: true });
// Performance indexes
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ org: 1, role: 1 });
UserSchema.index({ org: 1, department: 1 });
UserSchema.index({ orgs: 1 });
UserSchema.pre("save", function (next) {
    // Ensure activeOrg is always set and org mirrors it.
    if (!this.activeOrg) {
        this.activeOrg = this.org;
    }
    if (!this.orgs || this.orgs.length === 0) {
        this.orgs = [this.activeOrg];
    }
    if (!this.orgs.some((o) => String(o) === String(this.activeOrg))) {
        this.orgs.push(this.activeOrg);
    }
    this.org = this.activeOrg;
    next();
});
UserSchema.pre("save", async function (next) {
    if (!this.isModified("password") || !this.password)
        return next();
    if (!bcrypt) {
        console.warn("bcrypt not available - password stored in plain text (not recommended)");
        return next();
    }
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }
    catch (err) {
        console.error("Password hashing failed:", err);
    }
    next();
});
UserSchema.methods.comparePassword = function (candidate) {
    if (!this.password)
        return Promise.resolve(false);
    if (!bcrypt) {
        // Fallback: plain text comparison (not secure, but allows system to work)
        console.warn("bcrypt not available - using plain text comparison");
        return Promise.resolve(candidate === this.password);
    }
    return bcrypt.compare(candidate, this.password);
};
exports.default = mongoose_1.default.model("User", UserSchema);
