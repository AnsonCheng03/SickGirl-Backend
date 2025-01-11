import { headers } from "next/headers";
import { createThread, sendMessage } from "./handleMessages";

export async function GET(req, res) {
  const headersList = await headers();
  const referer = headersList.get("referer");
  const response = "Health check passed!";

  return new Response(response, {
    status: 200,
    headers: { referer: referer },
  });
}

export async function POST(req, res) {
  // get body from request
  const request = await req.json();
  const userInput = request.userInput;
  const threadId = request.threadId || (await createThread());

  const messageList = [];

  messageList.push({ role: "user", text: userInput });
  await sendMessage(userInput, threadId, messageList);
  return new Response(JSON.stringify({ messageList }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
