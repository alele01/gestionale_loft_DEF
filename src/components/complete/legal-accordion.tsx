"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  legalIntro,
  legalIntroTitle,
  legalSections,
} from "@reference/oldPage/legalContent";

export function LegalAccordion() {
  return (
    <div id="legal-document" className="space-y-3 scroll-mt-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{legalIntroTitle}</h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {legalIntro}
        </p>
      </div>
      <Accordion type="multiple" className="rounded-md border bg-card">
        {legalSections.map((section) => (
          <AccordionItem
            key={section.id}
            value={section.id}
            className="border-b last:border-b-0"
          >
            <AccordionTrigger className="px-3 text-sm">
              {section.title}
            </AccordionTrigger>
            <AccordionContent className="px-3">
              <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
                {section.body.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
