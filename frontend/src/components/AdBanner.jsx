import { useEffect } from "react";

const ADSENSE_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT || "ca-pub-6167628668615065";
const DEFAULT_AD_SLOT = import.meta.env.VITE_ADSENSE_SLOT || "";

// AdSense Banner Component. It stays dormant until an ad slot exists.
export default function AdBanner({
  dataAdSlot = DEFAULT_AD_SLOT,
  dataAdFormat = "auto",
  fullWidthResponsive = "true",
  sticky = false,
}) {
  const hasSlot = Boolean(dataAdSlot);

  useEffect(() => {
    if (!hasSlot) return;

    try {
      if (typeof window !== "undefined" && window.adsbygoogle) {
        window.adsbygoogle.push({});
      }
    } catch (e) {
      console.error("AdSense error:", e);
    }
  }, [hasSlot]);

  if (!hasSlot) return null;

  return (
    <aside className={`ad-container ${sticky ? "ad-sticky-bottom" : ""}`} aria-label="Publicidad">
      <div className="ad-placeholder-text">Espacio Publicitario</div>
      <ins
        className="adsbygoogle"
        style={{ display: "block", width: "100%" }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={dataAdSlot}
        data-ad-format={dataAdFormat}
        data-full-width-responsive={fullWidthResponsive}
      />
    </aside>
  );
}
