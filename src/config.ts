export interface AppConfig {
  brevo: {
    apiKey: string;
    senderEmail: string;
    senderName: string;
  } | null;
}
