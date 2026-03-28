using System;

namespace SecureChatBackend.GraphQL.Inputs;

public sealed class DeleteConversationInput
{
    public Guid ConversationId { get; set; }
}
