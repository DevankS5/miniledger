import { Router } from 'express';
import { pool } from './db';
import { HttpError, parse } from './http';
import { idParam, loanSchema } from './validation';

export const loansRouter = Router();

const COLUMNS = `id, friend_name AS "friendName", amount, due_date AS "dueDate", repaid_at AS "repaidAt",
  created_at AS "createdAt", receipt IS NOT NULL AS "hasReceipt",
  (repaid_at IS NULL AND due_date < CURRENT_DATE) AS overdue`;

loansRouter.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM loans WHERE user_id = $1 ORDER BY (repaid_at IS NOT NULL), due_date, id`,
    [req.userId],
  );
  res.json(rows);
});

loansRouter.post('/', async (req, res) => {
  const loan = parse(loanSchema, req.body);
  const { rows } = await pool.query(
    `INSERT INTO loans (user_id, friend_name, amount, due_date, receipt, receipt_mime)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${COLUMNS}`,
    [
      req.userId,
      loan.friendName,
      loan.amount,
      loan.dueDate,
      loan.receipt ? Buffer.from(loan.receipt.base64, 'base64') : null,
      loan.receipt?.mimeType ?? null,
    ],
  );
  res.status(201).json(rows[0]);
});

loansRouter.post('/:id/repay', async (req, res) => {
  const { id } = parse(idParam, req.params);
  const { rows } = await pool.query(
    `UPDATE loans SET repaid_at = COALESCE(repaid_at, now()) WHERE id = $1 AND user_id = $2 RETURNING ${COLUMNS}`,
    [id, req.userId],
  );
  if (!rows.length) throw new HttpError(404, 'Loan not found');
  res.json(rows[0]);
});

loansRouter.get('/:id/receipt', async (req, res) => {
  const { id } = parse(idParam, req.params);
  const { rows } = await pool.query('SELECT receipt, receipt_mime FROM loans WHERE id = $1 AND user_id = $2', [id, req.userId]);
  if (!rows[0]?.receipt) throw new HttpError(404, 'No receipt for this loan');
  res.type(rows[0].receipt_mime).send(rows[0].receipt);
});

export async function summary(userId: number) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS "totalLent",
            COALESCE(SUM(amount) FILTER (WHERE repaid_at IS NOT NULL), 0) AS "totalRepaid",
            COALESCE(SUM(amount) FILTER (WHERE repaid_at IS NULL AND due_date < CURRENT_DATE), 0) AS "overdueAmount"
     FROM loans WHERE user_id = $1`,
    [userId],
  );
  return rows[0] as { totalLent: number; totalRepaid: number; overdueAmount: number };
}
