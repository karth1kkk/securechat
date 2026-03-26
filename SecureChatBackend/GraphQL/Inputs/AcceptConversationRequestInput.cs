using System;

namespace SecureChatBackend.GraphQL.Inputs;

public sealed class AcceptConversationRequestInput
{
    public Guid ConversationId { get; set; }
}

