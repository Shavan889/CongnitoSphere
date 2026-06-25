const express = require("express");
const authControllers = require("../controller/auth.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const router = express.Router();

router.post("/register", authControllers.registerUser);
router.post("/login", authControllers.loginUser);
router.post("/logout", authControllers.LogoutUser);

router.get("/me", authMiddleware.authUser, (req, res) => {
  res.status(200).json({
    user: {
      email: req.user.email,
      _id: req.user._id,
      fullName: req.user.fullName,
    },
  });
});

module.exports = router;
