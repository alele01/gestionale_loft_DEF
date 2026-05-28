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
        color: "#0f172a",
        fontSize: "22px",
        fontWeight: 700,
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
        color: "#0f172a",
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
        color: "#475569",
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
        backgroundColor: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: "10px",
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
  color: "#64748b",
  fontSize: "11px",
  fontWeight: 600,
  letterSpacing: "0.05em",
  margin: "8px 0 2px 0",
  textTransform: "uppercase",
};

const recapValueStyle: React.CSSProperties = {
  color: "#0f172a",
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
          backgroundColor: "#0f172a",
          borderRadius: "8px",
          color: "#ffffff",
          display: "inline-block",
          fontSize: "15px",
          fontWeight: 600,
          padding: "12px 24px",
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
        backgroundColor: "#eff6ff",
        border: "1px solid #bfdbfe",
        borderRadius: "8px",
        margin: "16px 0",
        padding: "12px 14px",
      }}
    >
      <Text
        style={{
          color: "#1e3a8a",
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
        backgroundColor: "#fef3c7",
        border: "1px solid #fcd34d",
        borderRadius: "8px",
        margin: "16px 0",
        padding: "12px 14px",
      }}
    >
      <Text
        style={{
          color: "#78350f",
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
