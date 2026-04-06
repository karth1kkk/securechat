namespace SecureChatBackend.Configuration;

public sealed class SecureChatNetworkOptions
{
    public const string SectionName = "SecureChatNetwork";

    /// <summary>Optional override; otherwise AWS_REGION or hosting default is used at runtime.</summary>
    public string? ApiRegion { get; set; }

    /// <summary>Optional label for the running deployment (e.g. ECS service name).</summary>
    public string? DeploymentId { get; set; }

    public List<NetworkPathNodeConfig> Nodes { get; set; } = new();
}

public sealed class NetworkPathNodeConfig
{
    public NetworkPathRole Role { get; set; }
    public string Label { get; set; } = "";
    public string? CountryCode { get; set; }
    public string? Region { get; set; }
}

public enum NetworkPathRole
{
    You,
    EntryNode,
    ServiceNode,
    Relay,
    Destination
}
