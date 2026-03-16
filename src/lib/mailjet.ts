import Mailjet from 'node-mailjet';

const mailjet = new Mailjet({
  apiKey: process.env.MJ_APIKEY_PUBLIC || '',
  apiSecret: process.env.MJ_APIKEY_PRIVATE || ''
});

interface SendEmailParams {
  toEmail: string;
  toName: string;
  subject: string;
  textPart: string;
  htmlPart: string;
}

export async function sendEmail({ toEmail, toName, subject, textPart, htmlPart }: SendEmailParams) {
  if (!process.env.MJ_APIKEY_PUBLIC || !process.env.MJ_APIKEY_PRIVATE) {
    console.warn("Mailjet keys are missing. Email not sent.");
    return { success: false, error: "Configuration Mailjet manquante" };
  }

  try {
    const request = mailjet
      .post("send", { 'version': 'v3.1' })
      .request({
        "Messages": [
          {
            "From": {
              "Email": process.env.ADMIN_EMAIL_FROM || "ruben.combe@gmail.com",
              "Name": process.env.ADMIN_NAME_FROM || "Educalcul Support"
            },
            "To": [
              {
                "Email": toEmail,
                "Name": toName
              }
            ],
            "Subject": subject,
            "TextPart": textPart,
            "HTMLPart": htmlPart,
            "CustomID": "AppGettingStartedTest"
          }
        ]
      });

    const result = await request;
    return { success: true, data: result.body };
  } catch (err: any) {
    console.error("Mailjet error:", err.statusCode, err.message);
    return { success: false, error: err.message };
  }
}
