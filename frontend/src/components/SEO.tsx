import { useEffect } from 'react';

export interface SEOProps {
  description?: string;
  keywords?: string[];
  canonicalUrl?: string;
  jsonLd?: Record<string, unknown>;
}

const DEFAULT_DESCRIPTION =
  'AeroInfo India is an interactive digital platform for Indian airspace visualization, eAIP India charts, ATS navigation routes, real-time METAR & TAF weather reports, NOTAMs, RTR(A) examination resources, DGCA Air Navigation, DGCA Meteorology, and DGCA Air Regulations.';

const DEFAULT_KEYWORDS = [
  'AeroInfo India',
  'AIP India',
  'eAIP India',
  'METAR',
  'TAF',
  'RTR(A)',
  'RTR Aero',
  'DGCA EXAMS resources',
  'DGCA Exam Resources',
  'DGCA Air Navigation',
  'DGCA Meteorology',
  'DGCA Air Regulations',
  'Indian Airspace',
  'Flight Navigation',
  'Airspace Visualization',
  'ATS Routes',
  'Real-time METAR',
  'NOTAMs',
  'Aeronautical Charts',
];

/**
 * SEO component ensuring metadata, OpenGraph tags, and JSON-LD stay synchronized
 * across SPA route transitions while keeping title strictly 'AeroInfo India'.
 */
export default function SEO({
  description = DEFAULT_DESCRIPTION,
  keywords = DEFAULT_KEYWORDS,
  canonicalUrl = 'https://aeroinfo.in/',
  jsonLd,
}: SEOProps) {
  useEffect(() => {
    // Ensure title remains strictly 'AeroInfo India'
    document.title = 'AeroInfo India';

    // Helper function to set meta tag content
    const setMetaTag = (selector: string, attrName: string, attrValue: string, content: string) => {
      let element = document.querySelector<HTMLMetaElement>(selector);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attrName, attrValue);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    setMetaTag('meta[name="description"]', 'name', 'description', description);
    setMetaTag('meta[name="keywords"]', 'name', 'keywords', keywords.join(', '));
    setMetaTag('meta[property="og:title"]', 'property', 'og:title', 'AeroInfo India');
    setMetaTag('meta[property="og:description"]', 'property', 'og:description', description);
    setMetaTag('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
    setMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', 'AeroInfo India');
    setMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', description);
    setMetaTag('meta[name="twitter:url"]', 'name', 'twitter:url', canonicalUrl);

    // Update canonical link
    let canonicalLink = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonicalUrl);

    // Update route-specific JSON-LD if provided
    if (jsonLd) {
      let script = document.querySelector<HTMLScriptElement>('script#dynamic-jsonld');
      if (!script) {
        script = document.createElement('script');
        script.id = 'dynamic-jsonld';
        script.type = 'application/ld+json';
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(jsonLd);
    }
  }, [description, keywords, canonicalUrl, jsonLd]);

  return null;
}
