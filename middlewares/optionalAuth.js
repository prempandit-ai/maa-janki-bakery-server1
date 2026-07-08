import jwt from "jsonwebtoken";

export const optionalAuth = (req, res, next) => {
    try {
        const { token: cookieToken } = req.cookies;
        const tokenHeader = req.headers.token;
        const authHeader = req.headers.authorization;

        let token = cookieToken || tokenHeader;

        if (!token && authHeader && authHeader.startsWith("Bearer ")) {
            token = authHeader.split(" ")[1];
        }

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
