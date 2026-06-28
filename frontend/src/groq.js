const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.1-8b-instant";

export async function distributeTeamsWithAI({ players, skills, instructions, teamCount }) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("VITE_GROQ_API_KEY no está configurada. Agregala en el archivo .env");
  }

  const playerList = players.map((p) => {
    const playerSkills = skills.filter((s) => s.player_id === p.id).map((s) => s.skill);
    return {
      id: p.id,
      name: p.full_name || p.nickname || "Jugador",
      rating: p.rating,
      skills: playerSkills,
    };
  });

  const systemPrompt = `Eres un asistente experto en fútbol. Tu trabajo es distribuir jugadores en equipos equilibrados.

Reglas:
- Los jugadores se identifican por "id" (UUID) y "name" (nombre).
- Cada jugador tiene un rating (1-4) y puede tener skills como: wizard, cannon, wings, shield, strong_leg, goalkeeper, captain, veteran, speedy, tactician.
- ${teamCount ? `Debes crear EXACTAMENTE ${teamCount} equipos.` : "Debes crear entre 2 y 3 equipos según el número de jugadores."}
- DISTRIBUCIÓN EQUITATIVA OBLIGATORIA: la diferencia entre el equipo más grande y el más pequeño debe ser como máximo 1 jugador. Si hay 10 jugadores y 2 equipos, deben ser 5+5 (nunca 8+2 o 7+3).
- Distribuye los ratings lo más parejo posible entre equipos.
- Considera las skills: los porteros (goalkeeper) deben estar en equipos distintos. Las skills similares (wizard, captain) idealmente en equipos distintos.
- Si hay instrucciones del usuario, respétalas (ej: "Juan con Pedro", "Luis portero", etc).

Responde SOLO con JSON válido en este formato exacto:
{
  "teams": [
    {
      "name": "Equipo A",
      "player_ids": ["uuid1", "uuid2", ...]
    },
    {
      "name": "Equipo B",
      "player_ids": ["uuid1", "uuid2", ...]
    }
  ]
}

Cada player_id debe aparecer exactamente una vez. La suma de player_ids en todos los equipos debe ser igual al total de jugadores. No agregues texto adicional.`;

  const userPrompt = `${instructions ? `INSTRUCCIONES DEL USUARIO: ${instructions}\n\n` : ""}JUGADORES:\n${JSON.stringify(playerList, null, 2)}`;

  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error?.message || `Error de Groq: ${res.status}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq no devolvió respuesta");

  const result = JSON.parse(content);
  if (!result.teams || !Array.isArray(result.teams)) {
    throw new Error("Formato de respuesta inválido");
  }

  return result.teams.map((team) => {
    const ids = team.player_ids || team.playerIds || [];
    return {
      name: team.name,
      playerIds: ids,
    };
  });
}
