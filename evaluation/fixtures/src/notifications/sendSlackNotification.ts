export async function sendSlackNotification(
  channel: string,
  text: string,
  slack: { postMessage: (channel: string, text: string) => Promise<void> }
) {
  await slack.postMessage(channel, text);
  return { channel: "slack" };
}
