import { MessageRole, MessageType } from "@/generated/prisma";
import { inngest } from "@/inngest/client";
import { db } from "@/lib/db";
import { consumeCredits } from "@/lib/usage";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { GoogleGenAI } from "@google/genai";
import { TRPCError } from "@trpc/server";
import { generateSlug } from "random-word-slugs";
import { z } from "zod";
import { PROJECT_NAME_SYSTEM_INSTRUCTION } from "./prompt";

export const projectsRouter = createTRPCRouter({
  getMany: protectedProcedure.query(async ({ ctx }) => {
    const projects = await db.project.findMany({
      orderBy: {
        createdAt: "asc",
      },
      where: {
        userId: ctx.auth.userId,
      },
    });

    return projects;
  }),
  getOne: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1, "Project ID is required"),
      })
    )
    .query(async ({ input, ctx }) => {
      const project = await db.project.findUnique({
        where: {
          id: input.id,
          userId: ctx.auth.userId,
        },
      });

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      return project;
    }),
  create: protectedProcedure
    .input(
      z.object({
        value: z
          .string()
          .min(1, "Prompt is required")
          .max(10000, { message: "Prompt is too long" }),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      let projectName: string;

      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          config: {
            systemInstruction: PROJECT_NAME_SYSTEM_INSTRUCTION,
          },
          contents: `Project Description: "${input.value}"`,
        });

        if (response.text) {
          projectName = response.text.trim();
        } else {
          throw new Error("Failed to generate project name");
        }
      } catch {
        projectName = generateSlug(2, {
          format: "kebab",
        });
      }

      try {
        await consumeCredits();
      } catch (error) {
        if (error instanceof Error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Something went wrong",
          });
        }
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message:
            "You have exceeded your usage limit. Please upgrade your plan.",
        });
      }

      const createdProject = await db.project.create({
        data: {
          name: projectName,
          userId: ctx.auth.userId,
          messages: {
            create: {
              content: input.value,
              role: MessageRole.USER,
              type: MessageType.RESULT,
            },
          },
        },
      });

      await inngest.send({
        name: "code-agent/run",
        data: {
          value: input.value,
          projectId: createdProject.id,
        },
      });

      return createdProject;
    }),
});
