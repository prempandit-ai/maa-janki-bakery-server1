import jwt from "jsonwebtoken";

export const authSeller = (req, res, next) => {
  try {
    const { sellerToken } = req.cookies;
    const tokenHeader = req.headers.token;
    const authHeader = req.headers.authorization;

    let token = sellerToken || tokenHeader;

    if (!token && authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ message: "Unauthorised - No token provided", success: false });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const sellerEmail = process.env.SELLER_EMAIL?.trim().toLowerCase();

    if (decoded.role !== "seller" || decoded.email !== sellerEmail) {
      return res.status(401).json({ message: "Unauthorised - Invalid credentials", success: false });
    }

    req.seller = decoded.email;
    next();
  } catch (error) {
    console.error("Seller authentication error:", error.message);
    return res.status(401).json({ message: "Unauthorised - Invalid or expired token", success: false });
  }
};
