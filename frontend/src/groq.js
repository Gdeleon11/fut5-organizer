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

REGLAS ABSOLUTAS E INVIOLABLES DE DISTRIBUCIÓN:
1. CADA JUGADOR (player_id) DEBE SER ASIGNADO EXACTAMENTE A UN EQUIPO.
2. NO PUEDEN EXISTIR JUGADORES DUPLICADOS (un mismo player_id en múltiples equipos es un error grave).
3. EL NÚMERO TOTAL DE JUGADORES EN TODOS LOS EQUIPOS DEBE SER IGUAL A LA CANTIDAD TOTAL DE JUGADORES RECIBIDOS.
4. ${teamCount ? `Debes crear EXACTAMENTE ${teamCount} equipos.` : "Debes crear entre 2 y 3 equipos según el número de jugadores."}
5. DISTRIBUCIÓN EQUITATIVA DE TAMAÑO: la diferencia de cantidad de jugadores entre el equipo más grande y el más pequeño debe ser como máximo 1. Por ejemplo, si hay 15 jugadores confirmados y 3 equipos, deben ser exactamente de 5, 5 y 5 jugadores cada uno.
6. Distribuye los ratings (1-4) de forma equitativa para que los equipos queden nivelados.
7. Los porteros (goalkeeper) y habilidades de cracks deben distribuirse de manera equitativa entre los equipos.
8. Si hay instrucciones especiales del usuario, cúmplelas.

Responde SOLO con un objeto JSON en este formato:
{
  "teams": [
    {
      "name": "Equipo A",
      "player_ids": ["uuid1", "uuid2", ...]
    },
    ...
  ]
}
No agregues texto explicativo ni formato Markdown adicional fuera del JSON.`;

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
