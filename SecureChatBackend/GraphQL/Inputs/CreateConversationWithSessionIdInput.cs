namespace SecureChatBackend.GraphQL.Inputs;

public sealed class CreateConversationWithSessionIdInput
{
    public string SessionId { get; set; } = null!;
}
