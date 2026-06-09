export type MessageType = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  text: string;
  type: MessageType;
}

export interface SessionResponse {
  session_id: string;
  message: string;
}

export interface MessageResponse {
  session_id: string;
  output: string[];
  context?: Record<string, unknown>;
}
