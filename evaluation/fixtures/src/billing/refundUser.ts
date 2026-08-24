export async function refundUser(
  userId: string,
  amountCents: number,
  gateway: { refund: (id: string, amount: number) => Promise<void> },
  db: { insertBillingRecord: (id: string, amount: number) => Promise<void> }
) {
  await gateway.refund(userId, amountCents);
  await db.insertBillingRecord(userId, -amountCents);
  return { refunded: true };
}
