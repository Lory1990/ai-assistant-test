import "dotenv/config";

function optional(name: string): string | undefined {
  return process.env[name];
}

export const env = {
  redisUrl: optional("REDIS_URL") ?? "redis://localhost:6379",
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
};
