using System;

namespace SecureChatBackend.GraphQL.Inputs;

public sealed class CreateConversationRequestWithSessionIdInput
{
    public string SessionId { get; set; } = string.Empty;
}
