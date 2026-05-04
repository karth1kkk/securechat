using System.Net.Http;
using System.Text.Json;

namespace SecureChatBackend.Infrastructure.Hosting;

internal sealed record AwsHostRuntimeSnapshot(
    string? EcsTaskArn,
    string? AvailabilityZone,
    string? Ec2InstanceId);

/// <summary>
/// Resolves region, placement AZ, and deployment labels for SecureChat Network / Path when hosted on AWS (EC2, ECS, etc.).
/// </summary>
internal static class AwsRuntimeInfo
{
    private static readonly Lazy<AwsHostRuntimeSnapshot> SnapshotLazy = new(LoadSnapshot);

    internal static AwsHostRuntimeSnapshot HostSnapshot => SnapshotLazy.Value;

    public static string? ResolveApiRegion(string? configuredApiRegion)
    {
        if (!string.IsNullOrWhiteSpace(configuredApiRegion))
        {
            return configuredApiRegion.Trim();
        }

        var r = Environment.GetEnvironmentVariable("AWS_REGION")
                ?? Environment.GetEnvironmentVariable("AWS_DEFAULT_REGION");
        return string.IsNullOrWhiteSpace(r) ? null : r.Trim();
    }

    public static string? ResolveDeploymentId(string? configuredDeploymentId)
    {
        if (!string.IsNullOrWhiteSpace(configuredDeploymentId))
        {
            return configuredDeploymentId.Trim();
        }

        var label = Environment.GetEnvironmentVariable("SECURECHAT_DEPLOYMENT_LABEL");
        if (!string.IsNullOrWhiteSpace(label))
        {
            return label.Trim();
        }

        var ec2Env = Environment.GetEnvironmentVariable("EC2_INSTANCE_ID");
        if (!string.IsNullOrWhiteSpace(ec2Env))
        {
            return ec2Env.Trim();
        }

        var snap = HostSnapshot;
        if (!string.IsNullOrWhiteSpace(snap.Ec2InstanceId))
        {
            return snap.Ec2InstanceId.Trim();
        }

        if (!string.IsNullOrWhiteSpace(snap.EcsTaskArn))
        {
            return snap.EcsTaskArn.Trim();
        }

        return null;
    }

    public static string? ResolveApiAvailabilityZone()
    {
        var az = HostSnapshot.AvailabilityZone;
        return string.IsNullOrWhiteSpace(az) ? null : az.Trim();
    }

    /// <summary>EC2 instance id for this API process when known (env or IMDS).</summary>
    public static string? ResolveApiInstanceId()
    {
        var ec2Env = Environment.GetEnvironmentVariable("EC2_INSTANCE_ID");
        if (!string.IsNullOrWhiteSpace(ec2Env))
        {
            return ec2Env.Trim();
        }

        var id = HostSnapshot.Ec2InstanceId;
        return string.IsNullOrWhiteSpace(id) ? null : id.Trim();
    }

    private static AwsHostRuntimeSnapshot LoadSnapshot()
    {
        string? ecsArn = null;
        string? az = null;
        string? instanceId = null;

        var ecsUri = Environment.GetEnvironmentVariable("ECS_CONTAINER_METADATA_URI_V4");
        if (!string.IsNullOrWhiteSpace(ecsUri))
        {
            TryLoadEcsTaskMetadata(ecsUri.Trim(), out ecsArn, out az);
        }

        if (az == null || instanceId == null)
        {
            TryLoadEc2Imds(out var imdsAz, out var imdsInstanceId);
            az ??= imdsAz;
            instanceId ??= imdsInstanceId;
        }

        return new AwsHostRuntimeSnapshot(ecsArn, az, instanceId);
    }

    private static void TryLoadEcsTaskMetadata(string ecsUriBase, out string? taskArn, out string? availabilityZone)
    {
        taskArn = null;
        availabilityZone = null;
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
            var taskJson = client.GetStringAsync($"{ecsUriBase.TrimEnd('/')}/task").GetAwaiter().GetResult();
            using var doc = JsonDocument.Parse(taskJson);
            var root = doc.RootElement;
            if (root.TryGetProperty("TaskARN", out var arn))
            {
                taskArn = arn.GetString();
            }
            else if (root.TryGetProperty("TaskArn", out var arnCamel))
            {
                taskArn = arnCamel.GetString();
            }

            if (root.TryGetProperty("AvailabilityZone", out var azEl))
            {
                availabilityZone = azEl.GetString();
            }
        }
        catch
        {
            // Not on ECS or metadata unreachable — ignore.
        }
    }

    private static void TryLoadEc2Imds(out string? availabilityZone, out string? instanceId)
    {
        availabilityZone = null;
        instanceId = null;
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
            const string imds = "http://169.254.169.254";
            using var tokenReq = new HttpRequestMessage(HttpMethod.Put, $"{imds}/latest/api/token");
            tokenReq.Headers.TryAddWithoutValidation("X-aws-ec2-metadata-token-ttl-seconds", "21600");
            var tokenRes = client.SendAsync(tokenReq).GetAwaiter().GetResult();
            if (!tokenRes.IsSuccessStatusCode)
            {
                return;
            }

            var token = tokenRes.Content.ReadAsStringAsync().GetAwaiter().GetResult().Trim();
            if (string.IsNullOrEmpty(token))
            {
                return;
            }

            availabilityZone = GetImds(client, token, "/latest/meta-data/placement/availability-zone");
            instanceId = GetImds(client, token, "/latest/meta-data/instance-id");
        }
        catch
        {
            // Not on EC2 or IMDS blocked — ignore.
        }
    }

    private static string? GetImds(HttpClient client, string token, string path)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, $"http://169.254.169.254{path}");
        req.Headers.TryAddWithoutValidation("X-aws-ec2-metadata-token", token);
        var res = client.SendAsync(req).GetAwaiter().GetResult();
        if (!res.IsSuccessStatusCode)
        {
            return null;
        }

        var text = res.Content.ReadAsStringAsync().GetAwaiter().GetResult().Trim();
        return string.IsNullOrEmpty(text) ? null : text;
    }
}
