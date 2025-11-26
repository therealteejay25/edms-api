import { Request, Response } from "express";

// Simple handler to receive Zoho Flow or Creator webhooks. These can be extended
// to validate headers or signatures if available from the sending system.
export async function receiveWebhook(req: Request, res: Response) {
  const event = req.body;
  // TODO: validate signature / origin if Zoho can supply one
  // For now we just log and accept
  // eslint-disable-next-line no-console
  console.log("Received Zoho webhook", JSON.stringify(event).slice(0, 2000));
  res.json({ ok: true });
}

export default { receiveWebhook };
