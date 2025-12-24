"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../prisma");
const router = (0, express_1.Router)();
/**
 * SIGNUP
 */
router.post("/signup", async (req, res) => {
    const { email, password, name } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: "Missing email or password" });
    }
    try {
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        const user = await prisma_1.prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
            },
        });
        res.status(201).json({
            id: user.id,
            email: user.email,
            name: user.name,
        });
    }
    catch (error) {
        res.status(400).json({ error: "User already exists" });
    }
});
/**
 * LOGIN
 */
router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma_1.prisma.user.findUnique({
        where: { email },
    });
    if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
    }
    const validPassword = await bcrypt_1.default.compare(password, user.password);
    if (!validPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ token });
});
exports.default = router;
