export const POSITION_OPTIONS = [
  "Flexible",
  "Goalkeeper",
  "Defender",
  "Midfielder",
  "Forward",
];

export const MATCH_STATUSES = ["upcoming", "closed", "canceled"];
export const STAR_LEVELS = [1, 2, 3, 4];

export const ROLE_OPTIONS = ["super_admin", "admin", "player"];

export const ROLE_LABELS = {
  super_admin: "Super Admin",
  admin: "Admin",
  player: "Jugador",
};

export const STAR_LABELS = {
  1: "Casual",
  2: "Bueno",
  3: "Fuerte",
  4: "Crack",
};

export const POSITION_LABELS = {
  Flexible: "Flexible",
  Goalkeeper: "Portero",
  Defender: "Defensa",
  Midfielder: "Medio",
  Forward: "Delantero",
};

export const MATCH_STATUS_LABELS = {
  upcoming: "Abierto",
  closed: "Cerrado",
  canceled: "Cancelado",
};

export const FILTER_LABELS = {
  all: "Todos",
  active: "Activos",
  inactive: "Inactivos",
  unrated: "Sin estrellas",
  unpaid: "Con deuda",
};

export const SKILL_OPTIONS = [
  { id: "wizard", emoji: "🧙", label: "Mago", desc: "Muy bueno, crack" },
  { id: "cannon", emoji: "💣", label: "Cañón", desc: "Tira fuerte" },
  { id: "wings", emoji: "🪽", label: "Alas", desc: "Muy veloz" },
  { id: "shield", emoji: "🛡️", label: "Escudo", desc: "Defensor sólido" },
  { id: "strong_leg", emoji: "🦵", label: "Pierna fuerte", desc: "Buen remate" },
  { id: "goalkeeper", emoji: "🧤", label: "Guantes", desc: "Portero" },
  { id: "captain", emoji: "👑", label: "Capitán", desc: "Líder del equipo" },
  { id: "veteran", emoji: "🎖️", label: "Veterano", desc: "Mucha experiencia" },
  { id: "speedy", emoji: "⚡", label: "Relámpago", desc: "Velocidad pura" },
  { id: "tactician", emoji: "🧠", label: "Estratega", desc: "Visión de juego" },
];

export const emptyMatchForm = {
  title: "Chamuscón",
  match_date: "",
  start_time: "19:00",
  venue: "",
  min_players: 10,
  max_players: 18,
  status: "upcoming",
};

export const emptyProfileForm = {
  full_name: "",
  nickname: "",
  phone: "",
  preferred_position: "Flexible",
};
