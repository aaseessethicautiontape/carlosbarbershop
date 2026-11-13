import type { Metadata } from "next";
import { MenuBoard } from "@/components/site/MenuBoard";
import { getServices } from "@/lib/data/public";

export const revalidate = 3600;
export const metadata: Metadata = { title: "Services & prices", description: "Haircuts, hot towel shaves and beard trims at Carlo's Barbershop in Barrie." };

export default async function ServicesPage() {
  const services = await getServices();
  return (
    <>
      <section className="page-head dark"><div className="wrap"><p className="kick">The menu</p><h1 className="h2">Services &amp; <em>prices.</em></h1></div></section>
      <section className="section" style={{ paddingTop: 56 }}><div className="wrap"><MenuBoard services={services} /></div></section>
    </>
  );
}
