export class SmsService {
  static async sendSMS(to: string, body: string): Promise<boolean> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      console.log(`\n========================================`);
      console.log(`[SMS DEV MODE]`);
      console.log(`Para: ${to}`);
      console.log(`Mensagem: ${body}`);
      console.log(`========================================\n`);
      return true;
    }

    try {
      const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${auth}`
          },
          body: new URLSearchParams({
            To: to,
            From: fromNumber,
            Body: body
          })
        }
      );

      const data = await response.json() as any;
      if (response.ok) {
        console.log(`[Twilio] SMS enviado com sucesso para ${to}. SID: ${data.sid}`);
        return true;
      } else {
        console.error(`[Twilio] Falha ao enviar SMS para ${to}:`, data.message);
        return false;
      }
    } catch (e) {
      console.error(`[Twilio] Erro ao enviar SMS:`, e);
      return false;
    }
  }

  static async sendVerificationCode(to: string, code: string): Promise<boolean> {
    const body = `Seu codigo de verificacao AgroSemen e: ${code}. Valido por 5 minutos.`;
    
    // Formata o número para o padrão E.164 esperado pelo Twilio
    let formattedTo = to.replace(/[^\d+]/g, '');
    if (!formattedTo.startsWith('+')) {
      // Se não tem +, assume que é um número do Brasil (+55)
      formattedTo = '+55' + formattedTo.replace(/\D/g, '');
    }

    return this.sendSMS(formattedTo, body);
  }
}
