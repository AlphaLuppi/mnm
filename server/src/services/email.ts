import { logger } from "../middleware/logger.js";

export interface EmailService {
  sendInviteEmail(params: {
    to: string;
    inviteUrl: string;
    companyName: string;
    inviterName: string | null;
    expiresAt: Date;
  }): Promise<{ success: boolean; messageId?: string }>;
}

class ConsoleEmailService implements EmailService {
  async sendInviteEmail(params: {
    to: string;
    inviteUrl: string;
    companyName: string;
    inviterName: string | null;
    expiresAt: Date;
  }): Promise<{ success: boolean; messageId?: string }> {
    logger.info(
      {
        to: params.to,
        inviteUrl: params.inviteUrl,
        companyName: params.companyName,
        inviterName: params.inviterName,
        expiresAt: params.expiresAt,
      },
      "[DEV EMAIL] Invite email would be sent",
    );
    return { success: true, messageId: `console-${Date.now()}` };
  }
}

export function createEmailService(): EmailService {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MNM_EMAIL_FROM ?? "MnM <noreply@mnm.dev>";

  if (apiKey) {
    // Dynamic import to avoid requiring resend as a dependency when not used
    return {
      async sendInviteEmail(params) {
        // Dynamic import — resend is an optional peer dependency
        const moduleName = "resend";
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const mod: any = await import(moduleName);
        const ResendCtor = mod.Resend ?? mod.default?.Resend;
        const resend = new ResendCtor(apiKey);
        const result = await resend.emails.send({
          from,
          to: params.to,
          subject: `Invitation to join ${params.companyName} on MnM`,
          html: `<p>You have been invited to join <strong>${params.companyName}</strong> on MnM.</p>
<p><a href="${params.inviteUrl}">Accept invitation</a></p>
<p>This link expires on ${params.expiresAt.toLocaleDateString()}.</p>
${params.inviterName ? `<p>Invited by: ${params.inviterName}</p>` : ""}`,
        });
        return { success: true, messageId: result?.data?.id };
      },
    };
  }

  return new ConsoleEmailService();
}
