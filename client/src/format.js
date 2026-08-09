export function money(cents) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}
