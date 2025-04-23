import nodemailer from 'nodemailer'
import type { DepgraphAlert, AlertConfig } from './types'

export async function deliverEmail(
  alert: DepgraphAlert,
  config: AlertConfig['email']
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!config) return { success: false, error: 'No email config' }

  try {
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
    })

    const packageInfo = alert.packageName
      ? `<p><strong>Package:</strong> ${alert.ecosystem}/${alert.packageName}</p>`
      : ''

    const html = [
      `<h2>${alert.title}</h2>`,
      `<p><strong>Severity:</strong> ${alert.severity}</p>`,
      `<p><strong>Type:</strong> ${alert.type}</p>`,
      `<p>${alert.message}</p>`,
      packageInfo,
      `<hr><small>Alert ID: ${alert.id} · Generated at ${alert.createdAt}</small>`,
    ].join('')

    const textPkg = alert.packageName
      ? `\n\nPackage: ${alert.ecosystem}/${alert.packageName}`
      : ''
    const text = `${alert.title}\n\nSeverity: ${alert.severity}\nType: ${alert.type}\n\n${alert.message}${textPkg}\n\nAlert ID: ${alert.id}\nGenerated at: ${alert.createdAt}`

    const info = await transporter.sendMail({
      from: config.from,
      to: config.to.join(', '),
      subject: `[depgraph] ${alert.severity.toUpperCase()}: ${alert.title}`,
      text,
      html,
    })

    return { success: true, messageId: info.messageId as string | undefined }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}
