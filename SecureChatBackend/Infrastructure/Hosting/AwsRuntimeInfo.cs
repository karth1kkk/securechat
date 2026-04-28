using System.Text.Json;

namespace SecureChatBackend.Infrastructure.Hosting;

/// <summary>
/// Resolves region and deployment labels for SecureChat Network / Path when hosted on AWS (EC2, ECS, etc.).
/// </summary>
internal static class AwsRuntimeInfo
{
    private static readonly Lazy<string?> EcsTaskArnLazy = new(LoadEcsTaskArn);

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

        var ec2 = Environment.GetEnvironmentVariable("EC2_INSTANCE_ID");
        if (!string.IsNullOrWhiteSpace(ec2))
        {
            return ec2.Trim();
        }

        return EcsTaskArnLazy.Value;
    }

    private static string? LoadEcsTaskArn()
    {
        var uri = Environment.GetEnvironmentVariable("ECS_CONTAINER_METADATA_URI_V4");
        if (string.IsNullOrWhiteSpace(uri))
        {
            return null;
        }

        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
            var taskJson = client.GetStringAsync($"{uri.TrimEnd('/')}/task").GetAwaiter().GetResult();
            using var doc = JsonDocument.Parse(taskJson);
            if (doc.RootElement.TryGetProperty("TaskARN", out var arn))
            {
                return arn.GetString();
            }

            if (doc.RootElement.TryGetProperty("TaskArn", out var arnCamel))
            {
                return arnCamel.GetString();
            }
        }
        catch
        {
            // Not on ECS or metadata unreachable — ignore.
        }

        return null;
    }
}
