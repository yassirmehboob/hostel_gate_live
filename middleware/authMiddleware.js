import jwt from "jsonwebtoken";
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

function apiKeysMatch(providedKey, configuredKey) {
  const providedHash = crypto.createHash("sha256").update(providedKey).digest();
  const configuredHash = crypto.createHash("sha256").update(configuredKey).digest();

  return crypto.timingSafeEqual(providedHash, configuredHash);
}

export default function authMiddleware(req, res, next) {
  const apiKey = req.get("x-api-key");
  const configuredApiKey = process.env.API_KEY;

  // Server-to-server clients authenticate without creating a user session.
  if (apiKey) {
    if (!configuredApiKey) {
      return res.status(503).json({ message: "API key authentication is not configured" });
    }

    if (!apiKeysMatch(apiKey, configuredApiKey)) {
      return res.status(401).json({ message: "Invalid API key" });
    }

    req.auth = { type: "api-key" };
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Authentication required. Send X-API-Key or a Bearer token",
    });
  }

  const token = authHeader.slice("Bearer ".length).trim();

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    req.auth = { type: "jwt" };
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
