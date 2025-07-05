import type { TreeItem } from "@/types";
import { Message } from "@inngest/agent-kit";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function convertFilesToTreeItems(
  files: Record<string, string>
): TreeItem[] {
  interface TreeNode {
    [key: string]: TreeNode | null;
  }


  const tree: TreeNode = {};


  const sortedPaths = Object.keys(files).sort();

  for (const filePath of sortedPaths) {
    const parts = filePath.split("/");
    let current = tree;


    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part];
    }


    const fileName = parts[parts.length - 1];
    current[fileName] = null; 
  }


  function convertNode(node: TreeNode, name?: string): TreeItem[] | TreeItem {
    const entries = Object.entries(node);

    if (entries.length === 0) {
      return name || "";
    }

    const children: TreeItem[] = [];

    for (const [key, value] of entries) {
      if (value === null) {
 
        children.push(key);
      } else {
        const subTree = convertNode(value, key);
        if (Array.isArray(subTree)) {
          children.push([key, ...subTree]);
        } else {
          children.push([key, subTree]);
        }
      }
    }

    return children;
  }

  const result = convertNode(tree);
  return Array.isArray(result) ? result : [result];
}


export const parseAgentOutput = (value: Message[], msg: string) => {
  const output = value[0];
  if (output.type !== "text") {
    return msg;
  }

  if (Array.isArray(output.content)) {
    return output.content.join(" ");
  }
  return output.content;
};