/**
 * Payments adapter. Stub for this round: the shop is pay-at-the-chair, so nothing is charged online.
 * When the owner wants deposits, implement this interface (e.g. Stripe) and flip isEnabled().
 */
export interface PaymentsAdapter {
  isEnabled(): boolean;
  createDepositIntent(input: { bookingId: string; amountCents: number }): Promise<{ clientSecret: string }>;
}

export const payments: PaymentsAdapter = {
  isEnabled: () => false,
  async createDepositIntent() {
    throw new Error("Payments are not configured. Pay at the shop. See TODO-LIVE.md.");
  },
};
