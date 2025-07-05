import { Fragment, MessageRole, MessageType } from "@/generated/prisma";
import { AssistantMessage } from "./assistant-message";
import { UserMessage } from "./user-message";

interface IMessageCardProps {
  content: string;
  role: MessageRole;
  type: MessageType;
  fragment: Fragment | null;
  createdAt: Date;
  isActiveFragment: boolean;
  onFragmentClick: (fragment: Fragment) => void;
}

export const MessageCard = ({ role, ...props }: IMessageCardProps) => {
  if (role === MessageRole.ASSISTANT) {
    return <AssistantMessage {...props} />;
  }

  return <UserMessage content={props.content} />;
};
