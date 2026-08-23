export async function chargeAndRecord(
  chargeCard: (userId: string, amount: number) => Promise<void>,
  insertBillingRecord: (userId: string, amount: number) => Promise<void>,
  userId: string,
  amount: number
) {
  await chargeCard(userId, amount);
  await insertBillingRecord(userId, amount);
  return { charged: amount };
}