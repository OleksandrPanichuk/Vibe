import { MessageRole, MessageType } from "@/generated/prisma";
import { db } from "@/lib/db";
import { parseAgentOutput } from "@/lib/utils";
import { Sandbox } from "@e2b/code-interpreter";
import {
  createAgent,
  createNetwork,
  createState,
  createTool,
  gemini,
  Message,
  Tool,
} from "@inngest/agent-kit";
import { z } from "zod";
import { inngest } from "./client";
import { FRAGMENT_TITLE_PROMPT, PROMPT, RESPONSE_PROMPT } from "./prompt";
import { getSandbox, lastAssistantTextMessageContent } from "./utils";

interface AgentState {
  summary: string;
  files: {
    [path: string]: string;
  };
}

export const agent = inngest.createFunction(
  { id: "code-agent" },
  { event: "code-agent/run" },
  async ({ event, step }) => {
    const sandboxId = await step.run("get-sandbox-id", async () => {
      const sandbox = await Sandbox.create("vibe-nextjs-test-by-olksnd-2");
      await sandbox.setTimeout(60_000 * 30);
      return sandbox.sandboxId;
    });

    const previousMessages = await step.run(
      "get-previous-messages",
      async () => {
        const formattedMessages: Message[] = [];
        const messages = await db.message.findMany({
          where: {
            projectId: event.data.projectId,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 5
        });

        for (const message of messages) {
          formattedMessages.push({
            type: "text",
            role: message.role === MessageRole.ASSISTANT ? "assistant" : "user",
            content: message.content,
          });
        }

        return formattedMessages.reverse();
      }
    );

    const state = createState<AgentState>(
      {
        summary: "",
        files: {},
      },
      {
        messages: previousMessages,
      }
    );

    const codeAgent = createAgent<AgentState>({
      name: "code-agent",
      description: "An expert coding agent.",
      system: PROMPT,
      model: gemini({
        model: "gemini-2.0-flash",
        defaultParameters: {
          generationConfig: {
            temperature: 0.05,
            topP: 0.9,
            topK: 1,
          },
        },
      }),
      tools: [
        createTool({
          name: "terminal",
          description:
            "Execute shell commands in the sandbox environment to run build processes, install packages, start servers, and perform other command-line operations",
          parameters: z.object({
            command: z
              .string()
              .describe(
                "The shell command to execute in the sandbox terminal. This can include any valid bash command like 'npm install', 'ls', 'cd', etc."
              ),
          }),
          handler: async ({ command }, { step }) => {
            return await step?.run("terminal", async () => {
              const buffers = {
                stdout: "",
                stderr: "",
              };

              try {
                const sandbox = await getSandbox(sandboxId);
                const result = await sandbox.commands.run(command, {
                  onStdout: (data) => {
                    buffers.stdout += data;
                  },
                  onStderr: (data) => {
                    buffers.stderr += data;
                  },
                });
                return result.stdout;
              } catch (error) {
                const errorMessage = `Command failed: ${error} \nstdout: ${buffers.stdout} \nstderr: ${buffers.stderr}`;

                console.error(errorMessage);

                return errorMessage;
              }
            });
          },
        }),
        createTool({
          name: "writeFiles",
          description:
            "Create new files or update existing files in the sandbox filesystem. This tool allows you to write code files, configuration files, or any other text content to specific file paths in the project",
          parameters: z.object({
            files: z
              .array(
                z.object({
                  path: z
                    .string()
                    .describe(
                      "The file path relative to the project root where the file should be created or updated. Examples: 'src/components/Button.tsx', 'package.json', 'README.md'"
                    ),
                  content: z
                    .string()
                    .describe(
                      "The complete text content to write to the file. This will replace the entire file content if the file already exists"
                    ),
                })
              )
              .describe(
                "An array of file objects, each containing a path and content to write to the filesystem"
              ),
          }),
          handler: async (
            { files },
            { step, network }: Tool.Options<AgentState>
          ) => {
            const newFiles = await step?.run(
              "create-or-update-files",
              async () => {
                try {
                  const updatedFiles = network.state.data.files || {};
                  const sandbox = await getSandbox(sandboxId);

                  for (const file of files) {
                    await sandbox.files.write(file.path, file.content);
                    updatedFiles[file.path] = file.content;
                  }

                  return updatedFiles;
                } catch (error) {
                  return "Error: " + error;
                }
              }
            );

            if (typeof newFiles === "object") {
              network.state.data.files = newFiles;
            }
          },
        }),
        createTool({
          name: "readFiles",
          description:
            "Read the contents of existing files from the sandbox filesystem. Use this tool to examine current file contents before making modifications or to understand the project structure",
          parameters: z.object({
            files: z
              .array(
                z
                  .string()
                  .describe(
                    "The file path relative to the project root to read. Examples: 'src/App.tsx', 'package.json', 'tsconfig.json'"
                  )
              )
              .describe("An array of file paths to read from the filesystem"),
          }),
          handler: async ({ files }, { step }) => {
            return await step?.run("read-files", async () => {
              try {
                const sandbox = await getSandbox(sandboxId);
                const contents = [];

                for (const file of files) {
                  const content = await sandbox.files.read(file);
                  contents.push({ path: file, content });
                }
                return JSON.stringify(contents);
              } catch (e) {
                return "Error: " + e;
              }
            });
          },
        }),
      ],
      lifecycle: {
        onResponse: async ({ result, network }) => {
          const lastAssistantMessage = lastAssistantTextMessageContent(result);

          if (lastAssistantMessage && network) {
            {
              if (lastAssistantMessage.includes("<task_summary>")) {
                network.state.data.summary = lastAssistantMessage;
              }
            }
          }

          return result;
        },
      },
    });

    const network = createNetwork<AgentState>({
      name: "coding-agent-network",
      defaultState: state,
      agents: [codeAgent],
      maxIter: 25,
      router: async ({ network }) => {
        const summary = network.state.data.summary;

        if (summary) {
          return;
        }

        return codeAgent;
      },
    });

    const result = await network.run(event.data.value, { state });

    const fragmentTitleGenerator = createAgent({
      name: "fragment-title-generator",
      description: "Generates a title for the code fragment",
      system: FRAGMENT_TITLE_PROMPT,
      model: gemini({
        model: "gemini-2.0-flash",
      }),
    });

    const responseGenerator = createAgent({
      name: "response-generator",
      description: "A response generator",
      system: RESPONSE_PROMPT,
      model: gemini({
        model: "gemini-2.0-flash",
      }),
    });

    const { output: fragmentTitleOutput } = await fragmentTitleGenerator.run(
      result.state.data.summary
    );
    const { output: responseOutput } = await responseGenerator.run(
      result.state.data.summary
    );

    const isError =
      !result.state.data.summary ||
      Object.keys(result.state.data.files || {}).length === 0;

    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      const sandbox = await getSandbox(sandboxId);
      const host = sandbox.getHost(3000);
      return `https://${host}`;
    });

    await step.run("save-result", async () => {
      if (isError) {
        return await db.message.create({
          data: {
            content: "Something went wrong. Please try again.",
            projectId: event.data.projectId,
            role: MessageRole.ASSISTANT,
            type: MessageType.ERROR,
          },
        });
      }

      return await db.message.create({
        data: {
          projectId: event.data.projectId,
          content: parseAgentOutput(responseOutput, "Here you go!"),
          role: MessageRole.ASSISTANT,
          type: MessageType.RESULT,
          fragment: {
            create: {
              sandboxUrl,
              title: parseAgentOutput(fragmentTitleOutput, "Fragment"),
              files: result.state.data.files,
            },
          },
        },
      });
    });

    return {
      url: sandboxUrl,
      title: "Fragment",
      files: result.state.data.files,
      summary: result.state.data.summary,
    };
  }
);
