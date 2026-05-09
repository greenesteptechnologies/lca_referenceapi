import { Request, Response, NextFunction } from "express";

export function validate(schema: any) {
	return (req: Request, res: Response, next: NextFunction) => {
		// Implement schema validation logic here (e.g., using Joi or Zod)
		next();
	};
}
