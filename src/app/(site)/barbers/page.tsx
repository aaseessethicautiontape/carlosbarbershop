import type { Metadata } from "next";
import { BarberGrid } from "@/components/site/BarberGrid";
import { getBarbers } from "@/lib/data/public";

export const revalidate = 300;
export const metadata: Metadata = { title: "Our barbers", description: "Meet the barbers at Carlo's Barbershop in Barrie." };

export default async function BarbersPage() {
  const barbers = await getBarbers();
  return (
    <>
      <section className="page-head dark"><div className="wrap"><p className="kick">The chairs</p><h1 className="h2">Seven barbers, <em>one standard.</em></h1></div></section>
      <section className="section" style={{ paddingTop: 40 }}><div className="wrap"><BarberGrid barbers={barbers} /></div></section>
    </>
  );
}
