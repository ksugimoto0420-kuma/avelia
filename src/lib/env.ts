// 環境変数の集約。未設定時のデフォルトもここで吸収する。

export const env = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  paymentProvider: (process.env.PAYMENT_PROVIDER ?? "stripe") as
    | "stripe"
    | "payjp",
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
    currency: process.env.STRIPE_CURRENCY ?? "jpy",
  },
  storage: {
    driver: process.env.STORAGE_DRIVER ?? "local",
  },
  mail: {
    driver: process.env.MAIL_DRIVER ?? "console",
    from: process.env.MAIL_FROM ?? "Avelia FunClub <no-reply@example.com>",
    resendApiKey: process.env.RESEND_API_KEY ?? "",
  },
  reservationTtlMinutes: Number(process.env.RESERVATION_TTL_MINUTES ?? "15"),
  cronSecret: process.env.CRON_SECRET ?? "",
};
