using System;

namespace SecureChatBackend.Hubs;

public sealed class CallSignalDto
{
    public string Type { get; set; } = "";

    public string? Sdp { get; set; }

    public string? CandidateJson { get; set; }

    public string? CallId { get; set; }

    public Guid SenderId { get; set; }
}
