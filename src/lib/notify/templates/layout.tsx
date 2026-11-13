import { Body, Button, Container, Head, Html, Img, Preview, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";

/** Shared brand frame for every email. Inline styles only (email clients). Mirrors the admin preview. */
export interface EmailFrameProps {
  preview: string;
  chip: string;
  title: string;
  children?: ReactNode;
  cta?: { label: string; href: string };
  secondary?: Array<{ label: string; href: string }>;
  footer?: string;
  logoUrl: string;
}

const brass = "#C9A35B";
const ink = "#121010";

export function EmailFrame({ preview, chip, title, children, cta, secondary, footer, logoUrl }: EmailFrameProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ margin: 0, background: "#E9E2D6", fontFamily: "Helvetica, Arial, sans-serif", color: "#1C1918" }}>
        <Container style={{ maxWidth: 480, margin: "24px auto", background: "#FFFFFF", borderRadius: 8, overflow: "hidden" }}>
          <Section style={{ background: ink, padding: 20, textAlign: "center" }}>
            <Img src={logoUrl} alt="Carlo's Barbershop" width={96} style={{ margin: "0 auto" }} />
          </Section>
          <Section style={{ padding: "24px 26px" }}>
            <Text style={{ margin: 0, display: "inline-block", background: ink, color: brass, borderRadius: 12, padding: "4px 10px", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" }}>{chip}</Text>
            <Text style={{ fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 700, margin: "14px 0 10px" }}>{title}</Text>
            {children}
            {cta && (
              <Button href={cta.href} style={{ background: "#B3222B", color: "#FFFFFF", borderRadius: 6, padding: "12px 20px", fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", textDecoration: "none" }}>
                {cta.label}
              </Button>
            )}
            {secondary?.map((s) => (
              <Text key={s.href} style={{ margin: "14px 0 0", fontSize: 13 }}>
                <a href={s.href} style={{ color: "#B3222B" }}>{s.label}</a>
              </Text>
            ))}
            {footer && <Text style={{ margin: "18px 0 0", fontSize: 12, color: "#6E6253" }}>{footer}</Text>}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
