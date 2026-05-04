using HotChocolate;

namespace SecureChatBackend.GraphQL;

/// <summary>
/// Logs resolver exceptions so production issues (e.g. missing DB tables) are visible in docker/systemd logs
/// even when GraphQL:IncludeExceptionDetails is false for clients.
/// </summary>
public sealed class GraphQLLoggingErrorFilter(ILogger<GraphQLLoggingErrorFilter> logger) : IErrorFilter
{
    public IError OnError(IError error)
    {
        if (error.Exception is { } ex)
        {
            logger.LogError(ex, "GraphQL execution failed (path: {Path})", error.Path?.ToString() ?? "(none)");
        }

        return error;
    }
}
