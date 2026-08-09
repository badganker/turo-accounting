export const INCOME_CATEGORIES = ["trip_earning", "reimbursement", "extras", "other_income"];

export const EXPENSE_CATEGORIES = [
  "fuel",
  "cleaning",
  "maintenance",
  "insurance",
  "toll",
  "supplies",
  "parking",
  "fee",
  "other_expense",
];

// "fee" (Turo cancellation/platform fees, from Sync — see
// server/src/turo/sync.js) has no physical receipt to photograph, so it's
// left out of the picker for AI-scanned receipts. Keep this in sync with
// server/src/lib/claudeVision.js's EXPENSE_CATEGORIES, which prompts Claude
// with the same list.
export const RECEIPT_EXPENSE_CATEGORIES = EXPENSE_CATEGORIES.filter((c) => c !== "fee");
