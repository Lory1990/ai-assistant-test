/**
 * Dizionari delle traduzioni. L'italiano fa da riferimento: il tipo delle
 * chiavi si ricava da lui, quindi una chiave dimenticata in inglese diventa un
 * errore di compilazione invece di comparire vuota a schermo.
 */
export const it = {
  // Cornice
  'app.name': 'Family HUD',
  'app.tagline':
    'Il quartier generale digitale della tua famiglia: pasti, obiettivi, allenamenti, casa e calendario in un unico posto.',
  'common.loading': 'Caricamento...',
  'common.wait': 'Attendi...',
  'common.add': 'Aggiungi',
  'common.delete': 'elimina',
  'common.cancel': 'Annulla',
  'common.send': 'Invia',
  'common.logout': 'Esci',
  'common.none': 'Nessun dato.',

  // Menu
  'nav.chat': 'Chat',
  'nav.overview': 'Panoramica',
  'nav.fitness': 'Fitness',
  'nav.food': 'Alimentazione',
  'nav.home': 'Casa',
  'nav.goals': 'Obiettivi',
  'nav.investments': 'Investimenti',
  'nav.diary': 'Diario',
  'nav.social': 'Social',
  'nav.marketing': 'Marketing',
  'nav.profile': 'Profilo',

  // Stato connessione live
  'live.connected': 'Live',
  'live.reconnecting': 'Riconnessione...',
  'live.titleConnected': 'Aggiornamenti live attivi',
  'live.titleReconnecting': 'Riconnessione...',

  // Accesso
  'login.emailPrompt': 'Inserisci la tua email: ti mando un codice per entrare.',
  'login.emailPlaceholder': 'Email',
  'login.sendCode': 'Inviami il codice',
  'login.sending': 'Invio...',
  'login.codePlaceholder': 'Codice a 6 cifre',
  'login.namePlaceholder': 'Come ti chiami (solo al primo accesso)',
  'login.enter': 'Entra',
  'login.verifying': 'Verifico...',
  'login.changeEmail': 'Cambia email',
  'login.codeSent': 'Ho inviato un codice a {email}. Scade tra 10 minuti.',
  'login.or': 'oppure',
  'login.continueWith': 'Continua con {provider}',
  'login.socialHint':
    'Per attivare i login social aggiungi gli identity provider Google/Facebook nel realm Keycloak (Identity providers), con Client ID e Secret delle rispettive app OAuth.',
  'login.socialNotConfigured': 'Identity provider "{alias}" non configurato nel realm Keycloak',
  'login.failedTitle': 'Login non riuscito',
  'login.backToLogin': 'Torna al login',

  // Preferenze aspetto e lingua
  'theme.switchTo': 'Passa al tema {mode}',
  'theme.light': 'chiaro',
  'theme.dark': 'scuro',
  'language.label': 'Lingua',
  'language.italian': 'Italiano',
  'language.english': 'English',
} as const

export type TranslationKey = keyof typeof it

export const en: Record<TranslationKey, string> = {
  'app.name': 'Family HUD',
  'app.tagline':
    "Your family's digital headquarters: meals, goals, workouts, home and calendar all in one place.",
  'common.loading': 'Loading...',
  'common.wait': 'Please wait...',
  'common.add': 'Add',
  'common.delete': 'delete',
  'common.cancel': 'Cancel',
  'common.send': 'Send',
  'common.logout': 'Sign out',
  'common.none': 'No data.',

  'nav.chat': 'Chat',
  'nav.overview': 'Overview',
  'nav.fitness': 'Fitness',
  'nav.food': 'Food',
  'nav.home': 'Home',
  'nav.goals': 'Goals',
  'nav.investments': 'Investments',
  'nav.diary': 'Diary',
  'nav.social': 'Social',
  'nav.marketing': 'Marketing',
  'nav.profile': 'Profile',

  'live.connected': 'Live',
  'live.reconnecting': 'Reconnecting...',
  'live.titleConnected': 'Live updates active',
  'live.titleReconnecting': 'Reconnecting...',

  'login.emailPrompt': "Enter your email and I'll send you a code to sign in.",
  'login.emailPlaceholder': 'Email',
  'login.sendCode': 'Send me the code',
  'login.sending': 'Sending...',
  'login.codePlaceholder': '6-digit code',
  'login.namePlaceholder': 'Your name (first sign-in only)',
  'login.enter': 'Sign in',
  'login.verifying': 'Verifying...',
  'login.changeEmail': 'Change email',
  'login.codeSent': 'I sent a code to {email}. It expires in 10 minutes.',
  'login.or': 'or',
  'login.continueWith': 'Continue with {provider}',
  'login.socialHint':
    'To enable social sign-in, add the Google/Facebook identity providers in the Keycloak realm (Identity providers), with the Client ID and Secret of the respective OAuth apps.',
  'login.socialNotConfigured': 'Identity provider "{alias}" is not configured in the Keycloak realm',
  'login.failedTitle': 'Sign-in failed',
  'login.backToLogin': 'Back to sign-in',

  'theme.switchTo': 'Switch to {mode} theme',
  'theme.light': 'light',
  'theme.dark': 'dark',
  'language.label': 'Language',
  'language.italian': 'Italiano',
  'language.english': 'English',
}

export const dictionaries = { it, en }
export type Language = keyof typeof dictionaries
