/**
 * Legal text shown to participants in the accordion.
 *
 * To update the legal copy:
 *   1. Edit the sections below (each entry is one accordion item).
 *   2. Bump TERMS_VERSION in lib/constants.ts so new submissions are
 *      tracked under the new version in Supabase.
 * Informativa privacy (accordion): vedi lib/privacyContent.ts (fonte privacy.txt).
 * Se cambia in modo rilevante, incrementa TERMS_VERSION in lib/constants.ts.
 *
 * Each `body` is an array of paragraphs; bullet points should use a
 * leading "— " (em dash + space) to keep visual consistency.
 */

export type LegalSection = {
  id: string;
  title: string;
  body: string[];
};

export const legalIntroTitle = "Condizioni generali di partecipazione agli eventi Cooker Loft";

export const legalIntro =
  "Le presenti condizioni generali di partecipazione (le \u201cCondizioni\u201d) disciplinano in modo organico e completo i rapporti tra Anidra S.r.l. (\u201cAnidra\u201d) e i soggetti che prendono parte agli eventi organizzati da Anidra presso il \u201cCooker Loft\u201d o altre location di volta in volta individuate, nell\u2019ambito del progetto \u201cCooker Girl\u201d e in forza dei relativi diritti di utilizzo del marchio, del format, dell\u2019immagine e dei contenuti distintivi (gli \u201cEventi\u201d o l\u2019\u201cEvento\u201d). La partecipazione agli Eventi implica accettazione espressa, integrale e consapevole delle presenti Condizioni, le quali costituiscono parte integrante e sostanziale del rapporto contrattuale tra il partecipante e Anidra.";

export const legalSections: LegalSection[] = [
  {
    id: "sez-1",
    title: "1. Natura, contenuto e qualificazione giuridica dell\u2019Evento",
    body: [
      "Gli Eventi organizzati da Anidra si configurano come esperienze a contenuto creativo, culturale, dimostrativo e di intrattenimento, sviluppate presso il Cooker Loft o presso altre location di volta in volta individuate, nell\u2019ambito del progetto \u201cCooker Girl\u201d e in forza dei relativi diritti di utilizzo. Tali Eventi possono essere caratterizzati, a seconda del format specifico, dalla presenza, dal contributo creativo, dallo show cooking, dallo storytelling o dalla direzione creativa di Aurora Cavallo.",
      "Ciascun Evento \u00e8 strutturato come un\u2019esperienza unitaria e complessa, che pu\u00f2 includere, a titolo esemplificativo, momenti di show cooking, narrazione, dimostrazione, interazione con i partecipanti, contenuti culturali, presentazioni, attivit\u00e0 creative, nonch\u00e9 ulteriori elementi scenografici, comunicativi e organizzativi volti a creare un\u2019esperienza immersiva e riconoscibile.",
      "Il corrispettivo versato dal partecipante \u00e8 riferito esclusivamente al diritto di partecipare a tale esperienza complessiva e non pu\u00f2 in alcun modo essere qualificato come corrispettivo per servizi di ristorazione o somministrazione di alimenti e bevande.",
      "Le Parti convengono espressamente che il presente rapporto non ha ad oggetto, n\u00e9 direttamente n\u00e9 indirettamente, la vendita o fornitura di pasti o servizi analoghi, bens\u00ec la partecipazione a un evento esperienziale unitario e non scomponibile nelle sue singole componenti.",
    ],
  },
  {
    id: "sez-2",
    title: "2. Componente gastronomica: natura, limiti e qualificazione",
    body: [
      "Nel contesto di determinati Eventi, potr\u00e0 essere prevista una componente gastronomica, consistente in degustazioni, assaggi, rinfreschi o altre forme di proposta alimentare.",
      "Tale componente deve intendersi, sotto ogni profilo giuridico ed economico:",
      "\u2014 accessoria, strumentale e funzionale allo svolgimento dell\u2019Evento;",
      "\u2014 priva di autonoma rilevanza contrattuale;",
      "\u2014 non separatamente identificabile n\u00e9 economicamente scindibile rispetto all\u2019esperienza complessiva.",
      "La presenza di alimenti e bevande \u00e8 finalizzata esclusivamente a completare l\u2019esperienza e a favorire la partecipazione, senza costituire elemento determinante o prevalente del rapporto.",
      "La preparazione, gestione e somministrazione degli alimenti e delle bevande sono affidate a operatori professionali terzi, selezionati da Anidra, i quali operano in piena autonomia organizzativa e sotto la propria esclusiva responsabilit\u00e0.",
      "Anidra non svolge attivit\u00e0 di preparazione o somministrazione di alimenti e bevande e non assume alcuna responsabilit\u00e0 diretta in relazione a tali attivit\u00e0.",
    ],
  },
  {
    id: "sez-3",
    title: "3. Informazioni alimentari, intolleranze ed esigenze particolari",
    body: [
      "Il partecipante \u00e8 tenuto a comunicare in modo completo, corretto e tempestivo, gi\u00e0 al momento dell\u2019invio della richiesta di partecipazione o della prenotazione, eventuali allergie, intolleranze, condizioni alimentari particolari o esigenze specifiche che possano rilevare ai fini della partecipazione all\u2019Evento e dell\u2019eventuale fruizione della componente gastronomica accessoria.",
      "Tali informazioni sono essenziali per consentire ad Anidra e al catering incaricato di valutare, prima dell\u2019eventuale accettazione della richiesta di partecipazione o della conferma della prenotazione, se l\u2019Evento possa essere fruito dal partecipante in condizioni adeguate di sicurezza e compatibilit\u00e0 organizzativa.",
      "La richiesta di partecipazione o la prenotazione non comportano automaticamente accettazione da parte di Anidra. In presenza di allergie, intolleranze, condizioni alimentari particolari o esigenze specifiche che, anche a seguito di confronto con il catering incaricato, non risultino gestibili in sicurezza o non siano compatibili con la natura, il format o l\u2019organizzazione dell\u2019Evento, Anidra potr\u00e0 non accettare la richiesta di partecipazione o non confermare la prenotazione, senza che ci\u00f2 comporti responsabilit\u00e0, penali o obblighi ulteriori a proprio carico.",
      "Le informazioni comunicate dal partecipante saranno trasmesse, ove necessario, al catering incaricato, che resta il soggetto professionalmente responsabile della gestione degli alimenti, degli ingredienti, degli allergeni, delle eventuali contaminazioni crociate e delle relative informazioni.",
      "Il partecipante prende atto che la preparazione degli alimenti pu\u00f2 avvenire in ambienti nei quali sono presenti allergeni e che, in relazione alla natura dell\u2019Evento e all\u2019organizzazione del servizio, non \u00e8 sempre possibile garantire l\u2019assenza assoluta di contaminazioni crociate.",
      "Qualora eventuali allergie, intolleranze o esigenze alimentari particolari siano comunicate tardivamente, in modo incompleto o solo al momento dell\u2019Evento, Anidra e il catering incaricato potrebbero non essere in grado di garantire modifiche, adattamenti o alternative rispetto alla proposta gastronomica prevista.",
      "In caso di mancata, incompleta, inesatta o tardiva comunicazione di allergie, intolleranze o esigenze alimentari particolari, Anidra non potr\u00e0 essere ritenuta responsabile per conseguenze derivanti da tale omissione o inesattezza, ferma restando la responsabilit\u00e0 del soggetto che materialmente prepara e somministra gli alimenti nei limiti previsti dalla legge.",
      "Il partecipante riconosce che la gestione tecnica delle informazioni relative agli allergeni \u00e8 effettuata dal catering incaricato e che eventuali informazioni fornite da Anidra hanno carattere meramente informativo e non sostitutivo delle indicazioni del soggetto che materialmente prepara e somministra gli alimenti.",
    ],
  },
  {
    id: "sez-4",
    title: "4. Richiesta di partecipazione, conferma, conclusione del contratto e pagamento",
    body: [
      "La partecipazione agli Eventi \u00e8 subordinata all\u2019invio di una richiesta di partecipazione o prenotazione secondo le modalit\u00e0 indicate da Anidra, nonch\u00e9 alla successiva accettazione o conferma da parte di Anidra.",
      "L\u2019invio della richiesta di partecipazione o della prenotazione non comporta automaticamente il diritto a partecipare all\u2019Evento, n\u00e9 determina la conclusione del contratto, potendo Anidra verificare la disponibilit\u00e0 dei posti, la compatibilit\u00e0 della richiesta con l\u2019organizzazione dell\u2019Evento, nonch\u00e9 eventuali allergie, intolleranze, esigenze alimentari particolari o altre condizioni rilevanti comunicate dal partecipante.",
      "Il contratto tra Anidra e il partecipante si intende concluso solo nel momento in cui Anidra conferma la partecipazione e il partecipante completa, ove previsto, il pagamento del corrispettivo.",
      "Il pagamento ha natura anticipata e costituisce condizione essenziale per la partecipazione all\u2019Evento.",
      "Il diritto di partecipazione \u00e8 personale, salvo quanto diversamente previsto in materia di sostituzione, e non pu\u00f2 essere ceduto a terzi senza il preventivo consenso di Anidra.",
      "Anidra si riserva il diritto di non accettare richieste incomplete, non conformi alle presenti Condizioni, tardive, non compatibili con la disponibilit\u00e0 dei posti o con l\u2019organizzazione dell\u2019Evento, ovvero non gestibili in sicurezza in ragione delle esigenze specifiche rappresentate dal partecipante.",
    ],
  },
  {
    id: "sez-5",
    title: "5. Politica di cancellazione, rinuncia e modifiche da parte del partecipante",
    body: [
      "Prima della conferma definitiva della partecipazione e del pagamento, il partecipante viene espressamente informato del fatto che, trattandosi di Evento relativo ad attivit\u00e0 del tempo libero previsto per una data o un periodo di esecuzione specifici, il diritto di recesso non trova applicazione nei casi previsti dall\u2019art. 59, lett. n), del Codice del Consumo.",
      "Ai sensi dell\u2019art. 59, lett. n), del Codice del Consumo, il diritto di recesso non si applica ai contratti aventi ad oggetto servizi relativi ad attivit\u00e0 del tempo libero qualora il contratto preveda una data o un periodo di esecuzione specifici.",
      "Pertanto, una volta confermata la partecipazione e completato il pagamento, il partecipante non potr\u00e0 esercitare il diritto di recesso. In caso di rinuncia, mancata partecipazione o impossibilit\u00e0 a partecipare per cause imputabili al partecipante, il corrispettivo versato non sar\u00e0 rimborsabile, salvo diversa indicazione espressa prevista per lo specifico Evento o diversa valutazione discrezionale di Anidra, compatibilmente con le esigenze organizzative.",
      "Tale previsione trova giustificazione nella natura organizzativa dell\u2019Evento, che comporta costi anticipati e impegni non reversibili.",
      "Resta ferma la possibilit\u00e0, compatibilmente con l\u2019organizzazione:",
      "\u2014 di indicare un sostituto;",
      "\u2014 ovvero di richiedere una riprogrammazione, senza garanzia di accoglimento.",
      "Resta ferma la facolt\u00e0 di Anidra di valutare, in via discrezionale e compatibilmente con le esigenze organizzative, eventuali richieste del partecipante, anche al fine di favorire una gestione equilibrata del rapporto.",
    ],
  },
  {
    id: "sez-6",
    title: "6. Modifiche, riprogrammazioni e cancellazioni dell\u2019Evento",
    body: [
      "Anidra si riserva il diritto di apportare modifiche all\u2019Evento, anche rilevanti, qualora ci\u00f2 si renda necessario per esigenze organizzative, artistiche, tecniche, logistiche, di sicurezza o per cause indipendenti dalla propria volont\u00e0.",
      "Tali modifiche potranno riguardare, a titolo esemplificativo, contenuto e programma, orari, modalit\u00e0 di svolgimento, partecipazione di fornitori o collaboratori, componenti gastronomiche accessorie, allestimenti, location o altri elementi organizzativi.",
      "Qualora le modifiche non incidano in modo sostanziale sulla natura e sul contenuto essenziale dell\u2019esperienza, esse non daranno diritto a rimborso, riduzione del corrispettivo o indennizzo.",
      "In caso di cancellazione definitiva dell\u2019Evento da parte di Anidra, il partecipante avr\u00e0 diritto, a propria scelta, alla riprogrammazione su altra data disponibile oppure al rimborso integrale del corrispettivo versato, con esclusione di qualsiasi ulteriore risarcimento o indennizzo, salvo quanto inderogabilmente previsto dalla legge.",
      "In caso di rinvio dell\u2019Evento a una nuova data, Anidra ne dar\u00e0 comunicazione al partecipante e proporr\u00e0 la partecipazione alla data riprogrammata. Qualora il partecipante non possa prendere parte all\u2019Evento nella nuova data proposta, Anidra potr\u00e0 offrire, in alternativa, la partecipazione a un successivo Evento equivalente, un voucher di importo pari al corrispettivo versato da utilizzare entro [\u2022] mesi, oppure il rimborso del corrispettivo, secondo quanto indicato nella comunicazione di rinvio e nel rispetto della normativa applicabile.",
      "Resta escluso, salvo dolo o colpa grave, qualsiasi diritto del partecipante al risarcimento di danni indiretti, costi di viaggio, pernottamento, perdita di opportunit\u00e0 o ulteriori spese sostenute in relazione all\u2019Evento.",
    ],
  },
  {
    id: "sez-8",
    title: "8. Comportamento dei partecipanti, sicurezza e utilizzo degli spazi",
    body: [
      "La partecipazione agli Eventi richiede il rispetto di regole di comportamento improntate a correttezza, buona fede e rispetto reciproco.",
      "Il partecipante si impegna a:",
      "\u2014 attenersi alle indicazioni fornite dallo staff organizzativo;",
      "\u2014 utilizzare gli spazi, le attrezzature e gli arredi con la massima diligenza;",
      "\u2014 evitare comportamenti che possano compromettere la sicurezza, il decoro o il corretto svolgimento dell\u2019Evento.",
      "\u00c8 espressamente vietato porre in essere condotte che possano arrecare disturbo agli altri partecipanti, creare situazioni di rischio o pregiudicare l\u2019integrit\u00e0 degli ambienti.",
      "Il partecipante che iscriva, accompagni o indichi altri soggetti, inclusi minori, accompagnatori o ospiti, si impegna a portare a loro conoscenza le presenti Condizioni e risponde, nei limiti di legge, dei danni da essi arrecati a persone, beni, arredi, attrezzature, locali o altri partecipanti.",
      "Qualora l\u2019Evento consenta la partecipazione di minori, gli stessi potranno partecipare esclusivamente se accompagnati da un soggetto adulto che eserciti la responsabilit\u00e0 genitoriale o da altro adulto debitamente autorizzato. L\u2019accompagnatore sar\u00e0 responsabile della vigilanza sul minore per tutta la durata dell\u2019Evento e dovr\u00e0 assicurare che il minore rispetti le regole di comportamento, sicurezza e utilizzo degli spazi.",
      "In caso di partecipazione di minori, eventuali dichiarazioni relative ad allergie, intolleranze, esigenze alimentari particolari, privacy e utilizzo dell\u2019immagine dovranno essere rese dal soggetto che esercita la responsabilit\u00e0 genitoriale o da chi sia legittimato a prestare tali dichiarazioni.",
      "Anidra si riserva il diritto di interrompere la partecipazione e di allontanare, anche con effetto immediato, qualsiasi soggetto che tenga comportamenti ritenuti inappropriati o incompatibili con il contesto dell\u2019Evento, senza che ci\u00f2 comporti alcun diritto a rimborso o indennizzo.",
      "Il partecipante resta personalmente responsabile per ogni danno cagionato a persone, beni o strutture da s\u00e9 medesimo, nonch\u00e9, nei limiti di legge, dai minori, accompagnatori, ospiti o soggetti da lui indicati o introdotti all\u2019Evento, obbligandosi a risarcire integralmente i relativi pregiudizi.",
    ],
  },
  {
    id: "sez-8-bis",
    title: "8-bis. Bevande alcoliche e consumo responsabile. Oggetti personali",
    body: [
      "Qualora nell\u2019ambito dell\u2019Evento siano previste bevande alcoliche, la relativa somministrazione sar\u00e0 effettuata nel rispetto della normativa applicabile e, in ogni caso, non sar\u00e0 consentita nei confronti dei minori di et\u00e0.",
      "Il partecipante \u00e8 tenuto a un consumo responsabile e a mantenere un comportamento compatibile con il contesto dell\u2019Evento, con la sicurezza propria e altrui e con il rispetto degli altri partecipanti, dello staff e degli spazi.",
      "Anidra, il catering incaricato o il personale addetto potranno rifiutare o interrompere la somministrazione di bevande alcoliche nei confronti di soggetti minori, di soggetti che non siano in grado di dimostrare la maggiore et\u00e0, ovvero di soggetti che tengano comportamenti non adeguati, molesti, pericolosi o incompatibili con il corretto svolgimento dell\u2019Evento.",
      "Resta fermo il diritto di Anidra di allontanare dall\u2019Evento, senza diritto a rimborso, il partecipante che tenga comportamenti pregiudizievoli per la sicurezza, il decoro o il regolare svolgimento dell\u2019Evento.",
      "Il partecipante \u00e8 responsabile della custodia dei propri effetti personali durante l\u2019Evento.",
      "Anidra non assume obblighi di custodia in relazione a borse, capi di abbigliamento, dispositivi elettronici, oggetti di valore o altri beni personali introdotti dal partecipante negli spazi dell\u2019Evento, salvo che sia espressamente previsto un servizio di custodia organizzato da Anidra.",
      "Nei limiti consentiti dalla legge, Anidra non potr\u00e0 essere ritenuta responsabile per furti, smarrimenti, danneggiamenti o sottrazioni di effetti personali lasciati incustoditi, salvo il caso di dolo o colpa grave.",
    ],
  },
  {
    id: "sez-9",
    title: "9. Riprese fotografiche, audiovisive e utilizzo dell\u2019immagine",
    body: [
      "Nel corso degli Eventi potranno essere effettuate riprese fotografiche, video o altre forme di registrazione, anche da parte di professionisti incaricati da Anidra, al fine di documentare lo svolgimento dell\u2019Evento, raccontarne il contenuto e realizzare materiali di comunicazione collegati al progetto Cooker Girl e al Cooker Loft.",
      "Il partecipante prende atto che, in ragione della natura dell\u2019Evento e della possibile presenza di riprese generali dell\u2019ambiente, della sala, degli allestimenti, delle attivit\u00e0 e dei momenti collettivi, la propria immagine potrebbe risultare ripresa in modo incidentale, accessorio o non individualmente valorizzato all\u2019interno di immagini o video di contesto.",
      "L\u2019utilizzo dell\u2019immagine del partecipante in modo riconoscibile, individuale o comunque chiaramente identificabile per finalit\u00e0 promozionali, pubblicitarie, social, editoriali o di comunicazione commerciale sar\u00e0 subordinato al rilascio di uno specifico consenso separato, libero e revocabile, da acquisirsi in fase di richiesta di partecipazione, conferma della prenotazione o in altra modalit\u00e0 idonea.",
      "In mancanza di tale consenso separato, Anidra si aster\u00e0, per quanto ragionevolmente possibile, dall\u2019utilizzare immagini o riprese nelle quali il partecipante sia ritratto in modo individuale, riconoscibile e non meramente incidentale per finalit\u00e0 promozionali o commerciali.",
      "Qualora all\u2019Evento partecipino minori, l\u2019eventuale consenso all\u2019utilizzo della loro immagine dovr\u00e0 essere prestato dal soggetto che esercita la responsabilit\u00e0 genitoriale o da altro soggetto legittimato, mediante apposita autorizzazione separata.",
      "Resta fermo il diritto del partecipante di segnalare preventivamente allo staff la volont\u00e0 di non essere ripreso o di non comparire in materiali promozionali riconoscibili, ferma restando la possibile presenza incidentale in riprese generali dell\u2019Evento.",
    ],
  },
  {
    id: "sez-10",
    title: "10. Limitazione di responsabilit\u00e0 e allocazione dei rischi",
    body: [
      "Anidra assume responsabilit\u00e0 esclusivamente in relazione all\u2019organizzazione e alla gestione complessiva dell\u2019Evento, nei limiti della propria sfera di controllo.",
      "Il partecipante riconosce che l\u2019Evento si svolge con il coinvolgimento di una pluralit\u00e0 di soggetti terzi autonomi (tra cui, a titolo esemplificativo, fornitori, collaboratori e operatori del catering), i quali operano sotto la propria responsabilit\u00e0. Resta ferma, in ogni caso, la responsabilit\u00e0 di Anidra per gli obblighi inderogabili posti a suo carico dalla legge e per i fatti direttamente imputabili alla propria organizzazione, nei limiti previsti dalla normativa applicabile.",
      "Nei limiti consentiti dalla normativa applicabile, Anidra non potr\u00e0 essere ritenuta responsabile per:",
      "\u2014 fatti, omissioni o condotte imputabili a soggetti terzi;",
      "\u2014 danni derivanti da comportamenti del partecipante o di altri partecipanti;",
      "\u2014 eventi non prevedibili o comunque non evitabili con l\u2019ordinaria diligenza;",
      "\u2014 danni indiretti, consequenziali, perdita di opportunit\u00e0 o pregiudizi non immediatamente riconducibili all\u2019organizzazione dell\u2019Evento.",
      "Resta in ogni caso ferma la responsabilit\u00e0 dei soggetti che materialmente prestano servizi specifici, inclusa la preparazione e somministrazione di alimenti e bevande.",
      "Qualora, nei limiti di legge, venga accertata una responsabilit\u00e0 di Anidra, la stessa sar\u00e0 in ogni caso limitata al solo danno diretto e prevedibile e non potr\u00e0 eccedere l\u2019importo complessivamente versato dal partecipante per la partecipazione all\u2019Evento.",
      "Resta in ogni caso esclusa qualsiasi limitazione o esclusione di responsabilit\u00e0 nei casi di dolo o colpa grave, nonch\u00e9 nei casi in cui tale limitazione non sia consentita dalla normativa applicabile.",
      "La presente limitazione di responsabilit\u00e0 deve intendersi applicabile nei limiti consentiti dalla normativa vigente e non incide sui diritti inderogabili riconosciuti al consumatore.",
    ],
  },
  {
    id: "sez-11",
    title: "11. Forza maggiore e gestione degli eventi straordinari",
    body: [
      "Anidra non potr\u00e0 essere ritenuta responsabile per l\u2019impossibilit\u00e0, il ritardo o la modifica nello svolgimento dell\u2019Evento qualora ci\u00f2 sia determinato da eventi imprevedibili e indipendenti dalla propria volont\u00e0, quali, a titolo esemplificativo e non esaustivo:",
      "\u2014 provvedimenti delle autorit\u00e0;",
      "\u2014 eventi naturali straordinari;",
      "\u2014 indisponibilit\u00e0 sopravvenuta della location;",
      "\u2014 guasti tecnici rilevanti;",
      "\u2014 situazioni di emergenza o sicurezza.",
      "In presenza di tali circostanze, Anidra si impegna ad adottare ogni soluzione ragionevole per la gestione dell\u2019Evento, ivi inclusa la riprogrammazione, la modifica del format o, ove necessario, la cancellazione.",
      "In caso di impossibilit\u00e0 definitiva di svolgimento, il partecipante avr\u00e0 diritto al rimborso del corrispettivo versato o alla riprogrammazione, restando escluso qualsiasi ulteriore risarcimento o indennizzo.",
    ],
  },
  {
    id: "sez-12",
    title: "12. Disposizioni finali, validit\u00e0 e legge applicabile",
    body: [
      "Le presenti Condizioni costituiscono l\u2019intero accordo tra Anidra e il partecipante e sostituiscono qualsiasi precedente intesa, comunicazione o accordo, anche verbale, avente ad oggetto la partecipazione agli Eventi.",
      "L\u2019eventuale invalidit\u00e0, nullit\u00e0 o inefficacia di una o pi\u00f9 clausole non incider\u00e0 sulla validit\u00e0 delle restanti disposizioni, che continueranno a produrre pieno effetto tra le Parti.",
      "Il mancato esercizio da parte di Anidra di un diritto derivante dalle presenti Condizioni non potr\u00e0 essere interpretato come rinuncia allo stesso.",
      "Per quanto non espressamente previsto, si applica la legge italiana.",
      "Per ogni controversia relativa alla validit\u00e0, interpretazione o esecuzione delle presenti Condizioni, qualora il partecipante agisca in qualit\u00e0 di consumatore ai sensi della normativa vigente, sar\u00e0 competente il foro del luogo di residenza o domicilio del medesimo.",
      "Qualora il partecipante non rivesta la qualifica di consumatore, sar\u00e0 competente in via esclusiva il Foro di Torino.",
      "Le presenti Condizioni Generali disciplinano integralmente il rapporto tra Anidra S.r.l. e il partecipante e si intendono accettate mediante selezione dell\u2019apposita casella di presa visione e accettazione in fase di prenotazione.",
      "Il contratto si intende concluso nel momento in cui il partecipante completa la procedura di acquisto e riceve conferma della prenotazione.",
      "Le Condizioni applicabili sono quelle pubblicate sul sito al momento della prenotazione e restano consultabili in ogni momento.",
    ],
  },
  {
    id: "sez-13",
    title: "13. Trattamento dei dati personali",
    body: [
      "Il trattamento dei dati personali dei partecipanti avverr\u00e0 nel rispetto della normativa applicabile in materia di protezione dei dati personali, incluso il Regolamento (UE) 2016/679 (\u201cGDPR\u201d).",
      "Prima dell\u2019invio della richiesta di partecipazione o della conferma della prenotazione, il partecipante sar\u00e0 messo a disposizione dell\u2019informativa privacy di Anidra, contenente le informazioni relative alle finalit\u00e0 e modalit\u00e0 del trattamento, alle basi giuridiche, ai tempi di conservazione, ai soggetti destinatari dei dati e ai diritti riconosciuti all\u2019interessato.",
      "Il conferimento dei dati richiesti ai fini della gestione della partecipazione all\u2019Evento, inclusi eventuali dati relativi ad allergie, intolleranze o esigenze alimentari particolari, \u00e8 necessario per consentire ad Anidra di valutare e gestire la partecipazione all\u2019Evento. In assenza di tali informazioni, Anidra potrebbe non essere in grado di accettare o confermare la partecipazione.",
      "Il trattamento di immagini o riprese del partecipante per finalit\u00e0 promozionali o commerciali sar\u00e0 effettuato nei limiti dell\u2019eventuale consenso separatamente prestato, ove richiesto.",
    ],
  },
  {
    id: "approvazione-1341-1342",
    title: "Approvazione specifica delle clausole (artt. 1341 e 1342 c.c.)",
    body: [
      "Il partecipante dichiara, ai sensi e per gli effetti degli artt. 1341 e 1342 c.c., di aver letto attentamente e di approvare specificamente le seguenti clausole: 2, 3, 5, 6, 7, 8, 9 e 10.",
      "Specificamente, le clausole relative a limitazioni di responsabilit\u00e0, esclusione del diritto di recesso, cancellazioni, modifiche dell\u2019Evento, comportamento dei partecipanti e utilizzo dell\u2019immagine sono specificamente portate all\u2019attenzione del partecipante in fase di prenotazione e oggetto di separata accettazione mediante apposita selezione.",
      "Le presenti Condizioni si intendono accettate mediante selezione dell\u2019apposita casella di presa visione e accettazione in fase di richiesta di partecipazione, prenotazione o conferma della stessa.",
      "Il contratto si intende concluso nel momento in cui Anidra conferma la partecipazione e il partecipante completa, ove previsto, la procedura di pagamento.",
      "Le Condizioni applicabili sono quelle pubblicate sul sito e/o rese disponibili al partecipante al momento dell\u2019invio della richiesta di partecipazione o della prenotazione, e restano consultabili in ogni momento.",
    ],
  },
];
