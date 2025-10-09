import jwt from 'jsonwebtoken';
// Middleware to check if the user's token is verified
export const verifyUserToken = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1]; // Extract token from the Authorization header
    if (!token) {
        res.status(401).json({ message: 'Token not provided' });
        return; // Ensure the function exits here
    }
    try {
        const secretKey = process.env.JWT_SECRET_KEY || 'defaultSecret';
        const decoded = jwt.verify(token, secretKey);
        req.id = decoded.id; // Attach user data (id) to the request object
        next(); // Proceed to the next middleware or route handler
    }
    catch (error) {
        res.status(401).json({ message: 'Invalid or expired token' });
    }
};
//# sourceMappingURL=authMiddleware.js.map