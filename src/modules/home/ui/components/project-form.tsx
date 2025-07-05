"use client";

import { Button } from "@/components/ui/button";
import { Form, FormField } from "@/components/ui/form";
import { PROJECT_TEMPLATES } from "@/constants";
import { useCurrentTheme } from "@/hooks/use-current-theme";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { useClerk } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUpIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import TextareaAutosize from "react-textarea-autosize";
import { toast } from "sonner";
import { z } from "zod";

const formSchema = z.object({
  value: z
    .string()
    .min(1, "Prompt is required")
    .max(10000, "Prompt is too long"),
});

type FormValues = z.infer<typeof formSchema>;

export const ProjectForm = () => {
  const [isFocused, setIsFocused] = useState(false);

  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const clerk = useClerk();
  const theme = useCurrentTheme();

  const createProject = useMutation(
    trpc.projects.create.mutationOptions({
      onSuccess: ({ id }) => {
        queryClient.invalidateQueries(trpc.projects.getMany.queryOptions());

        queryClient.invalidateQueries(trpc.usage.status.queryOptions());

        router.push(`/projects/${id}`);
      },
      onError: (error) => {
        if (error.data?.code === "UNAUTHORIZED") {
          clerk.openSignIn({
            appearance: {
              baseTheme: theme === "dark" ? dark : undefined,
            },
          });
        }

        if (error.data?.code === "TOO_MANY_REQUESTS") {
          router.push("/pricing");
        }
        toast.error(error.message);
      },
    })
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      value: "",
    },
  });

  const isPending = createProject.isPending;
  const isDisabled = isPending || !form.formState.isValid;

  const onSubmit = async (values: FormValues) => {
    await createProject.mutateAsync({
      value: values.value,
    });
  };

  const onSelect = (content: string) => {
    form.setValue("value", content, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });
  };

  return (
    <Form {...form}>
      <section className="space-y-6">
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className={cn(
            "relative border p-4 pt-1 rounded-xl bg-sidebar dark:bg-sidebar transition-all",
            isFocused && "shadow-xs"
          )}
        >
          <FormField
            control={form.control}
            name="value"
            render={({ field }) => (
              <TextareaAutosize
                {...field}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                minRows={2}
                maxRows={8}
                disabled={isPending}
                className="pt-4 resize-none border-none w-full outline-none bg-transparent"
                placeholder="What would you like to build?"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    form.handleSubmit(onSubmit)(e);
                  }
                }}
              />
            )}
          />
          <div className="flex gap-x-2 items-end justify-between pt-2">
            <div className="text-[10px] text-muted-foreground font-mono">
              <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                <span>⌘ + Enter</span>
              </kbd>
              &nbsp;to submit
            </div>
            <Button
              className={cn(
                "size-8 rounded-full",
                isDisabled && "bg-muted-foreground border"
              )}
              disabled={isDisabled}
            >
              {isPending ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <ArrowUpIcon />
              )}
            </Button>
          </div>
        </form>
        <div className="flex-wrap justify-center gap-1 hidden md:flex max-w-3xl">
          {PROJECT_TEMPLATES.map((template) => (
            <Button
              key={template.title}
              variant={"outline"}
              size={"sm"}
              className="bg-white dark:bg-sidebar"
              onClick={() => onSelect(template.prompt)}
            >
              {template.emoji} {template.title}
            </Button>
          ))}
        </div>
      </section>
    </Form>
  );
};
