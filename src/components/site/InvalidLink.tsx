import Link from "next/link";

export function InvalidLink() {
  return (
    <section className="section"><div className="wrap" style={{ maxWidth: 560, textAlign: "center" }}>
      <h1 className="q">This link isn&apos;t valid any more.</h1>
      <p className="lede" style={{ marginBottom: 24 }}>It may have expired. You can book again, or call the shop.</p>
      <Link className="btn btn-red" href="/book">Book a chair</Link>
    </div></section>
  );
}
