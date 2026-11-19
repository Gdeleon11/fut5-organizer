import { normalizeRating } from "./teamGeneration.js";
import { supabase } from "./supabaseClient.js";

export async function distributeTeamsWithAI({
  players,
  skills = [],
  instructions = "",
  teamCount,
  groupId,
  matchId,
  accessToken,
  fetchImpl = globalThis.fetch,
}) {
  if (!groupId) {
    throw new Error("Falta el identificador del grupo para usar el balanceo con IA.");
  }

  let token = accessToken || "";
  if (!token && supabase) {
    const { data: sessionData } = await supabase.auth.getSession();
    token = sessionData?.session?.access_token || "";
  }
  if (!token) {
    throw new Error("Debes iniciar sesión como administrador del grupo para usar la IA.");
  }

  const playerList = players.map((p) => {
    const playerSkills = (skills || []).filter((s) => s.player_id === p.id).map((s) => s.skill);
    return {
      id: p.id,
      name: p.full_name || p.nickname || "Jugador",
      position: p.preferred_position || "Flexible",
      rating: normalizeRating(p.rating),
      attack_rating: normalizeRating(p.attack_rating || p.rating),
      defense_rating: normalizeRating(p.defense_rating || p.rating),
      midfield_rating: normalizeRating(p.midfield_rating || p.rating),
      goalkeeper_rating: normalizeRating(p.goalkeeper_rating || p.rating),
      skills: playerSkills,
    };
  });

  let sizesExplanation = "";
  if (teamCount) {
    const targetSizes = [];
    let remaining = players.length;
    for (let i = 0; i < teamCount; i++) {
      const size = Math.ceil(remaining / (teamCount - i));
      targetSizes.push(size);
      remaining -= size;
    }
    sizesExplanation = `Las cantidades de jugadores por equipo deben ser EXACTAMENTE las siguientes: ${targetSizes.join(", ")}.`;
  }

  const systemPrompt = `Eres un asistente experto en fútbol. Tu trabajo es distribuir jugadores en equipos equilibrados.

CADA JUGADOR INCLUYE:
- rating: puntuación general de 1 a 5 estrellas (donde 5.0 es el nivel máximo / crack)
- attack_rating, defense_rating, midfield_rating, goalkeeper_rating: puntuación por posición de 1 a 5 estrellas
- position: posición preferida (Forward, Defender, Midfielder, Goalkeeper, Flexible)
- skills: habilidades especiales (goalkeeper, wizard, cannon, shield, etc)

REGLAS ABSOLUTAS E INVIOLABLES DE DISTRIBUCIÓN:
1. CADA JUGADOR (player_id) DEBE SER ASIGNADO EXACTAMENTE A UN EQUIPO.
2. NO PUEDEN EXISTIR JUGADORES DUPLICADOS (un mismo player_id en múltiples equipos es un error grave).
3. EL NÚMERO TOTAL DE JUGADORES EN TODOS LOS EQUIPOS DEBE SER EXACTAMENTE ${players.length}.
4. ${teamCount ? `Debes crear EXACTAMENTE ${teamCount} equipos. ${sizesExplanation}` : "Debes crear entre 2 y 3 equipos según el número de jugadores."}
5. DISTRIBUCIÓN EXACTA DE TAMAÑO: No puedes desobedecer los tamaños de equipo solicitados.
6. Distribuye los puntajes (ratings) de forma equitativa para que la suma de ratings por equipo quede lo más pareja posible.
7. Los jugadores con position "Goalkeeper" o con skill "goalkeeper" deben distribuirse UNO por equipo si es posible.
8. Las habilidades especiales (wizard, cannon, shield, etc) deben distribuirse equitativamente.
9. Si hay instrucciones especiales del usuario, cúmplelas.

Responde SOLO con un objeto JSON en este formato:
{
  "teams": [
    {
      "name": "Equipo A",
      "player_ids": ["uuid1", "uuid2", ...]
    }
  ]
}
No agregues texto explicativo ni formato Markdown adicional fuera del JSON.`;

  const userPrompt = `${instructions ? `INSTRUCCIONES DEL USUARIO: ${instructions}\n\n` : ""}JUGADORES:\n${JSON.stringify(playerList, null, 2)}`;

  const res = await fetchImpl("/api/llm-proxy", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      groupId,
      ...(matchId ? { matchId } : {}),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 1500,
      json_mode: true,
    }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error?.message || error.error || `Error del servicio de IA (${res.status})`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("El modelo no devolvió respuesta");

  let result;
  try {
    result = JSON.parse(content);
  } catch {
    throw new Error("La IA no devolvió JSON válido");
  }
  if (!result.teams || !Array.isArray(result.teams)) {
    throw new Error("Formato de respuesta inválido");
  }

  return result.teams.map((team) => ({
    name: team.name,
    playerIds: team.player_ids || team.playerIds || [],
  }));
}
