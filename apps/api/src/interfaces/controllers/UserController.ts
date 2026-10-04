import { Request, Response } from "express";
import { CreateUser } from "../../domain/use-cases/CreateUser";
import { GetUser } from "../../domain/use-cases/GetUser";
import { UpdateUser } from "../../domain/use-cases/UpdateUser";

export class UserController {
  constructor(
    private createUserUSeCase: CreateUser,
    private getUserUSeCase: GetUser,
    private updateUserUSeCase: UpdateUser,
  ) {}

  async create(req: Request, res: Response): Promise<void> {
    try {
      const uid = req.user!.uid;
      const user = await this.createUserUSeCase.execute(uid, req.body);
      res.status(201).json(user);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const user = await this.getUserUSeCase.execute(userId);
      res.status(200).json(user);
    } catch (error: any) {
      const status = error.message === "Usuário não encontrado." ? 404 : 400;
      res.status(status).json({ error: error.message });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const requesterId = req.user!.uid;
      const requesterRole = req.user!.role;

      const updated = await this.updateUserUSeCase.execute(
        requesterId,
        requesterRole,
        userId,
        req.body,
      );

      res.status(200).json(updated);
    } catch (error: any) {
      const status = error.message.startsWith("Acesso negado") ? 403 : 400;
      res.status(status).json({ error: error.message });
    }
  }
}
