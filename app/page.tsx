import { siteConfig } from "@/config/site.config";
import { getPublicPrizes } from "@/lib/prizes";
import Wheel from "./components/Wheel";

export default function HomePage() {
  const prizes = getPublicPrizes();

  return (
    <main className="page">
      <div className="card">
        {siteConfig.business.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={siteConfig.business.logoUrl} alt={siteConfig.business.name} className="logo" />
        ) : (
          <h1 className="business-name">{siteConfig.business.name}</h1>
        )}
        <p className="tagline">Tournez la roue, tentez votre chance !</p>
        <Wheel
          prizes={prizes}
          consentLabel={siteConfig.legal.consentLabel}
          redeemInstructions={siteConfig.business.redeemInstructions}
          googleReviewUrl={siteConfig.business.googleReviewUrl}
        />
      </div>
    </main>
  );
}
