# Notenmanager Oberstufe

Notenmanager für die bayerische Oberstufe (G9, Qualifikationsphase), als einzelne Webseite (`index.html`) über GitHub Pages.

- Anmeldung mit 12-stelligen Codes, die Noten werden im Browser mit dem Code verschlüsselt (AES-GCM, Schlüssel per PBKDF2).
- Speicherung: verschlüsselt im Browser und in Firebase Firestore (Sync über Geräte).
- Die Codeliste kann nur das Admin-Konto (Firebase Authentication) ändern. Die Regeln dafür stehen in `firestore.rules` und werden in der Firebase-Konsole unter Firestore → Regeln eingefügt.

Anmeldecodes gehören nie in dieses Repository.

## App auf dem Handy

Die Seite ist eine installierbare Web-App (`manifest.webmanifest`, Symbole in `icons/`, Service Worker `sw.js`).
Die Seite selbst wird immer zuerst aus dem Netz geladen, damit Updates sofort ankommen; ohne Verbindung startet die zuletzt geladene Fassung.
Anfragen an Firestore und Firebase Auth laufen nicht über den Service Worker. Bei grundlegenden Änderungen an `sw.js` die Konstante `VERSION` erhöhen.
