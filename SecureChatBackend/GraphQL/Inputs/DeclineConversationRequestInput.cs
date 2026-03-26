using System;

namespace SecureChatBackend.GraphQL.Inputs;

public sealed class DeclineConversationRequestInput
{
    public Guid ConversationId { get; set; }
}

