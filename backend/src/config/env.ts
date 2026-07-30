import "dotenv/config";

function optional(name: string): string | undefined {
  return process.env[name];
}

export const env = {
  redisUrl: optional("REDIS_URL") ?? "redis://localhost:6379",
  // L'issuer atteso nei token e' quello visto dal browser (es. http://localhost:8081/...).
  // In Docker il backend non puo' raggiungere "localhost:8081" (e' se stesso): per
  // recuperare le chiavi JWKS usa invece l'hostname interno del container Keycloak.
  keycloakIssuerUrl: optional("KEYCLOAK_ISSUER_URL") ?? "http://localhost:8081/realms/personal-assistant",
  keycloakInternalUrl: optional("KEYCLOAK_INTERNAL_URL") ?? optional("KEYCLOAK_ISSUER_URL") ?? "http://localhost:8081/realms/personal-assistant",
  // Client confidenziale usato dal backend per il login email/password
  // (direct grant), lo scambio del code social e l'Admin API (service
  // account). Il browser non lo vede mai: la schermata di login e' nella
  // nostra app e parla solo col nostro backend.
  keycloakBackendClient: {
    clientId: optional("KEYCLOAK_BACKEND_CLIENT_ID") ?? "backend-service",
    clientSecret: optional("KEYCLOAK_BACKEND_CLIENT_SECRET"),
    socialRedirectUri: optional("KEYCLOAK_SOCIAL_REDIRECT_URI") ?? "http://localhost:3000/api/auth/social/callback",
  },
  telegramBotToken: optional("TELEGRAM_BOT_TOKEN"),
  shelly: {
    cloudServer: optional("SHELLY_CLOUD_SERVER"),
    authKey: optional("SHELLY_CLOUD_AUTH_KEY"),
  },
  overkiz: {
    server: optional("OVERKIZ_SERVER"),
    username: optional("OVERKIZ_USERNAME"),
    password: optional("OVERKIZ_PASSWORD"),
  },
  calorieApi: {
    appId: optional("CALORIE_API_APP_ID"),
    appKey: optional("CALORIE_API_APP_KEY"),
  },
  google: {
    clientId: optional("GOOGLE_CLIENT_ID"),
    clientSecret: optional("GOOGLE_CLIENT_SECRET"),
    redirectUri: optional("GOOGLE_REDIRECT_URI"),
  },
  microsoft: {
    clientId: optional("MS_CLIENT_ID"),
    clientSecret: optional("MS_CLIENT_SECRET"),
    tenantId: optional("MS_TENANT_ID"),
    redirectUri: optional("MS_REDIRECT_URI"),
  },
  appleMusic: {
    teamId: optional("APPLE_MUSIC_TEAM_ID"),
    keyId: optional("APPLE_MUSIC_KEY_ID"),
    privateKeyPath: optional("APPLE_MUSIC_PRIVATE_KEY_PATH"),
  },
  alexa: {
    refreshToken: optional("ALEXA_REFRESH_TOKEN"),
    clientId: optional("ALEXA_CLIENT_ID"),
    clientSecret: optional("ALEXA_CLIENT_SECRET"),
  },
  hisenseTv: {
    ip: optional("HISENSE_TV_IP"),
    mac: optional("HISENSE_TV_MAC"),
    mqttPort: Number(optional("HISENSE_TV_MQTT_PORT") ?? 36669),
  },
  anthropicApiKey: optional("ANTHROPIC_API_KEY"),
  // Modelli Claude ospitati su Azure AI Foundry: espongono lo stesso formato di
  // richiesta dell'API Anthropic nativa, quindi basta puntare l'SDK Anthropic
  // a questo endpoint con questa chiave invece che ad api.anthropic.com.
  // Endpoint/nome deployment esatti vanno verificati nel portale Azure AI
  // Foundry della propria risorsa (variano per regione/risorsa).
  azureAiFoundry: {
    endpoint: optional("AZURE_AI_FOUNDRY_ENDPOINT"),
    apiKey: optional("AZURE_AI_FOUNDRY_API_KEY"),
    model: optional("AZURE_AI_FOUNDRY_MODEL") ?? "claude-sonnet-5",
  },
  alphaVantageApiKey: optional("ALPHA_VANTAGE_API_KEY"),
  // Usato per trasformare in testo i messaggi vocali Telegram (Whisper API).
  // Se si valorizza anche OPENAI_CHAT_MODEL, la stessa chiave serve come
  // provider AI principale via l'API OpenAI diretta (alternativa ad Anthropic
  // e ad Azure AI Foundry).
  openAiApiKey: optional("OPENAI_API_KEY"),
  openAiChatModel: optional("OPENAI_CHAT_MODEL"),
  // Dove reindirizzare il browser dopo il callback OAuth di Google (l'utente
  // torna sulla dashboard web, non sul backend).
  frontendUrl: optional("FRONTEND_URL") ?? "http://localhost:8080",
  // App Meta (Facebook Login) — copre sia Pagine Facebook che account Instagram
  // Business collegati alla stessa app. Crea l'app su https://developers.facebook.com/apps.
  meta: {
    appId: optional("META_APP_ID"),
    appSecret: optional("META_APP_SECRET"),
    redirectUri: optional("META_REDIRECT_URI"),
  },
  // URL pubblico e raggiungibile da internet sotto cui e' servita /uploads:
  // obbligatorio per pubblicare immagini su Instagram (i suoi server la
  // scaricano da questo URL) o foto su Facebook; senza, restano possibili solo
  // i post di solo testo su Facebook. Vuoto di default (es. su localhost).
  publicBaseUrl: optional("PUBLIC_BASE_URL"),
};
