import { assistantId } from "@/app/assistant-config";
import { openai } from "@/app/openai";
import { AssistantStream } from "openai/lib/AssistantStream";
import { handleReadableStream } from "./handleResults";

export const runtime = "nodejs";

export const sendMessage = async (content, threadId, messageList) => {
  await openai.beta.threads.messages.create(threadId, {
    role: "user",
    content: content,
  });
  const stream = openai.beta.threads.runs.stream(threadId, {
    assistant_id: assistantId,
  });
  await handleReadableStream(stream, threadId, messageList);
};

export const createThread = async () => {
  const thread = await openai.beta.threads.create();
  return thread.id;
};
