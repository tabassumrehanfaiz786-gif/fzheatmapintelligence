export const LEGAL_REFERENCES = [
  { name: "UK MAR · Articles 2, 12, 16 and Annex I", url: "https://www.legislation.gov.uk/eur/2014/596/contents", status: "Legislation · scope must be checked", note: "Instrument and venue coverage comes first. Indicators are not proof; spot BTC is not automatically within UK MAR." },
  { name: "EU MAR · Regulation 596/2014", url: "https://eur-lex.europa.eu/eli/reg/2014/596/oj/eng", status: "EU legislation", note: "Article 12 and Annex I address manipulation and indicators, subject to Article 2 scope. Separate from UK MAR." },
  { name: "MAR indicators · Delegated Regulation 2016/522", url: "https://eur-lex.europa.eu/eli/reg_del/2016/522/oj/eng", status: "EU delegated legislation", note: "Additional non-exhaustive indicators; not an ‘RTS 8 spoofing test’ or a numerical judicial threshold." },
  { name: "MiCA · Articles 86, 91 and 92", url: "https://eur-lex.europa.eu/eli/reg/2023/1114/oj/eng", status: "EU legislation", note: "Article 91 prohibits market manipulation; Article 92 concerns prevention and detection. Article 86 defines Title VI scope; does not establish UK coverage." },
  { name: "FCA · Suspicious transaction and order reports", url: "https://www.fca.org.uk/markets/market-abuse/suspicious-transaction-and-order-reports", status: "Regulator guidance", note: "Reporting duties depend on role and instrument. Research drafts are not the official form and are never submitted by this app." },
  { name: "CPR Part 35 & Practice Direction 35", url: "https://www.justice.gov.uk/courts/procedure-rules/civil/rules/part35", status: "Civil procedure rules", note: "Expert duties and case-specific requirements are not established by an automated memorandum. No statement of truth is supplied." },
];

export function LegalReferences() {
  return <div className="space-y-3 border-t pt-4"><h3 className="font-semibold">Legal reference matrix</h3>
    <p className="text-xs text-muted-foreground">Primary-source links, not automated legal conclusions. Check the current consolidated text and jurisdiction before relying on a reference.</p>
    {LEGAL_REFERENCES.map(r => <div key={r.name} className="border-l pl-3 text-xs"><a href={r.url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline">{r.name}</a><div className="mt-1 text-warn">{r.status}</div><p className="mt-1 text-muted-foreground">{r.note}</p></div>)}
    <p className="text-xs text-muted-foreground">FCA v Da Vinci Invest Ltd [2015] EWHC 2401 (Ch) is a case-research lead, not an engine rule: the official judgment has not been verified here. No “four-prong” judicial test or statutory three-second threshold is applied.</p>
  </div>;
}