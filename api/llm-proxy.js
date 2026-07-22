const TARGET_URL = process.env.VITE_PRIMARY_LLM_URL || "https://integrate.api.nvidia.com/v1/chat/completions";
const API_KEY = process.env.VITE_PRIMARY_LLM_KEY;
const MODEL = process.env.VITE_PRIMARY_LLM_MODEL || "z-ai/glm-5.2";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = { ...req.body, model: MODEL };
  delete body.json_mode;

  try {
    const response = await fetch(TARGET_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}
