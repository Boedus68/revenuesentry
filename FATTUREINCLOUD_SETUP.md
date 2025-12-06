# Integrazione Fatture in Cloud

Questa guida spiega come configurare l'integrazione con Fatture in Cloud per importare automaticamente i costi.

## Panoramica

L'integrazione con Fatture in Cloud permette di:
- Importare automaticamente le spese registrate in Fatture in Cloud
- Importare i documenti ricevuti (fatture di acquisto)
- Sincronizzare i costi per un mese specifico
- Evitare l'inserimento manuale dei dati

## Prerequisiti

1. Un account attivo su [Fatture in Cloud](https://www.fattureincloud.it/)
2. Accesso alle impostazioni API del tuo account

## Configurazione

### Passo 1: Creare un'applicazione in Fatture in Cloud

1. Accedi al tuo account Fatture in Cloud
2. Vai su **Impostazioni** → **API**
3. Clicca su **Crea nuova applicazione**
4. Compila i seguenti campi:
   - **Nome applicazione**: RevenueSentry (o un nome a tua scelta)
   - **Redirect URI**: 
     ```
     https://tuodominio.com/api/integrations/fattureincloud/callback
     ```
     Per sviluppo locale:
     ```
     http://localhost:3000/api/integrations/fattureincloud/callback
     ```
   - **Scopes**: Seleziona almeno:
     - `received_documents:r` (lettura documenti ricevuti - fatture di acquisto)
     - `cashbook:r` (lettura prima nota - spese)

5. Salva e copia il **Client ID** e il **Client Secret**

### Passo 2: Configurare l'integrazione in RevenueSentry

1. Accedi al dashboard di RevenueSentry
2. Vai alla sezione **Costi**
3. Trova il box **Fatture in Cloud** nella parte superiore
4. Inserisci:
   - **Client ID**: Il Client ID ottenuto da Fatture in Cloud
   - **Client Secret**: Il Client Secret ottenuto da Fatture in Cloud
5. Clicca su **Connetti Fatture in Cloud**

**⚠️ IMPORTANTE**: 
- Assicurati di copiare **esattamente** il Client ID e Client Secret senza spazi iniziali o finali
- Il Client ID deve corrispondere a quello dell'applicazione creata in Fatture in Cloud
- Verifica che l'applicazione sia stata salvata correttamente in Fatture in Cloud prima di procedere

### Passo 3: Autorizzare l'applicazione

1. Verrai reindirizzato alla pagina di autorizzazione di Fatture in Cloud
2. Seleziona l'azienda da collegare
3. Autorizza l'applicazione
4. Verrai reindirizzato automaticamente al dashboard

## Utilizzo

### Sincronizzare i costi per un mese

1. Nella sezione **Costi**, seleziona il mese desiderato
2. Nel box **Fatture in Cloud**, clicca su **Sincronizza costi per [mese]**
3. Il sistema recupererà:
   - Tutte le spese registrate nel mese selezionato
   - Tutti i documenti ricevuti (fatture di acquisto) del mese selezionato
4. I costi verranno importati e potrai categorizzarli come per l'importazione da Excel

### Categorizzazione automatica

I costi importati da Fatture in Cloud vengono mappati automaticamente:
- **Spese**: Vengono importate con fornitore, importo, data e descrizione
- **Documenti ricevuti**: Vengono importati come fatture di acquisto con totale IVA inclusa

Dopo l'importazione, puoi categorizzare i costi manualmente usando il dialog di categorizzazione, oppure lasciare che il sistema applichi le categorie salvate per i fornitori conosciuti.

## Dati sincronizzati

L'integrazione recupera:

### Spese (`expenses`)
- Data della spesa
- Importo
- Fornitore
- Descrizione
- Categoria (se disponibile)
- Metodo di pagamento

### Documenti ricevuti (`received_documents`)
- Data del documento
- Importo totale (IVA inclusa)
- Fornitore
- Descrizione degli articoli

## Sicurezza

- Il **Client Secret** viene salvato in modo sicuro in Firestore
- Gli **Access Token** vengono rinnovati automaticamente quando scadono
- Puoi disconnettere l'integrazione in qualsiasi momento
- I dati vengono sincronizzati solo quando richiesto manualmente

## Risoluzione problemi

### Errore: "There is no app with the given client_id" o "Client ID non valido"
Questo errore indica che il Client ID inserito non corrisponde a nessuna applicazione in Fatture in Cloud.

**Soluzione:**
1. Vai su Fatture in Cloud → **Impostazioni** → **API**
2. Verifica che l'applicazione sia stata creata e salvata correttamente
3. Copia **nuovamente** il Client ID direttamente dalla pagina delle API (non da un documento salvato)
4. Assicurati di non aver copiato spazi iniziali o finali
5. Se l'applicazione non esiste, creala seguendo il **Passo 1** della configurazione
6. Verifica che il Redirect URI configurato corrisponda esattamente a quello mostrato nelle istruzioni

### Errore: "Fatture in Cloud non configurato"
- Verifica di aver completato il flusso OAuth
- Controlla che Client ID e Client Secret siano corretti

### Errore: "Errore autenticazione Fatture in Cloud"
- Il token potrebbe essere scaduto. Prova a riconnettere l'account
- Verifica che l'applicazione in Fatture in Cloud sia ancora attiva

### Nessun costo trovato
- Verifica che ci siano spese o documenti nel mese selezionato in Fatture in Cloud
- Controlla che le date siano corrette

### Redirect URI non corrisponde
- Assicurati che il Redirect URI configurato in Fatture in Cloud corrisponda esattamente all'URL del tuo sito
- Per produzione, usa `https://`
- Per sviluppo locale, usa `http://localhost:3000`

## Limitazioni

- La sincronizzazione è manuale (richiede un click)
- I costi devono essere categorizzati manualmente dopo l'importazione
- Non vengono sincronizzati automaticamente i costi futuri (solo su richiesta)

## Supporto

Per problemi con l'API di Fatture in Cloud, consulta la [documentazione ufficiale](https://developers.fattureincloud.it/api-reference/).
