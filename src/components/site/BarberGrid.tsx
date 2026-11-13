import Link from "next/link";
import type { Barber } from "@/lib/data/public";

/** Initials stand in for photos until the owner supplies them (barber.photo_path). */
export function BarberGrid({ barbers }: { barbers: Barber[] }) {
  return (
    <div className="team">
      {barbers.map((b) => (
        <article className="barber" key={b.id}>
          <div className="medal" aria-hidden="true">{b.initials}</div>
          <b>{b.name}</b>
          {b.bio ? <small>{b.bio}</small> : null}
          <Link className="btn btn-ink btn-sm" href={`/book?barber=${b.id}`}>Book with {b.name.split(" ")[0]}</Link>
        </article>
      ))}
      <div className="photo-note">Real barber photos and a line about each one go here.</div>
    </div>
  );
}
