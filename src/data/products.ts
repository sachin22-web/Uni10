import hoodieImg from "@/assets/product-hoodie-1.jpg";
import tshirtImg from "@/assets/product-tshirt-1.jpg";
import capImg from "@/assets/product-cap-1.jpg";
import jacketImg from "@/assets/product-jacket-1.jpg";
import pantsImg from "@/assets/product-pants-1.jpg";
import backpackImg from "@/assets/product-backpack-1.jpg";

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  description: string;
  image: string;
  images: string[];
  sizes: string[];
  colors: string[];
}

export const products: Product[] = [
  {
    id: "1",
    name: "Cosmic Hoodie",
    price: 3499,
    category: "Hoodies",
    description: "Premium black hoodie featuring an exclusive geometric gold logo design. Made from high-quality cotton blend for ultimate comfort and durability.",
    image: hoodieImg,
    images: [hoodieImg],
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: ["Black"],
  },
  {
    id: "2",
    name: "Essential Tee",
    price: 1299,
    category: "T-Shirts",
    description: "Classic black t-shirt with bold white typography. Perfect for everyday wear with a streetwear edge.",
    image: tshirtImg,
    images: [tshirtImg],
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: ["Black"],
  },
  {
    id: "3",
    name: "Luxury Cap",
    price: 1799,
    category: "Accessories",
    description: "Premium snapback cap with embroidered gold logo. Adjustable fit for maximum comfort.",
    image: capImg,
    images: [capImg],
    sizes: ["One Size"],
    colors: ["Black"],
  },
  {
    id: "4",
    name: "Bomber Jacket",
    price: 5999,
    category: "Jackets",
    description: "Sleek black bomber jacket with gold zipper details. Perfect for layering and making a statement.",
    image: jacketImg,
    images: [jacketImg],
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: ["Black"],
  },
  {
    id: "5",
    name: "Premium Joggers",
    price: 2799,
    category: "Bottoms",
    description: "Comfortable black jogger pants with gold drawstring details. Modern streetwear essential.",
    image: pantsImg,
    images: [pantsImg],
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: ["Black"],
  },
  {
    id: "6",
    name: "Leather Backpack",
    price: 7999,
    category: "Accessories",
    description: "Luxury black leather backpack with gold hardware accents. Spacious and stylish for daily use.",
    image: backpackImg,
    images: [backpackImg],
    sizes: ["One Size"],
    colors: ["Black"],
  },
];
