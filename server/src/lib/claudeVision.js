import Anthropic from "@anthropic-ai/sdk";

const EXPENSE_CATEGORIES = [
  "fuel",
  "cleaning",
  "maintenance",
  "insurance",
  "toll",
  "supplies",
  "parking",
  "other_expense",
];

let client = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set in server/.env");
  }
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export async function extractReceipt(base64Image, mediaType) {
  const anthropic = getClient();

  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64Image } },
          {
            type: "text",
            text: `This is a receipt for a Turo car-hosting business expense (fuel, cleaning, maintenance, tolls, etc).
Extract the following and reply with ONLY a JSON object, no markdown fences, no commentary:
{
  "vendor": string,
  "amount": number (total amount, in dollars, e.g. 42.50),
  "currency": string (3-letter code, default "USD"),
  "date": string (YYYY-MM-DD; use your best reading of the receipt date),
  "category": one of ${JSON.stringify(EXPENSE_CATEGORIES)},
  "description": short string summarizing what was purchased,
  "confidence": "high" | "medium" | "low"
}
If a field truly cannot be read, use null for it (except currency, default "USD").`,
          },
        ],
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock) throw new Error("No text response from Claude.");

  let parsed;
  try {
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : textBlock.text);
  } catch {
    throw new Error(`Could not parse Claude's response as JSON: ${textBlock.text.slice(0, 200)}`);
  }
  return parsed;
}

export { EXPENSE_CATEGORIES };
