const HEROES = {
  matches: { title: "Partidos", subtitle: "La próxima chamusca empieza acá.", image: "/images/banners/partidos.webp" },
  match: { title: "Detalle del partido", subtitle: "Asistencia, equipos y todo listo para jugar.", image: "/images/banners/partidos.webp" },
  team: { title: "Equipo", subtitle: "Tu gente, tu camiseta, tu cancha.", image: "/images/banners/equipo.webp" },
  fines: { title: "Multas", subtitle: "Reglas claras para que la chamusca siga rodando.", image: "/images/banners/multas.webp" },
  fees: { title: "Cobros", subtitle: "Cuentas claras, cancha pagada.", image: "/images/banners/cobros.webp" },
  profile: { title: "Perfil", subtitle: "Tu identidad dentro y fuera de la cancha.", image: "/images/banners/perfil.webp" },
  groups: { title: "Grupos", subtitle: "Cada chamusca tiene su propia historia.", image: "/images/banners/grupos.webp" },
  admin: { title: "Administración", subtitle: "Organizá el partido. Nosotros cuidamos los detalles.", image: "/images/banners/admin.webp" },
  players: { title: "Jugadores", subtitle: "Conocé el plantel y armá mejores equipos.", image: "/images/banners/jugadores.webp" },
  venues: { title: "Canchas", subtitle: "El lugar correcto para el próximo partidazo.", image: "/images/banners/canchas.webp" },
  sim: { title: "Simular equipos", subtitle: "Probá combinaciones antes del primer toque.", image: "/images/banners/simular.webp" },
  tournaments: { title: "Torneos", subtitle: "Calendario, tabla y gloria de chamusca.", image: "/images/banners/torneos.webp" },
  superadmin: { title: "Super Admin", subtitle: "Toda la organización bajo control.", image: "/images/banners/super-admin.webp" },
};

export default function SectionHero({ page, showArtwork = true }) {
  const hero = HEROES[page] || HEROES.matches;
  const style = showArtwork ? { "--hero-image": `url(${hero.image})` } : undefined;

  return (
    <section className={`section-hero ${showArtwork ? "" : "no-artwork"}`} style={style}
      aria-labelledby="section-hero-title">
      <div className="section-hero-copy">
        <p className="eyebrow">F5MANAGER</p>
        <h2 id="section-hero-title">{hero.title}</h2>
        <p>{hero.subtitle}</p>
      </div>
    </section>
  );
}
