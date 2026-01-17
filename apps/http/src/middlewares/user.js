import jwt from "jsonwebtoken";

export const userMiddleware = (req, res, next) => {
  const token = req.cookies?.jwt;   // ✅ READ FROM COOKIE

  if (!token) {
    return res.status(401).json({
      message: "Not logged in"
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "User" && decoded.role !== "Admin") {
      return res.status(403).json({
        message: "Forbidden"
      });
    }

    req.user = decoded;     // ✅ attach full user object
    next();
  } catch (err) {
    return res.status(401).json({
      message: "Invalid or expired token"
    });
  }
};
