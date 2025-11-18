import express from "express";
import Usuario from "../models/Usuario.js";

const router = express.Router();

// LOGIN
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const user = await Usuario.findOne({ username, password });

  if (!user) return res.status(401).json({ error: "Datos incorrectos" });

  req.session.userId = user._id;
  req.session.role = user.role;

  res.json({ msg: "Login correcto", role: user.role });
});

// LOGOUT
router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ msg: "Sesión cerrada" });
  });
});

export default router;
