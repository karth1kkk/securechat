using System;

namespace SecureChatBackend.GraphQL.Inputs;

public sealed class CreateConversationRequestInput
{
    // The user we want to request a chat from (their internal userId/UUID).
    public Guid TargetUserId { get; set; }
}

