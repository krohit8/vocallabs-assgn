export interface AppConfig {
  emailContent: {
    signatureName: string;
    companyName: string;
    offer: string;
    postalAddress: string;
  };
  brevo: {
    apiKey: string;
    senderEmail: string;
    senderName: string;
  } | null;
}
