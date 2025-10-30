import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface CategoryShowcaseProps {
  image: string;
  title: string;
  link: string;
  reverse?: boolean;
}

export const CategoryShowcase = ({ image, title, link, reverse = false }: CategoryShowcaseProps) => {
  return (
    <div className={`relative min-h-screen flex flex-col md:flex-row items-center overflow-hidden ${reverse ? 'md:flex-row-reverse' : ''}`}>
      {/* Cosmic background */}
      <div className="absolute inset-0 bg-background"></div>

      {/* Product Image - Mobile: Top, Desktop: Left Side */}
      <div className="relative z-0 w-full md:w-1/2 h-[50vh] md:h-screen flex items-center justify-center px-4 md:pl-10">
        <img
          src={image}
          alt={title}
          className="h-[80%] md:h-[90%] w-auto object-contain"
        />
      </div>

      {/* Category Title and Button - Mobile: Bottom, Desktop: Right Side */}
      <div className="relative z-20 w-full md:w-1/2 h-[50vh] md:h-screen flex flex-col items-center md:items-end justify-between py-10 md:py-20 px-4 md:pr-20">
        <h2
          className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-black tracking-tight leading-none text-center md:text-right text-foreground drop-shadow-lg"
          style={{
            letterSpacing: '0.02em'
          }}
        >
          {title}
        </h2>
        <Link to={link} className="w-full md:w-auto flex justify-center md:justify-end">
          <Button
            size="lg"
            variant="outline"
            className="text-base md:text-lg px-10 md:px-12 py-5 md:py-6 rounded-full border-2 hover:bg-foreground hover:text-background transition-all w-full md:w-auto max-w-xs"
          >
            VIEW
          </Button>
        </Link>
      </div>
    </div>
  );
};
