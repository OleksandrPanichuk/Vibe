"use client";

import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";

export const ProjectsList = () => {
  const trpc = useTRPC();
  const { data: projects, refetch } = useQuery(
    trpc.projects.getMany.queryOptions()
  );
  const { user } = useUser();

  useEffect(() => {
    if (user) {
      refetch();
    }
  }, [user, refetch]);

  if (!projects?.length || !user) {
    return null;
  }

  return (
    <div className="w-full bg-white dark:bg-sidebar rounded-xl p-8 border flex flex-col gap-y-6 sm:gap-y-4">
      <h2 className="text-2xl font-semibold">Your Vibes</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {projects?.length == 0 ? (
          <div className="col-span-full text-center">
            <p className="text-sm text-muted-foreground">No projects found</p>
          </div>
        ) : (
          projects?.map((project) => (
            <Button
              key={project.id}
              variant={"outline"}
              className="font-normal justify-start w-full text-start p-4 h-auto"
              asChild
            >
              <Link href={`/projects/${project.id}`}>
                <div className="flex items-center gap-x-4">
                  <Image
                    src={"/logo.svg"}
                    alt="Vibe"
                    width={32}
                    height={32}
                    className="object-contain"
                  />
                  <div className="flex flex-col">
                    <h3 className="truncate font-medium">{project.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {formatDistanceToNow(project.updatedAt, {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>
              </Link>
            </Button>
          ))
        )}
      </div>
    </div>
  );
};
