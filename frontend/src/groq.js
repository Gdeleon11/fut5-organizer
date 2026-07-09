const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.1-8b-instant";

export async function distributeTeamsWithAI({ players, skills, instructions, teamCount }) {
  const primaryUrl = import.meta.env.VITE_PRIMARY_LLM_URL;
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey && !primaryUrl) {
    throw new Error("Faltan las credenciales: configura VITE_GROQ_API_KEY o VITE_PRIMARY_LLM_URL en el archivo .env");
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
  let sizesText = "";
  let sizesExplanation = "";
  if (teamCount) {
    const targetSizes = [];
    let remaining = players.length;
    for (let i = 0; i < teamCount; i++) {
      const size = Math.ceil(remaining / (teamCount - i));
      targetSizes.push(size);
      remaining -= size;
    }
    sizesText = targetSizes.join(", ");
    sizesExplanation = `Las cantidades de jugadores por equipo deben ser EXACTAMENTE las siguientes: ${sizesText}.`;
  }

  const systemPrompt = `Eres un asistente experto en fútbol. Tu trabajo es distribuir jugadores en equipos equilibrados.

REGLAS ABSOLUTAS E INVIOLABLES DE DISTRIBUCIÓN:
1. CADA JUGADOR (player_id) DEBE SER ASIGNADO EXACTAMENTE A UN EQUIPO.
2. NO PUEDEN EXISTIR JUGADORES DUPLICADOS (un mismo player_id en múltiples equipos es un error grave).
3. EL NÚMERO TOTAL DE JUGADORES EN TODOS LOS EQUIPOS DEBE SER EXACTAMENTE ${players.length}.
4. ${teamCount ? `Debes crear EXACTAMENTE ${teamCount} equipos. ${sizesExplanation}` : "Debes crear entre 2 y 3 equipos según el número de jugadores."}
5. DISTRIBUCIÓN EXACTA DE TAMAÑO: No puedes desobedecer los tamaños de equipo solicitados.
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

  async function callLLM(url, key, model) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error?.message || `Error del LLM: ${res.status}`);
    }
    return res.json();
  }

  let data;
  try {
    if (primaryUrl) {
      console.log("Intentando LLM primario local/Cloudflare:", primaryUrl);
      data = await callLLM(primaryUrl, "", "local-model");
    } else {
      throw new Error("No primary URL");
    }
  } catch (error) {
    console.warn("Fallo el LLM primario, usando Groq como respaldo:", error.message);
    if (apiKey) {
      data = await callLLM(GROQ_API_URL, apiKey, GROQ_MODEL);
    } else {
      throw new Error("El LLM primario falló y no hay VITE_GROQ_API_KEY configurada.");
    }
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("El modelo no devolvió respuesta");

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
