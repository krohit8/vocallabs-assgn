export interface AppConfig {
  limits: {
    maxCompanies: number;
    maxContactsPerCompany: number;
    maxProspeoPages: number;
    maxRealEmails: number;
  };
  http: {
    timeoutMs: number;
    maxRetries: number;
  };
  emailContent: {
    signatureName: string;
    companyName: string;
    offer: string;
    postalAddress: string;
  };
  suppressionList: Set<string>;
  liveCredentials: {
    oceanApiToken: string;
    prospeoApiKey: string;
    eazyreachClientId: string;
    eazyreachClientSecret: string;
  } | null;
  brevo: {
    apiKey: string;
    senderEmail: string;
    senderName: string;
  } | null;
  allowRealSend: boolean;
  confirmedOptIn: boolean;
}
