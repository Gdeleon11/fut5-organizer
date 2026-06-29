import React, { useEffect } from 'react';

// AdSense Banner Component
export default function AdBanner({ dataAdSlot, dataAdFormat = "auto", fullWidthResponsive = "true", sticky = false }) {
  useEffect(() => {
    try {
      // AdSense script push
      if (typeof window !== "undefined" && window.adsbygoogle) {
        window.adsbygoogle.push({});
      }
    } catch (e) {
      console.error("AdSense error:", e);
    }
  }, []);

  return (
    <div className={`ad-container ${sticky ? 'ad-sticky-bottom' : ''}`}>
      {/* 
        This text only shows when ads are blocked or haven't loaded yet.
        It keeps the space reserved so the UI doesn't jump.
      */}
      <div className="ad-placeholder-text">Espacio Publicitario</div>
      
      <ins
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', minHeight: '50px' }}
        data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" // REPLACE WITH YOUR PUBLISHER ID
        data-ad-slot={dataAdSlot} // REPLACE WITH YOUR AD SLOT ID
        data-ad-format={dataAdFormat}
        data-full-width-responsive={fullWidthResponsive}
      />
    </div>
  );
}
