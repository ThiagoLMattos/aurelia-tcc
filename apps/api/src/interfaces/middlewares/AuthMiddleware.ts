import { Request, Response, NextFunction } from "express";
import { getAuth } from "firebase-admin/auth";
import { db } from "../../infrastructure/database/firebase";

export class AuthMiddleware {
  public static async isAuthenticated(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    const authHeader = req.headers.authorization;

    if (typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Token de autenticação não fornecido ou inválido! " });
    }

    const idToken = authHeader.replace(/^Bearer\s+/, "");

    if (!idToken) {
      return res
        .status(401)
        .json({ error: "Token de autenticação não fornecido ou inválido" });
    }

    try {
      const decodedToken = await getAuth().verifyIdToken(idToken);
      const userDoc = await db.collection("users").doc(decodedToken.uid).get();

      if (!userDoc.exists) {
        return res
          .status(403)
          .json({ error: "Usuário não encontrado na base de dados." });
      }

      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email || "",
        role: userDoc.data()?.role || "patient",
      };

      return next();
    } catch (error) {
      console.error("Erro no middleware de auth", error);
      
      return res
        .status(401)
        .json({ error: "Acesso negado. Token inválido ou espirado." });
    }
  }

  public static isRole(allowedRoles: ("patient" | "caregiver")[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({ error: "Usuário não autenticado. " });
      }

      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          error:
            "Acesso proibido. Seu perfil não tem permissão para esta ação. ",
        });
      }

      return next();
    };
  }
}
