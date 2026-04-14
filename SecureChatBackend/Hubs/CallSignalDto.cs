using System;

namespace SecureChatBackend.Hubs;

public sealed class CallSignalDto
{
    public string Type { get; set; } = "";

    public string? Sdp { get; set; }

    public string? CandidateJson { get; set; }

    public string? CallId { get; set; }

    /// <summary>Conversation this signal belongs to (set server-side).</summary>
    public Guid? ConversationId { get; set; }

    /// <summary>For invite: "audio" or "video".</summary>
    public string? Media { get; set; }

    public Guid SenderId { get; set; }
}
