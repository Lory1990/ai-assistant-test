# Family HUD

**Il quartier generale digitale della tua famiglia: pasti, obiettivi, allenamenti, casa e calendario in un unico posto.**

Family HUD è un assistente personale con AI che non si limita a rispondere: *agisce*.
Accende le luci, registra la cena, aggiorna la lista della spesa, crea un obiettivo,
pianifica un post social. Da una dashboard web o direttamente da Telegram, scrivendo
o parlando — in italiano, come si parlerebbe a una persona.

---

## Il problema

La vita di una famiglia è già organizzata: in sei app diverse, tre gruppi WhatsApp e
un foglio Excel. La domotica sta in un'app, la dieta in un'altra, gli allenamenti in
una terza, il calendario in una quarta. Nessuna di queste parla con le altre, e
nessuna sa nulla di chi la sta usando.

## La soluzione

Un unico assistente che ha accesso a tutto e ricorda chi sei.

> «Accendi le luci del salotto e chiudi le tapparelle»
> «Ho mangiato 150g di pasta al pomodoro»
> «Fammi un piano alimentare per oggi, ricordati che sono intollerante al lattosio»
> «Come va il mio portafoglio?»
> «Prepara un piano editoriale per il prossimo mese sul pilates»

Una richiesta, un canale, nessun form da compilare. L'assistente capisce l'intento,
esegue l'azione reale sui sistemi collegati e conferma il risultato.

---

## Cosa fa

### 🤖 Assistente conversazionale che esegue azioni
Non un chatbot: un agente con oltre 30 strumenti reali a disposizione. Decide da sé
quali usare, li concatena in più passaggi quando serve, e non inventa mai uno stato
che può verificare. Conversazioni persistenti: riprende sempre da dove avevate lasciato.

### 🧠 Memoria per persona
Preferenze, vincoli, allergie, abitudini. Le dici una volta — «sono vegetariano»,
«mi alleno il martedì» — e valgono per tutte le conversazioni successive, su tutti i
canali. La memoria è consultabile e cancellabile dalla dashboard: l'utente vede
esattamente cosa l'assistente sa di lui.

### 💬 Web + Telegram + voce
La stessa intelligenza su tre superfici: dashboard web in tempo reale, bot Telegram,
e messaggi vocali trascritti automaticamente. Foto incluse: fotografi il piatto e il
pasto va a registro.

### 🏠 Casa connessa
Luci, prese e interruttori Shelly; tapparelle Somfy TaHoma; TV Hisense; musica su
Apple Music e Alexa. Tutto in linguaggio naturale, senza aprire cinque app.

### 🍽️ Alimentazione
Registro pasti con calorie, piani alimentari generati dall'AI in base agli obiettivi
attivi della famiglia, e lista della spesa condivisa che si popola da sola con gli
ingredienti mancanti.

### 💪 Fitness
Registro allenamenti da testo libero («panca 4x8 a 60kg»), piani di allenamento,
recap automatico ogni mattina alle 9 con quello che il team ha fatto.

### 🎯 Obiettivi personali e di team
Obiettivi con scadenza, priorità e ambito: alcuni condivisi con tutta la famiglia,
altri visibili solo a chi li crea. Con promemoria automatici.

### 📅 Calendario ed email
Google Calendar e Gmail, Outlook e Microsoft Graph. Eventi marcati come importanti,
con notifica in anticipo su Telegram.

### 📈 Investimenti
Portafoglio azioni ed ETF con quotazioni di mercato e valorizzazione automatica.
Privato: mai condiviso col team.

### 📱 Social e piano editoriale
Post programmati su Facebook e Instagram, immagini incluse. E un piano editoriale
generato dall'AI su un periodo scelto — che diventa un post pubblicato solo con
un'azione esplicita, mai automaticamente.

### 📓 Diario privato
L'unico spazio dell'app deliberatamente invisibile anche all'assistente AI: nessuno
strumento del modello può leggerlo.

---

## Le scelte che fanno la differenza

**La privacy è nell'architettura, non nelle impostazioni.**
Diario, investimenti e piano editoriale non hanno nemmeno il concetto di "team" nel
codice: non sono nascosti, sono separati alla radice. Il diario è escluso di proposito
dagli strumenti dell'AI. Gli obiettivi hanno un ambito esplicito, personale o condiviso.

**Le azioni irreversibili chiedono il permesso.**
L'assistente genera il piano editoriale, ma non pubblica. Pubblicare su un profilo
pubblico è difficile da annullare: serve un clic umano. E davanti a una richiesta
ambigua, chiede un chiarimento invece di indovinare.

**Nessun lock-in sul modello AI.**
Claude e GPT funzionano entrambi dietro la stessa interfaccia. Anthropic diretto,
OpenAI diretto o Azure AI Foundry: si cambia modello modificando una riga di
configurazione, senza toccare il codice. Un requisito che diventa strategico quando
il fornitore va scelto per policy aziendale, non per preferenza tecnica.

**Login moderno, senza password da ricordare.**
Codice usa e getta via email, secondo fattore TOTP, login social. Su base Keycloak,
ma con la schermata di login dentro l'app: l'utente non viene mai sbalzato su un
dominio estraneo.

**Multilingua e multi-tema dal primo giorno.**
Italiano e inglese, tema scuro e chiaro. Le traduzioni sono verificate a compile-time:
una stringa dimenticata è un errore di build, non un buco che appare a schermo.

---

## Sotto il cofano

| | |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, TanStack Query, WebSocket per gli aggiornamenti live |
| **Backend** | Node.js, Fastify, TypeScript, Prisma |
| **Dati** | MongoDB (replica set), Redis per la cache |
| **AI** | Claude o GPT via Anthropic, OpenAI o Azure AI Foundry — con loop agentico a tool-use |
| **Auth** | Keycloak (OIDC), codici via email, TOTP, login social |
| **Canali** | Dashboard web, bot Telegram (grammY), trascrizione vocale |
| **Deploy** | Docker Compose: tutto lo stack in un comando |

Le integrazioni esterne collegate: Shelly Cloud, Somfy TaHoma/Overkiz, Hisense VIDAA,
Apple Music, Alexa, Google (Calendar + Gmail), Microsoft Graph (Outlook),
Meta Graph API (Facebook + Instagram), Alpha Vantage, provider calorie, SMTP.

**Un comando per provarlo:**

```bash
npm run docker:up
```

Dashboard su `http://localhost:8080`. Lo stack di sviluppo include un server SMTP
che cattura le email invece di spedirle, così il login via codice si prova senza
configurare nulla.

---

## Stato del progetto

Family HUD è un progetto in evoluzione attiva. Non tutte le aree hanno la stessa maturità:

**Solide** — assistente e loop di tool-use, memoria, conversazioni persistenti,
autenticazione, pasti e lista della spesa, obiettivi, allenamenti, piani alimentari
e di allenamento, investimenti, diario, piano editoriale, pubblicazione social,
dashboard e bot Telegram.

**In sviluppo** — sincronizzazione reale del calendario da Google/Outlook, lettura
email (flusso OAuth da completare), controllo TV Hisense e riproduzione su Alexa
(protocolli locali da verificare sui singoli modelli), lookup calorie su database
esterno, messaggi motivazionali sugli obiettivi generati dall'LLM.

---

*Documento di presentazione del progetto. Per la documentazione tecnica e
l'elenco completo delle variabili di configurazione, vedi `backend/.env.example`.*
