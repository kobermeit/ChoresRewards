import { AppSetting } from '../db';

export interface StructuredIngredient {
  raw: string;
  name: string;
  buy_name?: string;
  qty: string;
  store: string;
  prep?: string;
  catalog_id?: number | null;
  uncataloged?: boolean;
  in_pantry?: boolean;
  pantry_guess?: boolean;
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
  return (process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite').trim();
}

export async function testGeminiConnection(
  testKey?: string,
  testModel?: string
): Promise<{ success: boolean; message: string; model: string }> {
  const key = (testKey || getGeminiApiKey()).trim();
  const model = (testModel || getGeminiModel()).trim() || 'gemini-3.1-flash-lite';

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
  mimeType: string,
  simulate = false
): Promise<ExtractedRecipe> {
  if (simulate) {
    // Return simulated extraction only when explicitly requested (e.g. test harnesses)
    return {
      title: 'Classic Cottage Pie with Mashed Potato Top',
      type: 'Dinner',
      cuisine: 'British',
      servings: '4 servings',
      prep_time: '25 mins',
      cook_time: '35 mins',
      ingredients: [
        {
          raw: '500g Beef mince',
          name: 'Beef mince',
          qty: '500g',
          store: 'aldi',
          prep: '',
          pantry_guess: false,
        },
        {
          raw: '1 Brown onion, finely chopped',
          name: 'Onions',
          qty: '1',
          store: 'aldi',
          prep: 'finely chopped',
          pantry_guess: false,
        },
        {
          raw: '2 medium Carrots, diced',
          name: 'Carrot',
          qty: '2',
          store: 'fruit-an-vege-4537',
          prep: 'diced',
          pantry_guess: false,
        },
        {
          raw: '2 cloves Garlic, minced',
          name: 'Garlic',
          qty: '2 cloves',
          store: 'aldi',
          prep: 'minced',
          pantry_guess: false,
        },
        {
          raw: '1kg Potatoes, peeled and cubed',
          name: 'Potato',
          qty: '1kg',
          store: 'fruit-an-vege-4537',
          prep: 'peeled and cubed',
          pantry_guess: false,
        },
        {
          raw: '50g Butter',
          name: 'Butter',
          qty: '50g',
          store: 'aldi',
          prep: '',
          pantry_guess: false,
        },
        {
          raw: '100ml Milk',
          name: 'Milk',
          qty: '100ml',
          store: 'aldi',
          prep: '',
          pantry_guess: false,
        },
        {
          raw: '2 tbsp Olive oil',
          name: 'Olive oil',
          qty: '2 tbsp',
          store: 'aldi',
          prep: '',
          pantry_guess: true,
        },
        {
          raw: '1 cup Beef stock',
          name: 'Beef stock',
          qty: '1 cup',
          store: 'aldi',
          prep: '',
          pantry_guess: false,
        },
        {
          raw: '2 tbsp Tomato paste',
          name: 'Tomato paste',
          qty: '2 tbsp',
          store: 'aldi',
          prep: '',
          pantry_guess: false,
        },
        {
          raw: '1 cup Frozen peas',
          name: 'Frozen peas',
          qty: '1 cup',
          store: 'aldi',
          prep: '',
          pantry_guess: false,
        },
        {
          raw: '1 tsp Salt and black pepper',
          name: 'Salt and black pepper',
          qty: '1 tsp',
          store: 'aldi',
          prep: 'to taste',
          pantry_guess: true,
        },
      ],
      instructions: [
        'Place cubed potatoes in a pot of cold salted water, bring to a boil, and simmer until tender (approx 15 mins). Drain, mash with butter and milk until smooth, then season.',
        'Heat olive oil in a deep skillet over medium heat. Sauté diced onions and carrots for 5 minutes until softened, then stir in minced garlic.',
        'Add beef mince to the skillet, breaking it up with a wooden spoon until browned.',
        'Stir in tomato paste, beef stock, and frozen peas. Simmer for 10-12 minutes until the sauce thickens.',
        'Transfer beef filling to a baking dish, spread mashed potatoes evenly over the top, and rough the surface with a fork.',
        'Bake at 200°C for 25 minutes until golden brown and bubbling around the edges.',
      ],
    };
  }

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key is not configured. Please add your key in Settings -> Connected Integrations -> Google Gemini AI.');
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
