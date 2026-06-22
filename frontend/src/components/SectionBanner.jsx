export default function SectionBanner({ section }) {
  const src = `/images/banners/${section}.webp`;
  return (
    <div className="section-banner">
      <img src={src} alt="" loading="lazy" />
    </div>
  );
}
