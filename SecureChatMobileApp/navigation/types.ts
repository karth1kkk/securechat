export type RootStackParamList = {
  ChatList: undefined;
  Chat: { conversationId: string };
  Call: { conversationId: string; media: 'audio' | 'video'; callRole?: 'caller' | 'callee' };
  NewChat: { prefilledSessionId?: string } | undefined;
  Settings: undefined;
  SecurityCenter: undefined;
  Profile: undefined;
  Path: undefined;
  SecureChatNetwork: undefined;
  Appearance: undefined;
  ConversationsSettings: undefined;
  Donate: undefined;
  MessageRequests: undefined;
  RecoveryPassword: undefined;
  Help: undefined;
  ClearData: undefined;
  Notifications: undefined;
};
