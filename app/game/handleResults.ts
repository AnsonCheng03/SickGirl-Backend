import { AssistantStream } from "openai/lib/AssistantStream";
import { AssistantStreamEvent } from "openai/resources/beta/assistants";
import { openai } from "@/app/openai";

type MessageProps = {
  role: "user" | "assistant" | "code";
  text: string;
};

const appendToLastMessage = (text, messageList) => {
  messageList[messageList.length - 1].text += text;
  console.log("appendToLastMessage", messageList[messageList.length - 1]);
};

const appendMessage = (role, text, messageList) => {
  console.log("appendMessage", role, text);
  messageList.push({ role, text });
};

const annotateLastMessage = (annotations, messageList) => {
  const lastMessage = messageList[messageList.length - 1];
  annotations.forEach((annotation) => {
    if (annotation.type === "file_path") {
      lastMessage.text = lastMessage.text.replaceAll(
        annotation.text,
        `/api/files/${annotation.file_path.file_id}`
      );
    }
  });
  console.log("annotateLastMessage", lastMessage);
  messageList[messageList.length - 1] = lastMessage;
};

// handleRequiresAction - handle function call
const handleRequiresAction = async (
  event: AssistantStreamEvent.ThreadRunRequiresAction,
  threadId: string,
  messageList: MessageProps[],
  functionCallHandler = () => Promise.resolve("")
) => {
  const runId = event.data.id;
  const toolCalls = event.data.required_action.submit_tool_outputs.tool_calls;
  // loop over tool calls and call function handler
  const toolCallOutputs = await Promise.all(
    toolCalls.map(async (toolCall) => {
      //   const result = await functionCallHandler(toolCall);
      const result = await functionCallHandler();
      return { output: result, tool_call_id: toolCall.id };
    })
  );
  submitActionResult(runId, toolCallOutputs, threadId, messageList);
};

const submitActionResult = async (
  runId,
  toolCallOutputs,
  threadId,
  messageList
) => {
  const stream = openai.beta.threads.runs.submitToolOutputsStream(
    threadId,
    runId,
    { tool_outputs: toolCallOutputs }
  );
  handleReadableStream(stream, threadId, messageList);
};

// handleRunCompleted - re-enable the input form
const handleRunCompleted = () => {};

export const handleReadableStream = (
  stream: AssistantStream,
  threadId,
  messageList
) => {
  // messages
  return new Promise((resolve, reject) => {
    stream.on("textCreated", () => {
      appendMessage("assistant", "", messageList);
    });
    stream.on("textDelta", (delta) => {
      if (delta.value != null) {
        appendToLastMessage(delta.value, messageList);
      }
      if (delta.annotations != null) {
        annotateLastMessage(delta.annotations, messageList);
      }
    });

    // image
    stream.on("imageFileDone", (image) => {
      appendToLastMessage(
        `\n![${image.file_id}](/api/files/${image.file_id})\n`,
        messageList
      );
    });

    // code interpreter
    stream.on("toolCallCreated", (toolCall) => {
      if (toolCall.type != "code_interpreter") return;
      appendMessage("code", "", messageList);
    });
    stream.on("toolCallDelta", (delta, snapshot) => {
      if (delta.type != "code_interpreter") return;
      if (!delta.code_interpreter.input) return;
      appendToLastMessage(delta.code_interpreter.input, messageList);
    });

    // events without helpers yet (e.g. requires_action and run.done)
    stream.on("event", (event) => {
      if (event.event === "thread.run.requires_action")
        handleRequiresAction(event, threadId, messageList);
      if (event.event === "thread.run.completed") handleRunCompleted();
    });

    stream.on("error", (error) => {
      reject(error);
    });

    stream.on("end", () => {
      resolve(0);
    });
  });
};
