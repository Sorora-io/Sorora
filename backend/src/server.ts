import { requireAuth } from "./middleware/auth";
import authRoutes from "./routes/auth";
import { prisma } from "./prisma";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

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

app.use("/auth", authRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

app.get("/me", requireAuth, async (req, res) => {
  const userId = (req as any).userId;

  const user = await prisma.user.findUnique({
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

