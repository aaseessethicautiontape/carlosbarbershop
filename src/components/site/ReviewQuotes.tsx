import { site } from "@/content/site";

export function ReviewQuotes() {
  return (
    <section className="section dark" aria-labelledby="reviews-h">
      <div className="wrap revs">
        <div>
          <p className="kick" id="reviews-h">Reviews</p>
          <div className="score">{site.rating.score}</div>
          <p style={{ color: "var(--c-muted-dark)", margin: "8px 0 0" }}>{site.rating.count} reviews on Google</p>
          <a className="btn btn-line" href={site.googleMapsReviews} rel="noopener noreferrer" style={{ marginTop: 24 }}>Read them all</a>
        </div>
        <div className="quotes">
          {site.reviews.map((r) => (
            <blockquote className="qt" key={r.quote}><p>“{r.quote}”</p><cite>{r.by}</cite></blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
