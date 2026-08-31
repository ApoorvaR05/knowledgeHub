import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { SearchService } from '../services/SearchService';

const searchService = new SearchService();

export const search = async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ errors: errors.array() });
    return;
  }

  const { query, topK: rawTopK } = req.body as { query: string; topK?: unknown };

  let topK = 5;
  if (rawTopK !== undefined) {
    const parsed = parseInt(String(rawTopK), 10);
    topK = Number.isNaN(parsed) ? 5 : Math.min(parsed, 20);
  }

  const results = await searchService.search(query, topK);
  res.status(200).json({ results, query });
};
