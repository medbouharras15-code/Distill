import { SiteHeader } from "@/components/SiteHeader";
import { DropCursor } from "@/components/landing/DropCursor";
import { FaqSection } from "@/components/landing/FaqSection";
import { FinalCta } from "@/components/landing/FinalCta";
import { HeroSection } from "@/components/landing/HeroSection";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { PricingSection } from "@/components/landing/PricingSection";
import { ProductPreview } from "@/components/landing/ProductPreview";
import { TrustSection } from "@/components/landing/TrustSection";

/** Page d'accueil affichée aux visiteurs non connectés. */
export default function LandingGate() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Repli sans JavaScript : les sections révélées au scroll
          (data-reveal, voir globals.css) restent toujours visibles. */}
      <noscript>
        <style>{`[data-reveal="hidden"]{opacity:1 !important;transform:none !important;}`}</style>
      </noscript>
      <DropCursor />
      <SiteHeader />
      <HeroSection />
      <HowItWorks />
      <ProductPreview />
      <TrustSection />
      <PricingSection />
      <FaqSection />
      <FinalCta />
      <LandingFooter />
    </div>
  );
}
