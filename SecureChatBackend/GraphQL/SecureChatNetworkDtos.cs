using SecureChatBackend.Configuration;

namespace SecureChatBackend.GraphQL;

public sealed class SecureChatNetworkInfoDto
{
    public string? ApiRegion { get; init; }

    /// <summary>Placement AZ for the process serving this API (ECS task or EC2 host), when discoverable.</summary>
    public string? ApiAvailabilityZone { get; init; }

    /// <summary>EC2 instance id when this API runs on EC2 and id is known (env or IMDS).</summary>
    public string? ApiInstanceId { get; init; }

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
