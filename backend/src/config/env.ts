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
  // Usato solo per trasformare in testo i messaggi vocali Telegram (Whisper API)
  // prima di passarli all'assistente: non e' collegato al provider AI principale.
  openAiApiKey: optional("OPENAI_API_KEY"),
  // Dove reindirizzare il browser dopo il callback OAuth di Google (l'utente
  // torna sulla dashboard web, non sul backend).
  frontendUrl: optional("FRONTEND_URL") ?? "http://localhost:8080",
};
