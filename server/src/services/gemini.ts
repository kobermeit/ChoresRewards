import { AppSetting } from '../db';

export interface StructuredIngredient {
  raw: string;
  name: string;
  qty: string;
  store: string;
  prep?: string;
  catalog_id?: number | null;
  uncataloged?: boolean;
  in_pantry?: boolean;
}

export interface ExtractedRecipe {
  title: string;
  type?: string;
  cuisine?: string;
  servings?: string;
  prep_time?: string;
  cook_time?: string;
  ingredients: StructuredIngredient[];
  instructions: string[];
}

export function getGeminiApiKey(): string {
  const dbKey = AppSetting.get('gemini_api_key');
  if (dbKey && dbKey.trim()) return dbKey.trim();
  return (process.env.GEMINI_API_KEY || '').trim();
}

export function getGeminiModel(): string {
  const dbModel = AppSetting.get('gemini_model');
  if (dbModel && dbModel.trim()) return dbModel.trim();
  return (process.env.GEMINI_MODEL || 'gemini-2.0-flash').trim();
}

export async function testGeminiConnection(
  testKey?: string,
  testModel?: string
): Promise<{ success: boolean; message: string; model: string }> {
  const key = (testKey || getGeminiApiKey()).trim();
  const model = (testModel || getGeminiModel()).trim() || 'gemini-2.0-flash';

  if (!key) {
    return { success: false, message: 'No Gemini API key configured.', model };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: 'Ping. Reply with {"status":"ok"}' }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      let errMsg = `Gemini API returned HTTP ${resp.status}`;
      try {
        const parsed = JSON.parse(errText);
        if (parsed.error?.message) errMsg += `: ${parsed.error.message}`;
      } catch {
        errMsg += `: ${errText.slice(0, 150)}`;
      }
      return { success: false, message: errMsg, model };
    }

    return {
      success: true,
      message: `Connected successfully to Gemini using model "${model}"!`,
      model,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Network error connecting to Gemini: ${err?.message || err}`,
      model,
    };
  }
}

export async function transcribeRecipeImage(
  imageBuffer: Buffer,
  mimeType: string
): Promise<ExtractedRecipe> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key is not configured. Please add your key in Settings.');
  }

  const model = getGeminiModel();
  const base64Data = imageBuffer.toString('base64');

  const prompt = `You are an expert culinary assistant and recipe OCR engine.
Extract all recipe information from this image and return a strictly structured JSON object.

The image may be a photo of a recipe book page, a screenshot of a recipe website, a food magazine, or a handwritten recipe card.
Extract whatever recipe content is visible.

Return ONLY this JSON structure:
{
  "title": "Dish or recipe title",
  "type": "One of: Dinner, Lunch, Breakfast, Dessert, Snack, Drink",
  "cuisine": "e.g. Italian, Mexican, Asian, Indian, Australian, etc. or null",
  "servings": "Number of servings e.g. 4 or null",
  "prep_time": "Prep time e.g. 15 mins or null",
  "cook_time": "Cook time e.g. 30 mins or null",
  "ingredients": [
    {
      "raw": "The full original text as written, e.g. '1 large brown onion, finely chopped'",
      "buy_name": "The clean grocery purchase item name with NO prep details or quantities, e.g. 'Brown onion', 'Chicken breast', 'Soy sauce'",
      "qty": "Quantity and unit, e.g. '1 large', '500g', '2 tbsp', '1 cup'",
      "prep": "Prep instructions if any, e.g. 'finely chopped', 'diced', 'grated', 'minced', or empty string ''",
      "pantry_guess": true
    }
  ],
  "instructions": [
    "Step 1 text as a clear complete sentence",
    "Step 2 text",
    "Step 3 text"
  ]
}

Rules for ingredients:
- "buy_name" must be the standalone grocery item you would write on a shopping list. NEVER put "chopped", "diced", "melted", or "to taste" in "buy_name".
- "pantry_guess" should be true ONLY for basic household pantry staples that families almost always have in stock (e.g. water, tap water, salt, table salt, black pepper, pepper, olive oil, vegetable oil, cooking oil). For all other ingredients, set "pantry_guess": false.
- Convert imperial temperatures to Celsius (°C) and prefer metric units (g, kg, ml) where obvious.

If the image clearly does not contain any recipe, return: {"error": "No recipe found in image"}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { inline_data: { mime_type: mimeType, data: base64Data } },
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    let detail = `HTTP ${resp.status}`;
    try {
      const parsed = JSON.parse(errText);
      if (parsed.error?.message) detail = parsed.error.message;
    } catch {
      detail = errText.slice(0, 150);
    }
    throw new Error(`Gemini API error (${detail})`);
  }

  const json = await resp.json() as any;
  const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('Gemini returned an empty response.');
  }

  const clean = rawText.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean);

  if (parsed.error) {
    throw new Error(parsed.error);
  }

  return {
    title: String(parsed.title || 'Untitled Recipe').trim(),
    type: parsed.type || 'Dinner',
    cuisine: parsed.cuisine || '',
    servings: parsed.servings ? String(parsed.servings).trim() : '',
    prep_time: parsed.prep_time ? String(parsed.prep_time).trim() : '',
    cook_time: parsed.cook_time ? String(parsed.cook_time).trim() : '',
    ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
    instructions: Array.isArray(parsed.instructions)
      ? parsed.instructions.map((s: any) => String(s || '').trim()).filter(Boolean)
      : [],
  };
}
