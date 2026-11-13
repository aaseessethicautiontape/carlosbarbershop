import Link from "next/link";
import { formatPrice } from "@/lib/format";
import type { Service } from "@/lib/data/public";

/** Brass menu-board price list. Null prices render as [PRICE] until the owner sets them in admin. */
export function MenuBoard({ services, title = "Carlo's Price List" }: { services: Service[]; title?: string }) {
  return (
    <div className="board">
      <h3>{title}</h3>
      <div className="sub os">Cuts &amp; shaves · Barrie, Ontario</div>
      {services.map((s) => {
        const price = formatPrice(s.price_cents);
        return (
          <div className="mrow" key={s.id}>
            <b>{s.name}</b>
            <i aria-hidden="true" />
            <small>{s.duration_label ?? `${s.duration_minutes} min`}</small>
            <span className={s.price_cents === null ? "price tbd" : "price"}>{price}</span>
            <Link className="bk" href={`/book?service=${s.id}`} aria-label={`Book ${s.name}`}>Book</Link>
          </div>
        );
      })}
    </div>
  );
}
