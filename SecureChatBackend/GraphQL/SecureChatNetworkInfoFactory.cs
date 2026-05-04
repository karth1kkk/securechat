using System.Linq;
using System.Reflection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using SecureChatBackend.Configuration;
using SecureChatBackend.Infrastructure.Hosting;

namespace SecureChatBackend.GraphQL;

/// <summary>Shared builder for GraphQL <c>secureChatNetworkInfo</c> and the public <c>GET /path-info</c> JSON used by the mobile Path screen.</summary>
public static class SecureChatNetworkInfoFactory
{
    public static SecureChatNetworkInfoDto Create(IOptions<SecureChatNetworkOptions> options, IHostEnvironment environment)
    {
        var o = options.Value;
        var apiRegion = AwsRuntimeInfo.ResolveApiRegion(o.ApiRegion);
        var apiAz = AwsRuntimeInfo.ResolveApiAvailabilityZone();
        var apiInstanceId = AwsRuntimeInfo.ResolveApiInstanceId();
        var deploymentId = AwsRuntimeInfo.ResolveDeploymentId(o.DeploymentId);
        var version = Assembly.GetExecutingAssembly().GetName().Version?.ToString();
        var nodes = o.Nodes
            .Select(n => new NetworkPathNodeDto
            {
                Role = n.Role,
                Label = n.Label,
                CountryCode = n.CountryCode,
                Region = EnrichPathNodeRegion(n.Role, n.Region, apiRegion, apiAz, apiInstanceId)
            })
            .ToList();

        return new SecureChatNetworkInfoDto
        {
            ApiRegion = apiRegion,
            ApiAvailabilityZone = apiAz,
            ApiInstanceId = apiInstanceId,
            Environment = environment.EnvironmentName,
            DeploymentId = deploymentId,
            Version = version,
            Nodes = nodes
        };
    }

    internal static string? EnrichPathNodeRegion(
        NetworkPathRole role,
        string? configuredRegion,
        string? apiRegion,
        string? apiAvailabilityZone,
        string? apiInstanceId)
    {
        var trimmed = configuredRegion?.Trim();
        if (!string.IsNullOrEmpty(trimmed))
        {
            return configuredRegion;
        }

        if (role == NetworkPathRole.You)
        {
            return "This device (client)";
        }

        if (role == NetworkPathRole.ServiceNode)
        {
            if (!string.IsNullOrEmpty(apiAvailabilityZone) && !string.IsNullOrEmpty(apiRegion))
            {
                var inst = string.IsNullOrWhiteSpace(apiInstanceId) ? "" : $" · {apiInstanceId.Trim()}";
                return $"EC2 · {apiRegion} · {apiAvailabilityZone}{inst}";
            }

            return string.IsNullOrEmpty(apiRegion) ? "EC2 / container (AZ not reported)" : $"EC2 · {apiRegion}";
        }

        if (role == NetworkPathRole.EntryNode)
        {
            return string.IsNullOrEmpty(apiRegion)
                ? "ALB (multi-AZ when subnets span AZs)"
                : $"ALB · {apiRegion} · all enabled AZs (listener subnets)";
        }

        if (role == NetworkPathRole.Relay)
        {
            return string.IsNullOrEmpty(apiRegion) ? "Same Region (no separate relay tier)" : $"Same AWS Region · {apiRegion}";
        }

        if (role == NetworkPathRole.Destination)
        {
            return string.IsNullOrEmpty(apiRegion)
                ? "Amazon RDS (PostgreSQL)"
                : $"Amazon RDS · {apiRegion} (subnet group sets AZ / Multi-AZ)";
        }

        return configuredRegion;
    }
}
