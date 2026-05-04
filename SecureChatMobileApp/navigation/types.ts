export type RootStackParamList = {
  ChatList: undefined;
  Chat: { conversationId: string };
  Call: {
    conversationId: string;
    media: 'audio' | 'video';
    callRole?: 'caller' | 'callee';
    /** Other party display name when known (e.g. from chat). Call screen still resolves from API if omitted. */
    peerDisplayName?: string | null;
    /** Optional local URI for peer avatar (future / shared profile). */
    peerAvatarUri?: string | null;
  };
  NewChat: { prefilledSessionId?: string } | undefined;
  Settings: undefined;
  SecurityCenter: undefined;
  Profile: undefined;
  Path: undefined;
  SecureChatNetwork: undefined;
  Appearance: undefined;
  ConversationsSettings: undefined;
  MessageRequests: undefined;
  RecoveryPassword: undefined;
  Help: undefined;
  ClearData: undefined;
  Notifications: undefined;
  Games: undefined;
  TicTacToe: undefined;
};
