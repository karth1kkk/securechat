namespace SecureChatBackend.GraphQL.Inputs;

public sealed class RegisterUserInput
{
    public string PublicKey { get; set; } = null!;
    public string DeviceName { get; set; } = "unknown";
}
