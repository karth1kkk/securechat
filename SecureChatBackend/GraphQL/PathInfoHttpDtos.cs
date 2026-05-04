using SecureChatBackend.Configuration;

namespace SecureChatBackend.GraphQL;

/// <summary>JSON shape for <c>GET /path-info</c> (camelCase via ASP.NET defaults).</summary>
public sealed class PathInfoHttpDto
{
    public string? ApiRegion { get; init; }
    public string? ApiAvailabilityZone { get; init; }
    public string? ApiInstanceId { get; init; }
    public string? Environment { get; init; }
    public string? DeploymentId { get; init; }
    public string? Version { get; init; }
    public List<PathInfoNodeHttpDto> Nodes { get; init; } = new();
}

public sealed class PathInfoNodeHttpDto
{
    public string Role { get; init; } = "";
    public string Label { get; init; } = "";
    public string? CountryCode { get; init; }
    public string? Region { get; init; }

    public PathInfoNodeHttpDto(string role, string label, string? countryCode, string? region)
    {
        Role = role;
        Label = label;
        CountryCode = countryCode;
        Region = region;
    }
}

public static class NetworkPathRoleWireNames
{
    public static string ToWireName(NetworkPathRole r) =>
        r switch
        {
            NetworkPathRole.You => "YOU",
            NetworkPathRole.EntryNode => "ENTRY_NODE",
            NetworkPathRole.ServiceNode => "SERVICE_NODE",
            NetworkPathRole.Relay => "RELAY",
            NetworkPathRole.Destination => "DESTINATION",
            _ => r.ToString().ToUpperInvariant()
        };
}
