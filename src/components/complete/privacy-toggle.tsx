"use client";

import * as React from "react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  privacyIntro,
  privacyIntroTitle,
  privacySections,
} from "@reference/oldPage/privacyContent";

type PrivacyToggleProps = {
  checked: boolean;
  onChange: (v: boolean) => void;
  /**
   * Extra inline text appended after "informativa privacy" — used to
   * adapt the consent wording when the user is also acting as referent
   * for other participants.
   */
  extraText?: string;
  required?: boolean;
};

export function PrivacyToggleCheckbox({
  checked,
  onChange,
  extraText,
  required,
}: PrivacyToggleProps) {
  const [showText, setShowText] = React.useState(false);

  return (
    <div
      className={`space-y-2 rounded-md border bg-card p-3 ${
        required && !checked ? "border-rose-300/70 bg-rose-50/30" : ""
      }`}
    >
      <label className="flex cursor-pointer items-start gap-3">
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => onChange(v === true)}
          className="mt-0.5"
        />
        <span className="text-sm leading-snug">
          Dichiaro di aver preso visione dell&apos;{" "}
          <button
            type="button"
            className="underline underline-offset-2"
            onClick={(e) => {
              e.preventDefault();
              setShowText((s) => !s);
            }}
          >
            informativa privacy
          </button>
          {" "}di Anidra S.r.l.{extraText ?? ""}.
          {required ? (
            <span
              aria-label="campo obbligatorio"
              className="ml-0.5 font-semibold text-rose-600"
            >
              *
            </span>
          ) : null}
        </span>
      </label>

      {showText ? (
        <div className="space-y-3 rounded-md border-l-2 border-primary/30 bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {privacyIntroTitle}
            </p>
            <p className="mt-1">{privacyIntro}</p>
          </div>
          {privacySections.map((section) => (
            <div key={section.id}>
              <p className="text-xs font-semibold text-foreground">
                {section.title}
              </p>
              {section.body.map((p, i) => (
                <p key={i} className="mt-1">
                  {p}
                </p>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
