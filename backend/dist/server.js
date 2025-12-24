"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const auth_1 = require("./middleware/auth");
const auth_2 = __importDefault(require("./routes/auth"));
const prisma_1 = require("./prisma");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Health check route
app.get("/health", (req, res) => {
    res.json({ status: "ok", message: "Backend is running" });
});
//test
/*app.post("/users", async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    const user = await prisma.user.create({
      data: {
        email,
        password,
        name,
      },
    });

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
    });
  } catch (error) {
    res.status(400).json({ error: "User already exists" });
  }
});*/
const PORT = process.env.PORT || 4000;
app.use("/auth", auth_2.default);
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
app.get("/me", auth_1.requireAuth, async (req, res) => {
    const userId = req.userId;
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
        },
    });
    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
});
