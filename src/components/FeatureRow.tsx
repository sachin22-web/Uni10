import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface FeatureRowProps {
  image: string;
  title: string;
  link?: string;
  imageAlt?: string;
  reverse?: boolean;
}

export const FeatureRow = ({ image, title, link, imageAlt, reverse = false }: FeatureRowProps) => {
  const firstLetter = (title || '').charAt(0).toUpperCase();
  const restTitle = (title || '').slice(1); // ✅ added: title ke baaki letters
  const isClickable = link && link.trim().length > 0;
  
  const content = (
    <div className={`relative min-h-screen flex flex-col md:flex-row items-center overflow-hidden ${reverse ? 'md:flex-row-reverse' : ''}`}>
      {/* Cosmic background */}
      <div className="absolute inset-0 bg-background"></div>

      {/* Product Image with Red Letter Overlay - Mobile: Top, Desktop: Left Side */}
      <div className="relative z-0 w-full md:w-1/2 h-[50vh] md:h-screen flex items-center justify-center px-4 md:pl-10 overflow-hidden">
        {/* Red letter overlay */}
        <div className="absolute bottom-0 left-0 z-10 opacity-20 pointer-events-none">
          <div
            className="text-red-500 font-black leading-none"
            style={{
              fontSize: 'clamp(200px, 35vw, 600px)',
              letterSpacing: '-0.05em',
            }}
          >
            {firstLetter}
          </div>
        </div>
        
        <img
          src={image}
          alt={imageAlt || title}
          className="h-[80%] md:h-[90%] w-auto object-contain relative z-20"
        />
      </div>

      {/* Category Title and Button - Mobile: Bottom, Desktop: Right Side */}
      <div className="relative z-20 w-full md:w-1/2 h-[50vh] md:h-screen flex flex-col items-center md:items-end justify-between py-10 md:py-20 px-4 md:pr-20">
        <h2
          className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl xl:text-10xl font-black tracking-tight leading-none text-center md:text-right text-foreground drop-shadow-lg"
          style={{
            letterSpacing: '0.02em',
            wordBreak: 'break-word',
          }}
        >
          {/* ✅ first letter red without deleting your structure */}
          <span className="text-red-500">{firstLetter}</span>
          {restTitle}
        </h2>
        {isClickable && (
          <div className="w-full md:w-auto flex justify-center md:justify-end pointer-events-none">
            <Button
              size="lg"
              variant="outline"
              className="text-base md:text-lg px-10 md:px-12 py-5 md:py-6 rounded-full border-2 hover:bg-foreground hover:text-background transition-all w-full md:w-auto max-w-xs"
            >
              VIEW
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  if (isClickable) {
    return (
      <Link to={link} className="block hover:opacity-95 transition-opacity">
        {content}
      </Link>
    );
  }

  return content;
};
