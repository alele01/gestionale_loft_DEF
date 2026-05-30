import "server-only";

import { Button, Section, Text } from "@react-email/components";
import * as React from "react";

import {
  formatCurrencyEUR,
  formatEventDateTime,
} from "../format";

/* ---------- Typography helpers --------------------------------------- */

export function Heading({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        color: "#2f1e1a",
        fontSize: "22px",
        fontWeight: 800,
        lineHeight: "1.3",
        margin: "0 0 16px 0",
      }}
    >
      {children}
    </Text>
  );
}

export function Paragraph({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        color: "#2f1e1a",
        fontSize: "15px",
        lineHeight: "1.6",
        margin: "0 0 12px 0",
      }}
    >
      {children}
    </Text>
  );
}

export function Muted({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        color: "#78423F",
        fontSize: "13px",
        lineHeight: "1.5",
        margin: "0 0 12px 0",
      }}
    >
      {children}
    </Text>
  );
}

/* ---------- Event recap card ----------------------------------------- */

export type EventRecapData = {
  eventTitle: string;
  eventStartsAt: string;
  people: number;
  amountCents?: number;
};

export function EventRecap({ data }: { data: EventRecapData }) {
  return (
    <Section
      style={{
        backgroundColor: "#fdf3ec",
        border: "1px solid #f0ddcf",
        borderRadius: "8px",
        margin: "16px 0",
        padding: "16px",
      }}
    >
      <Text style={recapLabelStyle}>Evento</Text>
      <Text style={recapValueStyle}>{data.eventTitle}</Text>

      <Text style={recapLabelStyle}>Data e ora</Text>
      <Text style={recapValueStyle}>
        {formatEventDateTime(data.eventStartsAt)}
      </Text>

      <Text style={recapLabelStyle}>Numero partecipanti</Text>
      <Text style={recapValueStyle}>{data.people}</Text>

      {typeof data.amountCents === "number" ? (
        <>
          <Text style={recapLabelStyle}>Totale (IVA inclusa)</Text>
          <Text style={recapValueStyle}>
            {formatCurrencyEUR(data.amountCents)}
          </Text>
        </>
      ) : null}
    </Section>
  );
}

const recapLabelStyle: React.CSSProperties = {
  color: "#78423F",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.05em",
  margin: "8px 0 2px 0",
  textTransform: "uppercase",
};

const recapValueStyle: React.CSSProperties = {
  color: "#2f1e1a",
  fontSize: "15px",
  fontWeight: 600,
  lineHeight: "1.4",
  margin: "0 0 4px 0",
};

/* ---------- Primary CTA button --------------------------------------- */

export function PrimaryButton({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Section style={{ textAlign: "center", margin: "20px 0" }}>
      <Button
        href={href}
        style={{
          backgroundColor: "#AA2620",
          borderRadius: "6px",
          color: "#ffffff",
          display: "inline-block",
          fontSize: "15px",
          fontWeight: 700,
          letterSpacing: "0.02em",
          padding: "13px 26px",
          textDecoration: "none",
        }}
      >
        {children}
      </Button>
    </Section>
  );
}

/* ---------- Info / warning blocks ------------------------------------ */

export function InfoBlock({ children }: { children: React.ReactNode }) {
  return (
    <Section
      style={{
        backgroundColor: "#fdf3ec",
        border: "1px solid #f0ddcf",
        borderRadius: "8px",
        margin: "16px 0",
        padding: "12px 14px",
      }}
    >
      <Text
        style={{
          color: "#78423F",
          fontSize: "14px",
          lineHeight: "1.5",
          margin: 0,
        }}
      >
        {children}
      </Text>
    </Section>
  );
}

export function WarningBlock({ children }: { children: React.ReactNode }) {
  return (
    <Section
      style={{
        backgroundColor: "#fde5d4",
        border: "1px solid #ed7952",
        borderRadius: "8px",
        margin: "16px 0",
        padding: "12px 14px",
      }}
    >
      <Text
        style={{
          color: "#78423F",
          fontSize: "14px",
          lineHeight: "1.5",
          margin: 0,
        }}
      >
        {children}
      </Text>
    </Section>
  );
}
