import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey"; // move to .env in production
const JWT_EXPIRES = "365d"; // token expiry

// Generate Token
export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES,
  });
}

// Verify Token
export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}
