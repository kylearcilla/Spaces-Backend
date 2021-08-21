import jwt from "jsonwebtoken";
const JWT_KEY = process.env.JWT_KEY ?? "0";

export const generateToken = (email: string) => {
  return jwt.sign(
    {
      email: email,
    },
    JWT_KEY
  );
};

export const verifyToken = (req: any) => {
  const authHeader: string = req.headers.authorization;
  if (!authHeader) {
    return {
      hasError: true,
      response: "Authorization header must be provider",
    };
  }
  const token = authHeader.slice(7);
  if (!token) {
    return {
      hasError: true,
      response: "Authentication token must be 'Bearer [token]",
    };
  }
  try {
    const decodedToken = jwt.verify(token, JWT_KEY);
    return {
      hasError: false,
      decodedToken,
    };
  } catch (e) {
    return {
      hasError: true,
      response: "Invalid/Expired Token",
    };
  }
};
