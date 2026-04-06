using SecureChatBackend.Configuration;

namespace SecureChatBackend.GraphQL;

public sealed class SecureChatNetworkInfoDto
{
    public string? ApiRegion { get; init; }
    public string? Environment { get; init; }
    public string? DeploymentId { get; init; }
    public string? Version { get; init; }
    public IReadOnlyList<NetworkPathNodeDto> Nodes { get; init; } = Array.Empty<NetworkPathNodeDto>();
}

public sealed class NetworkPathNodeDto
{
    public NetworkPathRole Role { get; init; }
    public string Label { get; init; } = "";
    public string? CountryCode { get; init; }
    public string? Region { get; init; }
}
