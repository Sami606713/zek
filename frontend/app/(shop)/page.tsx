import { Hero } from "@/components/home/Hero";
import { BrandMarquee } from "@/components/home/BrandMarquee";
import { CategoryBento } from "@/components/home/CategoryBento";
import { ProductRail } from "@/components/home/ProductRail";
import { AgentShowcase } from "@/components/home/AgentShowcase";
import { Perks } from "@/components/home/Perks";

export default function HomePage() {
  return (
    <>
      <Hero />
      <BrandMarquee />
      <CategoryBento />
      <ProductRail />
      <AgentShowcase />
      <Perks />
    </>
  );
}
