import jwt from "jsonwebtoken";

export const authUser = (req, res, next) => {
  try {
    const { token: cookieToken } = req.cookies;
    const tokenHeader = req.headers.token;
    const authHeader = req.headers.authorization;

    let token = cookieToken || tokenHeader;

    if (!token && authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ message: "Unauthorised - No token provided", success: false });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.id;
    next();
  } catch (error) {
    console.error("User Authentication error:", error.message);
    return res.status(401).json({ message: "Unauthorised - Invalid or expired token", success: false });
  }
};