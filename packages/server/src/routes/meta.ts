import { Router } from "express";
import type { Request, Response } from "express";
import { getMetaData } from "../meta/data-service.js";

export const metaRouter = Router();

metaRouter.get("/:patch", async (req: Request, res: Response) => {
  const meta = await getMetaData(req.params.patch);

  if (!meta) {
    res.status(404).json({ error: `No meta data for patch ${req.params.patch}` });
    return;
  }

  res.json(meta);
});

metaRouter.get("/", async (_req: Request, res: Response) => {
  const meta = await getMetaData("current");

  if (!meta) {
    res.status(404).json({ error: "No current meta data available" });
    return;
  }

  res.json(meta);
});
