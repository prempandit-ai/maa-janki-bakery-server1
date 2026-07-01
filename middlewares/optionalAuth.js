import jwt from "jsonwebtoken";

export const optionalAuth = (req, res, next) => {
    try {
        const { token } = req.cookies;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded.id;
        }
        next();
    } catch (error) {
        // If token is invalid, just proceed without req.user
        next();
    }
};
