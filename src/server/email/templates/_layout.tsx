import "server-only";

import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

import { getAppBaseUrl, getVenueContactEmail } from "@/server/env";

export type EmailLayoutProps = {
  /** Short snippet shown in mail clients before the body opens. */
  preview: string;
  children: React.ReactNode;
};

/**
 * Shared envelope used by every Cooker Loft transactional email.
 * Renders a clean, single-column layout with a header and footer.
 *
 * Footer always contains the venue contact email (reply-to) and a
 * boilerplate transactional-email line.
 */
export function EmailLayout({ preview, children }: EmailLayoutProps) {
  const contact = getVenueContactEmail();
  const logoUrl = `${getAppBaseUrl()}/brand/cooker-loft-logo.png`;
  return (
    <Html lang="it">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={headerStyle}>
            <Img
              src={logoUrl}
              alt="Cooker Loft"
              height={38}
              style={logoStyle}
            />
          </Section>

          <Section style={contentStyle}>{children}</Section>

          <Hr style={hrStyle} />

          <Section style={footerStyle}>
            <Text style={footerTextStyle}>
              Hai domande? Scrivici a{" "}
              <a href={`mailto:${contact}`} style={linkStyle}>
                {contact}
              </a>
              .
            </Text>
            <Text style={footerMutedStyle}>
              Questa email è transazionale e riguarda la tua prenotazione presso
              Cooker Loft. I link contenuti sono personali: non condividerli con
              terzi.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const bodyStyle: React.CSSProperties = {
  backgroundColor: "#fff7f1",
  fontFamily:
    "'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
  margin: 0,
  padding: "24px 0",
};

const containerStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #f0ddcf",
  borderRadius: "10px",
  margin: "0 auto",
  maxWidth: "560px",
  padding: "0",
  boxShadow: "0 10px 28px rgba(120, 66, 63, 0.08)",
  overflow: "hidden",
};

const headerStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderBottom: "1px solid #f0ddcf",
  padding: "20px 28px",
  textAlign: "center",
};

const logoStyle: React.CSSProperties = {
  display: "inline-block",
  height: "38px",
  width: "auto",
};

const contentStyle: React.CSSProperties = {
  color: "#2f1e1a",
  fontSize: "15px",
  lineHeight: "1.55",
  padding: "24px 28px 8px 28px",
};

const hrStyle: React.CSSProperties = {
  borderColor: "#f0ddcf",
  margin: "12px 28px 0 28px",
};

const footerStyle: React.CSSProperties = {
  padding: "16px 28px 24px 28px",
};

const footerTextStyle: React.CSSProperties = {
  color: "#78423F",
  fontSize: "13px",
  lineHeight: "1.5",
  margin: "8px 0",
};

const footerMutedStyle: React.CSSProperties = {
  color: "#a78a7e",
  fontSize: "12px",
  lineHeight: "1.5",
  margin: "8px 0 0 0",
};

const linkStyle: React.CSSProperties = {
  color: "#AA2620",
  textDecoration: "underline",
};
