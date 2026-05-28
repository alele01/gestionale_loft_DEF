/**
 * Vendor (cedente/prestatore) constants for ANIDRA S.R.L.
 *
 * These values are HARDCODED on purpose: a typo on the vendor P.IVA would
 * invalidate every XML the system generates. The accountant signed off on
 * the values below by providing the reference XML at
 * `reference/xml/fattura reference.xml`. Any change here must be paired
 * with a reference XML refresh and the accountant's explicit approval.
 *
 * The shape mirrors the FatturaPA `CedentePrestatore` block plus the
 * top-level `IdTrasmittente` (we transmit on our own behalf in V1).
 */

export type VendorIdentity = {
  /** ISO-3166 alpha-2 country code for the fiscal identity. Italy only. */
  country: "IT";
  /** P.IVA (11 numeric digits). */
  vatNumber: string;
  /** Codice Fiscale (in our case identical to P.IVA — SRL). */
  taxCode: string;
  /** Ragione sociale (FatturaPA `Denominazione`). */
  denomination: string;
  /** Regime fiscale (FatturaPA codelist). RF01 = ordinario. */
  regimeFiscale: "RF01";
  /** Sede legale. */
  address: {
    street: string;
    streetNumber: string | null;
    zip: string;
    city: string;
    province: string;
    country: "IT";
  };
  /** Iscrizione REA (camera di commercio). */
  rea: {
    office: string;
    number: string;
    /** Capitale sociale in EUR, formatted as a fixed-2 decimal string. */
    capitaleSociale: string;
    /** SocioUnico flag: SU = socio unico, SM = più soci. */
    socioUnico: "SU" | "SM";
    /** LS = in liquidazione, LN = non in liquidazione. */
    statoLiquidazione: "LS" | "LN";
  };
  /** Email PEC del vendor (opzionale, va in `Contatti.Email`). */
  pecEmail: string | null;
};

/**
 * Cooker Loft vendor identity. Mirrors `reference/xml/fattura reference.xml`
 * (the accountant-supplied sample). The address values mirror the working
 * UI mock at `src/lib/mock/xml.ts`; if the accountant confirms a different
 * legal seat, update both this constant and the mock preview together so
 * the admin UI and the real generator stay in sync.
 */
export const VENDOR: VendorIdentity = {
  country: "IT",
  vatNumber: "04049550041",
  taxCode: "04049550041",
  denomination: "ANIDRA S.R.L.",
  regimeFiscale: "RF01",
  address: {
    street: "Corso Massimo D'Azeglio",
    streetNumber: "60/H",
    zip: "10126",
    city: "Torino",
    province: "TO",
    country: "IT",
  },
  rea: {
    office: "TO",
    number: "1334731",
    capitaleSociale: "10000.00",
    socioUnico: "SM",
    statoLiquidazione: "LN",
  },
  pecEmail: null,
};
