export type TelegramUpdate = {
  update_id: number | string;
  message?: TelegramMessage;
  channel_post?: TelegramMessage;
};

export type TelegramMessage = {
    message_id: number | string;
    date?: number;
    text?: string;
    caption?: string;
    photo?: Array<{
      file_id: string;
      file_unique_id?: string;
      width?: number;
      height?: number;
      file_size?: number;
    }>;
    document?: {
      file_id: string;
      file_unique_id?: string;
      file_name?: string;
      mime_type?: string;
      file_size?: number;
    };
    chat: {
      id: number | string;
      type: string;
      title?: string;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
    from?: {
      id: number | string;
      is_bot?: boolean;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
};
