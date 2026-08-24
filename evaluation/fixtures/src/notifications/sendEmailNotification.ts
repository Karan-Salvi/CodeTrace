export async function sendEmailNotification(
  to: string,
  subject: string,
  mailer: { send: (to: string, subject: string, body: string) => Promise<void> }
) {
  await mailer.send(to, subject, "");
  return { channel: "email" };
}
