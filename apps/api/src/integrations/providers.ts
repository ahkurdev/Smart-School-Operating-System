/**
 * Integration Hub: provider abstractions for external services.
 * No real credentials live here. Each provider reads its key from env at call
 * time and throws a clear SETUP_REQUIRED error when missing, so the rest of
 * the product keeps working without keys (see MISSING API KEY POLICY).
 */

export class ProviderNotConfiguredError extends Error {
  constructor(public readonly provider: string, public readonly envVar: string) {
    super(`${provider} belum dikonfigurasi (butuh ${envVar})`)
    this.name = 'ProviderNotConfiguredError'
  }
}

export interface AiProvider {
  readonly name: string
  isConfigured(): boolean
  complete(prompt: string): Promise<string>
}

export interface WhatsappProvider {
  readonly name: string
  isConfigured(): boolean
  sendText(to: string, message: string): Promise<{ messageId: string }>
}

export interface PaymentProvider {
  readonly name: string
  isConfigured(): boolean
  createInvoice(ref: string, amountIdr: number): Promise<{ url: string }>
}

export interface EmailProvider {
  readonly name: string
  isConfigured(): boolean
  send(to: string, subject: string, html: string): Promise<void>
}

function need(provider: string, envVar: string): string {
  const v = (process.env[envVar] ?? '').trim()
  if (!v) throw new ProviderNotConfiguredError(provider, envVar)
  return v
}

export class NoopAiProvider implements AiProvider {
  readonly name = 'noop-ai'
  isConfigured(): boolean {
    return !!(process.env.AI_API_KEY ?? '').trim()
  }
  async complete(_prompt: string): Promise<string> {
    need('AI', 'AI_API_KEY')
    throw new Error('unreachable')
  }
}

export class NoopWhatsappProvider implements WhatsappProvider {
  readonly name = 'noop-whatsapp'
  isConfigured(): boolean {
    return !!(process.env.WHATSAPP_API_KEY ?? '').trim()
  }
  async sendText(_to: string, _message: string): Promise<{ messageId: string }> {
    need('WhatsApp', 'WHATSAPP_API_KEY')
    throw new Error('unreachable')
  }
}

export class NoopPaymentProvider implements PaymentProvider {
  readonly name = 'noop-payment'
  isConfigured(): boolean {
    return !!(process.env.PAYMENT_API_KEY ?? '').trim()
  }
  async createInvoice(_ref: string, _amountIdr: number): Promise<{ url: string }> {
    need('Payment', 'PAYMENT_API_KEY')
    throw new Error('unreachable')
  }
}

export class NoopEmailProvider implements EmailProvider {
  readonly name = 'noop-email'
  isConfigured(): boolean {
    return !!(process.env.SMTP_HOST ?? '').trim()
  }
  async send(_to: string, _subject: string, _html: string): Promise<void> {
    need('Email', 'SMTP_HOST')
  }
}

export const integrations = {
  ai: new NoopAiProvider(),
  whatsapp: new NoopWhatsappProvider(),
  payment: new NoopPaymentProvider(),
  email: new NoopEmailProvider(),
}

export interface IntegrationStatus {
  provider: string
  configured: boolean
  envVar: string
}

export function statusList(): IntegrationStatus[] {
  return [
    { provider: 'AI Copilot', configured: integrations.ai.isConfigured(), envVar: 'AI_API_KEY' },
    { provider: 'WhatsApp', configured: integrations.whatsapp.isConfigured(), envVar: 'WHATSAPP_API_KEY' },
    { provider: 'Payment Gateway', configured: integrations.payment.isConfigured(), envVar: 'PAYMENT_API_KEY' },
    { provider: 'Email (SMTP)', configured: integrations.email.isConfigured(), envVar: 'SMTP_HOST' },
    { provider: 'Maps', configured: !!(process.env.MAP_API_KEY ?? '').trim(), envVar: 'MAP_API_KEY' },
  ]
}
