import type { FC } from "react";
import type { CategoryId } from "../types";

export type AffiliateIssueCategory = CategoryId;

interface AffiliateRecommendationProps {
  issueCategory: AffiliateIssueCategory;
}

const affiliateProducts: Record<AffiliateIssueCategory, { name: string; url: string; description: string }> = {
  echo: {
    name: "Acoustic Foam Panels",
    url: "https://amzn.to/4qTnyHf",
    description: "To reduce echo, consider acoustic panels that absorb sound reflections."
  },
  noise: {
    name: "FIFINE USB Microphone",
    url: "https://amzn.to/4rpWH5l",
    description: "A directional USB mic can help reject background noise and focus on your voice."
  },
  level: {
    name: "Microphone Arm",
    url: "https://amzn.to/4anIYpX",
    description: "A mic arm makes it easy to keep a consistent distance and angle."
  }
};

const AffiliateRecommendation: FC<AffiliateRecommendationProps> = ({ issueCategory }) => {
  const product = affiliateProducts[issueCategory];

  const trackClick = () => {
    window.gtag?.("event", "affiliate_click", { product_name: product.name });
  };

  return (
    <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-slate-700">
      <p className="font-semibold text-slate-800">Suggested gear</p>
      <p className="mt-2 text-sm text-slate-600">{product.description}</p>
      <a
        className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 transition hover:text-blue-800"
        href={product.url}
        onClick={trackClick}
        rel="noopener noreferrer nofollow"
        target="_blank"
      >
        View on Amazon →
      </a>
      <p className="mt-3 text-[11px] text-slate-600">
        As an Amazon Associate I earn from qualifying purchases.
      </p>
    </div>
  );
};

export default AffiliateRecommendation;
