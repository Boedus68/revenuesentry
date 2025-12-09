# Dove Mettere il File service-account-key.json

## Posizione Corretta

Il file `service-account-key.json` deve essere nella **root del progetto**, cioè la **stessa cartella** dove si trova:
- `package.json`
- `next.config.mjs`
- `tsconfig.json`
- `.gitignore`

## Struttura Corretta

```
E:\Progetti\revenuesentry\          ← ROOT DEL PROGETTO
├── service-account-key.json        ← QUI! (stesso livello di package.json)
├── package.json
├── next.config.mjs
├── tsconfig.json
├── .gitignore
├── app/
├── lib/
└── ...
```

## Come Verificare

1. Apri File Explorer
2. Vai alla cartella: `E:\Progetti\revenuesentry`
3. Verifica che vedi `package.json` nella lista
4. Il file `service-account-key.json` deve essere **nella stessa cartella** di `package.json`

## Come Ottenere il File

1. Vai su [Firebase Console](https://console.firebase.google.com)
2. Seleziona il progetto **revenuesentry**
3. Vai su ⚙️ **Project Settings** → Tab **Service Accounts**
4. Clicca su **Generate New Private Key**
5. Scarica il file JSON
6. **Rinomina** il file in: `service-account-key.json` (nome esatto!)
7. **Sposta** il file nella cartella `E:\Progetti\revenuesentry\`

## Verifica Automatica

Quando riavvii il server (`npm run dev`), nei log vedrai:
```
[Firebase Admin] Working directory (cwd): E:\Progetti\revenuesentry
[Firebase Admin] Percorso completo file: E:\Progetti\revenuesentry\service-account-key.json
[Firebase Admin] File esiste? true/false
```

Se `File esiste? false`, significa che il file non è nella posizione corretta.

## Troubleshooting

### "File non trovato"
- Verifica che il nome sia esattamente `service-account-key.json` (case-sensitive)
- Verifica che non sia in una sottocartella
- Verifica che sia nella stessa cartella di `package.json`

### "Working directory diverso"
Se il log mostra un percorso diverso da `E:\Progetti\revenuesentry`, assicurati di avviare il server dalla root del progetto.

### Test Manuale
Puoi testare manualmente con PowerShell:
```powershell
cd E:\Progetti\revenuesentry
Test-Path "service-account-key.json"
```
Dovrebbe restituire `True` se il file è presente.

